package com.cotejs.api.config

import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.Producer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.common.serialization.ByteArrayDeserializer
import org.apache.kafka.common.serialization.ByteArraySerializer
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.kafka.common.serialization.StringSerializer
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3AsyncClient
import software.amazon.awssdk.services.s3.S3Configuration
import java.net.URI
import java.util.Properties

/**
 * judge 파이프라인 연결 설정 — Kafka 제출/결과 토픽 + 테스트 번들 스토리지(S3 호환).
 *
 * **Kafka 클라이언트를 직접 쓰는 이유([ADR-0012])**: reactor-kafka는 kafka-clients 3.9
 * 기준이라 Boot 4의 kafka-clients 4.x와 바이너리 비호환이고(런타임 NoSuchMethodError),
 * spring-kafka의 `@KafkaListener`는 스레드 점유형이라 코루틴 스택과 어긋난다.
 * 자바 프로듀서는 이미 콜백 기반 비동기라 코루틴으로 감싸면 그대로 suspend가 된다.
 */
@Configuration
class JudgePipelineConfig {

    @Bean(destroyMethod = "close")
    fun judgeProducer(
        @Value("\${cotejs.kafka.brokers}") brokers: String,
    ): Producer<String, ByteArray> = KafkaProducer(
        Properties().apply {
            put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, brokers)
            put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer::class.java.name)
            put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer::class.java.name)
            // 발행 확인은 전 복제본 + 멱등 프로듀서 — 제출이 조용히 사라지지 않게(ADR-0011)
            put(ProducerConfig.ACKS_CONFIG, "all")
            put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true)
        },
    )

    // 이름은 컴포넌트 클래스(JudgeResultConsumer)와 겹치지 않게 둔다 — 겹치면 빈 정의 충돌.
    /** 결과 소비자. `poll()`이 블로킹이라 전용 디스패처에서 돌린다(JudgeResultConsumer). */
    @Bean(destroyMethod = "close")
    fun judgeResultKafkaConsumer(
        @Value("\${cotejs.kafka.brokers}") brokers: String,
        @Value("\${cotejs.kafka.group}") group: String,
    ): KafkaConsumer<String, ByteArray> = KafkaConsumer(
        Properties().apply {
            put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, brokers)
            put(ConsumerConfig.GROUP_ID_CONFIG, group)
            put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer::class.java.name)
            put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ByteArrayDeserializer::class.java.name)
            put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest")
            // 저장을 마친 뒤 수동 커밋(at-least-once) — judge 쪽과 같은 규율.
            put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false)
        },
    )

    /**
     * S3 호환 클라이언트 — 로컬은 MinIO, 배포 시 엔드포인트만 실제 S3로 바뀐다.
     * MinIO는 가상 호스트 주소(bucket.host)를 쓰지 않으므로 path-style을 강제한다.
     */
    @Bean
    fun s3AsyncClient(
        @Value("\${cotejs.storage.endpoint}") endpoint: String,
        @Value("\${cotejs.storage.access-key}") accessKey: String,
        @Value("\${cotejs.storage.secret-key}") secretKey: String,
        @Value("\${cotejs.storage.region}") region: String,
    ): S3AsyncClient = S3AsyncClient.builder()
        .endpointOverride(URI.create(endpoint))
        .credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)),
        )
        .region(Region.of(region))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build()
}
