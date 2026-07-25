-- 개발 더미데이터 (Repeatable 시드 — 2026-07-25 A안)
-- · R(반복) 마이그레이션: 파일이 바뀌면 api 기동 시 자동 재적용 → 멱등 필수(아래 DELETE 선행)
-- · dev에서만 적용: spring.flyway.locations의 db/seed 포함 여부로 제어(application.yml)

DELETE FROM submission;
DELETE FROM example;
DELETE FROM problem;

WITH sc AS (
    SELECT $starter${"Python":"import sys\ninput = sys.stdin.readline\n\ndef solve():\n    # 여기에 풀이를 작성하세요\n    pass\n\nsolve()\n","C++":"#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // 여기에 풀이를 작성하세요\n    return 0;\n}\n","Java":"import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // 여기에 풀이를 작성하세요\n    }\n}\n","JavaScript":"const input = require('fs').readFileSync(0, 'utf8').trim().split('\\n');\n\n// 여기에 풀이를 작성하세요\n"}$starter$::jsonb AS v
)
INSERT INTO problem (id, title, difficulty, tier, time_limit, memory_limit,
                     submission_count, accepted_count, tags, ai_generated,
                     description, input_desc, output_desc, starter_code)
SELECT p.*, sc.v
FROM sc CROSS JOIN (VALUES
    (1000::bigint, '두 수의 합', 'Bronze', 'Bronze V', '1초', '256 MB', 128430, 96322,
     ARRAY['구현','사칙연산'], FALSE,
     '두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.',
     '첫째 줄에 A와 B가 공백으로 구분되어 주어진다. (0 < A, B < 10)',
     '첫째 줄에 A+B를 출력한다.'),
    (2231, '분해합', 'Bronze', 'Bronze II', '2초', '192 MB', 74210, 43518,
     ARRAY['브루트포스','구현'], FALSE,
     '어떤 자연수 N이 있을 때, 그 자연수 N의 분해합은 N과 N을 이루는 각 자리수의 합을 의미한다. 어떤 자연수 M의 분해합이 N인 경우, M을 N의 생성자라 한다. 자연수 N이 주어졌을 때, N의 가장 작은 생성자를 구해내는 프로그램을 작성하시오.',
     '첫째 줄에 자연수 N(1 ≤ N ≤ 1,000,000)이 주어진다.',
     '첫째 줄에 답을 출력한다. 생성자가 없는 경우에는 0을 출력한다.'),
    (1932, '정수 삼각형', 'Silver', 'Silver I', '2초', '256 MB', 52104, 33820,
     ARRAY['다이나믹 프로그래밍'], FALSE,
     '맨 위층부터 시작해서 아래에 있는 수 중 하나를 선택하여 아래층으로 내려올 때, 이동은 대각선 왼쪽 또는 대각선 오른쪽으로만 가능하다. 선택된 수의 합이 최대가 되는 경로를 구하는 프로그램을 작성하라.',
     '첫째 줄에 삼각형의 크기 n(1 ≤ n ≤ 500)이 주어지고, 둘째 줄부터 n개의 줄에 걸쳐 삼각형이 주어진다. 각 정수는 0 이상 9999 이하이다.',
     '첫째 줄에 합이 최대가 되는 경로의 합을 출력한다.'),
    (7576, '토마토', 'Gold', 'Gold V', '1초', '256 MB', 89340, 38122,
     ARRAY['BFS','그래프 탐색'], FALSE,
     '격자 모양 상자에 담긴 토마토들 중 일부는 익었고 일부는 익지 않았다. 하루가 지나면 익은 토마토의 인접한(상하좌우) 익지 않은 토마토들이 익는다. 며칠이 지나면 상자 안의 토마토들이 모두 익게 되는지, 그 최소 일수를 구하는 프로그램을 작성하라.',
     '첫째 줄에 상자의 크기 M, N이 주어진다. 둘째 줄부터 토마토의 상태가 주어진다. (1: 익은 토마토, 0: 익지 않은 토마토, -1: 토마토가 없는 칸)',
     '모든 토마토가 익을 때까지의 최소 일수를 출력한다. 모두 익지 못하는 상황이면 -1을 출력한다.'),
    (9019, 'DSLR', 'Gold', 'Gold IV', '6초', '256 MB', 41200, 12844,
     ARRAY['BFS','그래프 탐색'], FALSE,
     '네 개의 명령어 D, S, L, R을 이용하여 레지스터에 저장된 수 A를 B로 바꾸는 최소 명령어 열을 구하는 프로그램을 작성하라.',
     '첫째 줄에 테스트 케이스의 개수 T가 주어지고, 각 테스트 케이스마다 두 정수 A, B(0 ≤ A, B < 10000)가 주어진다.',
     '각 테스트 케이스마다 A를 B로 바꾸는 최소 명령어 열을 출력한다.'),
    (100001, '정원사의 물결 정렬', 'Silver', 'Silver II', '1초', '256 MB', 842, 517,
     ARRAY['정렬','구현','그리디'], TRUE,
     '정원사 하윤은 N개의 화분을 일렬로 배치하려 한다. 각 화분에는 높이가 정해진 식물이 심겨 있으며, 하윤은 ''물결 배치''를 좋아한다. 물결 배치란 임의의 i(2 ≤ i ≤ N-1)에 대해 i번째 화분의 높이가 양옆보다 크거나(봉우리) 양옆보다 작은(골짜기) 형태가 번갈아 나타나는 배치를 말한다. 주어진 화분들을 재배치하여 물결 배치를 만들 때, 인접한 화분 높이 차의 총합이 최소가 되도록 하라.',
     '첫째 줄에 화분의 개수 N(3 ≤ N ≤ 100,000)이 주어진다. 둘째 줄에 각 화분의 높이 h_i(1 ≤ h_i ≤ 10^9)가 공백으로 구분되어 주어진다.',
     '물결 배치를 만족하는 최소 높이 차 총합을 출력한다.'),
    (100002, '캐시된 미로 탈출', 'Gold', 'Gold III', '2초', '512 MB', 401, 133,
     ARRAY['BFS','비트마스킹','그래프 탐색'], TRUE,
     '지훈이는 K개의 열쇠 색이 존재하는 미로에 갇혔다. 각 칸은 빈 칸, 벽, 특정 색의 문, 특정 색의 열쇠 중 하나이다. 문은 대응하는 색의 열쇠를 하나라도 소지하고 있으면 통과할 수 있다. 시작점에서 출구까지 이동하는 최소 이동 횟수를 구하라. 단, 이미 방문한 (위치, 보유 열쇠 집합) 상태는 다시 방문하지 않는다.',
     '첫째 줄에 미로의 크기 R, C와 열쇠 색의 수 K(1 ≤ K ≤ 6)가 주어진다. 이후 R개의 줄에 걸쳐 미로가 주어진다.',
     '출구까지의 최소 이동 횟수를 출력한다. 탈출이 불가능하면 -1을 출력한다.')
) AS p(id, title, difficulty, tier, time_limit, memory_limit,
       submission_count, accepted_count, tags, ai_generated,
       description, input_desc, output_desc);

