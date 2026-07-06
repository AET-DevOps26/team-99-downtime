plugins {
	java
	checkstyle
	id("org.springframework.boot") version "3.5.14"
	id("io.spring.dependency-management") version "1.1.7"
	id("com.diffplug.spotless") version "6.25.0"
	id("dev.nx.gradle.project-graph") version "0.1.21"
	id("org.springdoc.openapi-gradle-plugin") version "1.9.0"
}

val workspaceRoot = rootDir
val projectRootRel = projectDir.toRelativeString(rootDir)
val distDir = workspaceRoot.resolve("dist").resolve(projectRootRel)

group = "de.tum.aet.devops26.team99downtime"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation(project(":commons-jvm"))
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-web")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	runtimeOnly("org.postgresql:postgresql")
	// bootRun-only classpath (excluded from the jar): lets generateOpenApiDocs
	// boot against embedded H2 instead of needing a Postgres container.
	developmentOnly("com.h2database:h2")
	compileOnly("org.projectlombok:lombok")
	annotationProcessor("org.projectlombok:lombok")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.security:spring-security-test")
	testRuntimeOnly("com.h2database:h2")
	testCompileOnly("org.projectlombok:lombok")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testAnnotationProcessor("org.projectlombok:lombok")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

// generateOpenApiDocs: boots the service (embedded H2, side port so a running
// dev stack doesn't collide), fetches the springdoc spec and writes it to the
// committed openapi/ directory — no Docker needed. CI drift-checks the result.
openApi {
	apiDocsUrl.set("http://localhost:18080/api/transactions/v3/api-docs")
	outputDir.set(workspaceRoot.resolve("openapi"))
	outputFileName.set("${project.name}.json")
	// Cold JPA context on a CI runner can exceed the default 30 s.
	waitTimeInSeconds.set(120)
	customBootRun {
		args.set(listOf("--server.port=18080"))
	}
}

// The springdoc plugin's fork task consumes the commons-jvm jar off the runtime
// classpath but never declares it, which Gradle's dependency validation rejects.
tasks.named("forkedSpringBootRun") {
	dependsOn(":commons-jvm:jar")
}

tasks.named<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    // Tell the worker to put the final jar straight into dist folder
    destinationDirectory.set(distDir)
    
    // Standardize the name so Nx always knows the exact filename
    archiveFileName.set("app.jar")
}

tasks.named("build") {
    // This explicitly tells Gradle that the final output of the entire 'build' pipeline 
    // lives in the distDir, helping tools like Nx track build artifacts accurately.
    outputs.dir(distDir)
}

checkstyle {
	toolVersion = "10.26.1"
	configFile = workspaceRoot.resolve("config/checkstyle/checkstyle.xml")
}

spotless {
	java {
		target("src/**/*.java")
		googleJavaFormat("1.23.0")
		ratchetFrom("HEAD")
	}
}

allprojects {
    apply {
        plugin("dev.nx.gradle.project-graph")
    }
}
