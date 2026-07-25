import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { acceptanceRate, type Problem } from "@/entities/problem/model";
import DifficultyBadge from "@/entities/problem/ui/DifficultyBadge";
import AiBadge from "@/entities/problem/ui/AiBadge";

export default function HomeView({ problems }: { problems: Problem[] }) {
  const recent = problems.slice(0, 5);
  const aiCount = problems.filter((p) => p.aiGenerated).length;

  return (
    <main>
      {/* Hero — 계기판 헤더 */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="grid-texture pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl animate-fade-up px-4 py-20 sm:py-28">
          <p className="mono-label mb-6 flex items-center gap-2">
            <span className="text-brand">//</span>
            AI-GENERATED · SIMILARITY-CHECKED · ANSWER-VERIFIED
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            매일 새로운 알고리즘 문제를,
            <br />
            <span className="text-brand">AI</span>가 만들고 검증한다.
          </h1>
          <p className="mt-6 max-w-xl font-mono text-sm leading-relaxed text-muted">
            <span className="text-brand">&gt;</span> 기존 문제와의 유사도 검증과 N개
            독립 풀이 교차검증을 통과한 신선한 문제로 실전을 준비하세요.
          </p>
          <div className="mt-9 flex flex-wrap gap-2.5">
            <Link
              href="/problems"
              className="inline-flex items-center gap-2 bg-brand px-5 py-2.5 font-mono text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
            >
              문제 풀러 가기 <ArrowRight size={16} />
            </Link>
            <Link
              href="/status"
              className="inline-flex items-center border border-border-strong px-5 py-2.5 font-mono text-sm font-medium text-fg transition-colors hover:border-brand hover:text-brand"
            >
              채점 현황
            </Link>
          </div>
        </div>
      </section>

      {/* 계기 리드아웃 — 헤어라인으로 나뉜 데이터 스트립 */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <Stat value={`${problems.length}`} label="PROBLEMS" />
          <Stat value={`${aiCount}`} label="AI-GENERATED" accent />
          <Stat value="92%" label="VERIFIED" />
          <Stat value="439K" label="SUBMISSIONS" />
        </div>
      </section>

      {/* 최근 문제 — 계기 테이블 */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="mono-label !text-fg">RECENT PROBLEMS</h2>
          <Link
            href="/problems"
            className="font-mono text-[13px] text-muted transition-colors hover:text-brand"
          >
            all →
          </Link>
        </div>

        <div className="border-t border-border">
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.id}`}
              className="group flex items-center gap-4 border-b border-border py-3.5 pl-3 transition-colors hover:bg-elevated"
            >
              {/* hover 시 좌측 앰버 인디케이터 */}
              <span className="-ml-3 h-9 w-[3px] bg-transparent transition-colors group-hover:bg-brand" />
              <span className="w-16 shrink-0 font-mono text-sm tabular-nums text-faint transition-colors group-hover:text-brand">
                {p.id}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {p.title}
                {p.aiGenerated && (
                  <span className="ml-2 align-middle">
                    <AiBadge size="xs" />
                  </span>
                )}
              </span>
              <span className="hidden w-32 shrink-0 sm:block">
                <DifficultyBadge difficulty={p.difficulty} tier={p.tier} />
              </span>
              <span className="w-16 shrink-0 pr-3 text-right font-mono text-sm tabular-nums text-muted">
                {acceptanceRate(p)}%
              </span>
            </Link>
          ))}
          {recent.length === 0 && (
            <div className="border-b border-border py-12 text-center font-mono text-sm text-faint">
              아직 등록된 문제가 없습니다.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg px-5 py-6">
      <div
        className={`font-mono text-3xl font-bold tabular-nums tracking-tight ${
          accent ? "text-brand" : "text-fg"
        }`}
      >
        {value}
      </div>
      <div className="mono-label mt-1.5">{label}</div>
    </div>
  );
}
