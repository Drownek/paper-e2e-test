# GUI Testing

Testing Minecraft inventory GUIs is a core feature of the framework. The v1.3.0 API uses live handles and locators, inspired by Playwright, for reactive and reliable GUI interactions.

## Quick Start

```javascript
test('interact with shop GUI', async ({ player }) => {
  await player.chat('/shop');
  
  // Get a live handle to the GUI
  const gui = await player.gui({ title: /Shop/ });
  
  // Create a locator for an item
  const diamondItem = gui.locator(item => item.name.includes('diamond'));
  
  // Click the item (with automatic retry)
  await diamondItem.click();
  
  await expect(player).toHaveReceivedMessage('Purchased');
});
```

## Core Concepts

### Live Handles vs Snapshots

**Live Handle** (`LiveGuiHandle`) - Always reflects the player's current GUI state:
- Returned by `player.gui({ title })`
- Automatically updates when GUI changes
- Use for dynamic, reactive testing

**Snapshot** (`GuiWrapper`) - Captures GUI state at a specific moment:
- Legacy API, now deprecated
- Use live handles for new code

### Locators

Locators are queries that re-evaluate each time they're used:
```javascript
const item = gui.locator(i => i.name === 'diamond');
// Locator doesn't fetch immediately - it's a query definition
```

## Modern API (v1.1.0+)

### `player.gui({ title, timeout? })`

Gets a live handle to a GUI matching the title pattern.

**Parameters:**
- `title` (string | RegExp) - Pattern to match GUI title
- `timeout` (number, optional) - Max wait time in ms (default: 5000)

**Returns:** `LiveGuiHandle`

**Examples:**
```javascript
// String match
const gui = await player.gui({ title: 'Shop' });

// RegEx match
const gui = await player.gui({ title: /Staff Activity/i });

// Custom timeout
const gui = await player.gui({ title: 'Admin', timeout: 10000 });
```

### `gui.locator(predicate)`

Creates a locator for items matching the predicate.

**Parameters:**
- `predicate` (function) - `(item: ItemWrapper) => boolean`

**Returns:** `GuiItemLocator`

**Examples:**
```javascript
// By item name
const compass = gui.locator(i => i.name === 'compass');

// By display name
const item = gui.locator(i => i.getDisplayName().includes('Session'));

// By lore
const item = gui.locator(i => i.hasLore('Click to view'));

// Multiple conditions
const item = gui.locator(i => 
  i.name === 'paper' && i.count > 1
);
```

### `locator.click(options?)`

Clicks the located item with automatic retry.

**Parameters:**
- `options.timeout` (number, optional) - Max wait time (default: 5000ms)

**Examples:**
```javascript
const item = gui.locator(i => i.name === 'diamond');
await item.click();

// Custom timeout
await item.click({ timeout: 10000 });
```

### `locator.displayName()`

Gets the display name of the located item (re-queries each call).

```javascript
const item = gui.locator(i => i.name === 'paper');
const name = item.displayName();
console.log(name); // "Session Log"
```

### `locator.loreText()`

Gets the lore text of the located item (re-queries each call).

```javascript
const item = gui.locator(i => i.name === 'clock');
const lore = item.loreText();
console.log(lore); // "From: 2024-01-01 To: 2024-01-02"
```

### `expect(locator).toHaveLore(text, options?)`

Asserts that a locator's item contains specific lore text, with automatic retry.

**Parameters:**
- `text` (string) - Text that should appear in lore
- `options.timeout` (number, optional) - Max wait time (default: 5000ms)
- `options.pollingRate` (number, optional) - Check interval (default: 100ms)

**Examples:**
```javascript
const item = gui.locator(i => i.name === 'clock');

// Basic assertion
await expect(item).toHaveLore('Session');

// With timeout
await expect(item).toHaveLore('messages', { timeout: 10000 });

// Negative assertion
await expect(item).not.toHaveLore('error');
```

### `gui.title`

Gets the current GUI title (or undefined if closed).

```javascript
const gui = await player.gui({ title: 'Shop' });
console.log(gui.title); // "Shop Menu"
```

