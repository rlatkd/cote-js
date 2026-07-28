-- 시각을 UTC 절대시각으로 통일한다 (부채 상환 — ADR-0012에서 겪은 9시간 어긋남의 근본 해결).
--
-- 문제였던 것: `TIMESTAMP`(존 없음)은 "몇 시"만 담고 "어디의 몇 시"를 담지 못한다.
-- judge는 UTC로 보내고 api는 로컬 시각을 넣으니, 같은 행의 submitted_at/judged_at이 어긋났다.
-- 각 서비스는 내부적으로 일관됐고 **경계를 넘을 때만** 깨진 전형적인 사례.
--
-- 해법: 저장을 `timestamptz`(절대시각)로 바꾸고 표시에서만 지역 시간으로 변환한다.
-- 기존 값은 로컬(Asia/Seoul)로 기록돼 있었으므로 그 존을 명시해 UTC로 환산한다.

ALTER TABLE problem
    ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'Asia/Seoul';

ALTER TABLE submission
    ALTER COLUMN submitted_at TYPE timestamptz USING submitted_at AT TIME ZONE 'Asia/Seoul',
    ALTER COLUMN judged_at    TYPE timestamptz USING judged_at    AT TIME ZONE 'Asia/Seoul';
