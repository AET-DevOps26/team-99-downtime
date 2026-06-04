plugins {
	`java-library`
	checkstyle
	id("io.spring.dependency-management") version "1.1.7"
	id("com.diffplug.spotless") version "6.25.0"
	id("dev.nx.gradle.project-graph") version "0.1.21"
}

// No group/version: this library is consumed via project(":commons-jvm"), never
// published to a Maven repo, so coordinates would be unused config.

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencyManagement {
	imports {
		mavenBom("org.springframework.boot:spring-boot-dependencies:3.5.14")
	}
}

dependencies {
	// `api` so consuming services inherit these transitively — they depend on
	// :commons-jvm and get the resource-server stack without re-declaring it.
	api("org.springframework.boot:spring-boot-starter-web")
	api("org.springframework.boot:spring-boot-starter-security")
	api("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	compileOnly("org.springframework.boot:spring-boot-autoconfigure")
	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("org.springframework.security:spring-security-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}

checkstyle {
	toolVersion = "10.26.1"
	configFile = rootDir.resolve("config/checkstyle/checkstyle.xml")
}

spotless {
	java {
		target("src/**/*.java")
		googleJavaFormat("1.23.0")
		ratchetFrom("HEAD")
	}
}
