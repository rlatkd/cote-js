/** lab2 정적 더미 — api·인프라 없이 시안을 보기 위한 값. 실데이터 배선은 채택 후. */

export type Verdict = "AC" | "WA" | "TLE" | null;

export type LabProblem = {
  id: number;
  title: string;
  tier: string;
  group: "BRONZE" | "SILVER" | "GOLD";
  rate: number;
  ai: boolean;
  verdict: Verdict;
  tags: string[];
};

export const PROBLEMS: LabProblem[] = [
  { id: 4821, title: "우주 정거장의 에코 드론 관리", tier: "SILVER I", group: "SILVER", rate: 62.4, ai: true, verdict: "WA", tags: ["BFS", "그래프 탐색"] },
  { id: 4820, title: "삼색 루미나의 신전", tier: "SILVER III", group: "SILVER", rate: 48.1, ai: true, verdict: null, tags: ["BFS", "구현"] },
  { id: 4818, title: "정수 삼각형의 최대 경로", tier: "SILVER I", group: "SILVER", rate: 57.2, ai: true, verdict: "AC", tags: ["DP"] },
  { id: 4819, title: "포탈 미로 탈출", tier: "GOLD V", group: "GOLD", rate: 31.7, ai: true, verdict: "TLE", tags: ["BFS", "다익스트라"] },
  { id: 4822, title: "은하 화물 분배", tier: "GOLD III", group: "GOLD", rate: 24.9, ai: true, verdict: null, tags: ["DP", "그리디"] },
  { id: 4823, title: "차원 도서관의 색인", tier: "GOLD IV", group: "GOLD", rate: 28.3, ai: true, verdict: null, tags: ["세그먼트 트리"] },
  { id: 4817, title: "창고 적재 순서 정하기", tier: "BRONZE I", group: "BRONZE", rate: 74.9, ai: false, verdict: "AC", tags: ["정렬", "구현"] },
  { id: 4815, title: "두 수의 합", tier: "BRONZE V", group: "BRONZE", rate: 91.2, ai: false, verdict: "AC", tags: ["구현"] },
];

export const GROUPS = ["BRONZE", "SILVER", "GOLD"] as const;

export const LANGUAGES = ["Python", "Java", "JavaScript"] as const;

export function problemById(id: number): LabProblem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}

/** 채점 현황 — 전체 공개 피드(비로그인도 본다, ADR-0019). */
export const FEED = [
  { id: 91_205, user: "@kim", problem: 4820, title: "삼색 루미나의 신전", lang: "Python", verdict: null as Verdict, progress: "2/5", ms: 0, kb: 0, at: "13:52:31" },
  { id: 91_204, user: "@sanghun", problem: 4821, title: "우주 정거장의 에코 드론 관리", lang: "Python", verdict: "WA" as Verdict, progress: "", ms: 131, kb: 31_540, at: "13:41:02" },
  { id: 91_203, user: "@lee", problem: 4817, title: "창고 적재 순서 정하기", lang: "JavaScript", verdict: "AC" as Verdict, progress: "", ms: 74, kb: 42_330, at: "13:39:55" },
  { id: 91_202, user: "@sanghun", problem: 4818, title: "정수 삼각형의 최대 경로", lang: "Python", verdict: "AC" as Verdict, progress: "", ms: 96, kb: 29_884, at: "13:31:15" },
  { id: 91_201, user: "@park", problem: 4819, title: "포탈 미로 탈출", lang: "Java", verdict: "TLE" as Verdict, progress: "", ms: 2_000, kb: 88_412, at: "13:28:40" },
  { id: 91_200, user: "@sanghun", problem: 4817, title: "창고 적재 순서 정하기", lang: "JavaScript", verdict: "AC" as Verdict, progress: "", ms: 74, kb: 42_330, at: "13:22:09" },
  { id: 91_199, user: "@choi", problem: 4815, title: "두 수의 합", lang: "Python", verdict: "AC" as Verdict, progress: "", ms: 68, kb: 29_104, at: "13:15:51" },
];

/** 내 제출 이력 — 마이페이지에만(채점 현황은 전체 전용, 2026-08-08 확정). */
export const MY_SUBMISSIONS = FEED.filter((s) => s.user === "@sanghun");

export const RANKING = [
  { rank: 1, user: "@lee", solved: 142, rate: 71.2 },
  { rank: 2, user: "@kim", solved: 97, rate: 64.8 },
  { rank: 3, user: "@park", solved: 88, rate: 59.1 },
  { rank: 4, user: "@choi", solved: 76, rate: 66.4 },
  { rank: 5, user: "@jung", solved: 71, rate: 52.9 },
  { rank: 6, user: "@yoon", solved: 64, rate: 48.2 },
  { rank: 12, user: "@sanghun", solved: 47, rate: 36.7, me: true },
];

