-- 코어 스키마 (소유자: hub — ADR-0006 단일 작성자 원칙)
-- 알려진 부채(docs/architecture/data-model.md): time/memory 문자열, problem_title 비정규화, username 문자열.

CREATE TABLE problem (
    id               BIGINT PRIMARY KEY, -- 백준식 문제 번호(수동 발급)
    title            TEXT        NOT NULL,
    difficulty       TEXT        NOT NULL,
    tier             TEXT        NOT NULL,
    time_limit       TEXT        NOT NULL,
    memory_limit     TEXT        NOT NULL,
    submission_count INT         NOT NULL DEFAULT 0,
    accepted_count   INT         NOT NULL DEFAULT 0,
    tags             TEXT[]      NOT NULL DEFAULT '{}',
    ai_generated     BOOLEAN     NOT NULL DEFAULT FALSE,
    description      TEXT        NOT NULL,
    input_desc       TEXT        NOT NULL,
    output_desc      TEXT        NOT NULL,
    starter_code     JSONB       NOT NULL,
    created_at       TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE TABLE example (
    id         BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problem (id) ON DELETE CASCADE,
    ord        INT    NOT NULL,
    input      TEXT   NOT NULL,
    output     TEXT   NOT NULL
);

CREATE INDEX idx_example_problem ON example (problem_id);

CREATE TABLE submission (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT      NOT NULL,
    problem_id    BIGINT    NOT NULL REFERENCES problem (id),
    problem_title TEXT      NOT NULL,
    result        TEXT      NOT NULL,
    language      TEXT      NOT NULL,
    exec_time     TEXT      NOT NULL,
    exec_memory   TEXT      NOT NULL,
    length        INT       NOT NULL,
    submitted_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_submission_problem ON submission (problem_id);
CREATE INDEX idx_submission_submitted_at ON submission (submitted_at DESC);