INSERT INTO example (problem_id, ord, input, output) VALUES
    (1000, 0, '1 2', '3'),
    (1000, 1, '5 4', '9'),
    (2231, 0, '216', '198'),
    (1932, 0, E'5\n7\n3 8\n8 1 0\n2 7 4 4\n4 5 2 6 5', '30'),
    (7576, 0, E'6 4\n0 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 0\n0 0 0 0 0 1', '8'),
    (9019, 0, E'3\n1234 3412\n1000 1\n1 16', E'LL\nL\nDDDD'),
    (100001, 0, E'4\n1 3 2 4', '6'),
    (100001, 1, E'5\n5 5 5 5 5', '0'),
    (100002, 0, E'1 5 1\nS.a.E', '4');

INSERT INTO submission (username, problem_id, problem_title, result, language,
                        exec_time, exec_memory, length, submitted_at) VALUES
    ('sanghoon', 100001, '정원사의 물결 정렬', '맞았습니다', 'Python', '148 ms', '31 MB', 612, '2026-07-09 14:22:10'),
    ('sanghoon', 100001, '정원사의 물결 정렬', '틀렸습니다', 'Python', '—', '—', 588, '2026-07-09 14:19:44'),
    ('devkim', 7576, '토마토', '맞았습니다', 'C++', '92 ms', '18 MB', 1204, '2026-07-09 14:05:31'),
    ('algo_master', 9019, 'DSLR', '시간 초과', 'Java', '—', '—', 1533, '2026-07-09 13:58:12'),
    ('novice22', 1000, '두 수의 합', '맞았습니다', 'JavaScript', '76 ms', '24 MB', 142, '2026-07-09 13:50:03'),
    ('hayoon', 100002, '캐시된 미로 탈출', '런타임 에러', 'C++', '—', '—', 2011, '2026-07-09 13:41:29'),
    ('devkim', 1932, '정수 삼각형', '맞았습니다', 'Python', '104 ms', '29 MB', 402, '2026-07-09 13:30:57'),
    ('sanghoon', 100002, '캐시된 미로 탈출', '메모리 초과', 'Java', '—', '—', 1890, '2026-07-09 13:22:41'),
    ('coder_lee', 2231, '분해합', '맞았습니다', 'C++', '4 ms', '2 MB', 356, '2026-07-09 13:10:08'),
    ('novice22', 2231, '분해합', '컴파일 에러', 'Java', '—', '—', 401, '2026-07-09 13:02:55');
