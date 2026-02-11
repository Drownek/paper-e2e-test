plugins {
    `kotlin-dsl`
    `maven-publish`
    id("com.gradle.plugin-publish") version "1.2.1"
}

group = "io.github.drownek"
val projectVersion = file("../version.txt").readText().trim()
version = projectVersion

repositories {
    mavenCentral()
}

dependencies {
    implementation(gradleApi())
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("org.yaml:snakeyaml:2.0")
}

gradlePlugin {
    website.set("https://github.com/drownek/paper-e2e-test")
    vcsUrl.set("https://github.com/drownek/paper-e2e-test.git")
    plugins {
        create("paperE2E") {
            id = "io.github.drownek.paper-e2e"
            displayName = "Paper E2E Testing Plugin"
            description = "End-to-end testing framework for Paper/Spigot Minecraft plugins"
            tags.set(listOf("minecraft", "paper", "spigot", "testing", "e2e"))
            implementationClass = "me.drownek.papere2e.PaperE2EPlugin"
        }
    }
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}
