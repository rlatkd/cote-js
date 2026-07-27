package com.cotejs.api.adapter.outbound.storage

import com.cotejs.api.domain.model.BundleRef
import com.cotejs.api.domain.model.TestCase
import com.cotejs.api.domain.port.outbound.BundleStore
import kotlinx.coroutines.future.await
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import software.amazon.awssdk.core.async.AsyncRequestBody
import software.amazon.awssdk.services.s3.S3AsyncClient
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import java.io.ByteArrayOutputStream
import java.security.MessageDigest

/**
 * claim-check([ADR-0009])의 **발행자** 측 — 테스트케이스를 tar.gz 번들로 묶어 올린다.
 * judge는 이 오브젝트를 키+해시로만 받아 내려받는다(메시지엔 데이터를 싣지 않는다).
 *
 * 번들 레이아웃은 judge의 executor가 기대하는 형태를 따른다: `cases/NN.in` · `cases/NN.out`.
 */
@Component
class MinioBundleStore(
    private val s3: S3AsyncClient,
    @Value("\${cotejs.storage.bucket}") private val bucket: String,
) : BundleStore {

    override suspend fun publish(problemId: Long, cases: List<TestCase>): BundleRef {
        require(cases.isNotEmpty()) { "problem $problemId has no test cases" }

        val archive = pack(cases)
        val sha = MessageDigest.getInstance("SHA-256").digest(archive)
            .joinToString("") { "%02x".format(it) }
        // 키에 해시를 넣어 오브젝트를 불변으로 만든다 — 내용이 바뀌면 새 오브젝트가 되고,
        // judge의 해시 기준 로컬 캐시가 자동으로 갱신된다.
        val key = "bundles/$sha.tgz"

        // 논블로킹 S3 클라이언트 + 코루틴 await — 스택 일관성(블로킹 SDK를 IO 디스패처로
        // 감싸는 대신 처음부터 async 클라이언트를 쓴다).
        s3.putObject(
            PutObjectRequest.builder()
                .bucket(bucket).key(key).contentType("application/gzip").build(),
            AsyncRequestBody.fromBytes(archive),
        ).await()

        return BundleRef(key = key, sha256 = sha)
    }

    /**
     * 결정적(deterministic) 패킹 — 같은 케이스 집합은 항상 같은 바이트를 만들어야 한다.
     * 그래야 해시가 안정되고 judge 캐시가 적중한다. 그래서 mtime·모드를 고정한다
     * (기본값을 쓰면 압축할 때마다 mtime이 달라져 해시가 매번 바뀐다).
     */
    private fun pack(cases: List<TestCase>): ByteArray {
        val out = ByteArrayOutputStream()
        GzipCompressorOutputStream(out).use { gz ->
            TarArchiveOutputStream(gz).use { tar ->
                cases.sortedBy { it.ord }.forEachIndexed { index, case ->
                    val no = index + 1
                    writeEntry(tar, "cases/%02d.in".format(no), case.input)
                    writeEntry(tar, "cases/%02d.out".format(no), case.output)
                }
            }
        }
        return out.toByteArray()
    }

    private fun writeEntry(tar: TarArchiveOutputStream, name: String, content: String) {
        val bytes = content.toByteArray(Charsets.UTF_8)
        val entry = TarArchiveEntry(name).apply {
            size = bytes.size.toLong()
            mode = 0b110_100_100 // 0644
            modTime = java.util.Date(0)
        }
        tar.putArchiveEntry(entry)
        tar.write(bytes)
        tar.closeArchiveEntry()
    }
}
