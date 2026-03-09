import { expect, test } from '@drownek/paper-e2e-runner';

test('multi-bot teleportation', async ({ player, createPlayer }) => {
    await player.makeOp()
    // Spawn a second player
    const friend = await createPlayer({ username: 'FriendBot' });

    // Teleport the friend to a specific location
    await friend.teleport(100, 100, 100);
    
    // Teleport primary player to the friend
    player.chat(`/tp ${player.username} ${friend.username}`);

    // Verify the primary player is near the friend
    await expect(player).toBeNear(100, 100, 100, { tolerance: 2 });
});
