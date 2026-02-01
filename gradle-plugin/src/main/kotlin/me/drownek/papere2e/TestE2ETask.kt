package me.drownek.papere2e

import com.google.gson.JsonParser
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.ListProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.*
import org.gradle.jvm.toolchain.JavaLauncher
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import org.yaml.snakeyaml.Yaml
import org.yaml.snakeyaml.DumperOptions

abstract class TestE2ETask : DefaultTask() {

    @get:InputDirectory
    @get:Optional
    abstract val testsDir: DirectoryProperty

    @get:Input
    abstract val serverJarPath: Property<String>

    @get:Input
    abstract val serverDir: Property<String>

    @get:Input
    abstract val minecraftVersion: Property<String>

    @get:Input
    abstract val jvmArgs: ListProperty<String>

    @get:Input
    abstract val autoDownloadServer: Property<Boolean>

    @get:Input
    abstract val acceptEula: Property<Boolean>

    @get:Input
    @get:Optional
    abstract val pluginJar: Property<File>

    @get:Input
    @get:Optional
    abstract val testFiles: Property<String>

    @get:Input
    @get:Optional
    abstract val testNames: Property<String>

    @get:Nested
    @get:Optional
    abstract val javaLauncher: Property<JavaLauncher>

    init {
        group = "verification"
        description = "Run E2E tests for Paper plugin"
    }

