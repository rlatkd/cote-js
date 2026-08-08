"use client";

/**
 * lab2 셸 — VS Code 크롬 전체. **레이아웃이라 라우트가 바뀌어도 리마운트되지 않는다.**
 *
 * 이게 하이브리드 라우팅의 핵심이다(engineering-notes 'lab2 — VS Code 레이아웃 차용'):
 * URL은 활성 문서 하나를 가리키고, 탭 집합·사이드바 상태·코드 초안은 이 레이아웃이
 * 들고 있는다. 그래서 **링크 공유·SEO·뒤로가기를 잃지 않으면서** 워크스페이스처럼
 * 동작한다. 대가는 페이지 언마운트로 Monaco가 재마운트되는 것(초안은 여기 보관).
 *
 * VS Code 골격 → 우리 도메인:
 *   타이틀바    로고 + **점프 검색**(커맨드 팔레트 아님) + 세션
 *   액티비티바  **메뉴 전체**. 사이드바 내용만 바꾸고 에디터는 건드리지 않는다.
 *               목록 없는 메뉴(마이페이지·설정)는 사이드바를 접고 문서만 연다.
 *   사이드바    선택된 메뉴의 목록 (드래그로 폭 조절, 비율로 저장)
 *   탭 바       열어둔 문서들 (세션 한정)
 *   패널        실행 결과 / 테스트 케이스 / 제출 기록  ← "터미널" 없음(우리는 터미널이 없다)
 *   상태 바     **파란 띠 없음**(Cursor식 응용) — 크롬과 같은 색
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Files,
  ListChecks,
  Trophy,
  ShieldCheck,
  CircleUser,
  Settings,
  Search,
  ChevronRight,
  X,
  PanelBottom,
  PanelLeft,
  Circle,
  CheckCircle2,
  FileText,
  Table2,
} from "lucide-react";
import { TOKENS, PASS, FAIL, WARN, sidebarWidth } from "./theme";
import { PROBLEMS, problemById } from "./data";
import Sidebar from "./Sidebar";
import JumpSearch from "./JumpSearch";
import PanelContent from "./PanelContent";
import {
  ACTIVITY_HAS_LIST,
  WorkspaceProvider,
  docFromPath,
  docHref,
  docKey,
  docSection,
  runVerdict,
  useWorkspace,
  type Activity,
  type Doc,
} from "./workspace";

/**
 * 액티비티 바 = 메뉴. **전부 진짜 링크다**(2026-08-08 ⓐ 채택).
 *
 * 버튼이었을 때 문제가 셋이었다: ① 크롤러가 따라갈 수 없어 SEO 경로가 끊긴다
 * ② 웹에서 메뉴를 눌렀는데 화면이 안 바뀌면 "반응이 없다"로 읽힌다 ③ ⌘+클릭 같은
 * 브라우저 기본 동작이 없다. 링크로 만들려면 **메뉴마다 대표 문서**가 있어야 해서
 * 채점 현황·검증 문서를 신설했고, 그 결과 모든 섹션이 "사이드바 목록 + 대표 문서"로
 * 균일해졌다.
 *
 * 단, **이미 그 섹션 안에 있으면 이동하지 않고 사이드바만 연다** — 문제를 풀던 중에
 * 트리를 보려고 눌렀는데 목록으로 튕겨나가면 안 되기 때문이다.
 */
const MENU: { key: Activity; icon: typeof Files; label: string; href: string }[] = [
  // 홈이 최상단. 목록이 없으므로 사이드바는 접히고, 화면 전체를 쓴다(탭·패널 없음).
  { key: "home", icon: Home, label: "홈", href: "/lab2" },
  { key: "explorer", icon: Files, label: "문제", href: "/lab2/problems" },
  { key: "status", icon: ListChecks, label: "채점 현황", href: "/lab2/status" },
  { key: "ranking", icon: Trophy, label: "랭킹", href: "/lab2/ranking" },
  { key: "verification", icon: ShieldCheck, label: "검증", href: "/lab2/verification" },
  { key: "me", icon: CircleUser, label: "마이페이지", href: "/lab2/me" },
];

/**
 * 셸은 client다(상태를 들고 있어야 하니까). 하지만 **`children`으로 들어오는 각
 * 문서 page는 server 컴포넌트여도 된다** — Next에서 client 컴포넌트의 children은
 * 이미 렌더된 요소로 전달되기 때문이다.
 *
 * 이 분리가 SEO의 핵심이다: `"use client"`인 파일은 `metadata`·`generateMetadata`를
 * export할 수 없어서, 페이지 전체를 client로 두면 **문제마다 제목·설명을 줄 수 없다.**
 * 문제 상세가 우리 검색 자산의 거의 전부인데 거기가 비게 된다.
 */
