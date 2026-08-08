/**
 * 검증 리포트 — "이 문제를 왜 믿을 수 있나". 우리 제품의 유일한 차별점이 사는 자리.
 *
 * VS Code의 **테스트 탐색기** 어휘를 빌린다: 공정이 단계로 서고 각 단계에 통과/대기
 * 표시가 붙는다. 랩 1차에서 홈의 PIPELINE 패널이 겉돌았던 이유는 **행동으로 이어지지
 * 않아서**였고, 여기서는 전용 문서 탭이라는 자기 자리를 갖는다.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle, Info, ArrowLeft } from "lucide-react";
import { PASS, FAIL, WARN, INFO } from "../../../theme";
import { VERIFICATION_SOLUTIONS, VERIFICATION_STEPS, problemById } from "../../../data";

/** 문제마다 다른 제목·설명 — 이게 `generateMetadata`가 필요한 이유다. */
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = problemById(Number(params.id));
  if (!p) return { title: "검증 리포트" };
  return {
    title: `${p.id} ${p.title} 검증 리포트`,
    description: `${p.title}이(가) 통과한 검증 — 독립 풀이 ${VERIFICATION_SOLUTIONS.length}개의 출력 합의, 실채점, 실행 격리 조건.`,
  };
}

export default function VerificationPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const problem = problemById(id);

  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-faint">
        {id}번 문제를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-10 py-10">
        <Link
          href={`/lab2/p/${id}`}
          className="mb-5 inline-flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-fg"
        >
          <ArrowLeft size={12} />
          문제로 돌아가기
        </Link>

        <h1 className="text-[20px] font-semibold tracking-tight">
          <span className="font-mono text-muted">{problem.id}</span> {problem.title}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          이 문제는 AI가 만들었습니다. 그대로 믿지 않기 위해 아래 공정을 거쳤고, 각 단계의
          결과를 그대로 공개합니다.
        </p>

        <h2 className="mt-10 text-[11px] uppercase tracking-[0.12em] text-faint">검증 공정</h2>
        <div className="mt-3 border border-border bg-surface">
          {VERIFICATION_STEPS.map((s, i) => (
            <div
              key={s.name}
              className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              {s.ok ? (
                <CheckCircle2 size={15} className="mt-[2px] shrink-0" style={{ color: PASS }} />
              ) : (
                <Info size={15} className="mt-[2px] shrink-0" style={{ color: WARN }} />
              )}
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] text-fg">{s.name}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-[11px] uppercase tracking-[0.12em] text-faint">
          독립 풀이 합의
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          서로를 모르는 풀이 3개가 같은 출력을 냈습니다. 비교는 출력 원문이 아니라{" "}
          <span className="font-mono text-[12px] text-fg">sha256</span> 해시로 합니다 — 정답을
          노출하지 않고 동일성만 확인하기 위해서입니다.
        </p>
        <table className="mt-3 w-full border border-border bg-surface font-mono text-[12px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.1em] text-faint">
              <th className="px-4 py-2 text-left font-normal">풀이</th>
              <th className="py-2 text-left font-normal">언어</th>
              <th className="py-2 text-left font-normal">출력 해시</th>
              <th className="py-2 text-right font-normal">시간</th>
              <th className="px-4 py-2 text-right font-normal">합의</th>
            </tr>
          </thead>
          <tbody>
            {VERIFICATION_SOLUTIONS.map((s) => (
              <tr key={s.n} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-[7px] text-muted">#{s.n}</td>
                <td className="py-[7px] text-muted">{s.lang}</td>
                <td className="py-[7px]" style={{ color: INFO }}>
                  {s.hash}
                </td>
                <td className="py-[7px] text-right tabular-nums text-muted">{s.ms} ms</td>
                <td className="px-4 py-[7px] text-right" style={{ color: PASS }}>
                  일치
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-10 text-[11px] uppercase tracking-[0.12em] text-faint">실행 격리</h2>
        <div className="mt-3 grid gap-px bg-border sm:grid-cols-3">
          {[
            { k: "네트워크", v: "차단" },
            { k: "권한", v: "cap-drop ALL" },
            { k: "파일시스템", v: "read-only" },
            { k: "프로세스", v: "pids-limit" },
            { k: "메모리", v: "rlimit + 컨테이너" },
            { k: "사용자", v: "nobody" },
          ].map((x) => (
            <div key={x.k} className="bg-surface px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{x.k}</div>
              <div className="mt-1 font-mono text-[13px] text-fg">{x.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-2.5 border border-border px-4 py-3">
          <XCircle size={14} className="mt-[3px] shrink-0" style={{ color: FAIL }} />
          <p className="text-[13px] leading-relaxed text-muted">
            오판정을 발견하면 신고할 수 있습니다. 문제 결함으로 확인되면 테스트 케이스를 고치고{" "}
            <span className="font-mono text-[12px] text-fg">batch</span> 레인으로 기존 제출을 전부
            재채점합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
