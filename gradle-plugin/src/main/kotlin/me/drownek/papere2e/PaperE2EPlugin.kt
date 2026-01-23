package me.drownek.papere2e

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.jvm.toolchain.JavaToolchainService

class PaperE2EPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create("e2e", PaperE2EExtension::class.java, project)

        project.tasks.register("testE2E", TestE2ETask::class.java) {
            testsDir.set(extension.testsDir)
            minecraftVersion.set(extension.minecraftVersion)
            jvmArgs.set(extension.jvmArgs)
            autoDownloadServer.set(extension.autoDownloadServer)
            acceptEula.set(extension.acceptEula)
            
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
