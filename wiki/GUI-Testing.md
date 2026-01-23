# GUI Testing

Testing Minecraft inventory GUIs is a core feature of the framework.

## Basic GUI Testing

### Opening and Waiting for GUIs

```javascript
test('shop GUI opens', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.waitForGui('Shop');
  
  expect(gui.getTitle()).toContain('Shop');
});
```

### Clicking Items

```javascript
test('clicking shop item', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.waitForGui('Shop');
  
  await gui.clickItem('diamond');
  
  await expect(player).toHaveReceivedMessage('Purchased');
});
```

## GUI API Reference

### `player.waitForGui(title, timeout?)`

Waits for a GUI window to open with the specified title.

**Parameters:**
- `title` (string) - GUI window title (partial match)
- `timeout` (number) - Timeout in ms (default: 5000)

**Returns:** GUI object

**Example:**
```javascript
const gui = await player.waitForGui('Shop', 10000);
```

### `gui.getTitle()`

Returns the GUI window title.

```javascript
const title = gui.getTitle();
expect(title).toBe('Shop Menu');
```

### `gui.clickItem(itemName)`

Clicks an item in the GUI by name.

**Parameters:**
- `itemName` (string) - Minecraft item name

**Example:**
```javascript
await gui.clickItem('diamond');
await gui.clickItem('compass');
```

### `gui.findItem(predicate)`

Finds a single item matching the predicate function.

**Parameters:**
- `predicate` (function) - Function that returns true for matching items

**Returns:** Item object or null

**Example:**
```javascript
const sessionEntry = gui.findItem(item => 
  item.getDisplayName().includes('Session')
);

if (sessionEntry) {
  console.log(sessionEntry.getDisplayName());
}
```

### `gui.findAllItems(predicate)`

Finds all items matching the predicate function.

**Parameters:**
- `predicate` (function) - Function that returns true for matching items

**Returns:** Array of item objects

**Example:**
```javascript
const logs = gui.findAllItems(item => item.name === 'paper');
expect(logs.length).toBeGreaterThan(0);
```

## Item Object

Items returned by `findItem` and `findAllItems` have these properties:

- `name` - Minecraft item name (e.g., 'diamond', 'paper')
- `count` - Stack count
- `getDisplayName()` - Custom display name
- `hasLore(text)` - Check if lore contains text

## Complete Example

```javascript
test('Activity Report GUI displays correctly', async ({ player, server }) => {
  // Open stats GUI
  await player.chat('/stats');
  const gui = await player.waitForGui('Activity Report');
  
  // Verify title
  expect(gui.getTitle()).toContain('Activity Report');
  
  // Find specific entry
  const sessionEntry = gui.findItem(item => 
    item.getDisplayName().includes('Session')
  );
  
  expect(sessionEntry).toBeTruthy();
  expect(sessionEntry.hasLore('From')).toBe(true);
  expect(sessionEntry.hasLore('To')).toBe(true);
  
  // Check all logs
  const logs = gui.findAllItems(item => item.name === 'paper');
  expect(logs.length).toBeGreaterThan(0);
  
  const messageCount = logs.reduce((sum, log) => sum + log.count, 0);
  expect(messageCount).toBeGreaterThanOrEqual(2);
  
  // Verify something doesn't exist
  const playerEntry = gui.findItem(item => 
    item.getDisplayName().includes('Player')
  );
  expect(playerEntry).toBeFalsy();
});
```

## Common Patterns

### Testing Shop Purchase

```javascript
test('shop purchase flow', async ({ player, server }) => {
  await server.execute(`eco give ${player.username} 1000`);
  await player.chat('/shop');
  
  const gui = await player.waitForGui('Shop');
  await gui.clickItem('diamond');
  
  await expect(player).toHaveReceivedMessage('Purchased');
  await expect(player).toContainItem('diamond');
});
```

### Testing Paginated GUI

```javascript
test('paginated menu navigation', async ({ player }) => {
  await player.chat('/warps');
  const gui = await player.waitForGui('Warps');
  
  // Check first page
  const firstWarp = gui.findItem(item => 
    item.getDisplayName().includes('Spawn')
  );
  expect(firstWarp).toBeTruthy();
  
  // Navigate to next page
  await gui.clickItem('arrow');
  
  // Check second page
  const secondWarp = gui.findItem(item => 
    item.getDisplayName().includes('Arena')
  );
  expect(secondWarp).toBeTruthy();
});
```

### Checking GUI Contents

```javascript
test('admin GUI has correct items', async ({ player, server }) => {
  await server.execute(`op ${player.username}`);
  await player.chat('/admin');
  
  const gui = await player.waitForGui('Admin Panel');
  
  const items = gui.getItems(); // Get all items
  expect(items.length).toBeGreaterThan(5);
  
  const reloadButton = gui.findItem(item => 
    item.getDisplayName() === 'Reload Config'
  );
  expect(reloadButton).toBeTruthy();
});
```

## Tips

- GUI operations are async - always use `await`
- Use `findItem` for single items, `findAllItems` for collections
- Custom display names differ from Minecraft item names
- Check logs if GUI doesn't open - the command might have failed

## Next Steps

- [Examples](Examples) - More real-world GUI test examples
- [Writing Tests](Writing-Tests) - Basic test patterns
