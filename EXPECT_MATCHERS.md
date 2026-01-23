# Expect Matchers Reference

This framework includes a comprehensive set of Jest-like assertion matchers for your tests.

## Table of Contents

- [Basic Equality](#basic-equality)
- [Truthiness](#truthiness)
- [Numbers](#numbers)
- [Strings](#strings)
- [Arrays and Collections](#arrays-and-collections)
- [Objects](#objects)
- [Exceptions](#exceptions)
- [Types](#types)
- [Custom Minecraft Matchers](#custom-minecraft-matchers)
- [Negation](#negation)

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

### `toBeTruthy()`
Passes if value is truthy (not `false`, `0`, `''`, `null`, `undefined`, or `NaN`).

```javascript
expect(1).toBeTruthy();
expect('hello').toBeTruthy();
expect({}).toBeTruthy();
```

### `toBeFalsy()`
Passes if value is falsy.

```javascript
expect(0).toBeFalsy();
expect('').toBeFalsy();
expect(null).toBeFalsy();
expect(undefined).toBeFalsy();
```

### `toBeNull()`
Passes if value is `null`.

```javascript
expect(null).toBeNull();
```

### `toBeUndefined()`
Passes if value is `undefined`.

```javascript
expect(undefined).toBeUndefined();
```

### `toBeDefined()`
Passes if value is not `undefined`.

```javascript
expect(0).toBeDefined();
expect(null).toBeDefined();
```

### `toBeNaN()`
Passes if value is `NaN`.

```javascript
expect(NaN).toBeNaN();
expect(Number('invalid')).toBeNaN();
```

## Numbers

### `toBeGreaterThan(number)`
Passes if value is greater than the expected number.

```javascript
expect(10).toBeGreaterThan(5);
```

### `toBeGreaterThanOrEqual(number)`
Passes if value is greater than or equal to the expected number.

```javascript
expect(10).toBeGreaterThanOrEqual(10);
expect(15).toBeGreaterThanOrEqual(10);
```

### `toBeLessThan(number)`
Passes if value is less than the expected number.

```javascript
expect(5).toBeLessThan(10);
```

### `toBeLessThanOrEqual(number)`
Passes if value is less than or equal to the expected number.

```javascript
expect(10).toBeLessThanOrEqual(10);
expect(5).toBeLessThanOrEqual(10);
```

### `toBeCloseTo(number, precision?)`
Passes if floating-point value is close to expected number. Precision defaults to 2 decimal places.

```javascript
expect(3.14159).toBeCloseTo(3.14, 2);
expect(0.1 + 0.2).toBeCloseTo(0.3);
```

## Strings

### `toMatch(regexOrString)`
Passes if string matches the regex or contains the substring.

```javascript
expect('Hello World').toMatch(/World/);
expect('Hello World').toMatch('World');
```

### `toContain(item)`
For strings, checks if substring is present.

```javascript
expect('Hello World').toContain('World');
```

## Arrays and Collections

### `toContain(item)`
Passes if array, Set, or Map contains the item.

```javascript
expect([1, 2, 3]).toContain(2);
expect(new Set(['a', 'b'])).toContain('a');
```

### `toContainEqual(item)`
Passes if array contains an item that deeply equals the expected value.

```javascript
expect([{ id: 1 }, { id: 2 }]).toContainEqual({ id: 1 });
```

### `toHaveLength(number)`
Passes if array or string has the expected length.

```javascript
expect([1, 2, 3]).toHaveLength(3);
expect('hello').toHaveLength(5);
```

## Objects

### `toHaveProperty(keyPath, value?)`
Passes if object has the property. Optionally checks the value.

```javascript
expect({ name: 'Steve' }).toHaveProperty('name');
expect({ name: 'Steve' }).toHaveProperty('name', 'Steve');

// Supports nested properties with dot notation
expect({ user: { age: 25 } }).toHaveProperty('user.age', 25);
```

### `toMatchObject(object)`
Passes if object contains matching properties (subset matching).

```javascript
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

### `toThrow(expected?)`
Passes if function throws an error. Can optionally match error message or type.

```javascript
const fn = () => { throw new Error('Oops'); };

expect(fn).toThrow();
expect(fn).toThrow('Oops');
expect(fn).toThrow(/Oops/);
expect(fn).toThrow(Error);
```

### `toThrowAsync(expected?)` ⚡ async
Async version of `toThrow()` for async functions.

```javascript
const asyncFn = async () => { 
  throw new Error('Async error'); 
};

await expect(asyncFn).toThrowAsync();
await expect(asyncFn).toThrowAsync('Async error');
await expect(asyncFn).toThrowAsync(/error/);
```

## Types

### `toBeInstanceOf(class)`
Passes if value is an instance of the expected class.

```javascript
expect(new Date()).toBeInstanceOf(Date);
expect(new Error()).toBeInstanceOf(Error);
expect([]).toBeInstanceOf(Array);
```

## Custom Minecraft Matchers

### `toHaveReceivedMessage(message, strict?)` ⚡ async
Waits for the bot to receive a message containing (or exactly matching) the text.

```javascript
await player.chat('/help');
await expect(player).toHaveReceivedMessage('Available commands');

// Strict mode requires exact match
await expect(player).toHaveReceivedMessage('Exact message', true);
```

### `toContainItem(itemName)` ⚡ async
Waits for the player's inventory to contain an item with the specified name.

```javascript
await server.execute(`give ${player.username} diamond 5`);
await expect(player).toContainItem('diamond');
```

## Negation

All matchers support negation using `.not`:

```javascript
expect(5).not.toBe(10);
expect(null).not.toBeTruthy();
expect([1, 2, 3]).not.toContain(4);
expect({ name: 'test' }).not.toHaveProperty('age');
expect(() => 'success').not.toThrow();
```

## Real-World Example

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('Player stats GUI displays correctly', async ({ player, server }) => {
    // Open stats GUI
    await player.chat('/stats');
    const gui = await player.waitForGui('Activity Report');
    
    // Verify GUI title
    expect(gui.getTitle()).toContain('Activity Report');
    
    // Find session entry
    const sessionEntry = gui.findItem(item => 
        item.getDisplayName().includes('Session')
    );
    
    // Assertions
    expect(sessionEntry).toBeTruthy();
    expect(sessionEntry.hasLore('From')).toBe(true);
    expect(sessionEntry.hasLore('To')).toBe(true);
    
    // Check logs
    const logs = gui.findAllItems(item => item.name === 'paper');
    expect(logs.length).toBeGreaterThan(0);
    
    const messageCount = logs.reduce((sum, log) => sum + log.count, 0);
    expect(messageCount).toBeGreaterThanOrEqual(2);
    
    // Verify player entry doesn't exist
    const playerEntry = gui.findItem(item => 
        item.getDisplayName().includes('Player')
    );
    expect(playerEntry).toBeFalsy();
});
```

## Tips

1. **Use `toBe()` for primitives** and `toEqual()` for objects/arrays
2. **Async matchers** (`toHaveReceivedMessage`, `toContainItem`, `toThrowAsync`) must be awaited
3. **All matchers support `.not`** for negation
4. **Chain matchers** for clear, expressive tests
5. **Use `toMatchObject()`** for partial object matching when you don't care about all properties
6. **Combine custom matchers** with standard ones for comprehensive Minecraft plugin tests

## Error Messages

All matchers provide clear, descriptive error messages when assertions fail:

```
AssertionError: Expected 5 to be greater than 10
AssertionError: Expected [1, 2, 3] to contain 4
AssertionError: Expected function to throw an error, but it did not
```
