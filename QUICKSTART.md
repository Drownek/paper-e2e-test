# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Build & Publish the Plugin (One Time Setup)
```bash
cd gradle-plugin
./gradlew publishToMavenLocal
```

This installs the e2e plugin to your local Maven repository.

### 2. Configure Your Plugin

In `build.gradle.kts`:

```kotlin
plugins {
    id("me.drownek.paper-e2e") version "1.0.0"
}
```

Create `src/test/e2e/package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "@drownek/paper-e2e-runner": "^1.0.0"
  }
}
```

Run `npm install` in `src/test/e2e`.

### 3. Run Tests
```bash
./gradlew testE2E
```

## ✍️ Writing Your First Test

Create `src/test/e2e/my-feature.spec.js`:

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player receives welcome message on join', async ({ player }) => {
  // Bot automatically joins the server
  // Wait for spawn to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check for welcome message
  await expect(player).toHaveReceivedMessage('Welcome');
});

test('player can use custom command', async ({ player }) => {
  // Execute your command
  await player.chat('/mycommand arg1 arg2');
  
  // Verify the response
  await expect(player).toHaveReceivedMessage('Command executed!');
});

test('player inventory has starter items', async ({ player }) => {
  // Give items via command
  await player.chat('/starter');
  
  // Check inventory
  await expect(player.inventory).toContainItem('diamond_sword');
});
```

## Testing Checklist

Before running tests, verify:
- [ ] Gradle plugin is published to Maven Local
- [ ] Node modules are installed (`npm install` in src/test/e2e)
- [ ] Server jar exists in `run/server.jar`
- [ ] Your plugin is built and in `run/plugins/` (auto-handled by testE2E task)

## 🐛 Troubleshooting

### "Cannot find module '@drownek/paper-e2e-runner'"
```bash
cd src/test/e2e
npm install
```

### "Server JAR not found"
Check that `run/server.jar` exists or `autoDownloadServer` is true in `build.gradle.kts`.

### "Plugin not found"
Check your `shadowJar` or `jar` task configuration. The runner attempts to find your built jar.

### Test timeout
- Increase timeout in runner (currently 5000ms for assertions)
- Ensure server started properly
- Check server logs in console output

### "Connection refused"
- Server might not be ready yet
- Check if port 25565 is available
- Verify no other servers are running

## 📖 API Quick Reference

### Test Function
```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('test description', async ({ player }) => {
  // test code
});
```

### Player Actions
```javascript
await player.chat('/command')        // Send chat/command
await player.chat('Hello!')          // Send chat message
await player.waitForGui('Title')     // Wait for GUI window
player.inventory                     // Access inventory
player.bot                           // Underlying Mineflayer bot
```

### Assertions
```javascript
// Chat message (partial match, 5s timeout)
await expect(player).toHaveReceivedMessage('text')

// Inventory item (5s timeout)
await expect(player.inventory).toContainItem('item_name')
```

### GUI Interaction
```javascript
const gui = await player.waitForGui('Menu Title');
await gui.clickItem('compass');  // Click item by name
```

## 🔧 Configuration

In your plugin's `build.gradle.kts`:

```kotlin
e2e {
    // defaults to src/test/e2e
    testsDir.set(file("custom/tests/path")) 
}
```

## 💡 Tips

1. **Keep tests isolated**: Each test gets a fresh bot
2. **Use descriptive names**: Make test failures easy to understand
3. **Wait for conditions**: Use assertions that auto-retry
4. **Test one thing**: Each test should verify one behavior
5. **Check server logs**: They appear in console during test runs

## 🎯 Example Test Scenarios

### Testing Commands
```javascript
test('admin command requires permission', async ({ player }) => {
  await player.chat('/admin reload');
  await expect(player).toHaveReceivedMessage('No permission');
});
```

### Testing Economy
```javascript
test('player starts with default balance', async ({ player }) => {
  await player.chat('/balance');
  await expect(player).toHaveReceivedMessage('$1000');
});
```

### Testing GUI
```javascript
test('shop menu opens correctly', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.waitForGui('Shop');
  await gui.clickItem('diamond');
  await expect(player).toHaveReceivedMessage('Purchased');
});
```

## 🚦 Next Steps

1. Write tests for your plugin's features
2. Run tests regularly during development
3. Add tests before fixing bugs (regression prevention)
4. Consider CI/CD integration (GitHub Actions, etc.)

---

Need help? Check the main README.md for detailed documentation!
