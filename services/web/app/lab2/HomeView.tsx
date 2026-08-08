"use client";

/**
 * 홈 — **서비스의 메인 화면**(2026-08-08 사용자 결정으로 성격 전환).
 *
 * 이전 시안은 VS Code의 "시작하기" 탭을 그대로 옮긴 것이었다 — `새 파일`·`폴더 열기`
 * 처럼 **동작 목록**을 나열하는 IDE 논리. 그런데 우리는 IDE가 아니라 서비스고,
 * 서비스의 홈은 **콘텐츠 대시보드**다(백준·리트코드·프로그래머스 전부 그렇다):
 * 기능으로 가는 링크가 아니라 **지금 무슨 일이 벌어지고 있고 내가 뭘 해야 하는지.**
 *
 * 그래서 홈은 문서가 아니라 화면이다 — 탭에 쌓이지 않고, 탭 바·하단 패널 없이
 * 전체를 쓴다(layout.tsx). IDE 껍데기와 모순되지 않는다: 셸은 크롬이고 내용은
 * 무엇이든 될 수 있으며, IDE다움은 **문제 푸는 화면**에서 진짜다.
 *
 * 비로그인 처리 원칙(랩 1차에서 확정한 것을 그대로 적용): **자리는 유지하고 내용만
 * 교체한다.** 비우면 로그인 시 레이아웃이 출렁이고, 좋은 자리를 버리게 된다.
 */

import Link from "next/link";
import { ArrowRight, Circle, Flame, ShieldCheck, Sparkles } from "lucide-react";
import { PASS, FAIL, WARN, TIER_COLOR } from "./theme";
import { FEED, PROBLEMS, RANKING } from "./data";
import { useWorkspace } from "./workspace";

const VERDICT_COLOR: Record<string, string> = { AC: PASS, WA: FAIL, TLE: WARN };

