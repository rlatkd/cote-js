-- run 레인(예제 실행) + 케이스별 채점 결과.
--
-- ① 실행 모드: 같은 채점기를 쓰지만 "예제 실행"과 "정식 제출"은 성격이 다르다
--    (전자는 시험 삼아 돌려보는 것, 후자는 기록에 남는 것). QoS 레인도 이 값으로 갈린다.
--    기존 행은 전부 정식 제출이므로 기본값 'submit'.
ALTER TABLE submission ADD COLUMN mode TEXT NOT NULL DEFAULT 'submit';

-- 채점 현황·문제 통계는 정식 제출만 센다 → 그 조회를 위한 인덱스.
CREATE INDEX idx_submission_mode_submitted_at ON submission (mode, submitted_at DESC);

-- ② 예제 번들: run 레인은 **공개 예제**(example)로 채점한다. 히든 케이스로 돌리면
--    사용자가 예제 실행만으로 히든 데이터를 역추적할 수 있다.
--    test_bundle_* 와 같은 claim-check 참조 캐시 구조.
ALTER TABLE problem ADD COLUMN example_bundle_key    TEXT,
                    ADD COLUMN example_bundle_sha256 TEXT;

-- ③ 케이스별 결과: judge는 이미 케이스별 판정을 보내는데 지금까지 종합만 저장하고 버렸다.
--    "몇 번 케이스에서 틀렸나"가 학습 플랫폼의 핵심 피드백이라 보존한다.
CREATE TABLE submission_case (
    id             BIGSERIAL PRIMARY KEY,
    submission_id  BIGINT NOT NULL REFERENCES submission (id) ON DELETE CASCADE,
    no             INT    NOT NULL,
    result         TEXT   NOT NULL,
    exec_time_ms   INT,
    memory_used_kb INT,
    -- 같은 제출의 같은 케이스는 하나뿐 — 중복 결과가 와도 늘어나지 않는다.
    -- (반영은 "해당 제출의 케이스 전부 삭제 후 삽입"이라 at-least-once에서 멱등)
    UNIQUE (submission_id, no)
);
