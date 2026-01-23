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
```

## Documentation

Full documentation is available in the [GitHub repository Wiki](https://github.com/Drownek/paper-e2e-test/wiki).

## License

MIT
