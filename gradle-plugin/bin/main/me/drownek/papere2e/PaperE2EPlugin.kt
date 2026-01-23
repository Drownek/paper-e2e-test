package me.drownek.papere2e

import org.gradle.api.Plugin
import org.gradle.api.Project

class PaperE2EPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("e2e", PaperE2EExtension::class.java, project)

        project.tasks.register("testE2E", TestE2ETask::class.java) {
            testsDir.set(extension.testsDir)
            minecraftVersion.set(extension.minecraftVersion)
            jvmArgs.set(extension.jvmArgs)
            autoDownloadServer.set(extension.autoDownloadServer)
            acceptEula.set(extension.acceptEula)
            
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
