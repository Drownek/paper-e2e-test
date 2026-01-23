# Getting Started

## Prerequisites

- Java 17 or higher
- Gradle 7.0 or higher
- Node.js 16 or higher
- A Paper/Spigot plugin project

## Installation

### 1. Build & Publish the Plugin (One Time Setup)

First, publish the Gradle plugin to your local Maven repository:

```bash
cd gradle-plugin
./gradlew publishToMavenLocal
```

### 2. Configure Your Plugin

Add the plugin to your `build.gradle.kts`:

```kotlin
plugins {
    id("me.drownek.paper-e2e") version "1.0.1"
}

repositories {
    mavenLocal()
}

paperE2E {
    minecraftVersion.set("1.19.4")
    serverDir.set("run")
    testsDir.set(file("src/test/e2e"))
    autoDownloadServer.set(true)
    acceptEula.set(true)
    pluginJar.set(tasks.shadowJar.flatMap { it.archiveFile })
}
```

### 3. Setup Test Directory

Create `src/test/e2e/package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "@drownek/paper-e2e-runner": "^1.0.0"
  }
}
```

Install dependencies:

```bash
cd src/test/e2e
npm install
```

### 4. Run Tests

```bash
./gradlew testE2E
```

## Project Structure

After setup, your project will look like:

```
your-plugin/
├── src/
│   ├── main/java/          # Your plugin code
│   └── test/e2e/           # E2E tests
│       ├── *.spec.js       # Test files
│       ├── package.json
│       └── node_modules/
├── build.gradle.kts
└── run/                    # Server (auto-created)
    ├── server.jar
    └── plugins/
```

## Next Steps

- [Writing Tests](Writing-Tests) - Learn how to write your first test
- [Configuration](Configuration) - Customize the test environment
