# Examples

Real-world test examples for common plugin features.

## More Examples

For additional TypeScript test examples, see the [StaffActivityMonitor project](https://github.com/Drownek/StaffActivityMonitor/tree/master/bukkit/src/test/e2e).

## Basic Command Testing

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('help command shows available commands', async ({ player }) => {
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Help: Index');
});

test('unknown command shows error', async ({ player }) => {
  await player.chat('/nonexistent');
  await expect(player).toHaveReceivedMessage('Unknown command');
});

test('permission-restricted command', async ({ player }) => {
  await player.chat('/admin reload');
  await expect(player).toHaveReceivedMessage('no permission');
});
```

## Economy Plugin

```javascript
test('player starts with default balance', async ({ player }) => {
  await player.chat('/balance');
  await expect(player).toHaveReceivedMessage('$1000');
});

test('player can send money', async ({ player, server }) => {
  await server.execute(`eco give ${player.username} 500`);
  await player.chat('/pay TestPlayer 100');
  await expect(player).toHaveReceivedMessage('Sent $100');
  
  await player.chat('/balance');
  await expect(player).toHaveReceivedMessage('$1400');
});

test('cannot send more money than balance', async ({ player }) => {
  await player.chat('/pay TestPlayer 999999');
  await expect(player).toHaveReceivedMessage('insufficient');
});
```

## Shop System

```javascript
test('shop opens with correct items', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.waitForGui('Shop');
  
  const diamond = gui.findItem(item => item.name === 'diamond');
  expect(diamond).toBeTruthy();
  expect(diamond.getDisplayName()).toContain('Diamond');
});

test('purchase item from shop', async ({ player, server }) => {
  await server.execute(`eco give ${player.username} 1000`);
  await player.chat('/shop');
  
  const gui = await player.waitForGui('Shop');
  await gui.clickItem('diamond');
  
  await expect(player).toHaveReceivedMessage('Purchased');
  await expect(player).toContainItem('diamond');
});

test('cannot buy without money', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.waitForGui('Shop');
  await gui.clickItem('diamond');
  
  await expect(player).toHaveReceivedMessage('Not enough money');
});
```

## Teleport System

```javascript
test('warp command teleports player', async ({ player }) => {
  await player.chat('/warp spawn');
  await expect(player).toHaveReceivedMessage('Teleported to spawn');
  
  const pos = player.bot.entity.position;
  expect(pos.x).toBeCloseTo(0, 1);
  expect(pos.z).toBeCloseTo(0, 1);
});

test('unknown warp shows error', async ({ player }) => {
  await player.chat('/warp nonexistent');
  await expect(player).toHaveReceivedMessage('Warp not found');
});

test('warp GUI lists available warps', async ({ player }) => {
  await player.chat('/warps');
  const gui = await player.waitForGui('Warps');
  
  const spawn = gui.findItem(item => 
    item.getDisplayName().includes('Spawn')
  );
  expect(spawn).toBeTruthy();
  
  await gui.clickItem('compass'); // Assuming compass is spawn warp
  await expect(player).toHaveReceivedMessage('Teleported');
});
```

## Kits System

```javascript
test('starter kit gives items', async ({ player }) => {
  await player.chat('/kit starter');
  
  await expect(player).toHaveReceivedMessage('Received starter kit');
  await expect(player).toContainItem('diamond_sword');
  await expect(player).toContainItem('bread');
});

test('kit has cooldown', async ({ player }) => {
  await player.chat('/kit starter');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await player.chat('/kit starter');
  await expect(player).toHaveReceivedMessage('cooldown');
});

test('VIP kit requires permission', async ({ player }) => {
  await player.chat('/kit vip');
  await expect(player).toHaveReceivedMessage('no permission');
});
```

## Minigame System

```javascript
test('join arena game', async ({ player }) => {
  await player.chat('/arena join');
  await expect(player).toHaveReceivedMessage('Joined arena');
  
  await player.chat('/arena leave');
  await expect(player).toHaveReceivedMessage('Left arena');
});

