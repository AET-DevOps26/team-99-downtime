rootProject.name = "99-downtime-root"

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
    id("dev.nx.gradle.project-graph") version "0.1.21" apply false
}

include("commons-jvm")
project(":commons-jvm").projectDir = file("apps/commons-jvm")
include("budget-service")
project(":budget-service").projectDir = file("apps/budget-service")
include("notification-service")
project(":notification-service").projectDir = file("apps/notification-service")
include("transaction-service")
project(":transaction-service").projectDir = file("apps/transaction-service")
