import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import mineflayer, { Bot } from 'mineflayer';
import { readdir } from 'fs/promises';
import { join, basename } from 'path';
import { pathToFileURL } from 'url';
import { ItemWrapper, GuiWrapper, createPlayerExtensions, Window, LiveGuiHandle, GuiItemLocator } from './lib/wrappers.js';
import { Matchers } from "./lib/expect.js";
import { randomUUID } from "node:crypto";
import { install as installSourceMapSupport } from 'source-map-support';
import { poll, sleep } from './lib/utils.js';
import { extractSpecLocation } from "./lib/stack-trace.js";
import pc from 'picocolors';

// Enable source map support for accurate TypeScript stack traces
installSourceMapSupport();

function writeMcOutput(data: Buffer): void {
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

export { ItemWrapper, GuiWrapper };

export interface TestContext {
    player: PlayerWrapper;
    server: ServerWrapper;
    createPlayer: (options?: { username?: string }) => Promise<PlayerWrapper>;
}

export class ServerWrapper {
    execute: (cmd: string) => void;

    constructor(executeFn: (cmd: string) => void) {
        this.execute = executeFn;
    }
}

interface TestCase {
    name: string;
    fn: (context: TestContext) => Promise<void>;
}

interface EventEmitterLike {
    on(event: string, listener: (...args: unknown[]) => void): void;
    removeListener(event: string, listener: (...args: unknown[]) => void): void;
    removeAllListeners(event?: string): void;
}


type Hook = (context: TestContext) => Promise<void>;

interface DescribeScope {
    label: string;
    beforeHooks: Hook[];
    afterHooks: Hook[];
}

const testRegistry: TestCase[] = [];
const scopeStack: DescribeScope[] = [{ label: '', beforeHooks: [], afterHooks: [] }];
let currentPlayer: Bot | null = null;
let messageBuffer: string[] = [];
let serverConsoleBuffer: string[] = [];
const activeBots: Bot[] = [];

export function test(name: string, fn: (context: TestContext) => Promise<void>): void {
    const labels = scopeStack.map(s => s.label).filter(l => l);
    const fullName = [...labels, name].join(' > ');

    // Snapshot hooks at registration time. Note: hooks registered *after* a test()
    // call within the same describe block will not apply to it — declare hooks first.
    const beforeHooks = scopeStack.flatMap(s => s.beforeHooks);
    const afterHooks = [...scopeStack].reverse().flatMap(s => s.afterHooks);

    const wrappedFn = async (ctx: TestContext) => {
        let testError: unknown;
        try {
            for (const hook of beforeHooks) await hook(ctx);
            await fn(ctx);
        } catch (e) {
            testError = e;
        } finally {
            for (const hook of afterHooks) {
                try {
                    await hook(ctx);
                } catch (e) {
                    testError ??= e;
                    console.error('[afterEach] Hook error:', (e as Error).message);
                }
            }
        }
        if (testError) throw testError;
    };

    testRegistry.push({ name: fullName, fn: wrappedFn });
}

export function opTest(name: string, fn: (context: TestContext) => Promise<void>): void {
    test(name, async (context: TestContext) => {
        await context.player.makeOp();
        await fn(context);
    });
}

export function describe(label: string, fn: () => void): void {
    scopeStack.push({ label, beforeHooks: [], afterHooks: [] });
    try {
        fn(); // synchronous — collects nested test/describe/beforeEach/afterEach calls
    } finally {
        scopeStack.pop();
    }
}

export function beforeEach(hook: Hook): void {
    scopeStack[scopeStack.length - 1].beforeHooks.push(hook);
}

export function afterEach(hook: Hook): void {
    scopeStack[scopeStack.length - 1].afterHooks.push(hook);
}

class RunnerMatchers<T = unknown> extends Matchers<T> {
    constructor(actual: T, isNot: boolean = false) {
        super(actual, isNot);
    }

    /**
     * Unwraps a rejected Promise so subsequent matchers run against the error.
     * Usage: await expect(promise).rejects.toThrow('message')
     */
    get rejects() {
        return {
            toThrow: async (expected?: string | RegExp) => {
                try {
                    await (this.actual as Promise<any>);
                } catch (err: any) {
                    // Promise rejected - this is the success path
                    if (expected === undefined) return;
                    const msg = err?.message ?? String(err);
                    if (typeof expected === 'string') {
                        this._assert(
                            msg.includes(expected),
                            `Expected rejection not to include "${expected}", but got "${msg}"`,
                            `Expected rejection to include "${expected}", but got "${msg}"`
                        );
                    } else {
                        this._assert(
                            expected.test(msg),
                            `Expected rejection not to match ${expected}, but got "${msg}"`,
                            `Expected rejection to match ${expected}, but got "${msg}"`
                        );
                    }
                    return;
                }
                // Promise resolved - fail
                this._assert(false, 'Expected promise to resolve, but it rejected', 'Expected promise to reject, but it resolved');
            }
        };
    }

    protected async pollAssertion(
        condition: () => boolean,
        passMessage: () => string,
        failMessage: () => string,
        options: { timeout?: number; pollingRate?: number } = {}
    ): Promise<void> {
        const { timeout = 5000, pollingRate = 50 } = options;
        const expected = !this.isNot;
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            if (condition() === expected) return;
            await new Promise(resolve => setTimeout(resolve, pollingRate));
        }

        throw new Error(this.isNot ? passMessage() : failMessage());
    }

    async toHaveReceivedMessage(
        this: RunnerMatchers<PlayerWrapper | ServerWrapper>,
        expectedMessage: string | RegExp,
        options: { strict?: boolean; timeout?: number; pollingRate?: number; since?: number } = {}
    ): Promise<void> {
        const { strict = false, timeout, pollingRate, since } = options;
        const isMatch = (msg: string): boolean => {
            if (expectedMessage instanceof RegExp) return expectedMessage.test(msg);
            return strict ? msg === expectedMessage : msg.includes(expectedMessage);
        };

        const buffer = this.actual instanceof PlayerWrapper ? messageBuffer : serverConsoleBuffer;
        const view = (): string[] => since !== undefined ? buffer.slice(since) : buffer;

        await this.pollAssertion(
            () => view().some(isMatch),
            () => `Expected NOT to receive message matching "${expectedMessage}", but received: "${view().find(isMatch)}"`,
            () => `Expected message matching "${expectedMessage}" not received`,
            { timeout, pollingRate }
        );
    }

    async toContainItem(
        this: RunnerMatchers<PlayerWrapper>,
        itemName: string,
        options: { count?: number; timeout?: number; pollingRate?: number } = {}
    ): Promise<void> {
        const { count, timeout, pollingRate } = options;
        const bot = this.actual.bot;

        const getItems = () => bot.inventory.items().filter(i => i.name.includes(itemName));
        const getTotal = () => getItems().reduce((sum, i) => sum + i.count, 0);

        const condition = () => {
            const items = getItems();
            if (items.length === 0) return false;
            if (count !== undefined) return getTotal() >= count;
            return true;
        };

        await this.pollAssertion(
            condition,
            () => count !== undefined
                ? `Expected inventory NOT to contain ${count}x "${itemName}", but found ${getTotal()}`
                : `Expected inventory NOT to contain "${itemName}", but found: "${getItems()[0]?.name}"`,
            () => count !== undefined
                ? `Expected ${count}x "${itemName}" in inventory, but found ${getTotal()}`
                : `Expected item "${itemName}" in inventory`,
            { timeout, pollingRate }
        );
    }

    async toHaveLore(
        this: RunnerMatchers<GuiItemLocator>,
        expectedLore: string,
        options: { timeout?: number; pollingRate?: number } = {}
    ): Promise<void> {
        const { timeout = 5000, pollingRate = 100 } = options;
        const locator = this.actual;

        await this.pollAssertion(
            () => locator.loreText().includes(expectedLore),
            () => `Expected locator NOT to have lore containing "${expectedLore}", but got: "${locator.loreText()}"`,
            () => `Expected locator to have lore containing "${expectedLore}", but got: "${locator.loreText()}"`,
            { timeout, pollingRate }
        );
    }

    async toBeNear(
        this: RunnerMatchers<PlayerWrapper>,
        x: number,
        y: number | undefined,
        z: number,
        options: { tolerance?: number; timeout?: number } = {}
    ): Promise<void> {
        const { tolerance = 1, timeout = 5000 } = options;
        const player = this.actual;
        const pos = () => player.bot.entity.position;

        const isNear = () =>
            Math.abs(pos().x - x) <= tolerance &&
            Math.abs(pos().z - z) <= tolerance &&
            (y === undefined || Math.abs(pos().y - y) <= tolerance);

        const targetStr = y !== undefined
            ? `(${x}, ${y}, ${z})`
            : `(${x}, *, ${z})`;

        const posStr = () => y !== undefined
            ? `(${pos().x.toFixed(2)}, ${pos().y.toFixed(2)}, ${pos().z.toFixed(2)})`
            : `(${pos().x.toFixed(2)}, *, ${pos().z.toFixed(2)})`;

        await this.pollAssertion(
            isNear,
            () => `Expected player NOT to be near ${targetStr}, but was at ${posStr()}`,
            () => `Expected player to be near ${targetStr}, but was at ${posStr()}`,
            { timeout }
        );
    }

    async toBeNearXZ(
        this: RunnerMatchers<PlayerWrapper>,
        x: number,
        z: number,
        options: { tolerance?: number; timeout?: number } = {}
    ): Promise<void> {
        return this.toBeNear(x, undefined, z, options);
    }
}