export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const doc = useMemo(() => docFromPath(pathname), [pathname]);

  return (
    <WorkspaceProvider currentDoc={doc}>
      <Shell doc={doc}>{children}</Shell>
    </WorkspaceProvider>
  );
}

function Shell({ doc, children }: { doc: Doc; children: React.ReactNode }) {
  const router = useRouter();
  const { prefs, setPrefs, tabs, closeTab, hydrated } = useWorkspace();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [viewport, setViewport] = useState(1440);
  const shellRef = useRef<HTMLDivElement>(null);

  const activeId = "id" in doc ? doc.id : undefined;
  const width = sidebarWidth(prefs.sidebarRatio, viewport);
  const isHome = doc.kind === "home";
  // 활성 메뉴는 URL에서 파생한다 — 별도 상태를 두면 라우트와 어긋날 수 있다.
  const section = docSection(doc);

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* 사이드바 드래그 리사이즈 — 놓을 때 한 번만 저장한다(드래그 중 매 픽셀 저장 금지). */
  const dragging = useRef(false);
  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const px = ev.clientX - 48; // 액티비티 바 폭만큼 뺀다
        setPrefs({ sidebarRatio: px / window.innerWidth });
      };
      const onUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [setPrefs],
  );

  /**
   * 이미 그 섹션 안에 있으면 이동을 막고 사이드바만 연다(같은 메뉴 재클릭 = 토글).
   * 다른 섹션이면 막지 않는다 — Link가 그대로 이동시킨다.
   * ⌘+클릭·가운데 클릭은 preventDefault를 걸지 않아 브라우저 기본 동작이 살아 있다.
   */
  const onMenuClick = (e: React.MouseEvent, key: Activity) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (section !== key) return;
    e.preventDefault();
    if (ACTIVITY_HAS_LIST[key]) setPrefs({ sidebarOpen: !prefs.sidebarOpen });
  };

  return (
    <div
      ref={shellRef}
      style={TOKENS as React.CSSProperties}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-surface font-sans text-[13px] text-fg antialiased"
    >
      {/* ── 타이틀 바 ───────────────────────────────────────── */}
      <header className="flex h-[35px] shrink-0 items-center border-b border-border bg-surface px-2">
        <Link href="/lab2" className="flex items-center gap-2 px-2 font-mono text-[13px]">
          <span className="inline-block h-[11px] w-[11px] bg-brand" />
          <span className="text-fg">cote.js</span>
        </Link>

        {/* 점프 검색 — 세 가지 검색 중 셋째. **커맨드 팔레트가 아니다**:
            단축키 배지도, 명령 접두어도 없다. 문제만 나온다. */}
        <button
          onClick={() => setJumpOpen(true)}
          className="mx-auto flex h-[22px] w-[min(38vw,460px)] items-center gap-2 border border-border bg-elevated px-2 text-[12px] text-faint transition-colors hover:border-border-strong hover:text-muted"
        >
          <Search size={12} />
          <span className="truncate">문제 번호 또는 제목</span>
        </button>

        {/* 우측은 세션만. 레이아웃 조작은 상태바 구석에 모았다 —
            패널·사이드바가 둘 다 화면 가장자리에 있어 공간적으로 맞고,
            "결과 다 봤으니 접는다"는 저빈도 조작이라 구석이 제자리다. */}
        <div className="flex items-center px-2 text-[12px] text-muted">
          {prefs.signedIn ? (
            <button
              onClick={() => setPrefs({ signedIn: false })}
              className="font-mono transition-colors hover:text-fg"
              title="랩 전용 — 비로그인 화면 보기"
            >
              @sanghun
            </button>
          ) : (
            <button
              onClick={() => setPrefs({ signedIn: true })}
              className="transition-colors hover:text-fg"
            >
              로그인
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── 액티비티 바 = 메뉴 전체 ───────────────────────── */}
        <nav className="flex w-12 shrink-0 flex-col items-center border-r border-border bg-surface py-1.5">
          {MENU.map((m) => (
            <MenuLink
              key={m.key}
              href={m.href}
              label={m.label}
              icon={m.icon}
              active={section === m.key}
              onClick={(e) => onMenuClick(e, m.key)}
            />
          ))}
          <div className="mt-auto mb-1">
            <MenuLink
              href="/lab2/settings"
              label="설정"
              icon={Settings}
              active={section === "settings"}
              onClick={(e) => onMenuClick(e, "settings")}
            />
          </div>
        </nav>

        {/* ── 사이드 바 (드래그 리사이즈) ────────────────────── */}
        {prefs.sidebarOpen && ACTIVITY_HAS_LIST[section] && (
          <>
            <aside
              className="shrink-0 overflow-hidden bg-surface"
              style={{ width: hydrated ? width : 240 }}
            >
              <Sidebar activity={section} activeId={activeId} />
            </aside>
            {/* 드래그 핸들 — VS Code처럼 경계선 자체가 손잡이다 */}
            <div
              onMouseDown={startDrag}
              className="w-px shrink-0 cursor-col-resize bg-border transition-colors hover:bg-brand"
              style={{ boxShadow: "0 0 0 2px transparent" }}
            />
          </>
        )}

        {/* ── 화면 영역 ─────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col border-l border-border bg-bg">
          {/* 홈은 문서가 아니라 **화면**이라 탭 바·브레드크럼·패널이 붙지 않는다.
              그 크롬을 다 떼야 대시보드가 쓸 공간이 나오고, 홈에서 "실행 결과"
              패널은 의미도 없다(문제를 풀고 있는 게 아니다). */}
          {isHome ? (
            <div className="min-h-0 flex-1 overflow-hidden bg-bg">{children}</div>
          ) : (
            <>
              <div className="flex h-[35px] shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface">
                {tabs.map((t) => (
                  <Tab
                    key={docKey(t)}
                    doc={t}
                    active={docKey(t) === docKey(doc)}
                    onClose={() => {
                      const wasActive = docKey(t) === docKey(doc);
                      closeTab(docKey(t));
                      if (wasActive) {
                        const rest = tabs.filter((x) => docKey(x) !== docKey(t));
                        // 마지막 탭을 닫으면 갈 곳은 홈이다
                        router.push(docHref(rest[rest.length - 1] ?? { kind: "home" }));
                      }
                    }}
                  />
                ))}
              </div>

              <Breadcrumb doc={doc} />

              <div className="min-h-0 flex-1 overflow-hidden bg-bg">{children}</div>

              <Panel doc={doc} />
            </>
          )}
        </div>
      </div>

      {/* ── 상태 바 — 파란 띠 없음 ────────────────────────────── */}
      <StatusBar doc={doc} isHome={isHome} />

      {jumpOpen && <JumpSearch onClose={() => setJumpOpen(false)} />}
      <AuthNotice />
    </div>
  );
}