    @TaskAction
    fun runTests() {
        val serverJar = serverJarPath.get()
        val serverDirectory = serverDir.get()
        val mcVersion = minecraftVersion.get()
        val serverArgs = jvmArgs.get()
        val shouldAutoDownload = autoDownloadServer.get()
        val shouldAcceptEula = acceptEula.get()

        // Create run directory if it doesn't exist
        val runDirectory = File(serverDirectory)
        if (!runDirectory.exists()) {
            logger.lifecycle("Creating run directory: ${runDirectory.absolutePath}")
            runDirectory.mkdirs()
        }

        // Ensure online-mode=false and connection-throttle=0 in server.properties
        val serverProperties = File(runDirectory, "server.properties")
        if (serverProperties.exists()) {
            var lines = Files.readAllLines(serverProperties.toPath()).toMutableList()
            
            // Update or add online-mode=false
            val hasOnlineMode = lines.any { it.trim().startsWith("online-mode=") }
            if (hasOnlineMode) {
                lines = lines.map { line ->
                    if (line.trim().startsWith("online-mode=")) "online-mode=false" else line
                }.toMutableList()
            } else {
                lines.add("online-mode=false")
            }
            
            // Update or add connection-throttle=0 (required for E2E tests to prevent "Connection throttled" errors)
            val hasConnectionThrottle = lines.any { it.trim().startsWith("connection-throttle=") }
            if (hasConnectionThrottle) {
                lines = lines.map { line ->
                    if (line.trim().startsWith("connection-throttle=")) "connection-throttle=0" else line
                }.toMutableList()
            } else {
                lines.add("connection-throttle=0")
            }
            
            Files.write(serverProperties.toPath(), lines)
        } else {
            logger.lifecycle("Creating server.properties with online-mode=false and connection-throttle=0")
            Files.write(serverProperties.toPath(), listOf("online-mode=false", "connection-throttle=0"))
        }

        // Configure bukkit.yml settings
        configureBukkitSettings(runDirectory)

        // Create plugins directory if it doesn't exist
        val pluginsDir = File(runDirectory, "plugins")
        if (!pluginsDir.exists()) {
            logger.lifecycle("Creating plugins directory: ${pluginsDir.absolutePath}")
            pluginsDir.mkdirs()
        }
        
        // Copy the project plugin to the server
        if (pluginJar.isPresent) {
            val jarFile = pluginJar.get()
            if (jarFile.exists()) {
                logger.lifecycle("Installing plugin: ${jarFile.name}")
                Files.copy(jarFile.toPath(), File(pluginsDir, jarFile.name).toPath(), StandardCopyOption.REPLACE_EXISTING)
            } else {
                logger.warn("Plugin jar configured but does not exist: $jarFile")
            }
        }

        // Download Paper server if needed
        val serverJarFile = File(serverJar)
        if (!serverJarFile.exists()) {
            if (shouldAutoDownload) {
                logger.lifecycle("Server JAR not found. Downloading Paper server for Minecraft $mcVersion...")
                downloadPaperServer(mcVersion, serverJarFile)
            } else {
                throw RuntimeException("Server JAR not found at $serverJar and autoDownloadServer is disabled")
            }
        }

        // Check tests directory
        val userTestsDirectory = if (testsDir.isPresent) {
            testsDir.get().asFile
        } else {
            logger.warn("Tests directory not configured")
            return
        }
        
        if (!userTestsDirectory.exists()) {
            logger.warn("Tests directory does not exist: ${userTestsDirectory.absolutePath}")
            return
        }

        // Install dependencies if needed
        if (!File(userTestsDirectory, "node_modules").exists()) {
            logger.lifecycle("Installing Node.js dependencies...")
            runCommand(userTestsDirectory, "npm", "install")
        }

        // Build TypeScript tests if tsconfig.json exists
        val tsconfigFile = File(userTestsDirectory, "tsconfig.json")
        if (tsconfigFile.exists()) {
            logger.lifecycle("TypeScript config found, compiling tests...")
            runCommand(userTestsDirectory, "npm", "run", "build")
        } else {
            logger.lifecycle("No TypeScript config found, running JavaScript tests directly")
        }

        // Build JVM arguments string for the runner
        val finalJvmArgs = serverArgs.toMutableList()
        
        // Ensure EULA argument is present if acceptEula is true
        if (shouldAcceptEula && !finalJvmArgs.any { it.contains("eula.agree") }) {
            finalJvmArgs.add("-Dcom.mojang.eula.agree=true")
        }
        
        val jvmArgsString = finalJvmArgs.joinToString(" ")

        // Run Tests using the npm package
        val javaPath = if (javaLauncher.isPresent) {
            javaLauncher.get().executablePath.asFile.absolutePath
        } else {
            File(System.getProperty("java.home"), "bin/java" + if (System.getProperty("os.name").lowercase().contains("win")) ".exe" else "").absolutePath
        }

        logger.lifecycle("Running E2E tests...")
        logger.lifecycle("Server JAR: $serverJar")
        logger.lifecycle("JVM Args: $jvmArgsString")

        val envMap = mutableMapOf(
            "SERVER_JAR" to serverJar.trim(),
            "SERVER_DIR" to serverDirectory.trim(),
            "JAVA_PATH" to javaPath,
            "JVM_ARGS" to jvmArgsString
        )

        if (testFiles.isPresent) {
            val fileFilter = testFiles.get()
            envMap["TEST_FILES"] = fileFilter
            logger.lifecycle("Test files filter: $fileFilter")
        }

        if (testNames.isPresent) {
            val nameFilter = testNames.get()
            envMap["TEST_NAMES"] = nameFilter
            logger.lifecycle("Test names filter: $nameFilter")
        }

        runCommand(
            userTestsDirectory, 
            "node", "node_modules/@drownek/paper-e2e-runner/dist/cli.js",
            env = envMap
        )
        
        logger.lifecycle("E2E tests completed successfully")
    }