interface PollOptions {
    timeout?: number;
    interval?: number;
    message?: string;
}

class PollMatchers<T> {
    private fn: () => T | Promise<T>;
    private options: Required<Omit<PollOptions, 'message'>> & { message?: string };
    private isNot: boolean;

    constructor(fn: () => T | Promise<T>, options: PollOptions = {}, isNot: boolean = false) {
        this.fn = fn;
        this.options = { timeout: 5000, interval: 250, ...options };
        this.isNot = isNot;
    }

    get not(): PollMatchers<T> {
        return new PollMatchers(this.fn, this.options, !this.isNot);
    }

    private async pollUntilPass(assertion: (matchers: Matchers<T>) => void | Promise<void>): Promise<void> {
        const { timeout, interval } = this.options;
        const deadline = Date.now() + timeout;
        let lastError: unknown;

        while (Date.now() < deadline) {
            const value = await this.fn();
            try {
                const m = new Matchers(value, this.isNot);
                await assertion(m);
                return;
            } catch (e) {
                lastError = e;
            }
            await sleep(Math.min(interval, Math.max(0, deadline - Date.now())));
        }

        if (this.options.message) {
            throw new Error(this.options.message);
        }
        throw lastError;
    }

    toBe(expected: any): Promise<void> {
        return this.pollUntilPass(m => m.toBe(expected));
    }
    toEqual(expected: any): Promise<void> {
        return this.pollUntilPass(m => m.toEqual(expected));
    }
    toBeTruthy(): Promise<void> {
        return this.pollUntilPass(m => m.toBeTruthy());
    }
    toBeFalsy(): Promise<void> {
        return this.pollUntilPass(m => m.toBeFalsy());
    }
    toBeNull(): Promise<void> {
        return this.pollUntilPass(m => m.toBeNull());
    }
    toBeUndefined(): Promise<void> {
        return this.pollUntilPass(m => m.toBeUndefined());
    }
    toBeDefined(): Promise<void> {
        return this.pollUntilPass(m => m.toBeDefined());
    }
    toBeNaN(): Promise<void> {
        return this.pollUntilPass(m => m.toBeNaN());
    }
    toBeGreaterThan(expected: number): Promise<void> {
        return this.pollUntilPass(m => (m as Matchers<number>).toBeGreaterThan(expected));
    }
    toBeGreaterThanOrEqual(expected: number): Promise<void> {
        return this.pollUntilPass(m => (m as Matchers<number>).toBeGreaterThanOrEqual(expected));
    }
    toBeLessThan(expected: number): Promise<void> {
        return this.pollUntilPass(m => (m as Matchers<number>).toBeLessThan(expected));
    }
    toBeLessThanOrEqual(expected: number): Promise<void> {
        return this.pollUntilPass(m => (m as Matchers<number>).toBeLessThanOrEqual(expected));
    }
    toBeCloseTo(expected: number, precision?: number): Promise<void> {
        return this.pollUntilPass(m => (m as Matchers<number>).toBeCloseTo(expected, precision));
    }
    toContain(item: any): Promise<void> {
        return this.pollUntilPass(m => m.toContain(item));
    }
    toContainEqual(item: any): Promise<void> {
        return this.pollUntilPass(m => m.toContainEqual(item));
    }
    toHaveLength(expected: number): Promise<void> {
        return this.pollUntilPass(m => m.toHaveLength(expected));
    }
    toHaveProperty(keyPath: string | string[], value?: any): Promise<void> {
        return this.pollUntilPass(m => m.toHaveProperty(keyPath, value));
    }
    toMatch(expected: string | RegExp): Promise<void> {
        return this.pollUntilPass(m => m.toMatch(expected));
    }
    toMatchObject(expected: any): Promise<void> {
        return this.pollUntilPass(m => m.toMatchObject(expected));
    }
    toBeInstanceOf(expected: Function): Promise<void> {
        return this.pollUntilPass(m => m.toBeInstanceOf(expected));
    }
    toThrow(expected?: string | RegExp | Function): Promise<void> {
        return this.pollUntilPass(m => m.toThrow(expected));
    }
    toThrowAsync(expected?: string | RegExp | Function): Promise<void> {
        return this.pollUntilPass(m => m.toThrowAsync(expected));
    }
}

