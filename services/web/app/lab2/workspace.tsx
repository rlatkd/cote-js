"use client";

/**
 * lab2 워크스페이스 상태 — 셸이 들고 있는 것들.
 *
 * 저장 규칙(2026-08-08 확정, engineering-notes 'lab2 — VS Code 레이아웃 차용'):
 *
 *   코드 초안  문제별·**언어별**·영구      → 계정(본 서비스) / localStorage(여기)
 *   취향/배치  테마·폭·높이·분할 비율·영구  → 계정(본 서비스) / localStorage(여기)
 *   탭 목록    **세션 한정**               → sessionStorage
 *
 * **탭이 세션 한정인 이유**: "어제 풀다 만 문제로 복귀"에서 본체는 탭이 아니라
 * **코드**다. 탭은 그걸 기억하려 띄워둔 대리 지표였고, 코드를 문제별로 저장하면
 * 탭은 영구일 필요가 없다. 덕분에 탭 무한 축적 문제와 그걸 풀려던 장치("AC 받으면
 * 자동 정리")가 통째로 불필요해졌다.
 *
 * **폭을 비율로 저장하는 이유**: 반응형이 레이아웃 *모드*를 정하고 저장값은 그
 * 모드 안의 *조정치*다. px로 저장하면 32″에서 벌린 폭이 13″에 그대로 와서 화면을
 * 먹지만, 비율+clamp면 기기 의존성이 흡수된다.
 *
 * 랩 한계(명시): 계정 동기화는 api 설정 테이블·엔드포인트가 필요하므로 여기서는
 * 브라우저 저장소만 쓴다. 서버 동기화는 본 서비스 적용 시.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ── 문서(탭) 식별 ─────────────────────────────────────────── */

/**
 * 화면은 두 층이다(2026-08-08 사용자 결정).
 *
 *   **홈**    — 문서가 아니다. "어디로 갈지 정하는 자리"라서 탭에 쌓지 않고,
 *              탭 바·하단 패널 없이 화면을 전부 쓴다. 서비스의 메인 홈.
 *   **문서**  — 보는 대상(문제·검증·목록·랭킹·마이페이지·설정). 탭에 쌓이고
 *              사이드바·패널과 함께 워크스페이스로 동작한다.
 *
 * VS Code는 Welcome조차 문서 탭이지만 우리는 IDE가 아니라 **서비스**다.
 * IDE다움은 문제 푸는 화면에서 진짜고, 홈은 서비스가 서비스인 자리다.
 */
export type Doc =
  | { kind: "home" }
  | { kind: "problems" }
  | { kind: "problem"; id: number }
  | { kind: "status" }
  | { kind: "verifications" }
  | { kind: "verification"; id: number }
  | { kind: "ranking" }
  | { kind: "me" }
  | { kind: "settings" };

/** 탭에 쌓이는가 = 문서인가. 홈만 아니다. */
export function isDocument(d: Doc): boolean {
  return d.kind !== "home";
}

const DOC_KINDS = [
  "home",
  "problems",
  "problem",
  "status",
  "verifications",
  "verification",
  "ranking",
  "me",
  "settings",
] as const;

/**
 * **저장소에서 읽은 값은 남의 입력처럼 다룬다.**
 *
 * 실제로 사고가 났다: `welcome`을 `home`으로 개명했는데 브라우저
 * sessionStorage에는 옛 `{kind:"welcome"}`이 남아 있었고, 복원되자 라벨 조회가
 * undefined를 반환해 셸 전체가 죽었다. 앱 코드와 저장된 데이터는 **다른 속도로
 * 바뀐다** — 스키마를 고치는 순간 이전 판이 필드에 남는다.
 */
function isValidDoc(v: unknown): v is Doc {
  if (!v || typeof v !== "object") return false;
  const kind = (v as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !DOC_KINDS.includes(kind as (typeof DOC_KINDS)[number])) {
    return false;
  }
  if (kind === "problem" || kind === "verification") {
    return typeof (v as { id?: unknown }).id === "number";
  }
  return true;
}

export function docKey(d: Doc): string {
  switch (d.kind) {
    case "problem":
      return `problem:${d.id}`;
    case "verification":
      return `verification:${d.id}`;
    default:
      return d.kind;
  }
}

export function docHref(d: Doc): string {
  switch (d.kind) {
    case "home":
      return "/lab2";
    case "problems":
      return "/lab2/problems";
    case "problem":
      return `/lab2/p/${d.id}`;
    case "status":
      return "/lab2/status";
    case "verifications":
      return "/lab2/verification";
    case "verification":
      return `/lab2/p/${d.id}/verification`;
    case "ranking":
      return "/lab2/ranking";
    case "me":
      return "/lab2/me";
    case "settings":
      return "/lab2/settings";
  }
}

