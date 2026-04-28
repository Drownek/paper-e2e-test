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

test('admin can use restricted command', async ({ player }) => {
  await player.makeOp();
  await player.chat('/admin reload');
  await expect(player).toHaveReceivedMessage('Reloaded');
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
  await player.chat('/pay Test_xx 100');
  await expect(player).toHaveReceivedMessage('Sent $100');
  
  await player.chat('/balance');
  await expect(player).toHaveReceivedMessage('$1400');
});

test('cannot send more money than balance', async ({ player }) => {
  await player.chat('/pay Test_xx 999999');
  await expect(player).toHaveReceivedMessage('insufficient');
});
```

## Shop System

```javascript
test('shop opens with correct items', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.gui({ title: 'Shop' });
  
  const diamond = gui.locator(item => item.name === 'diamond');
  expect(diamond.displayName()).toContain('Diamond');
});

test('purchase item from shop', async ({ player }) => {
  await player.giveItem('emerald', 64); // Give currency
  await player.chat('/shop');
  
  const gui = await player.gui({ title: 'Shop' });
  await gui.locator(item => item.name === 'diamond').click();
  
  await expect(player).toHaveReceivedMessage('Purchased');
  await expect(player).toContainItem('diamond');
});

test('cannot buy without money', async ({ player }) => {
  await player.chat('/shop');
  const gui = await player.gui({ title: 'Shop' });
  await gui.locator(item => item.name === 'diamond').click();
  
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
  const gui = await player.gui({ title: 'Warps' });
  
  const spawn = gui.locator(item => 
    item.getDisplayName().includes('Spawn')
  );
  expect(spawn).toBeTruthy();
  
  await gui.locator(item => item.name === 'compass').click(); // Assuming compass is spawn warp
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

## Next Steps

- [Writing Tests](Writing-Tests) - Learn test patterns
- [GUI Testing](GUI-Testing) - Advanced GUI interactions
- [Matchers Reference](Matchers-Reference) - All assertions
