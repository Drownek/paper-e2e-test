# Basic Usage & Setup

This guide walks you through setting up the Paper E2E Test Framework for your Minecraft plugin.

## Prerequisites

- Java 17 or higher
- Gradle (Kotlin DSL)
- Node.js 18 or higher
- A Paper/Spigot plugin project

## Step 1: Add Gradle Plugin

Add the plugin to your `build.gradle.kts`:

```kotlin
plugins {
    id("me.drownek.paper-e2e") version "1.0.1"
}

repositories {
    mavenLocal()  // Required for local development
}

paperE2E {
    minecraftVersion.set("1.19.4")
    serverDir.set("run")
    testsDir.set(file("src/test/e2e"))
    autoDownloadServer.set(true)
    acceptEula.set(true)
    
    // Point to your built plugin JAR
    pluginJar.set(tasks.shadowJar.flatMap { it.archiveFile })
}
```

## Step 2: Initialize Test Directory

Create the test directory structure:

```bash
mkdir -p src/test/e2e
cd src/test/e2e
```

Create `package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "@drownek/paper-e2e-runner": "^1.0.1"
  }
}
```

Install dependencies:

```bash
npm install
```

## Step 3: Write Your First Test

Create `src/test/e2e/basic.spec.js`:

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player can connect to server', async ({ player }) => {
  // Player is automatically connected
  // Just verify the bot is spawned
  expect(player.bot.entity).toBeDefined();
});

test('player can send chat message', async ({ player }) => {
  await player.chat('Hello, world!');
  // If this doesn't throw, message was sent successfully
});

test('help command works', async ({ player }) => {
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Available commands');
});
```

## Step 4: Run Tests

Execute the tests via Gradle:

```bash
./gradlew testE2E
```

The framework will:
1. Install npm dependencies (if needed)
2. Download Paper server JAR (if `autoDownloadServer` is true)
3. Build your plugin
4. Start the server with your plugin
5. Run all test files (`*.spec.js`)
6. Generate a test report
7. Clean up

## What Happens During Test Execution

Each test gets:
- A fresh Mineflayer bot connected to the server
- Access to the `player` object for bot interactions
- Access to the `server` object for console commands

The bot lifecycle:
1. Bot connects with username `TestPlayer_<random>`
2. Waits for spawn event
3. Test function executes
4. Bot disconnects
5. Next test begins

## Project Structure

After setup, your project should look like:

```
your-plugin/
├── src/
│   ├── main/
│   │   └── java/
│   │       └── com/example/
│   │           └── YourPlugin.java
│   └── test/
│       └── e2e/
│           ├── basic.spec.js
│           ├── commands.spec.js
│           ├── package.json
│           └── node_modules/
├── build.gradle.kts
├── settings.gradle.kts
└── run/                      # Created automatically
    ├── paper.jar
    ├── plugins/
    │   └── your-plugin.jar
    └── server.properties
```

## Verifying Setup

Run this simple test to verify everything works:

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('framework is working', async ({ player, server }) => {
  // Bot connected
  expect(player.bot.username).toContain('TestPlayer_');
  
  // Server is running
  await server.execute('version');
  
  // Chat works
  await player.chat('Test message');
});
```

If this passes, you're ready to write real tests!

## Next Steps

- [TypeScript Support](TypeScript-Support) - Set up TypeScript for type safety
- [Writing Tests](Writing-Tests) - Learn testing patterns and best practices
- [GUI Testing](GUI-Testing) - Test inventory menus and GUIs
