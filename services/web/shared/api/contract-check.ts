// 컴파일 타임 계약 검사 (ADR-0007) — web 도메인 모델과 api(Kotlin)의 OpenAPI 스키마가
// 어긋나면(필드 개명·추가·삭제·타입 변경) next build가 실패한다.
//
// schema.d.ts 재생성: api 기동 후 `pnpm gen:api` (생성물은 커밋한다).

import type { components } from "./schema";
import type { Problem } from "@/entities/problem/model";
import type { Submission } from "@/entities/submission/model";

type SchemaProblem = components["schemas"]["ProblemResponse"];
type SchemaSubmission = components["schemas"]["SubmissionResponse"];

type AssertTrue<T extends true> = T;

/** 두 타입의 키 집합이 완전히 같은가 (개명·추가·삭제 검출) */
type SameKeys<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [never, never]
  ? true
  : false;

/** 모델의 각 필드가 스키마 필드 타입에 대입 가능한가 (타입 호환 검출) */
type FieldsCompatible<Model, Schema> = Required<Model> extends Required<Schema> ? true : false;

// ── Problem ──────────────────────────────────────────────────────────
export type ProblemKeysInSync = AssertTrue<SameKeys<Problem, SchemaProblem>>;
export type ProblemFieldsCompatible = AssertTrue<FieldsCompatible<Problem, SchemaProblem>>;

// ── Submission ───────────────────────────────────────────────────────
export type SubmissionKeysInSync = AssertTrue<SameKeys<Submission, SchemaSubmission>>;
export type SubmissionFieldsCompatible = AssertTrue<
  FieldsCompatible<Submission, SchemaSubmission>
>;
