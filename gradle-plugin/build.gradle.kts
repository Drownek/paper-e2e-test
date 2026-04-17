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

val generateVersionResource = tasks.register("generateVersionResource") {
    val outFile = layout.buildDirectory.file("generated/version-resource/paper-e2e-version.properties")
    inputs.property("version", projectVersion)
    outputs.file(outFile)
    doLast {
        val f = outFile.get().asFile
        f.parentFile.mkdirs()
        f.writeText("version=$projectVersion\n")
    }
}

sourceSets.named("main") {
    resources.srcDir(generateVersionResource.map { it.outputs.files.singleFile.parentFile })
}