interface ExpectFunction {
    <T>(target: T): RunnerMatchers<T>;
    poll: <T>(fn: () => T | Promise<T>, options?: PollOptions) => PollMatchers<T>;
}

export const expect: ExpectFunction = Object.assign(
    <T>(target: T): RunnerMatchers<T> => new RunnerMatchers(target),
    {
        poll: <T>(fn: () => T | Promise<T>, options?: PollOptions): PollMatchers<T> =>
            new PollMatchers(fn, options),
    }
);

/**
 * Disconnects a bot, waiting for the `end` event or a timeout.
 * Cleans up all listeners BEFORE registering end handler so it isn't stripped.
 * Skips the wait entirely if the client is already ended.
 */
function disconnectBot(bot: Bot, label: string, timeoutMs: number = 3000): Promise<void> {
    const isAlreadyEnded = !!(bot as any)._client?.ended;
    if (isAlreadyEnded) {
        bot.removeAllListeners();
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            console.log(pc.dim(`[Bot] ${label} disconnect timeout, continuing`));
            resolve();
        }, timeoutMs);

        try {
            bot.removeAllListeners();
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

export class PlayerWrapper {
    bot: Bot;

    get inventory() {
        return this.bot.inventory;
    }

    get username() {
        return this.bot.username;
    }

    /**
     * @deprecated Use `player.gui({ title })` instead. This method will be removed in a future version.
     *
     * @example
     * // Old (deprecated):
     * const gui = await player.waitForGui(g => g.title.includes('Activity'));
     *
     * // New (recommended):
     * const gui = await player.gui({ title: /Activity/ });
     */
    waitForGui!: (guiMatcher: (gui: GuiWrapper) => boolean, options?: { timeout?: number }) => Promise<GuiWrapper>;

    /**
     * @deprecated Use `gui.locator(predicate)` with expectations instead. This method will be removed in a future version.
     *
     * @example
     * // Old (deprecated):
     * const item = await player.waitForGuiItem(i => i.name.includes('clock'));
     *
     * // New (recommended):
     * const gui = await player.gui({ title: /Activity/ });
     * const item = gui.locator(i => i.name.includes('clock'));
     * await expect(item).toHaveLore('some text');
     */
    waitForGuiItem!: (itemMatcher: (item: ItemWrapper) => boolean, options?: { timeout?: number, pollingRate?: number }) => Promise<ItemWrapper>;

    /**
     * @deprecated Use `gui.locator(predicate).click()` instead. This method will be removed in a future version.
     *
     * @example
     * // Old (deprecated):
     * await player.clickGuiItem(i => i.name.includes('clock'));
     *
     * // New (recommended):
     * const gui = await player.gui({ title: /Activity/ });
     * const item = gui.locator(i => i.name.includes('clock'));
     * await item.click();
     */
    clickGuiItem!: (itemMatcher: (item: ItemWrapper) => boolean, options?: { timeout?: number, pollingRate?: number }) => Promise<void>;

    gui!: (options: { title: string | RegExp; timeout?: number }) => Promise<LiveGuiHandle>;
    private serverWrapper?: ServerWrapper;
    private _botOptions?: { host: string; port: number; version: string | undefined; auth: 'mojang' | 'microsoft' | 'offline' };
    private _spawnPromise: Promise<void> | null = null;
    private _listenersBot: Bot | null = null;

    constructor(bot: Bot) {
        this.bot = bot;
        this._bindExtensions(bot);
    }

    /**
     * Binds bot-dependent extensions to the given bot.
     * Used by the constructor and rejoin() to keep extensions in sync.
     */
    private _bindExtensions(bot: Bot): void {
        const extensions = createPlayerExtensions(bot);
        this.waitForGui = extensions.waitForGui.bind(this);
        this.waitForGuiItem = extensions.waitForGuiItem.bind(this);
        this.clickGuiItem = extensions.clickGuiItem.bind(this);
        this.gui = extensions.gui.bind(this);
    }

    /**
     * Eagerly captures spawn/error/kicked events into a promise.
     * Must be called synchronously after createBot() - before any await -
     * so the spawn event cannot be missed.
     * @internal
     */
    _captureSpawnPromise(timeout: number = 10000): void {
        const botUsername = this.username;
        const bot = this.bot;

        this._spawnPromise = new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Bot ${botUsername} failed to spawn within ${timeout}ms`));
            }, timeout);

            const onSpawn = () => {
                cleanup();
                console.log(`${pc.cyan('[Bot]')} ${pc.dim(`${botUsername} spawned successfully`)}`);
                resolve();
            };

            const onError = (err: Error) => {
                cleanup();
                console.log(pc.red(`[Bot] ${botUsername} connection error: ${err.message}`));
                reject(err);
            };

            const onKicked = (reason: string) => {
                cleanup();
                console.log(pc.red(`[Bot] ${botUsername} kicked: ${reason}`));
                reject(new Error(`Bot ${botUsername} was kicked: ${reason}`));
            };

            const cleanup = () => {
                clearTimeout(timer);
                bot.removeListener('spawn', onSpawn);
                bot.removeListener('error', onError);
                bot.removeListener('kicked', onKicked);
            };

            bot.once('spawn', onSpawn);
            bot.once('error', onError);
            bot.once('kicked', onKicked);
        });

        // Prevent unhandled rejection if kicked/error fires before join() awaits
        this._spawnPromise.catch(() => {});
    }

    /**
     * Connects the bot to the server and waits until it spawns.
     * Resolves when the player has successfully joined.
     * Rejects if the player is kicked, encounters a connection error, or
     * the timeout elapses before spawning.
     */
    async join(options: { timeout?: number } = {}): Promise<void> {
        const { timeout = 10000 } = options;

        // If no spawn promise was captured eagerly, capture now as fallback
        if (!this._spawnPromise) {
            this._captureSpawnPromise(timeout);
        }

        await this._spawnPromise;
        this._spawnPromise = null;

        this._registerPersistentListeners();
    }

    /**
     * Registers persistent message/window listeners on the current bot.
     * Guarded: calling join() twice on the same bot won't duplicate listeners.
     */
    private _registerPersistentListeners(): void {
        if (this._listenersBot === this.bot) return;
        this._listenersBot = this.bot;

        const botUsername = this.username;
        const bot = this.bot;

        bot.on('message', (jsonMsg: unknown) => {
            const message = String(jsonMsg);
            console.log(pc.dim(`[Bot ${botUsername}] Received message: "${message}"`));
            messageBuffer.push(message);
        });

        bot.on('windowOpen', (window: unknown) => {
            const win = window as { title?: string; type?: string | number; slots?: unknown[] };
            console.log(pc.gray(`[DEBUG] [Bot ${botUsername}] Global windowOpen event - Title: "${win.title}", Type: ${win.type}, SlotCount: ${win.slots?.length}`));
        });

        bot.on('windowClose', (window: unknown) => {
            const win = window as { title?: string };
            console.log(pc.gray(`[DEBUG] [Bot ${botUsername}] windowClose event - Window: ${win?.title || 'unknown'}`));
        });

    }

    setServerWrapper(server: ServerWrapper): void {
        this.serverWrapper = server;
    }

    getCurrentGui(): GuiWrapper | null {
        let currentWindow = this.bot.currentWindow;
        return currentWindow ? new GuiWrapper(this.bot, currentWindow as Window) : null;
    }

    chat(message: string): void {
        console.log(`${pc.cyan('[Bot]')} ${pc.dim(`Chatting: ${message}`)}`);
        this.bot.chat(message);
    }

    getMessageBufferIndex(): number {
        return messageBuffer.length;
    }

    nextMessage(options: { timeout?: number } = {}): Promise<string> {
        const { timeout = 5000 } = options;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.bot.removeListener('message', handler);
                reject(new Error('Timeout: no message received'));
            }, timeout);

            const handler = (jsonMsg: unknown) => {
                clearTimeout(timer);
                this.bot.removeListener('message', handler);
                resolve(String(jsonMsg));
            };

            this.bot.on('message', handler);
        });
    }

    async makeOp(): Promise<void> {
        this.requireServer();
        this.serverWrapper!.execute(`minecraft:op ${this.username}`);

        await poll(
            () => messageBuffer.find(m => m.includes(`Made ${this.username} a server operator`)),
            { message: `Player ${this.username} was not opped` }
        );
    }

    async deOp(): Promise<void> {
        await this.executeAndSync(`minecraft:deop ${this.username}`);
    }

    async setGameMode(mode: 'survival' | 'creative' | 'adventure' | 'spectator'): Promise<void> {
        if (this.bot.game.gameMode === mode) return;
        this.requireServer();
        this.serverWrapper!.execute(`minecraft:gamemode ${mode} ${this.username}`);

        await poll(
            () => this.bot.game.gameMode === mode ? true : undefined,
            { message: `Game mode did not change to "${mode}"` }
        );
    }

    async teleport(x: number, y: number, z: number): Promise<void> {
        this.requireServer();
        this.serverWrapper!.execute(`minecraft:tp ${this.username} ${x} ${y} ${z}`);

        await poll(
            () => {
                const pos = this.bot.entity.position;
                const close =
                    Math.abs(pos.x - x) < 1 &&
                    Math.abs(pos.y - y) < 1 &&
                    Math.abs(pos.z - z) < 1;
                return close ? true : undefined;
            },
            { message: `Teleport to ${x} ${y} ${z} timed out` }
        );
    }

    /** @internal */
    _setBotOptions(opts: { host: string; port: number; version: string | undefined; auth: 'mojang' | 'microsoft' | 'offline' }): void {
        this._botOptions = opts;
    }

    /**
     * Disconnects the bot if connected, then reconnects with the same username and waits for spawn.
     * Useful for verifying whether a player can or cannot rejoin after being banned/kicked.
     *
     * @example
     * // Assert that a banned player cannot rejoin:
     * await expect(target.rejoin()).rejects.toThrow();
     */
    async rejoin(options: { timeout?: number } = {}): Promise<void> {
        if (!this._botOptions) {
            throw new Error('Cannot rejoin: bot connection options not set. Use wrapPlayer() to create players.');
        }

        const botUsername = this.username;
        const oldBot = this.bot;

        // Disconnect current bot - skips wait if already ended
        await disconnectBot(oldBot, botUsername);

        const idx = activeBots.indexOf(oldBot);
        if (idx !== -1) activeBots.splice(idx, 1);

        // Create a fresh bot with the same credentials
        const newBot = mineflayer.createBot({
            host: this._botOptions.host,
            port: this._botOptions.port,
            username: botUsername,
            version: this._botOptions.version,
            auth: this._botOptions.auth,
        });
        activeBots.push(newBot);
        newBot.once('end', (reason: string) => {
            console.log(pc.dim(`[Bot] ${botUsername} connection ended: ${reason}`));
        });

        // Rebind all bot-dependent state via shared helper
        this.bot = newBot;
        this._listenersBot = null;
        this._bindExtensions(newBot);

        // Capture spawn promise SYNCHRONOUSLY - before any await
        this._captureSpawnPromise(options.timeout || 10000);

        try {
            await this.join(options);
        } catch (err) {
            // Clean up the failed bot so it doesn't leak
            this.bot.removeAllListeners();
            const idx = activeBots.indexOf(this.bot);
            if (idx !== -1) activeBots.splice(idx, 1);
            throw err;
        }
    }

    async giveItem(item: string, count: number = 1): Promise<void> {
        this.requireServer();
        this.serverWrapper!.execute(`minecraft:give ${this.username} ${item} ${count}`);

        await poll(
            () => {
                const total = this.bot.inventory.items()
                    .filter(i => i.name.includes(item))
                    .reduce((sum, i) => sum + i.count, 0);
                return total >= count ? true : undefined;
            },
            { message: `Expected ${count}x "${item}" in inventory` }
        );
    }

    private requireServer(): void {
        if (!this.serverWrapper) {
            throw new Error('ServerWrapper not set on PlayerWrapper');
        }
    }

    /**
     * Executes a server command and waits for the server to finish processing it.
     *
     * Only guarantees synchronous dispatch completed. If a plugin schedules
     * async work (delayed tasks, DB calls), use `poll()` to wait for the
     * observable effect instead.
     */
    private async executeAndSync(cmd: string): Promise<void> {
        this.requireServer();
        const syncId = `sync_${randomUUID().split('-')[0]}`;
        this.serverWrapper!.execute(cmd);
        this.serverWrapper!.execute(`minecraft:say ${syncId}`);

        await poll(
            () => messageBuffer.find(m => m.includes(syncId)),
            { message: `Server command sync timed out for: ${cmd}` }
        );
    }
}

async function waitForServerStart(serverProcess: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Server failed to start within 120 seconds'));
        }, 120000);

        const dataHandler = (data: Buffer): void => {
            const output = data.toString();
            writeMcOutput(data);

            if (output.includes('Done (')) {
                clearTimeout(timeout);
                serverProcess.stdout.removeListener('data', dataHandler);
                serverProcess.stderr.removeListener('data', stderrHandler);
                setTimeout(resolve, 3000);
            }
        };

        const stderrHandler = (data: Buffer): void => {
            writeMcOutput(data);
        };

        serverProcess.stdout.on('data', dataHandler);
        serverProcess.stderr.on('data', stderrHandler);

        serverProcess.on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to start server: ${err.message}`));
        });

        serverProcess.on('exit', (code: number | null) => {
            if (code !== null && code !== 0) {
                clearTimeout(timeout);
                reject(new Error(`Server exited with code ${code} before becoming ready`));
            }
        });
    });
}

