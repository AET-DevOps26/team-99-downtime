plugins {
	java
	checkstyle
	id("org.springframework.boot") version "3.5.14"
	id("io.spring.dependency-management") version "1.1.7"
	id("com.diffplug.spotless") version "6.25.0"
	id("dev.nx.gradle.project-graph") version "0.1.21"
}

val workspaceRoot = rootDir.parentFile.parentFile
val projectRootRel = rootDir.toRelativeString(workspaceRoot)
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
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-web")
	compileOnly("org.projectlombok:lombok")
	annotationProcessor("org.projectlombok:lombok")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testCompileOnly("org.projectlombok:lombok")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testAnnotationProcessor("org.projectlombok:lombok")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

checkstyle {
	toolVersion = "10.26.1"
	configFile = workspaceRoot.resolve("config/checkstyle/checkstyle.xml")
}

spotless {
	java {
		target("src/**/*.java")
		googleJavaFormat("1.23.0")
	}
}

allprojects {
    apply {
        plugin("dev.nx.gradle.project-graph")
    }
}
