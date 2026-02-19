plugins {
    `java-library`
    id("de.eldoria.plugin-yml.bukkit") version "0.8.0"
    id("com.gradleup.shadow") version "9.0.0-beta12"
    id("io.github.drownek.paper-e2e") version "1.1.0"
}

e2e {
    minecraftVersion.set("1.19.4")
    acceptEula.set(true)
    testsDir.set(file("src/test/e2e"))
    downloadPlugins {
        url("https://hangarcdn.papermc.io/plugins/HelpChat/PlaceholderAPI/versions/2.11.6/PAPER/PlaceholderAPI-2.11.6.jar")
    }
}

group = "me.drownek"
version = "1.0-SNAPSHOT"

bukkit {
    main = "me.drownek.example.ExamplePlugin"
    apiVersion = "1.13"
    name = "ExamplePlugin"
    author = "Drownek"
}

repositories {
    mavenCentral()
    maven("https://jitpack.io/")
    maven("https://storehouse.okaeri.eu/repository/maven-releases/")
    maven("https://repo.panda-lang.org/releases")
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    compileOnly("org.spigotmc:spigot-api:1.16.5-R0.1-SNAPSHOT")

	implementation("io.github.drownek:platform-bukkit:2.3.2-SNAPSHOT")

    implementation("eu.okaeri:okaeri-configs-json-simple:5.0.6")

    /* lombok */
    compileOnly("org.projectlombok:lombok:1.18.32")
    annotationProcessor("org.projectlombok:lombok:1.18.32")
}

tasks.shadowJar {
    archiveFileName.set("bukkit-example-${project.version}.jar")

    val prefix = "me.drownek.example.libs"
    listOf(
        "eu.okaeri",
        "dev.rollczi.litecommands",
        "com.cryptomorin",
        "dev.triumphteam",
        "panda",
        "net.jodah",
        "net.kyori",
        "me.drownek.util",
    ).forEach { pack ->
        relocate(pack, "$prefix.$pack")
    }
}

tasks.withType<JavaCompile> {
    options.compilerArgs.add("-parameters")
    options.encoding = "UTF-8"
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}
