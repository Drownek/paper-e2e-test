# @drownek/paper-e2e-runner

End-to-end testing runner for Paper/Spigot Minecraft plugins.

## Installation

```bash
npm install @drownek/paper-e2e-runner
```

## Quick Start

```javascript
import { test, expect } from '@drownek/paper-e2e-runner';

test('player can join server', async ({ player }) => {
  await player.chat('/help');
  await expect(player).toHaveReceivedMessage('Available commands');
});

test('player can interact with GUI', async ({ player }) => {
    await player.makeOp();
    await player.chat('/staffactivity view');

    // Get a live handle to the GUI
    const gui = await player.gui({ title: /Staff activity/ });

    // Create a locator for items
    const messageItem = gui.locator(i => i.hasLore('messages'));

    // Expectations automatically retry
    await expect(messageItem).toHaveLore('messages');
});
```

## Documentation

Full documentation is available in the [GitHub repository Wiki](https://github.com/Drownek/paper-e2e-test/wiki).

## License

MIT
