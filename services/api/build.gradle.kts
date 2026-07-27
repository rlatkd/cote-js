plugins {
	kotlin("jvm") version "2.2.21"
	kotlin("plugin.spring") version "2.2.21"
	id("org.springframework.boot") version "4.0.7"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.cotejs"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

// 계약(Protobuf) 생성물 — 원본은 /contracts, 생성은 `cd contracts && buf generate`(ADR-0011).
// 생성물은 커밋하므로 빌드 시 코드젠을 돌리지 않는다(빌드에 buf·protoc 불필요).
sourceSets {
	main {
		java.srcDir("src/main/proto-gen")
	}
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webflux")
	implementation("io.projectreactor.kotlin:reactor-kotlin-extensions")
	implementation("org.flywaydb:flyway-database-postgresql")
	implementation("org.jetbrains.kotlin:kotlin-reflect")
	implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor")
	implementation("org.springframework:spring-jdbc")
	implementation("tools.jackson.module:jackson-module-kotlin")
	// judge와의 Kafka 계약 — Protobuf 직렬화 + Kafka 클라이언트를 코루틴으로 직접 사용.
	// spring-kafka(@KafkaListener)·reactor-kafka를 쓰지 않는 이유는 ADR-0012 참조.
	implementation("com.google.protobuf:protobuf-java:4.34.1")
	implementation("org.apache.kafka:kafka-clients")
	implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactive")
	// 테스트 번들(claim-check) 발행 — S3 호환 비동기 클라이언트(로컬 MinIO → 배포 시 S3)
	implementation("software.amazon.awssdk:s3:2.32.14")
	implementation("org.apache.commons:commons-compress:1.28.0")
	// OpenAPI 스펙 자동 생성(/v3/api-docs) — web 타입 codegen의 계약 원본 (ADR-0007)
	implementation("org.springdoc:springdoc-openapi-starter-webflux-api:3.0.3")
	runtimeOnly("org.postgresql:postgresql") // Flyway(JDBC)용
	// 영속 어댑터가 JSONB 코덱(io.r2dbc.postgresql.codec.Json)을 직접 쓰므로 컴파일 의존
	implementation("org.postgresql:r2dbc-postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-data-r2dbc-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webflux-test")
	testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
	testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
	compilerOptions {
		freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}

// Gradle이 포크 JVM에 데몬의 네이티브 인코딩(-Dfile.encoding)을 넘겨
// Windows(MS949)에서 JEP 400의 UTF-8 기본값이 덮이는 것을 차단
tasks.withType<JavaExec> {
	defaultCharacterEncoding = "UTF-8"
}
