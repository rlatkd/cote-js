-- 부채 상환(docs/architecture/data-model.md): 제한·측정값을 표시용 문자열에서 수치로.
--   "1초"/"256 MB" 같은 문자열은 사람이 읽기엔 좋지만 비교·계산이 불가하고,
--   judge 계약(contracts/proto)이 수치(ms·MB·KB)라 경계마다 파싱이 필요해진다.
--   표시 형식("1초")은 화면(web)의 관심사이므로 프론트에서 만든다.
--
-- 기존 값은 파싱해서 이관한다(개발 DB만 있더라도 마이그레이션은 데이터 보존이 원칙).

-- problem: 시간/메모리 제한
ALTER TABLE problem ADD COLUMN time_limit_ms   INT,
                    ADD COLUMN memory_limit_mb INT;

UPDATE problem SET
    -- '1초' → 1000 (소수 초 표기도 대비: '1.5초' → 1500)
    time_limit_ms = ROUND(NULLIF(regexp_replace(time_limit, '[^0-9.]', '', 'g'), '')::numeric * 1000),
    memory_limit_mb = NULLIF(regexp_replace(memory_limit, '[^0-9]', '', 'g'), '')::int;

ALTER TABLE problem ALTER COLUMN time_limit_ms   SET NOT NULL,
                    ALTER COLUMN memory_limit_mb SET NOT NULL,
                    DROP COLUMN time_limit,
                    DROP COLUMN memory_limit;

-- submission: 실행 측정값. 채점 전에는 값이 없으므로 NULL 허용
-- (기존 TEXT 스키마는 '채점 중'에도 빈 문자열을 넣어야 했다 — 없음을 표현하지 못하는 타입이었다).
ALTER TABLE submission ADD COLUMN exec_time_ms   INT,
                       ADD COLUMN memory_used_kb INT;

UPDATE submission SET
    exec_time_ms = NULLIF(regexp_replace(exec_time, '[^0-9]', '', 'g'), '')::int,
    -- 기존 표기는 MB였다 → KB로 환산(judge 계약이 KB)
    memory_used_kb = NULLIF(regexp_replace(exec_memory, '[^0-9]', '', 'g'), '')::int * 1024;

ALTER TABLE submission DROP COLUMN exec_time,
                       DROP COLUMN exec_memory;

-- 채점 결과 수용을 위한 컬럼: 제출 코드(재채점·표시용)와 채점 완료 시각,
-- 그리고 사용한 테스트 번들 참조(claim-check — 어떤 데이터로 채점했는지 추적).
ALTER TABLE submission ADD COLUMN code      TEXT,
                       ADD COLUMN judged_at TIMESTAMP;

-- 히든 테스트케이스 — 진실원은 DB(api가 코어 스키마 단일 작성자, ADR-0006).
-- judge에 보내는 MinIO 번들은 이 행들로부터 **파생**된 것이며,
-- problem.test_bundle_* 는 그 파생물의 캐시된 참조(claim-check, ADR-0009)다.
CREATE TABLE test_case (
    id         BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problem (id) ON DELETE CASCADE,
    ord        INT    NOT NULL,
    input      TEXT   NOT NULL,
    output     TEXT   NOT NULL,
    UNIQUE (problem_id, ord)
);

ALTER TABLE problem ADD COLUMN test_bundle_key    TEXT,
                    ADD COLUMN test_bundle_sha256 TEXT;
