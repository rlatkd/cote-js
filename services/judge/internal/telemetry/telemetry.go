// Package telemetry — OTel 추적 초기화. 스팬을 OTLP gRPC(기본 localhost:4317 — Jaeger)로
// 내보낸다. 수집기가 내려가 있어도 채점은 영향받지 않는다: 배치 프로세서가 백그라운드에서
// 내보내다 실패하면 스팬만 버린다(관측은 부가 기능이지 채점의 의존성이 아니다).
package telemetry

import (
	"context"
	"os"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// Init은 전역 TracerProvider와 전파 규약(W3C Trace Context)을 설정하고
// 종료 시 호출할 정리 함수를 돌려준다.
// 엔드포인트는 표준 환경변수 OTEL_EXPORTER_OTLP_ENDPOINT로 바꾼다.
func Init(ctx context.Context, serviceName string) (func(context.Context) error, error) {
	// 기본(로컬 Jaeger)은 평문 — gRPC 익스포터의 기본값은 TLS라 명시로 꺼야 한다
	// (실측: TLS 핸드셰이크 실패로 스팬 전량 유실). https 엔드포인트를 주면 TLS 유지.
	var opts []otlptracegrpc.Option
	if !strings.HasPrefix(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"), "https://") {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}
	exporter, err := otlptracegrpc.New(ctx, opts...)
	if err != nil {
		return nil, err
	}
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewSchemaless(
			attribute.String("service.name", serviceName),
		)),
	)
	otel.SetTracerProvider(provider)
	// web(@vercel/otel)·api(java agent)와 같은 규약이어야 한 추적으로 이어진다(ADR-0017).
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))
	return provider.Shutdown, nil
}
