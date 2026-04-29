# Getting Started

## Prerequisites

- Java 17 or higher
- Gradle 7.0 or higher
- Node.js 16 or higher
- A Paper/Spigot plugin project

## Installation

### 1. Add Gradle Plugin

Add the plugin to your `build.gradle.kts`:

```kotlin
plugins {
    id("io.github.drownek.paper-e2e") version "1.3.1"
}

e2e {
    minecraftVersion.set("1.19.4")
    runDir.set("run")
    testsDir.set(file("src/test/e2e"))
    acceptEula.set(true)
}
```

**Note:** The plugin automatically detects and uses the output from `shadowJar`, `reobfJar`, or `jar` tasks, so you don't need to manually configure the plugin JAR path.

### 2. Initialize the Test Environment

To automatically scaffold your tests directory, `package.json`, `tsconfig.json`, and an example test, run:

```bash
./gradlew initE2E
```

This command will prompt you for the test directory location (defaulting to `src/test/e2e`), set up TypeScript, install dependencies, and generate an `example.spec.ts` file so you can get started immediately.

### 3. Run Tests

```bash
./gradlew testE2E
```

## What Happens During Test Execution

The framework will:
1. Install npm dependencies (if needed)
2. Download Paper server JAR (if not present)
3. Build your plugin
4. **Clean the run directory** — delete everything except files in `cleanExcludePatterns` (default: `server.jar`, `cache`, `libraries`)
5. Start the server with your plugin
6. Run all test files (`*.spec.js`, `*.spec.ts`)
7. Generate a test report
8. Shut down the server

Each test gets:
- A fresh Mineflayer bot connected to the server
- Access to the `player` object for bot interactions
- Access to the `server` object for console commands

The bot lifecycle per test:
1. Bot connects with username `Test_<random>`
2. Waits for spawn event
3. Test function executes
4. Bot disconnects
5. Next test begins

## Project Structure

After setup, your project should look like:

```
your-plugin/
├── src/
│   ├── main/java/              # Your plugin code
│   └── test/e2e/               # E2E tests
│       ├── basic.spec.js
│       ├── package.json
│       └── node_modules/
├── build.gradle.kts
└── run/                        # Created automatically
    ├── server.jar              # Preserved by cleanE2E
    ├── cache/                  # Preserved by cleanE2E
    ├── libraries/              # Preserved by cleanE2E
    ├── plugins/                # Cleaned before each run
    │   └── your-plugin.jar
    ├── world/                  # Cleaned before each run
    └── server.properties       # Cleaned before each run
```

## Next Steps

- [Writing Tests](Writing-Tests) - Learn testing patterns and best practices
- [Configuration](Configuration) - Customize cleanup behavior and other settings
- [GUI Testing](GUI-Testing) - Test inventory menus and GUIs
