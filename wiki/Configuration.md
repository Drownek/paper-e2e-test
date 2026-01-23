# Configuration

Complete reference for Gradle plugin configuration options.

## Basic Configuration

In your `build.gradle.kts`:

```kotlin
e2e {
    minecraftVersion.set("1.19.4")
    runDir.set("run")
    testsDir.set(file("src/test/e2e"))
    autoDownloadServer.set(true)
    acceptEula.set(true)
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

### `runDir`

**Type:** `Property<String>`  
**Required:** No  
**Default:** `"run"`

Directory where the test server will be located.

```kotlin
runDir.set("run")
runDir.set("test-server")
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

Automatically accept Minecraft EULA, if you agree to the [Minecraft EULA](https://www.minecraft.net/en-us/eula)

```kotlin
acceptEula.set(true)
```

## Complete Example

```kotlin
plugins {
    id("me.drownek.paper-e2e") version "1.0.2"
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

e2e {
    // Server configuration
    minecraftVersion.set("1.19.4")
    runDir.set("run")
    autoDownloadServer.set(true)
    acceptEula.set(true)
    
    // Test configuration
    testsDir.set(file("src/test/e2e"))
}
```

## Tips

- Always set `acceptEula` to `true` in test environments
- Use `autoDownloadServer` for CI/CD pipelines
- Keep `runDir` in `.gitignore`

## Next Steps

- [Getting Started](Getting-Started) - Initial setup
- [Troubleshooting](Troubleshooting) - Fix common issues
