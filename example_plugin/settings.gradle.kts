pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
    }
}

includeBuild("../gradle-plugin")

rootProject.name = "example-plugin"
