# Writing Tests

## Basic Test Structure

Tests use a simple API similar to Jest:

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('test description', async ({ player }) => {
  // Your test code here
});
```

## Your First Test

Create `src/test/e2e/first.spec.js`:

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player receives welcome message', async ({ player }) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  await expect(player).toHaveReceivedMessage('Welcome');
});
```

## Common Test Patterns

### Testing Commands

```javascript
test('help command works', async ({ player }) => {
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Available commands');
});

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

test('player can purchase items', async ({ player, server }) => {
  await server.execute(`eco give ${player.username} 500`);
  await player.chat('/buy diamond');
  await expect(player).toHaveReceivedMessage('Purchased');
  await expect(player).toContainItem('diamond');
});
```

### Testing Inventory

```javascript
test('player inventory has starter items', async ({ player }) => {
  await player.chat('/starter');
  await expect(player).toContainItem('diamond_sword');
  await expect(player).toContainItem('bread');
});
```

### Server Operations

```javascript
test('server executes commands', async ({ player, server }) => {
  await server.execute(`op ${player.username}`);
  await server.execute(`give ${player.username} diamond 64`);
  await expect(player).toContainItem('diamond');
});
```

## API Reference

### Test Context

Each test receives a context object with:

- `player` - The Mineflayer bot instance
- `server` - Server control interface (future feature)

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
await expect(player).toContainItem('item_name')
```

See [Matchers Reference](Matchers-Reference) for all available assertions.

## Best Practices

1. **Keep tests isolated** - Each test gets a fresh bot
2. **Use descriptive names** - Make test failures easy to understand
3. **Wait for conditions** - Use assertions that auto-retry
4. **Test one thing** - Each test should verify one behavior
5. **Check server logs** - They appear in console during test runs
6. **Add delays when needed** - Use `setTimeout` for timing-dependent tests

## Tips

- Tests run sequentially, not in parallel
- Server starts fresh for each test run
- Bot automatically connects to the server
- Server logs are visible in the console output

## Next Steps

- [GUI Testing](GUI-Testing) - Learn how to test inventory GUIs
- [Matchers Reference](Matchers-Reference) - Explore all available assertions
- [Examples](Examples) - See more real-world examples
