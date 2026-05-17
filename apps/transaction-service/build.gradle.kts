plugins {
	java
	checkstyle
	id("org.springframework.boot") version "3.5.14"
	id("io.spring.dependency-management") version "1.1.7"
	id("com.diffplug.spotless") version "6.25.0"
	id("dev.nx.gradle.project-graph") version "0.1.21"
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
	}
}

allprojects {
    apply {
        plugin("dev.nx.gradle.project-graph")
    }
}
