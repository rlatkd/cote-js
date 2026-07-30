// W3C Trace Context(traceparent) — Next **서버 전용**.
//
// 추적의 시작점은 브라우저가 아니라 Next 서버다: 브라우저가 만든 값은 신뢰할 수 없어
// api가 어차피 재검증·재생성해야 하므로, 신뢰 경계 안(서버)에서 시작해야 이점이 있다.
// api는 이 헤더를 파싱해 같은 trace_id로 잇고, judge까지 전파한다(ADR-0017).

import { trace, isSpanContextValid } from "@opentelemetry/api";

/**
 * 현재 요청의 traceparent. OTel(instrumentation.ts)이 켜져 있으면 **활성 스팬의
 * 컨텍스트**를 쓴다 — 임의 생성하면 fetch 계측이 주입하는 헤더와 어긋나 로그의 id가
 * 실제 전파된 id와 달라진다. OTel이 없을 때만 직접 발급한다(폴백).
 */
export function currentTraceparent(): string {
  const sc = trace.getActiveSpan()?.spanContext();
  if (sc && isSpanContextValid(sc)) {
    return `00-${sc.traceId}-${sc.spanId}-${sc.traceFlags.toString(16).padStart(2, "0")}`;
  }
  return `00-${randomHex(16)}-${randomHex(8)}-01`;
}

function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