## Complete Examples

### Permission Test
```javascript
test('command requires permission', async ({ player }) => {
  await player.chat('/admin');
  await expect(player).toHaveReceivedMessage('You don\'t have permission');
});

test('admin can open admin panel', async ({ player }) => {
  await player.makeOp();
  await player.chat('/admin');
  
  const gui = await player.gui({ title: 'Admin' });
  expect(gui.title).toContain('Admin');
});
```

### Item Interaction
```javascript
test('clicking GUI item triggers callback', async ({ player }) => {
  await player.makeOp();
  await player.chat('/example gui-settings');
  
  const gui = await player.gui({ title: 'guiSettings' });
  const item = gui.locator(item => item.getDisplayName().includes('guiItemInfo'));
  
  await item.click();
  await expect(player).toHaveReceivedMessage('You clicked on item');
});
```

### Dynamic Lore Testing
```javascript
test('activity log shows correct data', async ({ player }) => {
  await player.makeOp();
  await player.chat('/staffactivity view');
  
  const gui = await player.gui({ title: /Staff activity/ });
  
  // Locator for message counter
  const messageItem = gui.locator(i => i.hasLore('messages'));
  
  // Wait for lore to update
  await expect(messageItem).toHaveLore('messages');
  
  // Verify lore contains expected data
  const lore = messageItem.loreText();
  expect(lore).toContain('Session');
});
```

### Paginated GUIs
```javascript
test('navigate through pages', async ({ player }) => {
  await player.chat('/warps');
  const gui = await player.gui({ title: 'Warps' });
  
  // Check first page
  const firstItem = gui.locator(i => i.getDisplayName().includes('Spawn'));
  await firstItem.click();
  
  // Reopen and check next page
  await player.chat('/warps');
  const nextButton = gui.locator(i => i.name === 'arrow');
  await nextButton.click();
  
  const secondItem = gui.locator(i => i.getDisplayName().includes('Arena'));
  expect(secondItem.displayName()).toContain('Arena');
});
```

## Player Helper Methods

### `player.makeOp()`

Grants operator status to the player.

```javascript
await player.makeOp();
await player.chat('/admin'); // Now has permission
```

### `player.deOp()`

Removes operator status from the player.

```javascript
await player.deOp();
```

### `player.setGameMode(mode)`

Changes the player's game mode.

**Parameters:**
- `mode` - 'survival' | 'creative' | 'adventure' | 'spectator'

```javascript
await player.setGameMode('creative');
```

### `player.teleport(x, y, z)`

Teleports the player to coordinates.

```javascript
await player.teleport(0, 100, 0);
```

### `player.giveItem(item, count?)`

Gives items to the player.

```javascript
await player.giveItem('diamond', 64);
```

## Legacy API (Deprecated)

The following methods are deprecated in v1.1.0. Use the modern API instead.

### `player.waitForGui(guiMatcher, options?)` ⚠️ Deprecated

Use `player.gui({ title })` instead.

**Migration:**
```javascript
// Old
const gui = await player.waitForGui(g => g.title.includes('Shop'));

// New
const gui = await player.gui({ title: /Shop/ });
```

### `gui.findItem(predicate)` ⚠️ Deprecated

Use `gui.locator(predicate)` instead.

**Migration:**
```javascript
// Old
const item = gui.findItem(i => i.name === 'diamond');

// New
const item = gui.locator(i => i.name === 'diamond');
```

### `gui.clickItem(predicate)` ⚠️ Deprecated

Use `gui.locator(predicate).click()` instead.

**Migration:**
```javascript
// Old
await gui.clickItem(i => i.name === 'diamond');

// New
await gui.locator(i => i.name === 'diamond').click();
```

## Tips

- GUI operations are async - always use `await`
- Locators are reactive - they re-query on each use
- Use `expect(locator).toHaveLore()` for dynamic content
- Custom display names differ from Minecraft item names
- Check logs if GUI doesn't open - the command might have failed

## Next Steps

- [Examples](Examples) - More real-world GUI test examples
- [Writing Tests](Writing-Tests) - Basic test patterns
