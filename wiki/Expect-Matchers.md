# Expect Matchers Reference

Complete reference for all assertion matchers available in the framework.

## Custom Minecraft Matchers

### toHaveReceivedMessage(message, strict?)

Waits for the player to receive a chat message (default timeout: 5 seconds).

```javascript
// Partial match (default)
await expect(player).toHaveReceivedMessage('Welcome');

// Exact match
await expect(player).toHaveReceivedMessage('Welcome to the server!', true);

// Negation
await expect(player).not.toHaveReceivedMessage('Error');
```

**Parameters:**
- `message` (string): Text to match
- `strict` (boolean, optional): If true, requires exact match. Default: false (contains)

### toContainItem(itemName)

Waits for the player's inventory to contain an item (default timeout: 5 seconds).

```javascript
await expect(player).toContainItem('diamond');
await expect(player).toContainItem('wooden_sword');

// Negation
await expect(player).not.toContainItem('bedrock');
```

**Parameters:**
- `itemName` (string): Minecraft item name (e.g., 'diamond', 'stone_sword')

## Basic Equality

### toBe(value)

Strict equality using `Object.is()`. Use for primitives.

```javascript
expect(42).toBe(42);
expect('hello').toBe('hello');
expect(true).toBe(true);
expect(player.username).toBe('TestBot_123');
```

### toEqual(value)

Deep equality check. Use for objects and arrays.

```javascript
expect({ x: 1, y: 2 }).toEqual({ x: 1, y: 2 });
expect([1, 2, 3]).toEqual([1, 2, 3]);

const item = { name: 'diamond', count: 5 };
expect(item).toEqual({ name: 'diamond', count: 5 });
```

## Truthiness

### toBeTruthy() / toBeFalsy()

```javascript
expect(1).toBeTruthy();
expect('text').toBeTruthy();
expect({}).toBeTruthy();

expect(0).toBeFalsy();
expect('').toBeFalsy();
expect(null).toBeFalsy();
expect(undefined).toBeFalsy();
```

### toBeNull() / toBeUndefined() / toBeDefined()

```javascript
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect(0).toBeDefined();
expect(null).toBeDefined();  // null is defined, just null
```

### toBeNaN()

```javascript
expect(NaN).toBeNaN();
expect(Number('invalid')).toBeNaN();
expect(0 / 0).toBeNaN();
```

## Numbers

### toBeGreaterThan / toBeGreaterThanOrEqual

```javascript
expect(10).toBeGreaterThan(5);
expect(10).toBeGreaterThanOrEqual(10);
expect(15).toBeGreaterThanOrEqual(10);

const inventory = player.inventory.items();
expect(inventory.length).toBeGreaterThan(0);
```

### toBeLessThan / toBeLessThanOrEqual

```javascript
expect(5).toBeLessThan(10);
expect(10).toBeLessThanOrEqual(10);
expect(5).toBeLessThanOrEqual(10);

const health = player.bot.health;
expect(health).toBeLessThanOrEqual(20);
```

### toBeCloseTo(number, precision?)

Floating-point comparison with precision (default: 2 decimal places).

```javascript
expect(3.14159).toBeCloseTo(3.14, 2);
expect(0.1 + 0.2).toBeCloseTo(0.3);
expect(Math.PI).toBeCloseTo(3.14, 2);
```

## Strings

### toMatch(regexOrString)

```javascript
expect('Hello World').toMatch(/World/);
expect('Hello World').toMatch('World');
expect(player.username).toMatch(/TestBot_\d+/);

// Negation
expect('Hello').not.toMatch(/goodbye/);
```

### toContain(substring)

```javascript
expect('Hello World').toContain('World');
expect('Error: Invalid command').toContain('Invalid');

const message = 'Welcome to the server!';
expect(message).toContain('Welcome');
```

## Arrays and Collections

### toContain(item)

```javascript
expect([1, 2, 3]).toContain(2);
expect(['a', 'b', 'c']).toContain('b');
expect(new Set(['a', 'b'])).toContain('a');

const items = player.inventory.items().map(i => i.name);
expect(items).toContain('diamond');
```

### toContainEqual(item)

Deep equality check for array items.

```javascript
expect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 1 });

const players = [
  { name: 'Alice', level: 5 },
  { name: 'Bob', level: 3 }
];
expect(players).toContainEqual({ name: 'Alice', level: 5 });
```

### toHaveLength(number)

```javascript
expect([1, 2, 3]).toHaveLength(3);
expect('hello').toHaveLength(5);
expect(player.inventory.items()).toHaveLength(5);
```

## Objects

### toHaveProperty(keyPath, value?)

```javascript
expect({ name: 'Steve' }).toHaveProperty('name');
expect({ name: 'Steve' }).toHaveProperty('name', 'Steve');

// Nested properties
expect({ user: { age: 25 } }).toHaveProperty('user.age', 25);

// Minecraft example
const item = player.inventory.items()[0];
expect(item).toHaveProperty('name');
expect(item).toHaveProperty('count');
```

