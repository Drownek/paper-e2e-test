plugins {
    `kotlin-dsl`
    `maven-publish`
}

group = "me.drownek.papere2e"
version = "1.0.1"

repositories {
    mavenCentral()
}

dependencies {
    implementation(gradleApi())
    implementation("com.google.code.gson:gson:2.10.1")
}

gradlePlugin {
    plugins {
        create("paperE2E") {
            id = "me.drownek.paper-e2e"
            implementationClass = "me.drownek.papere2e.PaperE2EPlugin"
        }
    }
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}
