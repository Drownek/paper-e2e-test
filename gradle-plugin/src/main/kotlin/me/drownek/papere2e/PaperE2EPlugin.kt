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
                val excludePatterns = extension.cleanExcludePatterns.get()

                if (!runDir.exists()) {
                    project.logger.lifecycle("🧹 [E2E] Run directory doesn't exist yet, nothing to clean")
                    return@doLast
                }

                project.logger.lifecycle("🧹 [E2E] Cleaning run directory, excluding: ${excludePatterns.joinToString(", ")}")

                // Get all files and directories in the run folder
                val allEntries = runDir.listFiles() ?: emptyArray()

                // Separate entries into deleted and kept
                val deletedFiles = mutableListOf<String>()
                val keptFiles = mutableListOf<String>()

                // Delete everything except the excluded patterns
                allEntries.forEach { entry ->
                    val shouldExclude = excludePatterns.any { pattern ->
                        entry.name == pattern
                    }

                    if (!shouldExclude) {
                        deletedFiles.add(entry.name)
                        project.delete(entry)
                    } else {
                        keptFiles.add(entry.name)
                    }
                }

                if (deletedFiles.isNotEmpty()) {
                    project.logger.lifecycle("🧹 [E2E] Deleted: ${deletedFiles.joinToString(", ")}")
                }
                if (keptFiles.isNotEmpty()) {
                    project.logger.lifecycle("🧹 [E2E] Preserved: ${keptFiles.joinToString(", ")}")
                }

                project.logger.lifecycle("🧹 [E2E] Cleaned run directory")
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
            pluginUrls.set(extension.pluginUrls)

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
        }
    }
}