/** 액티비티 바 항목 — 진짜 `<a href>`라 크롤러가 따라가고 ⌘+클릭도 동작한다. */
function MenuLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof Files;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`relative flex h-12 w-12 items-center justify-center transition-colors ${
        active ? "text-fg" : "text-faint hover:text-muted"
      }`}
    >
      {/* 활성 표시 = 좌측 2px 앰버. VS Code는 흰 선, 우리는 액센트로. */}
      {active && <span className="absolute left-0 top-0 h-full w-[2px] bg-brand" />}
      <Icon size={20} strokeWidth={1.5} />
    </Link>
  );
}

/* ── 탭 ────────────────────────────────────────────────────── */

function tabLabel(d: Doc): { text: string; icon: typeof FileText; mono: boolean } {
  switch (d.kind) {
    case "home":
      // 홈은 탭에 안 쌓이므로 여기 오지 않는다(타입 완전성용).
      return { text: "홈", icon: Home, mono: false };
    case "problems":
      return { text: "문제 목록", icon: Table2, mono: false };
    case "status":
      return { text: "채점 현황", icon: ListChecks, mono: false };
    case "verifications":
      return { text: "검증", icon: ShieldCheck, mono: false };
    case "problem": {
      const p = problemById(d.id);
      return { text: `${d.id} ${p?.title ?? ""}`, icon: FileText, mono: true };
    }
    case "verification": {
      const p = problemById(d.id);
      return { text: `검증: ${d.id} ${p?.title ?? ""}`, icon: ShieldCheck, mono: true };
    }
    case "ranking":
      return { text: "랭킹", icon: Trophy, mono: false };
    case "me":
      return { text: "마이페이지", icon: CircleUser, mono: false };
    case "settings":
      return { text: "설정", icon: Settings, mono: false };
  }
}

