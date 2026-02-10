# Paper E2E Test Framework

End-to-end testing framework for Paper/Spigot Minecraft plugins with support for both JavaScript and TypeScript.

## Features

* 🚀 **Fast & Simple Setup** – Start testing in minutes with automated server lifecycle management and Paper server downloads.
* 🎮 **Realistic Bot Testing** – Powered by Mineflayer for authentic player interaction.
* 🎭 **Playwright-inspired API** – Familiar patterns using live handles and locators for intuitive scripting.
* 🧪 **Type-Safe** – Native JavaScript and TypeScript support with full type safety.
* 🔄 **Automatic Retries** – Built-in retry logic to eliminate flaky tests and ensure stability.
* 📊 **Rich Assertions** – Custom matchers specifically designed for Minecraft mechanics.
* 🔧 **Gradle Integration** – Run your entire suite with a single command.

## Quick Start

### 1. Add Gradle Plugin

```kotlin
plugins {
    id("io.github.drownek.paper-e2e") version "1.1.0"
}

paperE2E {
    minecraftVersion.set("1.19.4")
    runDir.set("run")
    testsDir.set(file("src/test/e2e"))
    autoDownloadServer.set(true)
    acceptEula.set(true)
}
```

### 2. Setup Tests

Create `src/test/e2e/package.json`:
```json
{
  "type": "module",
  "dependencies": {
    "@drownek/paper-e2e-runner": "^1.1.0"
  }
}
```

Run `npm install` in `src/test/e2e`.

### 3. Write Your First Test

Create `src/test/e2e/my-test.spec.js`:
```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player receives welcome message', async ({ player }) => {
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Available commands');
});
```

### 4. Run Tests

```bash
./gradlew testE2E
```

## Documentation

See the [GitHub Wiki](../../wiki) for comprehensive guides:

- [Getting Started](../../wiki/Getting-Started) - Installation and setup
- [Writing Tests](../../wiki/Writing-Tests) - Test examples and patterns
- [Matchers Reference](../../wiki/Matchers-Reference) - All available assertions
- [GUI Testing](../../wiki/GUI-Testing) - Testing inventory GUIs
- [TypeScript Support](../../wiki/TypeScript-Support) - Using TypeScript
- [Configuration](../../wiki/Configuration) - Gradle plugin options
- [Troubleshooting](../../wiki/Troubleshooting) - Common issues

## License

MIT
