# Configuration

Complete reference for Gradle plugin configuration options.

## Table of Contents

- [Basic Configuration](#basic-configuration)
- [Configuration Options](#configuration-options)
  - [`minecraftVersion`](#minecraftversion)
  - [`runDir`](#rundir)
  - [`testsDir`](#testsdir)
  - [`acceptEula`](#accepteula)
  - [`cleanExcludePatterns`](#cleanexcludepatterns)
  - [`useExternalPluginsOnly`](#useexternalpluginsonly)
  - [`downloadPlugins`](#downloadplugins)
  - [`writeFiles`](#writefiles)
- [Complete Example](#complete-example)
- [Next Steps](#next-steps)

---

## Basic Configuration

In your `build.gradle.kts`:

```kotlin
e2e {
    minecraftVersion.set("1.19.4")
    runDir.set("run")
    testsDir.set(file("src/test/e2e"))
    acceptEula.set(true)
    downloadPlugins {
        url("https://url.to/plugin.jar")
    }
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

### `acceptEula`

**Type:** `Property<Boolean>`  
**Required:** No  
**Default:** `false`

Automatically accept Minecraft EULA, if you agree to the [Minecraft EULA](https://www.minecraft.net/en-us/eula)

```kotlin
acceptEula.set(true)
```

### `cleanExcludePatterns`

**Type:** `Property<List<String>>`  
**Required:** No  
**Default:** `listOf("server.jar", "cache", "libraries")`

Configures which files or folders in the `runDir` should **not** be deleted when the `cleanE2E` task runs. This is useful for preserving the server JAR, dependency caches, or other persistent data between test runs.

By default, the cleanup preserves:
- `server.jar` - The Paper server executable
- `cache` - Minecraft/Paper cache folder
- `libraries` - Server dependencies

Everything else in the run directory will be deleted to ensure a clean test environment.

```kotlin
// Custom exclusions - add additional files to preserve
cleanExcludePatterns.set(listOf(
    "server.jar",
    "cache",
    "libraries"
))
```

### `useExternalPluginsOnly`

**Type:** `Property<Boolean>`  
**Required:** No  
**Default:** `false`

Whether to use only externally downloaded plugins instead of building the project plugin. When true, the `testE2E` task will not depend on jar/shadowJar/reobfJar tasks. Useful when running E2E tests with plugins downloaded from external sources only.

```kotlin
useExternalPluginsOnly.set(true)
```

### `downloadPlugins`

**Type:** `Action<DownloadPluginsSpec>`
**Required:** No

Download external plugins (like dependencies) before starting the server.

```kotlin
e2e {
    downloadPlugins {
        url("https://url/to/plugin.jar")
    }
}
```

### `writeFiles`

**Type:** `Action<RunDirFileSpec>`  
**Required:** No

Stage files into the run directory before the server starts. You can provide inline text content or copy from an existing local file. Paths are relative to the run directory.

```kotlin
e2e {
    writeFiles {
        // inline text content
        file("plugins/SomePlugin/config.yml", """
            key: "value"
        """.trimIndent())

        // copy from a local source file
        file("plugins/MyPlugin/data.json", projectDir.resolve("test-fixtures/data.json"))
    }
}
```

## Complete Example

```kotlin
e2e {
    // Server configuration
    minecraftVersion.set("1.19.4")
    runDir.set("run")
    acceptEula.set(true)
    
    // Test configuration
    testsDir.set(file("src/test/e2e"))
    
    // Cleanup configuration
    cleanExcludePatterns.set(listOf(
        "server.jar",
        "cache",
        "libraries"
    ))
}
```

## Next Steps

- [Writing Tests](Writing-Tests) - Learn testing patterns and best practices
- [Test Filtering](Test-Filtering) - Run specific tests by file or name
- [GUI Testing](GUI-Testing) - Test inventory menus and GUIs
