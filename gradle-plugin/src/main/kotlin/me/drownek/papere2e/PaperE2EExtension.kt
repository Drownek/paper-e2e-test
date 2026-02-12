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
     */
    val jvmArgs: ListProperty<String> = project.objects.listProperty(String::class.java).convention(
        listOf(
            "-Xmx2G"
        )
    )

    /**
     * Whether to accept the Minecraft EULA automatically.
     * When true, adds -Dcom.mojang.eula.agree=true to JVM args.
     */
    val acceptEula: Property<Boolean> = project.objects.property(Boolean::class.java).convention(true)

    /**
     * List of files/folders to exclude from deletion during cleanE2E.
     * By default, excludes server.jar, cache, and libraries folders.
     * These paths are relative to the run directory.
     */
    val cleanExcludePatterns: ListProperty<String> = project.objects.listProperty(String::class.java).convention(
        listOf(
            "server.jar",
            "cache",
            "libraries"
        )
    )

    /**
     * URLs of plugins to download before running tests.
     * These plugins will be placed in the server's plugins directory.
     */
    val pluginUrls: ListProperty<String> = project.objects.listProperty(String::class.java).convention(emptyList())

    /**
     * DSL method for configuring plugin downloads.
     * Example:
     * ```
     * downloadPlugins {
     *     url("https://example.com/plugin1.jar")
     *     url("https://example.com/plugin2.jar")
     * }
     * ```
     */
    fun downloadPlugins(action: PluginDownloadSpec.() -> Unit) {
        val spec = PluginDownloadSpec()
        action(spec)
        pluginUrls.set(spec.urls)
    }

    /**
     * Specification for plugin downloads.
     */
    class PluginDownloadSpec {
        internal val urls = mutableListOf<String>()

        /**
         * Add a plugin URL to download.
         */
        fun url(pluginUrl: String) {
            urls.add(pluginUrl)
        }
    }
}
