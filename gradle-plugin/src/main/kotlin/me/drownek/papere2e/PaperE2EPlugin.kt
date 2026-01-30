package me.drownek.papere2e

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.jvm.toolchain.JavaToolchainService

class PaperE2EPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("e2e", PaperE2EExtension::class.java, project)

        // Register cleanE2E task
        val cleanE2E = project.tasks.register("cleanE2E") {
            group = "verification"
            description = "Wipes the test server data for a clean slate."

            doLast {
                val runDir = extension.runDir.get().asFile
                val pluginName = extension.pluginName.get()
                val shouldClean = extension.cleanPluginData.get()

                // 1. Always wipe World Data (Safe, these regenerate)
                project.delete(runDir.resolve("world"))
                project.delete(runDir.resolve("world_nether"))
                project.delete(runDir.resolve("world_the_end"))
                project.delete(runDir.resolve("usercache.json"))
                project.logger.lifecycle("🧹 [E2E] Cleaned world data and user cache")

                // 2. Wipe Plugin Data (Configurable)
                if (shouldClean) {
                    val pluginFolder = runDir.resolve("plugins/$pluginName")
                    if (pluginFolder.exists()) {
                        project.logger.lifecycle("🧹 [E2E] Wiping plugin data: ${pluginFolder.path}")
                        project.delete(pluginFolder)
                    }
                }
            }
        }

        project.tasks.register("testE2E", TestE2ETask::class.java) {
            // Ensure clean runs before test
            dependsOn(cleanE2E)
            
            testsDir.set(extension.testsDir)
            minecraftVersion.set(extension.minecraftVersion)
            jvmArgs.set(extension.jvmArgs)
            autoDownloadServer.set(extension.autoDownloadServer)
            acceptEula.set(extension.acceptEula)
            pluginName.set(extension.pluginName)
            
            // Support command line properties for filtering
            if (project.hasProperty("testFiles")) {
                testFiles.set(project.property("testFiles") as String)
            }
            
            if (project.hasProperty("testNames")) {
                testNames.set(project.property("testNames") as String)
            }
            
            serverJarPath.set(
                extension.runDir.map { runDir ->
                    val serverJar = runDir.asFile.resolve("server.jar")
                    serverJar.absolutePath
                }
            )
            
            serverDir.set(
                extension.runDir.map { runDir ->
                    runDir.asFile.absolutePath
                }
            )

            // Configure Java Toolchain if Java plugin is present
            project.plugins.withId("java") {
                val javaExtension = project.extensions.findByType(JavaPluginExtension::class.java)
                val javaToolchains = project.extensions.findByType(JavaToolchainService::class.java)
                
                if (javaExtension != null && javaToolchains != null) {
                    javaLauncher.set(javaToolchains.launcherFor(javaExtension.toolchain))
                }
            }
        }

        project.afterEvaluate {
            val testTask = project.tasks.named("testE2E", TestE2ETask::class.java).get()
            
            // Try to find the task that produces the plugin jar
            val jarTask = when {
                project.tasks.findByName("shadowJar") != null -> project.tasks.named("shadowJar")
                project.tasks.findByName("reobfJar") != null -> project.tasks.named("reobfJar")
                else -> project.tasks.named("jar")
            }
            
            if (jarTask.isPresent) {
                testTask.dependsOn(jarTask)
                testTask.pluginJar.set(jarTask.get().outputs.files.singleFile)
            }
            
            // Automatic fixture copying from src/test/e2e/fixtures
            val fixturesDir = project.file("src/test/e2e/fixtures")
            if (fixturesDir.exists() && fixturesDir.isDirectory) {
                val runDir = extension.runDir.get().asFile
                val pluginName = extension.pluginName.get()
                val targetDir = runDir.resolve("plugins/$pluginName")
                
                testTask.doFirst {
                    targetDir.mkdirs()
                    project.copy {
                        from(fixturesDir)
                        into(targetDir)
                    }
                    project.logger.lifecycle("📂 [E2E] Loaded test fixtures into plugin folder: ${targetDir.path}")
                }
            }
        }
    }
}
