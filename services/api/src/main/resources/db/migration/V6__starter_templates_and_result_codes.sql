-- V6: 데이터 부채 상환(ADR-0020)
--   ① 스타터 코드: 언어별 공용 템플릿(starter_template) + 문제별 오버라이드(problem.starter_code, nullable)
--   ② result 저장값: 한국어 라벨 → enum name (표시 라벨은 API 경계에서만)
--   ③ submission.problem_title 비정규화 제거 (조회 시 problem 조인)

-- ① 언어별 공용 템플릿 — api 소유 서빙 데이터(채점 지식이 아니므로 judge 레지스트리와 분리)
CREATE TABLE starter_template (
    language VARCHAR(20) PRIMARY KEY, -- api Language enum의 label ('Python' 등)
    code     TEXT NOT NULL
);

INSERT INTO starter_template (language, code) VALUES
    ('Python', $tpl$import sys
input = sys.stdin.readline

def solve():
    # 여기에 풀이를 작성하세요
    pass

solve()
$tpl$),
    ('Java', $tpl$import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // 여기에 풀이를 작성하세요
    }
}
$tpl$),
    ('JavaScript', $tpl$const input = require('fs').readFileSync(0, 'utf8').trim().split('\n');

// 여기에 풀이를 작성하세요
$tpl$);

-- 기존 problem.starter_code는 전부 위 공용 템플릿과 동일한 복제본이었다(부채 ⑥의 증상).
-- 오버라이드로 재정의하며 비운다 — 문제 고유 템플릿이 생기면 그때 이 컬럼에만 넣는다.
ALTER TABLE problem ALTER COLUMN starter_code DROP NOT NULL;
UPDATE problem SET starter_code = NULL;

-- ② result: 라벨 → enum name (submission + submission_case 동일 매핑)
UPDATE submission SET result = CASE result
    WHEN '맞았습니다' THEN 'ACCEPTED'
    WHEN '틀렸습니다' THEN 'WRONG_ANSWER'
    WHEN '시간 초과' THEN 'TIME_LIMIT'
    WHEN '메모리 초과' THEN 'MEMORY_LIMIT'
    WHEN '런타임 에러' THEN 'RUNTIME_ERROR'
    WHEN '컴파일 에러' THEN 'COMPILE_ERROR'
    WHEN '채점 중' THEN 'PENDING'
    WHEN '채점 오류' THEN 'INTERNAL_ERROR'
    ELSE result END;

UPDATE submission_case SET result = CASE result
    WHEN '맞았습니다' THEN 'ACCEPTED'
    WHEN '틀렸습니다' THEN 'WRONG_ANSWER'
    WHEN '시간 초과' THEN 'TIME_LIMIT'
    WHEN '메모리 초과' THEN 'MEMORY_LIMIT'
    WHEN '런타임 에러' THEN 'RUNTIME_ERROR'
    WHEN '컴파일 에러' THEN 'COMPILE_ERROR'
    WHEN '채점 중' THEN 'PENDING'
    WHEN '채점 오류' THEN 'INTERNAL_ERROR'
    ELSE result END;

-- ③ 제목 비정규화 제거 — 문제 제목이 바뀌면 과거 제출이 옛 제목을 보이던 소지 제거
ALTER TABLE submission DROP COLUMN problem_title;