export default function HomeView() {
  const { prefs } = useWorkspace();
  const signedIn = prefs.signedIn;

  const today = PROBLEMS.find((p) => p.ai && !p.verdict) ?? PROBLEMS[0];
  const stuck = PROBLEMS.find((p) => p.verdict && p.verdict !== "AC");
  const fresh = [...PROBLEMS].sort((a, b) => b.id - a.id).slice(0, 5);
  const solved = PROBLEMS.filter((p) => p.verdict === "AC").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-10 py-8">
        {/* ── 1열: 오늘의 문제 + 내 상태 ─────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* 오늘의 문제 — 홈에서 가장 큰 덩어리. 바로 풀러 갈 수 있어야 한다. */}
          <Link
            href={`/lab2/p/${today.id}`}
            className="group relative flex flex-col justify-between overflow-hidden border border-border bg-surface p-6 transition-colors hover:border-border-strong"
          >
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-brand">
                <Sparkles size={12} />
                오늘의 문제
              </div>
              <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight">
                {today.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-faint">{today.id}</span>
                <span style={{ color: TIER_COLOR[today.group] }}>{today.tier}</span>
                {today.tags.map((t) => (
                  <span key={t} className="border border-border px-1.5 py-0.5 text-faint">
                    {t}
                  </span>
                ))}
                <span className="text-faint">정답률 {today.rate}%</span>
              </div>
            </div>
            <div className="mt-7 flex items-center gap-2 text-[14px] text-fg group-hover:text-brand">
              풀러 가기
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* 내 상태 — 비로그인이어도 자리는 유지하고 내용만 바꾼다 */}
          <div className="border border-border bg-surface p-5">
            {signedIn ? (
              <>
                <SectionLabel>내 진행</SectionLabel>
                <div className="mt-4 flex items-baseline gap-2">
                  <Flame size={16} className="translate-y-[2px] text-brand" />
                  <span className="font-mono text-[28px] tabular-nums leading-none">12</span>
                  <span className="text-[13px] text-muted">일 연속</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-px bg-border">
                  <Cell label="해결" value={String(solved)} />
                  <Cell label="이번 주" value="5" />
                </div>

                {stuck && (
                  <Link
                    href={`/lab2/p/${stuck.id}`}
                    className="group mt-5 block border-t border-border pt-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.12em] text-faint">
                      이어풀기
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-mono text-[11px] text-faint">{stuck.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg group-hover:text-brand">
                        {stuck.title}
                      </span>
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: VERDICT_COLOR[stuck.verdict!] }}
                      >
                        {stuck.verdict}
                      </span>
                    </div>
                  </Link>
                )}
              </>
            ) : (
              <>
                <SectionLabel>시작하기</SectionLabel>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  문제를 읽고 예제를 실행하는 건 로그인 없이도 됩니다. 제출 기록과 연속
                  기록을 남기려면 로그인하세요.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-px bg-border">
                  <Cell label="문제" value={String(PROBLEMS.length)} />
                  <Cell label="검증 통과" value="92%" />
                </div>
                <button className="mt-5 w-full bg-brand py-2 text-[13px] text-brand-ink transition-colors hover:bg-brand-hover">
                  카카오로 시작하기
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── 2열: 새 문제 + 실시간 채점 ─────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card>
            <CardHead title="새로 게시된 문제" href="/lab2/problems" hrefLabel="전체" />
            <div>
              {fresh.map((p) => (
                <Link
                  key={p.id}
                  href={`/lab2/p/${p.id}`}
                  className="group flex items-center gap-3 border-b border-border/60 py-[9px] last:border-0"
                >
                  <span className="w-10 shrink-0 font-mono text-[12px] tabular-nums text-faint">
                    {p.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-muted group-hover:text-fg">
                    {p.title}
                  </span>
                  {p.ai && (
                    <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-faint">
                      AI
                    </span>
                  )}
                  <span
                    className="w-20 shrink-0 text-right font-mono text-[11px]"
                    style={{ color: TIER_COLOR[p.group] }}
                  >
                    {p.tier}
                  </span>
                  <span className="w-14 shrink-0 text-right font-mono text-[12px] tabular-nums text-faint">
                    {p.rate}%
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="실시간 채점" />
            <div>
              {FEED.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 border-b border-border/60 py-[9px] last:border-0"
                >
                  {s.verdict ? (
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: VERDICT_COLOR[s.verdict] }}
                    />
                  ) : (
                    <Circle
                      size={7}
                      className="shrink-0 animate-pulse fill-current"
                      style={{ color: WARN }}
                    />
                  )}
                  <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-faint">
                    {s.problem}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
                    {s.user}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
                    {s.verdict ?? `${s.progress}`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── 3열: 검증 현황 + 랭킹 ──────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* 랩 1차의 PIPELINE 패널이 홈에서 겉돌았던 건 *공정 진행 숫자*(생성 12·검증 8)
              였기 때문이다 — 사용자 행동으로 이어지지 않았다. 여기 있는 건 *결과 숫자*라
              성격이 다르고, 클릭하면 리포트로 간다. */}
          <Card>
            <CardHead
              title="이 문제들을 믿을 수 있는 이유"
              href={`/lab2/p/${today.id}/verification`}
              hrefLabel="리포트"
            />
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              <Cell label="게시된 문제" value={String(PROBLEMS.length)} />
              <Cell label="검증 통과" value="92%" accent />
              <Cell label="독립 풀이 합의" value="3/3" />
              <Cell label="검수 대기" value="2" />
            </div>
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-faint">
              <ShieldCheck size={13} className="mt-[2px] shrink-0" style={{ color: PASS }} />
              AI가 낸 초안을 그대로 믿지 않습니다. 지문만 보고 만든 독립 풀이 여러 개를 실제
              채점기로 돌려 답이 합의되는지 확인하고, 통과한 것만 사람 검수를 거쳐 게시합니다.
            </p>
          </Card>

          <Card>
            <CardHead title="랭킹" href="/lab2/ranking" hrefLabel="전체" />
            <div>
              {RANKING.slice(0, 4).map((r) => (
                <div
                  key={r.user}
                  className="flex items-center gap-3 border-b border-border/60 py-[7px] last:border-0"
                >
                  <span className="w-5 shrink-0 text-right font-mono text-[12px] tabular-nums text-faint">
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
                    {r.user}
                  </span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg">
                    {r.solved}
                  </span>
                </div>
              ))}
              {signedIn && (
                <div className="mt-1 flex items-center gap-3 border-t border-border py-[7px]">
                  <span className="w-5 shrink-0 text-right font-mono text-[12px] tabular-nums text-brand">
                    12
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-brand">
                    @sanghun
                  </span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg">47</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── 조각들 ────────────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border bg-surface p-5">{children}</div>;
}

function CardHead({
  title,
  href,
  hrefLabel,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <SectionLabel>{title}</SectionLabel>
      {href && (
        <Link
          href={href}
          className="ml-auto shrink-0 font-mono text-[11px] text-faint transition-colors hover:text-brand"
        >
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">{children}</h2>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface px-3 py-3">
      <div
        className={`font-mono text-[20px] tabular-nums leading-none ${accent ? "text-brand" : ""}`}
      >
        {value}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-faint">{label}</div>
    </div>
  );
}