/** URL → 문서. 라우트가 진실원이고 탭은 그 위에 쌓인다(하이브리드 라우팅). */
export function docFromPath(path: string): Doc {
  const m = /^\/lab2\/p\/(\d+)(\/verification)?$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    return m[2] ? { kind: "verification", id } : { kind: "problem", id };
  }
  if (path === "/lab2/problems") return { kind: "problems" };
  if (path === "/lab2/status") return { kind: "status" };
  if (path === "/lab2/verification") return { kind: "verifications" };
  if (path === "/lab2/ranking") return { kind: "ranking" };
  if (path === "/lab2/me") return { kind: "me" };
  if (path === "/lab2/settings") return { kind: "settings" };
  return { kind: "home" };
}

/**
 * 문서가 속한 **섹션**. 액티비티 바가 이걸로 활성 표시를 정한다.
 *
 * 액티비티를 별도 상태로 들고 있지 않는 이유(2026-08-08 ⓐ 채택): 메뉴가 **진짜
 * 링크**가 되면서 "지금 어느 섹션인가"는 URL만으로 결정된다. 상태를 따로 두면
 * 라우트와 어긋날 수 있는 두 번째 진실원이 생긴다.
 */
export function docSection(d: Doc): Activity {
  switch (d.kind) {
    case "problems":
    case "problem":
      return "explorer";
    case "status":
      return "status";
    case "verifications":
    case "verification":
      return "verification";
    case "ranking":
      return "ranking";
    case "me":
      return "me";
    case "settings":
      return "settings";
    default:
      return "home";
  }
}

/* ── 저장되는 설정 ─────────────────────────────────────────── */

export type Prefs = {
  /** 사이드바 폭 — 뷰포트 대비 비율(0.10~0.34). clamp는 렌더에서 px 하한·상한으로. */
  sidebarRatio: number;
  sidebarOpen: boolean;
  panelHeight: number;
  panelOpen: boolean;
  /** 지문/에디터 분할 — 좌측 비율(%). */
  splitLeft: number;
  language: string;
  signedIn: boolean;
};

const DEFAULT_PREFS: Prefs = {
  sidebarRatio: 0.17,
  sidebarOpen: true,
  panelHeight: 236,
  panelOpen: true,
  splitLeft: 46,
  language: "Python",
  signedIn: true,
};

export type Activity =
  | "home"
  | "explorer"
  | "status"
  | "ranking"
  | "verification"
  | "me"
  | "settings";

/** 사이드바에 띄울 목록이 있는 메뉴만. 나머지를 고르면 사이드바를 접고 화면만 연다. */
export const ACTIVITY_HAS_LIST: Record<Activity, boolean> = {
  home: false,
  explorer: true,
  status: true,
  ranking: true,
  verification: true,
  me: false,
  settings: false,
};

const PREFS_KEY = "cotejs.lab2.prefs";
const TABS_KEY = "cotejs.lab2.tabs";
const DRAFT_KEY = "cotejs.lab2.drafts";

/* ── 컨텍스트 ──────────────────────────────────────────────── */

/* ── 채점 실행 상태 ────────────────────────────────────────── */

export type CaseResult = { n: number; verdict: "AC" | "WA" | "TLE"; ms: number; kb: number };

export type Run = {
  problemId: number;
  /** run = 공개 예제만 · submit = 히든 포함 (ADR-0014) */
  mode: "run" | "submit";
  lang: string;
  total: number;
  /** 도착한 케이스만 — 실제로는 SSE로 하나씩 들어온다. */
  cases: CaseResult[];
  done: boolean;
  submissionId: number;
};

export function runVerdict(r: Run): "AC" | "WA" | "TLE" | null {
  if (!r.done) return null;
  const bad = r.cases.find((c) => c.verdict !== "AC");
  return bad ? bad.verdict : "AC";
}

type Ctx = {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
  tabs: Doc[];
  closeTab: (key: string) => void;
  /** 문제별·언어별 코드 초안. */
  draft: (problemId: number, lang: string) => string | undefined;
  setDraft: (problemId: number, lang: string, code: string) => void;
  /** 저장소에서 값을 읽어오기 전에는 true — 깜빡임 방지용. */
  hydrated: boolean;
  /** 지금 돌고 있거나 방금 끝난 채점. 패널·상태바가 이걸 그린다. */
  run: Run | null;
  startRun: (problemId: number, mode: "run" | "submit", lang: string) => void;
  panelTab: number;
  setPanelTab: (i: number) => void;
  /** 제출은 로그인 필수(ADR-0019) — 비로그인 클릭 시 안내를 띄운다. */
  authNotice: boolean;
  setAuthNotice: (v: boolean) => void;
};

const WorkspaceCtx = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace는 WorkspaceProvider 안에서만 쓸 수 있다");
  return ctx;
}