function Tab({ doc, active, onClose }: { doc: Doc; active: boolean; onClose: () => void }) {
  const { text, icon: Icon, mono } = tabLabel(doc);
  return (
    <div
      className={`group relative flex max-w-[240px] shrink-0 items-center border-r border-border transition-colors ${
        active ? "bg-bg text-fg" : "bg-surface text-faint hover:text-muted"
      }`}
    >
      {/* 활성 탭 상단 라인 — VS Code는 파랑, 우리는 앰버 */}
      {active && <span className="absolute left-0 top-0 h-[1px] w-full bg-brand" />}
      <Link href={docHref(doc)} className="flex min-w-0 items-center gap-2 py-0 pl-3 pr-1">
        <Icon size={13} className="shrink-0" strokeWidth={1.5} />
        <span className={`truncate text-[13px] ${mono ? "font-mono text-[12px]" : ""}`}>
          {text}
        </span>
      </Link>
      <button
        onClick={onClose}
        className={`mr-1.5 shrink-0 p-0.5 transition-opacity hover:bg-elevated ${
          active ? "opacity-60" : "opacity-0 group-hover:opacity-60"
        }`}
        title="닫기"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ── 브레드크럼 ────────────────────────────────────────────── */

function Breadcrumb({ doc }: { doc: Doc }) {
  const parts = useMemo(() => {
    switch (doc.kind) {
      case "problem": {
        const p = problemById(doc.id);
        return p ? ["problems", p.group, `${p.id} ${p.title}`] : null;
      }
      case "verification": {
        const p = problemById(doc.id);
        return p ? ["verification", `${p.id} ${p.title}`] : null;
      }
      case "problems":
        return ["problems", "전체"];
      case "status":
        return ["submissions", "전체"];
      case "verifications":
        return ["verification", "전체"];
      case "ranking":
        return ["ranking", "주간"];
      case "me":
        return ["me", "@sanghun"];
      case "settings":
        return ["settings"];
      default:
        return null;
    }
  }, [doc]);

  if (!parts) return null;

  return (
    <div className="flex h-[22px] shrink-0 items-center gap-1.5 bg-bg px-4 text-[12px] text-faint">
      {parts.map((b, i) => (
        <span key={b} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="text-border-strong" />}
          <span className={i === parts.length - 1 ? "text-muted" : ""}>{b}</span>
        </span>
      ))}
    </div>
  );
}

/* ── 하단 패널 ─────────────────────────────────────────────── */

/**
 * 패널 내용은 각 문서가 채운다 — 여기서는 자리와 탭만.
 * 문제 풀이 화면이 포털로 내용을 넣는다(`#lab2-panel-slot`).
 * **"터미널" 탭은 없다** — 우리는 터미널을 갖고 있지 않다.
 */
const PANEL_TABS = ["실행 결과", "테스트 케이스", "제출 기록"];

function Panel({ doc }: { doc: Doc }) {
  const { prefs, setPrefs, panelTab, setPanelTab } = useWorkspace();

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = prefs.panelHeight;
    const onMove = (ev: MouseEvent) =>
      setPrefs({ panelHeight: Math.min(520, Math.max(120, startH + (startY - ev.clientY))) });
    const onUp = () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!prefs.panelOpen) return null;

  return (
    <>
      <div
        onMouseDown={startDrag}
        className="h-px shrink-0 cursor-row-resize bg-border transition-colors hover:bg-brand"
      />
      <div className="flex shrink-0 flex-col bg-surface" style={{ height: prefs.panelHeight }}>
        <div className="flex h-[35px] shrink-0 items-center gap-5 px-4">
          {PANEL_TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setPanelTab(i)}
              className={`relative h-full text-[11px] uppercase tracking-[0.12em] transition-colors ${
                i === panelTab ? "text-fg" : "text-faint hover:text-muted"
              }`}
            >
              {t}
              {i === panelTab && (
                <span className="absolute bottom-0 left-0 h-[1px] w-full bg-brand" />
              )}
            </button>
          ))}
          <X
            size={14}
            className="ml-auto cursor-pointer text-faint transition-colors hover:text-fg"
            onClick={() => setPrefs({ panelOpen: false })}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <PanelContent doc={doc} />
        </div>
      </div>
    </>
  );
}

/* ── 상태 바 ───────────────────────────────────────────────── */