### toMatchObject(object)

Subset matching for objects.

```javascript
expect({
  name: 'Steve',
  age: 30,
  location: 'Overworld'
}).toMatchObject({
  name: 'Steve',
  age: 30
});

// Partial item check
expect(item).toMatchObject({ name: 'diamond' });
```

## Exceptions

### toThrow(expected?)

```javascript
const fn = () => { throw new Error('Oops'); };

expect(fn).toThrow();
expect(fn).toThrow('Oops');
expect(fn).toThrow(/Oops/);
expect(fn).toThrow(Error);

// No exception expected
expect(() => { return 'success'; }).not.toThrow();
```

### toThrowAsync(expected?)

Async version for async functions.

```javascript
const asyncFn = async () => { 
  throw new Error('Async error'); 
};

await expect(asyncFn).toThrowAsync();
await expect(asyncFn).toThrowAsync('Async error');
await expect(asyncFn).toThrowAsync(/error/);

// No exception expected
await expect(async () => 'success').not.toThrowAsync();
```

## Types

### toBeInstanceOf(class)

```javascript
expect(new Date()).toBeInstanceOf(Date);
expect(new Error()).toBeInstanceOf(Error);
expect([]).toBeInstanceOf(Array);

const item = player.inventory.items()[0];
expect(item).toBeInstanceOf(Object);
```

## Negation

All matchers support `.not` for negation:

```javascript
expect(5).not.toBe(10);
expect(null).not.toBeTruthy();
expect([1, 2, 3]).not.toContain(4);
expect({ name: 'test' }).not.toHaveProperty('age');
expect(() => 'success').not.toThrow();

// Async matchers
await expect(player).not.toHaveReceivedMessage('Error');
await expect(player).not.toContainItem('bedrock');
```

## Real-World Examples

### Complete Test Using Multiple Matchers

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player stats command displays correctly', async ({ player, server }) => {
  // Give player some items first
  await server.execute(`give ${player.username} diamond 10`);
  await server.execute(`give ${player.username} gold_ingot 5`);
  
  // Execute stats command
  await player.chat('/stats');
  
  // Check response messages
  await expect(player).toHaveReceivedMessage('Player Statistics');
  await expect(player).toHaveReceivedMessage('Diamonds');
  
  // Verify inventory state
  await expect(player).toContainItem('diamond');
  await expect(player).toContainItem('gold_ingot');
  
  // Check item counts
  const items = player.inventory.items();
  expect(items.length).toBeGreaterThan(0);
  
  const diamond = items.find(i => i.name === 'diamond');
  expect(diamond).toBeTruthy();
  expect(diamond).toHaveProperty('count', 10);
  expect(diamond.count).toBe(10);
  expect(diamond.count).toBeGreaterThanOrEqual(5);
  
  // Verify username format
  expect(player.username).toMatch(/TestBot_\d+/);
  
  // Check we didn't get error messages
  await expect(player).not.toHaveReceivedMessage('Error');
  await expect(player).not.toHaveReceivedMessage('Permission denied');
});
```

### GUI Testing with Matchers

```javascript
test('shop GUI inventory check', async ({ player, server }) => {
  await player.chat('/shop');
  const gui = await player.waitForGui('Shop');
  
  // GUI properties
  expect(gui).toBeTruthy();
  expect(gui.getTitle()).toContain('Shop');
  expect(gui.getTitle()).toMatch(/Shop/);
  
  // Find items
  const items = gui.findAllItems(item => item.name === 'diamond');
  expect(items).toBeTruthy();
  expect(items.length).toBeGreaterThan(0);
  
  // Check specific item
  const diamondItem = items[0];
  expect(diamondItem).toHaveProperty('name', 'diamond');
  expect(diamondItem).toMatchObject({ name: 'diamond' });
  
  // Click and verify purchase
  await gui.clickItem('diamond');
  await expect(player).toHaveReceivedMessage('Purchased');
  await expect(player).toContainItem('diamond');
});
```

## Assertion Tips

1. **Use appropriate matchers**: `toBe()` for primitives, `toEqual()` for objects
2. **Async matchers must be awaited**: `toHaveReceivedMessage`, `toContainItem`, `toThrowAsync`
3. **Use negation wisely**: `.not` works with all matchers
4. **Combine matchers**: Test multiple aspects of the same value
5. **Clear assertions**: Use the most specific matcher for your use case

## Error Messages

When assertions fail, you get clear error messages:

```
AssertionError: Expected 5 to be greater than 10
AssertionError: Expected [1, 2, 3] to contain 4
AssertionError: Expected function to throw an error, but it did not
AssertionError: Expected player to receive message "Welcome" within 5000ms
```

## Next Steps

- [GUI Testing](GUI-Testing) - Advanced GUI interaction patterns
- [Writing Tests](Writing-Tests) - Best practices
- [Examples](Examples) - Real-world test examples
