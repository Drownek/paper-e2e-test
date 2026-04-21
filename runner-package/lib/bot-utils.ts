import mineflayer, { Bot } from 'mineflayer';
import pc from 'picocolors';

/** Shared mutable state for active bots and message buffers. */
export const activeBots: Bot[] = [];
export const messageBuffer: string[] = [];
export const serverConsoleBuffer: string[] = [];

/**
 * Disconnects a bot, waiting for the `end` event or a timeout.
 * Cleans up all listeners BEFORE registering end handler so it isn't stripped.
 * Skips the wait entirely if the client is already ended.
 */
export function disconnectBot(bot: Bot, label: string, timeoutMs: number = 3000): Promise<void> {
    const isAlreadyEnded = !!(bot as any)._client?.ended;
    if (isAlreadyEnded) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            console.log(pc.dim(`[Bot] ${label} disconnect timeout, continuing`));
            resolve();
        }, timeoutMs);

        try {
            bot.once('end', () => {
                clearTimeout(timeout);
                resolve();
            });
            bot.quit();
        } catch (err) {
            console.log(pc.dim(`[Bot] ${label} error during disconnect: ${(err as Error).message}`));
            clearTimeout(timeout);
            resolve();
        }
    });
}

/**
 * Creates a new mineflayer bot and registers it in the activeBots list.
 */
export function createBot(options: {
    host: string;
    port: number;
    username: string;
    version: string | undefined;
    auth: 'mojang' | 'microsoft' | 'offline';
}): Bot {
    const bot = mineflayer.createBot({
        host: options.host,
        port: options.port,
        username: options.username,
        version: options.version,
        auth: options.auth,
    });

    activeBots.push(bot);

    bot.once('end', (reason: string) => {
        console.log(pc.dim(`[Bot] ${options.username} connection ended: ${reason}`));
    });

    return bot;
}

/**
 * Disconnects all active bots and clears the list.
 */
export async function disconnectAllBots(): Promise<void> {
    await Promise.all(activeBots.map(b => {
        const isAlreadyEnded = !!(b as any)._client?.ended;
        if (isAlreadyEnded) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                console.log(pc.yellow(`[WARNING] Bot ${b.username} disconnect timeout, continuing anyway`));
                resolve();
            }, 2000);

            b.once('end', () => {
                clearTimeout(timeout);
                resolve();
            });

            try {
                b.quit();
            } catch (err) {
                clearTimeout(timeout);
                resolve();
            }
        });
    }));

    activeBots.length = 0;
}

/**
 * Writes Minecraft server output to the console and appends to the server console buffer.
 */
export function writeMcOutput(data: Buffer): void {
    const text = data.toString().replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.length > 0) {
            serverConsoleBuffer.push(line);
        }
    }
    const prefixed = lines
        .map(line => line.length > 0 ? `${pc.gray('[MC]')} ${line}` : '')
        .join('\n');
    process.stdout.write(prefixed);
}