function StatusBar({ doc, isHome }: { doc: Doc; isHome: boolean }) {
  const { prefs, setPrefs, run } = useWorkspace();
  const solved = PROBLEMS.filter((p) => p.verdict === "AC").length;
  const verdict = run ? runVerdict(run) : null;

  return (
    <footer className="flex h-[22px] shrink-0 items-center border-t border-border bg-surface pl-1 font-mono text-[11px] text-muted">
      <Item>
        <CheckCircle2 size={11} style={{ color: PASS }} />
        judge 연결됨
      </Item>

      {/* 채점 상태 — 패널을 접어둬도 여기서는 보인다 */}
      {run && (
        <Item>
          {run.done ? (
            <>
              <span
                className="h-[7px] w-[7px]"
                style={{ background: VERDICT_TINT[verdict ?? "AC"] }}
              />
              {VERDICT_TEXT[verdict ?? "AC"]}
            </>
          ) : (
            <>
              <Circle size={7} className="animate-pulse fill-current" style={{ color: WARN }} />
              채점 중 {run.cases.length}/{run.total}
            </>
          )}
        </Item>
      )}

      <span className="ml-auto" />

      {doc.kind === "problem" && <Item>{prefs.language}</Item>}
      <Item>
        해결 {solved} / {PROBLEMS.length}
      </Item>
      <Item>
        <Circle size={7} className="animate-pulse fill-current" style={{ color: PASS }} />
        SSE
      </Item>

      {/* ── 레이아웃 조작 — 흩어져 있던 걸 여기 한 곳에 모았다 ──
          사이드바 토글은 여태 "액티비티 아이콘 재클릭"으로만 되고 아무 표시가
          없었다(알 방법이 없는 기능). 여기 나오면서 발견 가능해진다.
          **홈에서는 감춘다** — 조작할 대상(탭·패널)이 애초에 없는 화면에서
          토글만 남아 있으면 그거야말로 없는 걸 있는 척하는 것이다. */}
      {!isHome && (
        <>
          <span className="mx-1.5 h-3 w-px bg-border" />
          <Item
            onClick={() => setPrefs({ sidebarOpen: !prefs.sidebarOpen })}
            title="사이드바 접기/펴기"
            dim={!prefs.sidebarOpen}
          >
            <PanelLeft size={13} />
          </Item>
          <Item
            onClick={() => setPrefs({ panelOpen: !prefs.panelOpen })}
            title="하단 패널 접기/펴기"
            dim={!prefs.panelOpen}
          >
            <PanelBottom size={13} />
          </Item>
        </>
      )}
      <span className="w-1" />
    </footer>
  );
}

/** 상태바 한 칸. 누를 수 있는 것만 hover 배경이 칸 전체를 채운다(VS Code 방식). */
function Item({
  children,
  onClick,
  title,
  dim,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  /** 꺼진 상태 — 있음/없음을 색으로만 구분한다(아이콘을 바꾸면 뭘 누르는지 흔들린다). */
  dim?: boolean;
}) {
  const cls = `flex h-full items-center gap-1.5 px-2 ${dim ? "text-faint" : ""} ${
    onClick ? "transition-colors hover:bg-elevated hover:text-fg" : ""
  }`;
  if (!onClick) return <span className={cls}>{children}</span>;
  return (
    <button className={cls} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

const VERDICT_TINT: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };
const VERDICT_TEXT: Record<string, string> = {
  AC: "맞았습니다",
  WA: "틀렸습니다",
  TLE: "시간 초과",
};

/** 제출은 로그인 필수(ADR-0019). 비로그인 클릭 시 안내. */
function AuthNotice() {
  const { authNotice, setAuthNotice, setPrefs } = useWorkspace();
  if (!authNotice) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="w-[min(90vw,380px)] border border-border-strong bg-surface p-5">
        <h2 className="text-[15px] text-fg">제출하려면 로그인이 필요합니다</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          문제를 읽고 예제를 실행하는 건 로그인 없이도 됩니다. 제출 기록을 남기려면
          계정이 필요합니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setAuthNotice(false)}
            className="px-3 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
          >
            닫기
          </button>
          <button
            onClick={() => {
              setPrefs({ signedIn: true });
              setAuthNotice(false);
            }}
            className="bg-brand px-3 py-1.5 text-[13px] text-brand-ink transition-colors hover:bg-brand-hover"
          >
            카카오로 로그인
          </button>
        </div>
      </div>
    </div>
  );
}