/** 언어별 스타터 — 실제로는 api의 starter_template(V6)가 준다. */
export const STARTER: Record<string, string> = {
  Python: `import sys
from collections import deque


def solve() -> int:
    n, m = map(int, sys.stdin.readline().split())
    grid = [sys.stdin.readline().strip() for _ in range(n)]

    dist = [[-1] * m for _ in range(n)]
    q = deque([(0, 0)])
    dist[0][0] = 0

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < n and 0 <= nx < m and dist[ny][nx] < 0:
                if grid[ny][nx] != '#':
                    dist[ny][nx] = dist[y][x] + 1
                    q.append((ny, nx))

    return dist[n - 1][m - 1]


if __name__ == "__main__":
    print(solve())
`,
  Java: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int n = Integer.parseInt(st.nextToken());
        int m = Integer.parseInt(st.nextToken());

        // 여기에 풀이를 작성하세요.
        System.out.println(0);
    }
}
`,
  JavaScript: `const lines = require("fs").readFileSync(0, "utf8").split("\\n");
const [n, m] = lines[0].split(" ").map(Number);

// 여기에 풀이를 작성하세요.
console.log(0);
`,
};

export const MONACO_LANG: Record<string, string> = {
  Python: "python",
  Java: "java",
  JavaScript: "javascript",
};

/** 문제 지문 — 실제로는 api가 준다. 4821 하나만 상세히, 나머지는 자리표시. */
export const STATEMENTS: Record<number, {
  intro: string;
  detail: string;
  input: string;
  output: string;
  examples: { in: string; out: string }[];
  hiddenCount: number;
}> = {
  4821: {
    intro:
      "우주 정거장에는 에코 드론이 격자 통로를 따라 이동한다. 드론은 매 초 상하좌우 한 칸씩 움직이며, 통로가 막힌 칸(#)에는 진입할 수 없다.",
    detail:
      "정거장 관리자는 좌상단 도킹 베이에서 우하단 정비고까지 드론이 도달하는 데 걸리는 최소 시간을 알고 싶다. 도달할 수 없다면 -1을 출력한다.",
    input:
      "첫 줄에 격자의 크기 N, M이 주어진다. (1 ≤ N, M ≤ 1,000)\n이어서 N개의 줄에 걸쳐 격자가 주어진다. 빈 칸은 '.', 막힌 칸은 '#'이다.",
    output: "도달까지 걸리는 최소 시간을 출력한다. 도달할 수 없으면 -1을 출력한다.",
    examples: [
      { in: "3 4\n....\n.##.\n....", out: "5" },
      { in: "2 2\n.#\n#.", out: "-1" },
    ],
    hiddenCount: 5,
  },
};

export function statementOf(id: number) {
  return (
    STATEMENTS[id] ?? {
      intro: "이 문제의 지문은 아직 시안 데이터에 없습니다.",
      detail: "lab2는 정적 더미로 동작합니다 — 실데이터 배선은 본 서비스 적용 시.",
      input: "표준 입력으로 주어집니다.",
      output: "표준 출력으로 출력합니다.",
      examples: [{ in: "1 2", out: "3" }],
      hiddenCount: 5,
    }
  );
}

/** 검증 리포트 — 우리 제품의 차별점. */
export const VERIFICATION_STEPS = [
  { name: "생성", ok: true, detail: "모델 nemotron-3-super-120b · 0.9s · 자체 소재(복제 금지 규칙 적용)" },
  { name: "독립 풀이", ok: true, detail: "지문만 노출하고 3개 생성 — 초안의 풀이 스케치는 차단(합의가 반향이 되는 것 방지)" },
  { name: "실채점", ok: true, detail: "judge batch 레인 · Docker 격리 · 유저 제출과 동일한 채점 규칙" },
  { name: "합의 판정", ok: true, detail: "풀이 3개 중 3개가 동일 출력 해시 · 초안 예제 출력과도 일치" },
  { name: "사람 검수", ok: false, detail: "검수 대기 — 지문 명확성·난이도 적절성은 사람이 본다" },
];

export const VERIFICATION_SOLUTIONS = [
  { n: 1, lang: "Python", hash: "9f2c…a41b", ms: 96 },
  { n: 2, lang: "Java", hash: "9f2c…a41b", ms: 214 },
  { n: 3, lang: "JavaScript", hash: "9f2c…a41b", ms: 88 },
];

/** 검증 사이드바 목록 — 최근 검증된 문제들. */
export const VERIFIED_RECENT = [
  { id: 4823, title: "차원 도서관의 색인", state: "검수 대기" as const },
  { id: 4822, title: "은하 화물 분배", state: "검수 대기" as const },
  { id: 4821, title: "우주 정거장의 에코 드론 관리", state: "게시됨" as const },
  { id: 4820, title: "삼색 루미나의 신전", state: "게시됨" as const },
  { id: 4819, title: "포탈 미로 탈출", state: "게시됨" as const },
];

/** 30일 활동 — 마이페이지 스파크라인. */
export const ACTIVITY_30D = [
  0, 2, 1, 0, 4, 3, 1, 0, 0, 5, 2, 1, 3, 0, 1,
  4, 6, 2, 0, 1, 3, 2, 0, 4, 1, 2, 5, 3, 1, 2,
];
