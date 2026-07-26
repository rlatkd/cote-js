// Package bundle — claim-check(ADR-0009)의 소비자 측. 메시지에 실려 온 참조(키+해시)로
// 오브젝트 스토리지에서 테스트 번들을 받아 로컬에 푼다.
//
// 캐시 키는 경로가 아니라 **콘텐츠 해시**다 — 문제를 수정해 번들이 바뀌면 해시가 달라져
// 자동으로 재다운로드된다(무효화 로직이 따로 필요 없다).
package bundle

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type Store struct {
	client   *minio.Client
	bucket   string
	cacheDir string
}

type Config struct {
	Endpoint  string // 예: localhost:9000
	AccessKey string
	SecretKey string
	Bucket    string
	CacheDir  string
	UseSSL    bool
}

func NewStore(cfg Config) (*Store, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(cfg.CacheDir, 0o755); err != nil {
		return nil, err
	}
	return &Store{client: client, bucket: cfg.Bucket, cacheDir: cfg.CacheDir}, nil
}

// Fetch는 번들이 풀린 로컬 디렉토리 경로를 돌려준다. 캐시에 있으면 네트워크를 타지 않는다.
// 반환 경로는 executor가 그대로 Task.BundleDir로 쓴다(cases/NN.in|out 레이아웃).
func (s *Store) Fetch(ctx context.Context, key, wantSHA256 string) (string, error) {
	dir := filepath.Join(s.cacheDir, wantSHA256)
	marker := filepath.Join(dir, ".complete")

	// 완료 마커로 판단한다 — 디렉토리 존재만 보면 다운로드 중 죽은 반쪽 캐시를 유효로 오인한다.
	if _, err := os.Stat(marker); err == nil {
		return dir, nil
	}
	_ = os.RemoveAll(dir)

	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return "", fmt.Errorf("번들 조회 실패(%s): %w", key, err)
	}
	defer obj.Close()

	tmp, err := os.CreateTemp("", "bundle-*.tgz")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())

	// 받으면서 해시를 계산한다 — 받은 뒤 다시 읽지 않기 위해.
	hasher := sha256.New()
	if _, err := io.Copy(io.MultiWriter(tmp, hasher), obj); err != nil {
		tmp.Close()
		return "", fmt.Errorf("번들 다운로드 실패(%s): %w", key, err)
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}

	got := hex.EncodeToString(hasher.Sum(nil))
	if !strings.EqualFold(got, wantSHA256) {
		// 계약 위반(발행자가 알린 해시와 실제 내용이 다름) — 조용히 채점하면 안 된다.
		return "", fmt.Errorf("번들 해시 불일치(%s): 기대 %s, 실제 %s", key, wantSHA256, got)
	}

	staging := dir + ".staging"
	_ = os.RemoveAll(staging)
	if err := extractTarGz(tmp.Name(), staging); err != nil {
		_ = os.RemoveAll(staging)
		return "", fmt.Errorf("번들 해제 실패(%s): %w", key, err)
	}
	// 원자적 게시 — 완성된 디렉토리만 캐시 경로에 나타나게 한다.
	if err := os.Rename(staging, dir); err != nil {
		_ = os.RemoveAll(staging)
		return "", err
	}
	if err := os.WriteFile(marker, nil, 0o644); err != nil {
		return "", err
	}
	return dir, nil
}

func extractTarGz(archivePath, destDir string) error {
	f, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return err
	}

	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		// zip slip 방어 — 아카이브의 경로를 신뢰하지 않는다(../로 캐시 밖에 쓰는 공격).
		target := filepath.Join(destDir, filepath.Clean("/"+header.Name))
		if !strings.HasPrefix(target, filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("번들에 비정상 경로 포함: %s", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			out, err := os.Create(target)
			if err != nil {
				return err
			}
			if _, err := io.Copy(out, tr); err != nil { //nolint:gosec // 번들은 내부 발행물
				out.Close()
				return err
			}
			if err := out.Close(); err != nil {
				return err
			}
		default:
			// 심볼릭 링크 등은 무시 — 테스트 데이터에 필요 없고 탈출 경로가 된다.
		}
	}
}
