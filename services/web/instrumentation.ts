// Next 계측 진입점(instrumentationHook) — 서버 기동 시 한 번 실행된다.
// @vercel/otel이 Next 내장 스팬(렌더링·Server Action)과 fetch 전파를 켠다.
// 스팬은 OTLP HTTP(기본 localhost:4318 — Jaeger)로 나간다. 수집기가 없으면
// 내보내기만 실패하고 앱은 영향받지 않는다(ADR-0018).

import { registerOTel, OTLPHttpProtoTraceExporter } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "web",
    traceExporter: new OTLPHttpProtoTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT != null
          ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
          : "http://localhost:4318/v1/traces",
    }),
    // 기본값은 같은 배포 안 URL에만 전파한다 — api는 별도 오리진이라 명시해야
    // fetch가 traceparent를 실어 보낸다.
    instrumentationConfig: {
      fetch: {
        propagateContextUrls: [/^https?:\/\/localhost:4000\//],
      },
    },
  });
}
