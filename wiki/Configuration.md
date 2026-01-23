# Configuration

Complete reference for Gradle plugin configuration options.

## Basic Configuration

In your `build.gradle.kts`:

```kotlin
paperE2E {
    minecraftVersion.set("1.19.4")
    serverDir.set("run")
    testsDir.set(file("src/test/e2e"))
    autoDownloadServer.set(true)
    acceptEula.set(true)
    pluginJar.set(tasks.shadowJar.flatMap { it.archiveFile })
}
```

## Configuration Options

### `minecraftVersion`

**Type:** `Property<String>`  
**Required:** Yes  
**Default:** None

The Minecraft version to use for testing.

```kotlin
minecraftVersion.set("1.19.4")
minecraftVersion.set("1.20.1")
```

### `serverDir`

**Type:** `Property<String>`  
**Required:** No  
**Default:** `"run"`

Directory where the test server will be located.

```kotlin
serverDir.set("run")
serverDir.set("test-server")
```

### `testsDir`

**Type:** `Property<File>`  
**Required:** No  
**Default:** `file("src/test/e2e")`

Directory containing test files.

```kotlin
testsDir.set(file("src/test/e2e"))
testsDir.set(file("tests/integration"))
```

### `autoDownloadServer`

**Type:** `Property<Boolean>`  
**Required:** No  
**Default:** `true`

Automatically download Paper server JAR if not present.

```kotlin
autoDownloadServer.set(true)
autoDownloadServer.set(false) // Manually provide server.jar
```

### `acceptEula`

**Type:** `Property<Boolean>`  
**Required:** No  
**Default:** `false`

Automatically accept Minecraft EULA.

```kotlin
acceptEula.set(true)
```

⚠️ **Warning:** Only set this to `true` if you agree to the [Minecraft EULA](https://www.minecraft.net/en-us/eula).

### `pluginJar`

**Type:** `Property<File>`  
**Required:** Yes  
**Default:** None

The plugin JAR file to test.

```kotlin
// Using shadowJar task
pluginJar.set(tasks.shadowJar.flatMap { it.archiveFile })

// Using jar task
pluginJar.set(tasks.jar.flatMap { it.archiveFile })

// Custom path
pluginJar.set(file("build/libs/my-plugin-1.0.0.jar"))
```

## Complete Example

```kotlin
plugins {
    id("me.drownek.paper-e2e") version "1.0.1"
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

repositories {
    mavenLocal()
    mavenCentral()
}

paperE2E {
    // Server configuration
    minecraftVersion.set("1.19.4")
    serverDir.set("run")
    autoDownloadServer.set(true)
    acceptEula.set(true)
    
    // Test configuration
    testsDir.set(file("src/test/e2e"))
    
    // Plugin configuration
    pluginJar.set(tasks.shadowJar.flatMap { it.archiveFile })
}
```

## Multiple Minecraft Versions

To test against multiple versions, create separate configurations:

```kotlin
// Not directly supported - run tests manually for each version

tasks.register("testE2E-1.19") {
    doFirst {
        paperE2E.minecraftVersion.set("1.19.4")
    }
    finalizedBy("testE2E")
}

tasks.register("testE2E-1.20") {
    doFirst {
        paperE2E.minecraftVersion.set("1.20.1")
    }
    finalizedBy("testE2E")
}
```

## Custom Server Properties

Create a `server.properties` file in your `serverDir`:

```properties
# server.properties
online-mode=false
pvp=true
difficulty=easy
spawn-protection=0
max-players=10
```

The framework will use this file when starting the server.

## Environment Variables

You can use environment variables in your configuration:

```kotlin
paperE2E {
    minecraftVersion.set(System.getenv("MC_VERSION") ?: "1.19.4")
}
```

## Tips

- Always set `acceptEula` to `true` in test environments
- Use `autoDownloadServer` for CI/CD pipelines
- Point `pluginJar` to your build task output
- Keep `serverDir` in `.gitignore`

## Next Steps

- [Getting Started](Getting-Started) - Initial setup
- [Troubleshooting](Troubleshooting) - Fix common issues
