# Matchers Reference

Complete reference for all available assertion matchers.

## Minecraft-Specific Matchers

### `toHaveReceivedMessage(message, strict?)`

Waits for the bot to receive a message containing (or exactly matching) the text.

```javascript
await player.chat('/help');
await expect(player).toHaveReceivedMessage('Available commands');

// Strict mode requires exact match
await expect(player).toHaveReceivedMessage('Exact message', true);
```

**Parameters:**
- `message` (string) - Text to search for
- `strict` (boolean) - Require exact match (default: false)

**Timeout:** 5 seconds

### `toContainItem(itemName)`

Waits for the player's inventory to contain an item with the specified name.

```javascript
await server.execute(`give ${player.username} diamond 5`);
await expect(player).toContainItem('diamond');
```

**Parameters:**
- `itemName` (string) - Minecraft item name

**Timeout:** 5 seconds

## Basic Equality

### `toBe(value)`

Strict equality check using `Object.is()`. Use for primitives.

```javascript
expect(42).toBe(42);
expect('hello').toBe('hello');
expect(true).toBe(true);
```

### `toEqual(value)`

Deep equality check. Use for objects and arrays.

```javascript
expect({ name: 'Steve' }).toEqual({ name: 'Steve' });
expect([1, 2, 3]).toEqual([1, 2, 3]);
```

## Truthiness

```javascript
expect(1).toBeTruthy();
expect(0).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect(0).toBeDefined();
expect(NaN).toBeNaN();
```

## Numbers

```javascript
expect(10).toBeGreaterThan(5);
expect(10).toBeGreaterThanOrEqual(10);
expect(5).toBeLessThan(10);
expect(10).toBeLessThanOrEqual(10);
expect(0.1 + 0.2).toBeCloseTo(0.3);
```

## Strings

```javascript
expect('Hello World').toMatch(/World/);
expect('Hello World').toMatch('World');
expect('Hello World').toContain('World');
```

## Arrays

```javascript
expect([1, 2, 3]).toContain(2);
expect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 1 });
expect([1, 2, 3]).toHaveLength(3);
```

## Objects

```javascript
expect({ name: 'Steve' }).toHaveProperty('name');
expect({ name: 'Steve' }).toHaveProperty('name', 'Steve');
expect({ user: { age: 25 } }).toHaveProperty('user.age', 25);

expect({
  name: 'Steve',
  age: 30,
  location: 'Overworld'
}).toMatchObject({
  name: 'Steve',
  age: 30
});
```

## Exceptions

```javascript
const fn = () => { throw new Error('Oops'); };

expect(fn).toThrow();
expect(fn).toThrow('Oops');
expect(fn).toThrow(/Oops/);
expect(fn).toThrow(Error);

// For async functions
const asyncFn = async () => { throw new Error('Async error'); };
await expect(asyncFn).toThrowAsync();
await expect(asyncFn).toThrowAsync('Async error');
```

## Types

```javascript
expect(new Date()).toBeInstanceOf(Date);
expect(new Error()).toBeInstanceOf(Error);
expect([]).toBeInstanceOf(Array);
```

## Negation

All matchers support `.not`:

```javascript
expect(5).not.toBe(10);
expect(null).not.toBeTruthy();
expect([1, 2, 3]).not.toContain(4);
expect({ name: 'test' }).not.toHaveProperty('age');
expect(() => 'success').not.toThrow();
```

## Complete Example

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('comprehensive test example', async ({ player, server }) => {
  // Minecraft-specific assertions
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Available');
  
  await server.execute(`give ${player.username} diamond 5`);
  await expect(player).toContainItem('diamond');
  
  // Standard assertions
  const count = player.inventory.items().length;
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(36);
  
  const item = player.inventory.items()[0];
  expect(item).toBeTruthy();
  expect(item.name).toMatch('diamond');
});
```

## Tips

- Use `toBe()` for primitives and `toEqual()` for objects/arrays
- Async matchers must be awaited
- All matchers support `.not` for negation
- Minecraft matchers have a 5-second timeout
