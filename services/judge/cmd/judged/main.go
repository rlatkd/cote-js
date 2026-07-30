// judged — judge 워커 데몬. Kafka 제출 3레인을 소비해 채점하고 결과 토픽에 발행한다.
// (채점 코어만 단독으로 돌려보려면 cmd/judgecli)
package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/rlatkd/cotejs/services/judge/internal/bundle"
	"github.com/rlatkd/cotejs/services/judge/internal/executor"
	"github.com/rlatkd/cotejs/services/judge/internal/messaging"
	"github.com/rlatkd/cotejs/services/judge/internal/sandbox/docker"
	"github.com/rlatkd/cotejs/services/judge/internal/telemetry"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	// OTel 추적(OTLP→Jaeger). 실패해도 채점은 계속한다 — 관측은 부가 기능.
	otelShutdown, err := telemetry.Init(context.Background(), "judge")
	if err != nil {
		log.Warn("OTel 초기화 실패 — 추적 없이 진행", "err", err)
	} else {
		defer otelShutdown(context.Background())
	}

	store, err := bundle.NewStore(bundle.Config{
		Endpoint:  env("MINIO_ENDPOINT", "localhost:9000"),
		AccessKey: env("MINIO_ACCESS_KEY", "cotejs"),
		SecretKey: env("MINIO_SECRET_KEY", "cotejs-dev"),
		Bucket:    env("MINIO_BUCKET", "testdata"),
		CacheDir:  env("BUNDLE_CACHE_DIR", filepath.Join(os.TempDir(), "cotejs-judge-bundles")),
	})
	if err != nil {
		log.Error("번들 저장소 초기화 실패", "err", err)
		os.Exit(1)
	}

	worker, err := messaging.NewWorker(
		messaging.Config{
			Brokers: strings.Split(env("KAFKA_BROKERS", "localhost:9092"), ","),
			GroupID: env("KAFKA_GROUP", "judge-workers"),
		},
		executor.New(docker.New()),
		store,
		log,
	)
	if err != nil {
		log.Error("Kafka 워커 초기화 실패", "err", err)
		os.Exit(1)
	}
	defer worker.Close()

	// SIGINT/SIGTERM에 진행 중 채점을 마치고 오프셋을 커밋한 뒤 내려간다.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	log.Info("judged 기동", "lanes", []string{messaging.TopicRun, messaging.TopicSubmit, messaging.TopicBatch})
	if err := worker.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Error("워커 종료", "err", err)
		os.Exit(1)
	}
	log.Info("judged 종료")
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
