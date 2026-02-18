import {expect, test} from '@drownek/paper-e2e-runner';

test('command permission works', async ({ player, server }) => {
  player.chat('/example gui-settings');
  await expect(player).toHaveReceivedMessage('You don\'t have permission to execute this command! (example) (MISSING_PERMISSIONS)');
});

test('admin can interact with gui', async ({ player, server }) => {
  // 1. OP: to grant ability to execute command
  await player.makeOp();

  // 2. Action: Open the GUI and wait for it
  player.chat('/example gui-settings');
  const gui = await player.gui({ title: 'guiSettings' });

  // 3. Interact: Click the item named "guiItemInfo"
  gui.locator(item => item.getDisplayName().includes('guiItemInfo')).click();

  // 4. Assertion: Check for the callback message
  await expect(player).toHaveReceivedMessage('You clicked on item');
});

test('help displays message', async ({ player, server }) => {
  player.chat('/help');
  await expect(player).toHaveReceivedMessage('Help');
});
