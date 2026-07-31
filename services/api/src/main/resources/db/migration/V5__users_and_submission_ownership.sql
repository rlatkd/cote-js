-- V5: 인증 도입(ADR-0019) — users 테이블 + 제출 소유자(user_id)
-- 제출은 로그인 필수 정책이므로 submission.user_id NOT NULL이 스키마 불변식이다.
-- 기존 픽스처 제출은 시드 유저에 귀속한다(사용자 결정 (a), 2026-07-30).

CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    provider    VARCHAR(20)  NOT NULL, -- 'kakao' (후속 프로바이더 추가 대비) / 'seed'(개발 픽스처 전용)
    provider_id VARCHAR(100) NOT NULL, -- OIDC id_token의 sub (프로바이더 안에서 불변·유일)
    nickname    VARCHAR(100) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'USER', -- USER | ADMIN (M3 검수 UI 대비 선반영)
    created_at  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_id)
);

ALTER TABLE submission
    ADD COLUMN user_id BIGINT REFERENCES users (id);

-- 주인 없는 제출(개발 DB의 픽스처)이 있을 때만 시드 유저를 만들어 귀속.
-- 운영(빈 DB)에서는 아무 행도 만들지 않는다 — 조건 없는 더미 유저 생성 금지.
DO $mig$
BEGIN
    IF EXISTS (SELECT 1 FROM submission WHERE user_id IS NULL) THEN
        INSERT INTO users (provider, provider_id, nickname)
        SELECT 'seed', s.username, s.username
        FROM (SELECT DISTINCT username FROM submission WHERE user_id IS NULL) s
        ON CONFLICT (provider, provider_id) DO NOTHING;

        UPDATE submission
        SET user_id = u.id
        FROM users u
        WHERE u.provider = 'seed'
          AND u.provider_id = submission.username
          AND submission.user_id IS NULL;
    END IF;
END
$mig$;

ALTER TABLE submission
    ALTER COLUMN user_id SET NOT NULL;