test('cannot join full arena', async ({ player, server }) => {
  // Fill arena with fake players
  for (let i = 0; i < 10; i++) {
    await server.execute(`arena addplayer Player${i}`);
  }
  
  await player.chat('/arena join');
  await expect(player).toHaveReceivedMessage('Arena is full');
});
```

## Stats Tracking

```javascript
test('stats GUI displays player stats', async ({ player, server }) => {
  await player.chat('/stats');
  const gui = await player.waitForGui('Player Stats');
  
  const killsItem = gui.findItem(item => 
    item.getDisplayName().includes('Kills')
  );
  expect(killsItem).toBeTruthy();
  
  const deathsItem = gui.findItem(item => 
    item.getDisplayName().includes('Deaths')
  );
  expect(deathsItem).toBeTruthy();
});
```

## Custom GUI Navigation

```javascript
test('multi-page GUI navigation', async ({ player }) => {
  await player.chat('/menu');
  const gui = await player.waitForGui('Main Menu');
  
  // Click "Settings" option
  const settings = gui.findItem(item => 
    item.getDisplayName() === 'Settings'
  );
  expect(settings).toBeTruthy();
  await gui.clickItem('redstone');
  
  // Should open settings submenu
  const settingsGui = await player.waitForGui('Settings');
  expect(settingsGui.getTitle()).toBe('Settings');
  
  // Navigate back
  await settingsGui.clickItem('arrow');
  const mainGui = await player.waitForGui('Main Menu');
  expect(mainGui.getTitle()).toBe('Main Menu');
});
```

## Event-Based Testing

```javascript
test('player receives item on first join', async ({ player }) => {
  // Assuming plugin gives items on first join
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await expect(player).toHaveReceivedMessage('Welcome');
  await expect(player).toContainItem('wooden_sword');
});

test('scheduled announcement appears', async ({ player }) => {
  // Wait for scheduled announcement (e.g., every 60 seconds)
  await new Promise(resolve => setTimeout(resolve, 65000));
  await expect(player).toHaveReceivedMessage('Server announcement');
});
```

## Complex Workflow

```javascript
test('complete player journey', async ({ player, server }) => {
  // 1. Join and get starter kit
  await player.chat('/kit starter');
  await expect(player).toContainItem('diamond_sword');
  
  // 2. Check initial balance
  await player.chat('/balance');
  await expect(player).toHaveReceivedMessage('$1000');
  
  // 3. Buy something from shop
  await player.chat('/shop');
  let gui = await player.waitForGui('Shop');
  await gui.clickItem('diamond');
  await expect(player).toHaveReceivedMessage('Purchased');
  
  // 4. Check reduced balance
  await player.chat('/balance');
  await expect(player).toHaveReceivedMessage('$900');
  
  // 5. Join minigame
  await player.chat('/arena join');
  await expect(player).toHaveReceivedMessage('Joined');
  
  // 6. Leave and check stats
  await player.chat('/arena leave');
  await player.chat('/stats');
  gui = await player.waitForGui('Stats');
  expect(gui.findItem(item => item.name === 'paper')).toBeTruthy();
});
```

## Testing with Multiple Scenarios

```javascript
const testCases = [
  { command: '/warp spawn', message: 'Teleported', item: null },
  { command: '/kit starter', message: 'Received', item: 'diamond_sword' },
  { command: '/shop', message: null, item: null }
];

for (const testCase of testCases) {
  test(`command ${testCase.command} works`, async ({ player }) => {
    await player.chat(testCase.command);
    
    if (testCase.message) {
      await expect(player).toHaveReceivedMessage(testCase.message);
    }
    
    if (testCase.item) {
      await expect(player).toContainItem(testCase.item);
    }
  });
}
```

## Tips for Writing Tests

1. **Start simple** - Test basic functionality first
2. **Use descriptive names** - Make failures self-explanatory
3. **One assertion per concept** - Don't overcomplicate tests
4. **Add delays when needed** - Some operations take time
5. **Test edge cases** - Not just happy paths
6. **Check both success and failure** - Ensure errors are handled

## Next Steps

- [Writing Tests](Writing-Tests) - Learn test patterns
- [GUI Testing](GUI-Testing) - Advanced GUI interactions
- [Matchers Reference](Matchers-Reference) - All assertions
