package me.drownek.papere2e

import org.gradle.api.Project
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property

abstract class PaperE2EExtension(project: Project) {
    /**
     * Directory containing test files (.spec.js)
     */
    val testsDir: DirectoryProperty = project.objects.directoryProperty().convention(
        project.layout.projectDirectory.dir("src/test/e2e")
    )

    /**
     * Directory where the server will be run from.
     * Will be created automatically if it doesn't exist.
     */
    val runDir: DirectoryProperty = project.objects.directoryProperty().convention(
        project.layout.projectDirectory.dir("run")
    )

    /**
     * Minecraft version for the Paper server (e.g., "1.19.4", "1.20.4")
     */
    val minecraftVersion: Property<String> = project.objects.property(String::class.java).convention("1.19.4")

    /**
     * Whether to automatically download the Paper server if not present
     */
    val autoDownloadServer: Property<Boolean> = project.objects.property(Boolean::class.java).convention(true)

    /**
     * JVM arguments to pass when starting the server.
     * Defaults include EULA auto-agree for testing purposes.
     */
    val jvmArgs: ListProperty<String> = project.objects.listProperty(String::class.java).convention(
        listOf(
            "-Xmx2G",
            "-Dcom.mojang.eula.agree=true"
        )
    )

    /**
     * Whether to accept the Minecraft EULA automatically.
     * When true, adds -Dcom.mojang.eula.agree=true to JVM args.
     */
    val acceptEula: Property<Boolean> = project.objects.property(Boolean::class.java).convention(true)

    /**
     * The name of the plugin folder in plugins/ directory.
     * Defaults to project.name if not specified.
     * Used to determine which plugin data folder to clean before tests.
     */
    val pluginName: Property<String> = project.objects.property(String::class.java).convention(project.name)

    /**
     * Whether to clean plugin data before each test run.
     * When true, deletes the plugin folder in run/plugins/ before starting tests.
     * This ensures tests run with a fresh state.
     */
    val cleanPluginData: Property<Boolean> = project.objects.property(Boolean::class.java).convention(true)
}