interface TestResult {
    file: string;
    testName: string;
    passed: boolean;
    durationMs: number;
    error?: Error;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
}

async function findSpecFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
            results.push(...await findSpecFiles(join(dir, entry.name)));
        } else if (entry.isFile() && entry.name.endsWith('.spec.js')) {
            results.push(join(dir, entry.name));
        }
    }
    return results;
}

export async function runTestSession(): Promise<void> {
    const serverJar = process.env.SERVER_JAR;
    const serverDir = process.env.SERVER_DIR;
    const javaPath = process.env.JAVA_PATH;
    const testFileFilter = process.env.TEST_FILES;
    const testNameFilter = process.env.TEST_NAMES;
    const testResults: TestResult[] = [];

    if (!serverJar || !serverDir || !javaPath) {
        throw new Error('SERVER_JAR, JAVA_PATH and SERVER_DIR environment variables must be set');
    }

    let exitCode = 0;

    console.log(`\n${pc.bold('Starting Paper server...')}`);

    const jvmArgsString = process.env.JVM_ARGS || '';
    const jvmArgs = jvmArgsString.split(' ').filter(arg => arg.trim() !== '');

    console.log(pc.dim(`JVM Arguments: ${jvmArgs.join(' ')}`));

    const serverProcess = spawn(javaPath!, [...jvmArgs, '-jar', serverJar, '--nogui'], {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    try {
        await waitForServerStart(serverProcess);
        console.log(`${pc.green(pc.bold('Server started successfully'))}\n`);

        serverProcess.stdout.on('data', writeMcOutput);
        serverProcess.stderr.on('data', writeMcOutput);

        let testFiles = await findSpecFiles(process.cwd());
        if (testFileFilter) {
            const patterns = testFileFilter.split(',').map(p => p.trim());
            console.log(`${pc.dim(`Filtering test files with patterns: ${JSON.stringify(patterns)}`)}\n`);
            testFiles = testFiles.filter(file =>
                patterns.some(pattern => {
                    const fileName = basename(file).replace(/\.spec\.js$/, '');
                    const matches = fileName.includes(pattern) || file.includes(pattern);
                    console.log(pc.dim(`  Testing ${file} (basename: ${fileName}) against pattern "${pattern}": ${matches}`));
                    return matches;
                })
            );
        }

        console.log(`${pc.bold(`Found ${testFiles.length} test file(s)${testFileFilter ? ` matching filter: ${testFileFilter}` : ''}`)}\n`);

        for (const file of testFiles) {
            console.log(`\n${pc.blue(pc.bold(`Running tests from: ${file}`))}`);

            testRegistry.length = 0;
            scopeStack.length = 0;
            scopeStack.push({ label: '', beforeHooks: [], afterHooks: [] });
            await import(pathToFileURL(file).href);

            for (const testCase of testRegistry) {
                if (testNameFilter) {
                    const patterns = testNameFilter.split(',').map(p => p.trim());
                    const matches = patterns.some(pattern => testCase.name.includes(pattern));
                    if (!matches) {
                        console.log(pc.dim(`  Test: ${testCase.name} - SKIPPED (filter: ${testNameFilter})`));
                        continue;
                    }
                }

                console.log(`  ${pc.bold(`Test: ${testCase.name}`)}`);

                messageBuffer.length = 0;
                serverConsoleBuffer.length = 0;

                const server = new ServerWrapper((cmd: string) => {
                    console.log(`${pc.yellow('[Server]')} ${pc.dim(`Executing: ${cmd}`)}`);
                    serverProcess.stdin.write(cmd + '\n', (err) => {
                        if (err) console.error(`[Server] Write error: ${err}`);
                    });
                });

                const createPlayer = async (options?: { username?: string }): Promise<PlayerWrapper> => {
                    const uniqueId = randomUUID().split('-')[0];
                    const botUsername = options?.username || `Test_${uniqueId}`;
                    console.log(`${pc.cyan('[Bot]')} Creating bot: ${pc.bold(botUsername)}`);

                    const bot = mineflayer.createBot({
                        host: 'localhost',
                        port: 25565,
                        username: botUsername,
                        version: process.env.MC_VERSION,
                        auth: 'offline'
                    });

                    activeBots.push(bot);

                    bot.once('end', (reason: string) => {
                        console.log(pc.dim(`[Bot] ${botUsername} connection ended: ${reason}`));
                    });

                    const player = new PlayerWrapper(bot);
                    player._captureSpawnPromise();
                    player.setServerWrapper(server);
                    player._setBotOptions({
                        host: 'localhost',
                        port: 25565,
                        version: process.env.MC_VERSION,
                        auth: 'offline',
                    });

                    await player.join();
                    return player;
                };

                const player = await createPlayer();
                currentPlayer = player.bot;

                const testStartTime = Date.now();

                try {
                    const timeoutMs = process.env.TEST_TIMEOUT ? parseInt(process.env.TEST_TIMEOUT, 10) : 30000;
                    let timeoutHandle: ReturnType<typeof setTimeout>;
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        timeoutHandle = setTimeout(() => {
                            reject(new Error(`Test timed out after ${timeoutMs}ms. You can increase this by setting the TEST_TIMEOUT environment variable.`));
                        }, timeoutMs);
                    });

                    await Promise.race([
                        testCase.fn({ player, server, createPlayer }).finally(() => clearTimeout(timeoutHandle)),
                        timeoutPromise
                    ]);

                    const durationMs = Date.now() - testStartTime;
                    console.log(`    ${pc.green(pc.bold('PASSED'))} ${pc.dim(`(${formatDuration(durationMs)})`)}\n`);
                    testResults.push({ file, testName: testCase.name, passed: true, durationMs });
                } catch (error) {
                    const durationMs = Date.now() - testStartTime;
                    const errorMsg = (error as Error).message;

                    console.log(`    ${pc.red(pc.bold('FAILED'))} ${pc.dim(`(${formatDuration(durationMs)})`)}: ${pc.red(errorMsg)}\n`);

                    testResults.push({
                        file,
                        testName: testCase.name,
                        passed: false,
                        durationMs,
                        error: error as Error
                    });
                } finally {
                    for (const b of activeBots) {
                        b.removeAllListeners();
                    }

                    await Promise.all(activeBots.map(b => {
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

                    currentPlayer = null;
                    activeBots.length = 0;
                }
            }
        }

    } finally {
        // Disconnect all bots
        for (const bot of activeBots) {
            bot.removeAllListeners();
        }

        await Promise.all(activeBots.map(bot => {
            return new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    console.log(pc.yellow(`[WARNING] Bot ${bot.username} cleanup timeout, forcing end`));
                    resolve();
                }, 2000);

                bot.once('end', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                try {
                    bot.quit();
                } catch (err) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        }));
        activeBots.length = 0;

        // Stop the server
        if (serverProcess.exitCode === null && !serverProcess.killed) {
            try {
                serverProcess.stdin.write('stop\n');
            } catch (err) {
                console.log(pc.yellow(`[WARNING] Failed to send stop command to server: ${(err as Error).message}`));
            }
        }

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                console.log(pc.yellow('[WARNING] Server did not stop gracefully, forcing shutdown...'));
                serverProcess.kill();
                resolve();
            }, 30000);

            serverProcess.once('exit', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    console.log(pc.yellow(`[WARNING] Server exited with code: ${code}`));
                }
                resolve();
            });
        });

        serverProcess.removeAllListeners();
        serverProcess.stdin.end();
        serverProcess.stdout.destroy();
        serverProcess.stderr.destroy();

        // Display test results
        console.log(`\n${pc.bold('═'.repeat(40))}`);
        console.log(pc.bold('  Test Summary'));
        console.log(pc.bold('═'.repeat(40)));

        const passed = testResults.filter(r => r.passed);
        const failed = testResults.filter(r => !r.passed);

        const totalDuration = testResults.reduce((sum, r) => sum + r.durationMs, 0);

        console.log(`  Total:    ${pc.bold(String(testResults.length))}`);
        console.log(`  Passed:   ${pc.green(pc.bold(String(passed.length)))}`);
        console.log(`  Failed:   ${failed.length > 0 ? pc.red(pc.bold(String(failed.length))) : pc.dim(String(failed.length))}`);
        console.log(`  Duration: ${pc.dim(formatDuration(totalDuration))}`);

        const statusCol = 'Status';
        const testCol = 'Test';
        const durationCol = 'Duration';

        const statusWidth = Math.max(statusCol.length, ...(testResults.map(r => r.passed ? 'PASS' : 'FAIL').map(s => s.length)));
        const durationWidth = Math.max(durationCol.length, ...testResults.map(r => formatDuration(r.durationMs).length));
        const testWidth = Math.max(testCol.length, ...testResults.map(r => r.testName.length));

        const header = `  ${pc.dim(`${statusCol.padEnd(statusWidth)}  ${testCol.padEnd(testWidth)}  ${durationCol.padStart(durationWidth)}`)}`;
        const separator = `  ${pc.dim(`${'─'.repeat(statusWidth)}  ${'─'.repeat(testWidth)}  ${'─'.repeat(durationWidth)}`)}`;

        console.log(`\n${header}`);
        console.log(separator);

        for (const result of testResults) {
            const status = result.passed ? 'PASS' : 'FAIL';
            const statusPadded = status.padEnd(statusWidth);
            const coloredStatus = result.passed
                ? pc.green(pc.bold(statusPadded))
                : pc.red(pc.bold(statusPadded));
            const duration = formatDuration(result.durationMs);
            console.log(`  ${coloredStatus}  ${result.testName.padEnd(testWidth)}  ${pc.dim(duration.padStart(durationWidth))}`);
        }

        console.log(separator);
        console.log(`  ${''.padEnd(statusWidth)}  ${pc.bold('Total'.padEnd(testWidth))}  ${pc.dim(formatDuration(totalDuration).padStart(durationWidth))}`);

        if (failed.length > 0) {
            console.log(`\n${pc.red(pc.bold('Failed Tests:'))}\n`);

            for (const result of failed) {
                console.log(`  ${pc.red(`✗ ${result.testName}`)}`);

                if (result.error) {
                    console.log(`    ${pc.red(result.error.message)}`);
                    const location = extractSpecLocation(result.error);
                    if (location) {
                        console.log(`    ${pc.dim(`at ${location}`)}`);
                    }
                }

                console.log('');
            }

            exitCode = 1;
        } else {
            console.log(`\n${pc.green(pc.bold('All tests passed!'))}`);
        }

        setTimeout(() => {
            process.exit(exitCode);
        }, 1000).unref();
    }
}

export { sleep, waitForAssertion, waitUntil } from './lib/utils.js';
