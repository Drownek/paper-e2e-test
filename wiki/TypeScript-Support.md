# TypeScript Support

The framework fully supports TypeScript for type-safe test development.

## Setup

### 1. Install TypeScript Dependencies

In your `src/test/e2e/package.json`:

```json
{
  "type": "module",
  "dependencies": {
    "@drownek/paper-e2e-runner": "^1.0.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### 2. Create TypeScript Configuration

Create `src/test/e2e/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["*.spec.ts"]
}
```

### 3. Write TypeScript Tests

Create `src/test/e2e/my-test.spec.ts`:

```typescript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player receives welcome message', async ({ player }) => {
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Available commands');
});
```

## Type Safety Benefits

### Autocomplete and IntelliSense

TypeScript provides full autocomplete for the test API:

```typescript
test('example', async ({ player }) => {
  // TypeScript knows all available methods
  await player.chat('/help');
  await player.waitForGui('Shop');
  
  // Autocomplete for matchers
  await expect(player).toHaveReceivedMessage('text');
  await expect(player).toContainItem('diamond');
});
```

### Type Checking

Catch errors before running tests:

```typescript
// TypeScript will error on invalid usage
await expect(player).toHaveReceivedMessage(123); // Error: Expected string
await player.invalidMethod(); // Error: Method doesn't exist
```

### Custom Types

Define your own types for test data:

```typescript
interface ShopItem {
  name: string;
  price: number;
  category: string;
}

const items: ShopItem[] = [
  { name: 'Diamond', price: 100, category: 'materials' },
  { name: 'Emerald', price: 150, category: 'materials' }
];

test('shop items are purchasable', async ({ player }) => {
  for (const item of items) {
    await player.chat(`/buy ${item.name}`);
    await expect(player).toHaveReceivedMessage(`Purchased ${item.name}`);
  }
});
```

## Compilation

The framework automatically compiles TypeScript files when you run tests:

```bash
./gradlew testE2E
```

Compiled JavaScript files are output to `src/test/e2e/dist/`.

## Mixed JavaScript and TypeScript

You can use both `.js` and `.ts` files in the same test directory:

```
src/test/e2e/
├── basic.spec.js      # JavaScript test
├── advanced.spec.ts   # TypeScript test
├── package.json
└── tsconfig.json
```

## Complete TypeScript Example

```typescript
import { test, expect } from '@drownek/paper-e2e-runner';

interface PlayerStats {
  kills: number;
  deaths: number;
  level: number;
}

function parseStats(message: string): PlayerStats {
  const matches = message.match(/Kills: (\d+), Deaths: (\d+), Level: (\d+)/);
  if (!matches) throw new Error('Invalid stats format');
  
  return {
    kills: parseInt(matches[1]),
    deaths: parseInt(matches[2]),
    level: parseInt(matches[3])
  };
}

test('player stats are tracked', async ({ player }) => {
  await player.chat('/stats');
  
  // TypeScript ensures type safety
  const statsMessage = await player.bot.waitForMessage(/Kills:/);
  const stats = parseStats(statsMessage);
  
  expect(stats.kills).toBeGreaterThanOrEqual(0);
  expect(stats.deaths).toBeGreaterThanOrEqual(0);
  expect(stats.level).toBeGreaterThan(0);
});
```

## Tips

- Use TypeScript for complex test logic
- JavaScript is fine for simple tests
- TypeScript catches errors at compile time
- Both formats work with the same test runner
- No performance difference between JS and TS

## Next Steps

- [Writing Tests](Writing-Tests) - Learn test patterns
- [Matchers Reference](Matchers-Reference) - Type-safe assertions
