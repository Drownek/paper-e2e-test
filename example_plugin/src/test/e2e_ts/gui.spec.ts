import {expect, test} from '@drownek/paper-e2e-runner';

test('admin can interact with gui', async ({ player, server }) => {
  // 1. Setup: OP the bot so it can run the command (if needed, though this command seems permissionless or basic)
  await server.execute(`op ${player.bot.username}`);

  // 2. Action: Open the GUI and wait for it
  await player.chat('/example gui-settings');
  const gui = await player.waitForGui('guiSettings');

  // 3. Interact: Click the item named "guiItemInfo"
  // Note: The item name in config is "guiItemInfo". Mineflayer usually sees the display name.
  await gui.clickItem(item => item.getDisplayName().includes('guiItemInfo'));

  // 4. Assertion: Check for the callback message
  await expect(player).toHaveReceivedMessage('You clicked on item');
});
