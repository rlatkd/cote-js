"use client";

/**
 * 설정 — 취향(계정을 따라다닐 것)과 배치(반응형이 모드를 정하고 그 안에서 조정)를
 * 한 화면에서 보여준다. 여기서 바꾸면 셸에 즉시 반영된다.
 *
 * **랩 한계(정직하게 표시)**: 계정 동기화는 api 설정 테이블·엔드포인트가 필요해서
 * 여기서는 브라우저 저장소만 쓴다. "어느 기기에서든 따라온다"는 본 서비스 적용 시.
 */

import { LANGUAGES } from "../data";
import { SIDEBAR_MAX_PX, SIDEBAR_MIN_PX } from "../theme";
import { useWorkspace } from "../workspace";

export default function SettingsView() {
  const { prefs, setPrefs } = useWorkspace();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-10 py-10">
        <h1 className="text-[20px] font-semibold tracking-tight">설정</h1>

        <Group title="취향" note="계정을 따라다닙니다 — 어느 기기에서 로그인해도 같습니다">
          <Field label="기본 언어" desc="새 문제를 열 때 선택되는 언어">
            <select
              value={prefs.language}
              onChange={(e) => setPrefs({ language: e.target.value })}
              className="border border-border bg-surface px-2 py-1 font-mono text-[12px] text-fg outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </Group>

        <Group
          title="배치"
          note={`비율로 저장합니다. 화면 크기에 따라 ${SIDEBAR_MIN_PX}~${SIDEBAR_MAX_PX}px 사이로 맞춰집니다`}
        >
          <Field label="사이드바 폭" desc="경계선을 드래그해도 됩니다">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.1}
                max={0.34}
                step={0.005}
                value={prefs.sidebarRatio}
                onChange={(e) => setPrefs({ sidebarRatio: Number(e.target.value) })}
                className="h-1 w-48 accent-[rgb(var(--brand))]"
              />
              <span className="w-12 font-mono text-[12px] tabular-nums text-muted">
                {(prefs.sidebarRatio * 100).toFixed(1)}%
              </span>
            </div>
          </Field>

          <Field label="하단 패널 높이" desc="패널 경계선을 드래그해도 됩니다">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={120}
                max={520}
                step={4}
                value={prefs.panelHeight}
                onChange={(e) => setPrefs({ panelHeight: Number(e.target.value) })}
                className="h-1 w-48 accent-[rgb(var(--brand))]"
              />
              <span className="w-12 font-mono text-[12px] tabular-nums text-muted">
                {prefs.panelHeight}px
              </span>
            </div>
          </Field>

          <Field label="지문 / 에디터 분할" desc="문제 화면의 좌측 비율">
            <span className="font-mono text-[12px] tabular-nums text-muted">
              {prefs.splitLeft}% / {100 - prefs.splitLeft}%
            </span>
          </Field>
        </Group>

        <Group title="랩 전용" note="시안을 비교하기 위한 스위치 — 본 서비스에는 없습니다">
          <Field label="로그인 상태" desc="비로그인 화면을 확인할 때">
            <button
              onClick={() => setPrefs({ signedIn: !prefs.signedIn })}
              className="border border-border px-3 py-1 text-[12px] text-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {prefs.signedIn ? "로그인됨 · @sanghun" : "비로그인"}
            </button>
          </Field>
        </Group>

        <p className="mt-10 border-t border-border pt-4 text-[12px] leading-relaxed text-faint">
          ⚠️ 랩에서는 이 값들이 <span className="font-mono">localStorage</span>에만 저장됩니다.
          계정 동기화(다른 기기에서도 따라오기)는 api 설정 테이블이 필요해서 본 서비스 적용
          시점에 붙입니다. 열어둔 탭은 <span className="font-mono">sessionStorage</span>라 브라우저를
          닫으면 초기화됩니다 — 쓰던 코드는 문제별·언어별로 남습니다.
        </p>
      </div>
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">{title}</h2>
      <p className="mt-1 text-[12px] text-faint">{note}</p>
      <div className="mt-3 border border-border bg-surface">{children}</div>
    </section>
  );
}

function Field({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-6 border-b border-border px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-fg">{label}</div>
        <div className="mt-0.5 text-[12px] text-faint">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