export function WorkspaceProvider({
  currentDoc,
  children,
}: {
  currentDoc: Doc;
  children: React.ReactNode;
}) {
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [tabs, setTabs] = useState<Doc[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // 최초 1회 복원. SSR과 값이 달라 깜빡이는 걸 막으려 hydrated 전에는 기본값으로 그린다.
  useEffect(() => {
    try {
      const p = localStorage.getItem(PREFS_KEY);
      if (p) setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(p) } as Prefs);

      const t = sessionStorage.getItem(TABS_KEY);
      if (t) {
        const parsed: unknown = JSON.parse(t);
        // 모르는 종류는 조용히 버린다 — 하나 때문에 셸 전체가 죽는 것보다 낫다
        setTabs(Array.isArray(parsed) ? parsed.filter(isValidDoc).filter(isDocument) : []);
      }

      const d = localStorage.getItem(DRAFT_KEY);
      if (d) {
        const parsed: unknown = JSON.parse(d);
        if (parsed && typeof parsed === "object") setDrafts(parsed as Record<string, string>);
      }
    } catch {
      // 저장소가 막혀 있거나(사파리 프라이빗) 값이 깨졌으면 기본값으로 간다.
    }
    setHydrated(true);
  }, []);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((prev) => {
      // **값이 같으면 같은 참조를 돌려준다.** 안 그러면 매번 새 객체가 나와
      // 컨텍스트가 갱신되고 전 구독자가 리렌더된다. PanelGroup의 onLayout처럼
      // "배치가 바뀔 때마다 저장"하는 호출부와 만나면 그대로 무한 루프가 된다
      // (onLayout → setPrefs → 리렌더 → 재배치 → onLayout …).
      const changed = (Object.keys(patch) as (keyof Prefs)[]).some(
        (k) => patch[k] !== undefined && patch[k] !== prev[k],
      );
      if (!changed) return prev;

      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // 라우트가 바뀌면 탭에 추가한다 — URL이 진실원이고 탭은 그 흔적이다.
  // **홈은 제외**: 문서가 아니라 화면이라 탭에 쌓지 않는다.
  useEffect(() => {
    if (!hydrated || !isDocument(currentDoc)) return;
    setTabs((prev) => {
      if (prev.some((t) => docKey(t) === docKey(currentDoc))) return prev;
      const next = [...prev, currentDoc];
      try {
        sessionStorage.setItem(TABS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [currentDoc, hydrated]);

  // 전부 닫으면 탭이 빈다 — 그때는 홈으로 보낸다(호출부가 처리).
  const closeTab = useCallback((key: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => docKey(t) !== key);
      try {
        sessionStorage.setItem(TABS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const draftKey = (id: number, lang: string) => `${id}:${lang}`;

  const draft = useCallback(
    (id: number, lang: string) => drafts[draftKey(id, lang)],
    [drafts],
  );

  const setDraft = useCallback((id: number, lang: string, code: string) => {
    setDrafts((prev) => {
      const next = { ...prev, [draftKey(id, lang)]: code };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  /* ── 채점 실행(시안) ─────────────────────────────────────
     실제로는 제출 → Kafka → judge → 결과 토픽 → api → **SSE로 케이스가 하나씩**
     도착한다. 랩에는 백엔드가 없으므로 그 도착 패턴만 타이머로 흉내낸다.
     흉내내는 대상이 "우리가 실제로 가진 것"이라 코스프레가 아니다 —
     이 화면이 우리 제품에서 가장 중요한 순간인데 1차 시안엔 없었다. */
  const [run, setRun] = useState<Run | null>(null);
  const [panelTab, setPanelTab] = useState(0);
  const [authNotice, setAuthNotice] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const startRun = useCallback(
    (problemId: number, mode: "run" | "submit", lang: string) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];

      // run은 공개 예제만, submit은 히든까지 (ADR-0014)
      const total = mode === "run" ? 2 : 5;
      const submissionId = 91_206;
      setRun({ problemId, mode, lang, total, cases: [], done: false, submissionId });
      setPanelTab(0);

      for (let i = 1; i <= total; i++) {
        timers.current.push(
          setTimeout(() => {
            setRun((prev) => {
              if (!prev || prev.submissionId !== submissionId) return prev;
              // 3번 케이스에서 틀리는 시나리오(제출 모드에서만 — 예제는 통과한다)
              const verdict: CaseResult["verdict"] =
                mode === "submit" && i === 3 ? "WA" : "AC";
              const cases = [
                ...prev.cases,
                { n: i, verdict, ms: 110 + i * 6, kb: 30_900 + i * 140 },
              ];
              return { ...prev, cases, done: cases.length === total };
            });
          }, 420 * i),
        );
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      prefs,
      setPrefs,
      tabs,
      closeTab,
      draft,
      setDraft,
      hydrated,
      run,
      startRun,
      panelTab,
      setPanelTab,
      authNotice,
      setAuthNotice,
    }),
    [prefs, setPrefs, tabs, closeTab, draft, setDraft, hydrated, run, startRun, panelTab, authNotice],
  );

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}
