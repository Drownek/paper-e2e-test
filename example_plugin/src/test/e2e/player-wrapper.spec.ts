import { expect, sleep, test } from '@drownek/paper-e2e-runner';

test('makeOp', async ({ player }) => {
    await player.makeOp();
    await expect(player).toHaveReceivedMessage(`Made ${player.username} a server operator`)
});

test('deOp', async ({ player }) => {
    await player.deOp();
    player.chat('/op');
    await expect(player).toHaveReceivedMessage('Unknown command');
});

test('chat', async ({ player }) => {
    player.chat('/help');
    await expect(player).toHaveReceivedMessage('Help');
});

test('gamemode', async ({ player }) => {
    await player.setGameMode('adventure');
    expect(player.bot.game.gameMode).toBe('adventure');
});

test('teleport', async ({ player }) => {
    await player.teleport(123, 100, 321)
    expect(player.bot.entity.position).toMatchObject({ x: 123.5, z: 321.5 });
});

test('giveItem', async ({ player }) => {
    await player.giveItem('emerald', 5)
    await expect(player).toContainItem('emerald', 5)
});