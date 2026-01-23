# Troubleshooting

Common issues and their solutions.

## Installation Issues

### "Cannot find module '@drownek/paper-e2e-runner'"

**Cause:** npm dependencies not installed.

**Solution:**
```bash
cd src/test/e2e
npm install
```

### "Plugin 'me.drownek.paper-e2e' not found"

**Cause:** Gradle plugin not published to Maven Local.

**Solution:**
```bash
cd gradle-plugin
./gradlew publishToMavenLocal
```

## Server Issues

### "Server JAR not found"

**Cause:** Paper server not downloaded.

**Solution 1 - Auto download:**
```kotlin
paperE2E {
    autoDownloadServer.set(true)
}
```

**Solution 2 - Manual:**
Download Paper server manually to `run/server.jar`.

### "Failed to bind to port 25565"

**Cause:** Another server is running on port 25565.

**Solution:**
1. Stop the running server
2. Check for other Minecraft instances
3. Kill the process using port 25565

**Windows:**
```bash
netstat -ano | findstr :25565
taskkill /PID <process_id> /F
```

**Linux/Mac:**
```bash
lsof -i :25565
kill -9 <process_id>
```

### "Server failed to start"

**Cause:** Various server startup issues.

**Diagnostics:**
1. Check server logs in console output
2. Verify Java version (17+ required)
3. Check `run/logs/latest.log`
4. Ensure EULA is accepted

**Solution:**
```kotlin
paperE2E {
    acceptEula.set(true)
}
```

## Test Issues

### "Test timeout"

**Cause:** Server not ready or assertion waiting too long.

**Solutions:**

1. **Increase wait time before assertions:**
```javascript
await new Promise(resolve => setTimeout(resolve, 2000));
await expect(player).toHaveReceivedMessage('text');
```

2. **Check server logs** - Server might have crashed

3. **Verify command works** - Test the command in-game first

### "Connection refused"

**Cause:** Bot trying to connect before server is ready.

**Solution:**
Wait for server startup (handled automatically, but if issues persist):

```javascript
test('my test', async ({ player }) => {
  // Add delay if needed
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Continue test...
});
```

### "Player not receiving messages"

**Cause:** Message sent before event listener registered.

**Solution:**
Add a small delay after joining:

```javascript
test('message test', async ({ player }) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  await expect(player).toHaveReceivedMessage('Welcome');
});
```

### "Plugin not found in server"

**Cause:** Plugin JAR not copied to plugins folder.

**Solution:**
Verify `pluginJar` configuration:

```kotlin
paperE2E {
    pluginJar.set(tasks.shadowJar.flatMap { it.archiveFile })
}
```

Ensure your build task completes before running tests:
```bash
./gradlew build testE2E
```

## TypeScript Issues

### "TypeScript compilation failed"

**Cause:** TypeScript configuration or syntax errors.

**Solutions:**

1. **Check tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

2. **Install TypeScript:**
```bash
npm install -D typescript
```

3. **Check for syntax errors** in your `.ts` files

### "Module not found in TypeScript"

**Cause:** Missing type definitions.

**Solution:**
```bash
npm install -D @types/node
```

## GUI Testing Issues

### "GUI not opening"

**Cause:** Command failed or GUI title mismatch.

**Solutions:**

1. **Check exact title:**
```javascript
// Wrong - title might not match exactly
const gui = await player.waitForGui('Shop');

// Right - use partial match
const gui = await player.waitForGui('Shop Menu');
```

2. **Verify command works:**
Test the command in-game first.

3. **Add delay before waiting:**
```javascript
await player.chat('/shop');
await new Promise(resolve => setTimeout(resolve, 500));
const gui = await player.waitForGui('Shop');
```

### "Item not found in GUI"

**Cause:** Item name mismatch or item not present.

**Solution:**
Use `findItem` to inspect GUI contents:

```javascript
const gui = await player.waitForGui('Shop');
const allItems = gui.findAllItems(() => true);
console.log('All items:', allItems.map(i => ({ 
  name: i.name, 
  display: i.getDisplayName() 
})));
```

## Performance Issues

### "Tests running slowly"

**Causes and Solutions:**

1. **Server startup delay** - Expected on first run
2. **Too many delays** - Reduce unnecessary `setTimeout` calls
3. **Server not shutting down** - Kill lingering processes

### "Out of memory"

**Solution:**
Increase Java heap size in Gradle:

```kotlin
tasks.named("testE2E") {
    jvmArgs("-Xmx2G")
}
```

## Debugging Tips

### Enable Verbose Logging

Check server console output during test runs - it shows all server logs.

### Inspect Bot State

```javascript
test('debug test', async ({ player }) => {
  console.log('Bot username:', player.username);
  console.log('Bot position:', player.bot.entity.position);
  console.log('Inventory:', player.inventory.items());
});
```

### Manual Server Testing

1. Start server manually: `java -jar run/server.jar`
2. Connect with Minecraft client
3. Test commands manually
4. Compare behavior with test expectations

## Getting Help

If you're still stuck:

1. Check [GitHub Issues](https://github.com/yourusername/paper-e2e-test-framework/issues)
2. Review [Examples](Examples) for working code
3. Enable debug logging and share logs
4. Verify your setup matches [Getting Started](Getting-Started)

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `EADDRINUSE` | Port 25565 in use | Kill process on port 25565 |
| `MODULE_NOT_FOUND` | Missing dependencies | Run `npm install` |
| `AssertionError` | Test assertion failed | Check test logic |
| `TimeoutError` | Operation took too long | Increase timeout or fix root cause |
| `ECONNREFUSED` | Server not ready | Add delay or check server startup |