    private fun downloadPaperServer(version: String, destination: File) {
        val httpClient = HttpClient.newBuilder().build()
        
        try {
            // Step 1: Get the latest build number for this version
            logger.lifecycle("Fetching latest Paper build for Minecraft $version...")
            
            val versionInfoUrl = "https://api.papermc.io/v2/projects/paper/versions/$version"
            val versionRequest = HttpRequest.newBuilder()
                .uri(URI.create(versionInfoUrl))
                .GET()
                .build()
            
            val versionResponse = httpClient.send(versionRequest, HttpResponse.BodyHandlers.ofString())
            
            if (versionResponse.statusCode() != 200) {
                throw RuntimeException("Failed to fetch Paper version info. Status: ${versionResponse.statusCode()}. Make sure Minecraft version '$version' is valid.")
            }
            
            val versionJson = JsonParser.parseString(versionResponse.body()).asJsonObject
            val buildsArray = versionJson.getAsJsonArray("builds")
            
            if (buildsArray.size() == 0) {
                throw RuntimeException("No builds found for Minecraft version $version")
            }
            
            val latestBuild = buildsArray.last().asInt
            logger.lifecycle("Found latest build: $latestBuild")
            
            // Step 2: Get the download name for this build
            val buildInfoUrl = "https://api.papermc.io/v2/projects/paper/versions/$version/builds/$latestBuild"
            val buildRequest = HttpRequest.newBuilder()
                .uri(URI.create(buildInfoUrl))
                .GET()
                .build()
            
            val buildResponse = httpClient.send(buildRequest, HttpResponse.BodyHandlers.ofString())
            
            if (buildResponse.statusCode() != 200) {
                throw RuntimeException("Failed to fetch build info. Status: ${buildResponse.statusCode()}")
            }
            
            val buildJson = JsonParser.parseString(buildResponse.body()).asJsonObject
            val downloadsJson = buildJson.getAsJsonObject("downloads")
            val applicationJson = downloadsJson.getAsJsonObject("application")
            val downloadName = applicationJson.get("name").asString
            
            // Step 3: Download the JAR
            val downloadUrl = "https://api.papermc.io/v2/projects/paper/versions/$version/builds/$latestBuild/downloads/$downloadName"
            logger.lifecycle("Downloading Paper server from: $downloadUrl")
            
            val downloadRequest = HttpRequest.newBuilder()
                .uri(URI.create(downloadUrl))
                .GET()
                .build()
            
            val downloadResponse = httpClient.send(downloadRequest, HttpResponse.BodyHandlers.ofInputStream())
            
            if (downloadResponse.statusCode() != 200) {
                throw RuntimeException("Failed to download Paper server. Status: ${downloadResponse.statusCode()}")
            }
            
            // Create parent directories if needed
            destination.parentFile?.mkdirs()
            
            // Save the file
            Files.copy(downloadResponse.body(), destination.toPath(), StandardCopyOption.REPLACE_EXISTING)
            
            logger.lifecycle("Paper server downloaded successfully to: ${destination.absolutePath}")
            
        } catch (e: Exception) {
            throw RuntimeException("Failed to download Paper server: ${e.message}", e)
        }
    }

    private fun configureBukkitSettings(serverDirectory: File) {
        val bukkitYmlFile = File(serverDirectory, "bukkit.yml")

        try {
            val dumperOptions = DumperOptions().apply {
                defaultFlowStyle = DumperOptions.FlowStyle.BLOCK
                isPrettyFlow = true
            }
            val yaml = Yaml(dumperOptions)

            val bukkitConfig: MutableMap<String, Any> = if (bukkitYmlFile.exists()) {
                val content = bukkitYmlFile.readText()
                yaml.load(content) ?: mutableMapOf()
            } else {
                mutableMapOf()
            }

            // Ensure settings section exists
            @Suppress("UNCHECKED_CAST")
            val settings = bukkitConfig.getOrPut("settings") { mutableMapOf<String, Any>() } as MutableMap<String, Any>

            // Set connection-throttle to 0
            settings["connection-throttle"] = 0

            // Write back to file
            val updatedContent = yaml.dump(bukkitConfig)
            bukkitYmlFile.writeText(updatedContent)
            logger.lifecycle("Set connection-throttle to 0 in bukkit.yml")
        } catch (e: Exception) {
            logger.warn("Warning: Could not configure bukkit.yml: ${e.message}")
        }
    }

    private fun runCommand(dir: File, vararg command: String, env: Map<String, String> = emptyMap()) {
        val isWindows = System.getProperty("os.name").lowercase().contains("win")
        val cmd = if (isWindows && (command[0] == "npm" || command[0] == "node")) {
            listOf("cmd", "/c") + command
        } else {
            command.toList()
        }

        val processBuilder = ProcessBuilder(cmd)
        processBuilder.directory(dir)
        processBuilder.environment().putAll(env)
        
        val process = processBuilder.start()

        // Capture stdout
        val stdoutThread = Thread {
            process.inputStream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { logger.lifecycle(it) }
            }
        }
        
        // Capture stderr
        val stderrThread = Thread {
            process.errorStream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { logger.error(it) }
            }
        }

        stdoutThread.start()
        stderrThread.start()

        val exitCode = process.waitFor()
        stdoutThread.join()
        stderrThread.join()

        if (exitCode != 0) {
            throw RuntimeException("Command '${command.joinToString(" ")}' failed with exit code: $exitCode")
        }
    }
}
