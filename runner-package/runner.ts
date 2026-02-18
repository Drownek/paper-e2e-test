import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import mineflayer, { Bot } from 'mineflayer';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ItemWrapper, GuiWrapper, createPlayerExtensions, Window, LiveGuiHandle, GuiItemLocator } from './lib/wrappers.js';
import { Matchers } from "./lib/expect.js";
import { randomUUID } from "node:crypto";
import { install as installSourceMapSupport } from 'source-map-support';
import { extractLineNumberFromStack } from './lib/stack-trace.js';
import { poll, sleep } from './lib/utils.js';

// Enable source map support for accurate TypeScript stack traces
installSourceMapSupport();

export { ItemWrapper, GuiWrapper };

export interface TestContext {
    player: PlayerWrapper;
    server: ServerWrapper;
}

export interface ServerWrapper {
    execute: (cmd: string) => Promise<void>;
}

interface TestCase {
    name: string;
    fn: (context: TestContext) => Promise<void>;
}

interface EventEmitterLike {
    on(event: string, listener: (...args: unknown[]) => void): void;
    removeListener(event: string, listener: (...args: unknown[]) => void): void;
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

    protected async pollAssertion(
        condition: () => boolean,
        passMessage: () => string,
        failMessage: () => string,
        options: { timeout?: number; pollingRate?: number } = {}
    ): Promise<void> {
        const { timeout = 5000, pollingRate = 50 } = options;

        if (this.isNot) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                if (condition()) throw new Error(passMessage());
                await new Promise(resolve => setTimeout(resolve, pollingRate));
            }
            return;
        }

        await poll(
            () => condition() ? true : undefined,
            { timeout, interval: pollingRate, message: failMessage }
        );
    }

    async toHaveReceivedMessage(
        this: RunnerMatchers<PlayerWrapper>,
        expectedMessage: string | RegExp,
        strict: boolean = false
    ): Promise<void> {
        const isMatch = (msg: string): boolean => {
            if (expectedMessage instanceof RegExp) return expectedMessage.test(msg);
            return strict ? msg === expectedMessage : msg.includes(expectedMessage);
        };

        await this.pollAssertion(
            () => messageBuffer.some(isMatch),
            () => `Expected NOT to receive message matching "${expectedMessage}", but received: "${messageBuffer.find(isMatch)}"`,
            () => `Expected message matching "${expectedMessage}" not received`
        );
    }

    async toContainItem(
        this: RunnerMatchers<PlayerWrapper>,
        itemName: string,
        count: number | undefined = undefined
    ): Promise<void> {
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
                : `Expected item "${itemName}" in inventory`
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
            Math.abs(pos().x - x) < tolerance &&
            Math.abs(pos().z - z) < tolerance &&
            (y === undefined || Math.abs(pos().y - y) < tolerance);

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

    private async pollUntilPass(assertion: (matchers: Matchers<T>) => void): Promise<void> {
        const { timeout, interval } = this.options;
        const deadline = Date.now() + timeout;
        let lastError: unknown;

        while (Date.now() < deadline) {
            const value = await this.fn();
            try {
                const m = new Matchers(value, this.isNot);
                assertion(m);
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

export class PlayerWrapper {
    bot: Bot;
    inventory: Bot['inventory'];
    username: string;

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
    waitForGui: (guiMatcher: (gui: GuiWrapper) => boolean, options?: { timeout?: number }) => Promise<GuiWrapper>;

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
    waitForGuiItem: (itemMatcher: (item: ItemWrapper) => boolean, options?: { timeout?: number, pollingRate?: number }) => Promise<ItemWrapper>;

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
    clickGuiItem: (itemMatcher: (item: ItemWrapper) => boolean, options?: { timeout?: number, pollingRate?: number }) => Promise<void>;

    gui: (options: { title: string | RegExp; timeout?: number }) => Promise<LiveGuiHandle>;
    private serverWrapper?: ServerWrapper;

    constructor(bot: Bot) {
        this.bot = bot;
        this.inventory = bot.inventory;
        this.username = bot.username;

        const extensions = createPlayerExtensions(bot);
        this.waitForGui = extensions.waitForGui.bind(this);
        this.waitForGuiItem = extensions.waitForGuiItem.bind(this);
        this.clickGuiItem = extensions.clickGuiItem.bind(this);
        this.gui = extensions.gui.bind(this);
    }

    setServerWrapper(server: ServerWrapper): void {
        this.serverWrapper = server;
    }

    getCurrentGui(): GuiWrapper | null {
        let currentWindow = this.bot.currentWindow;
        return currentWindow ? new GuiWrapper(this.bot, currentWindow as Window) : null;
    }

    async chat(message: string): Promise<void> {
        console.log(`[Bot] Chatting: ${message}`);
        this.bot.chat(message);
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
        await this.serverWrapper!.execute(`minecraft:op ${this.username}`);

        await poll(
            () => messageBuffer.find(m => m.includes(`Made ${this.username} a server operator`)),
            { message: `Player ${this.username} was not opped` }
        );
    }

    async deOp(): Promise<void> {
        await this.executeAndSync(`minecraft:deop ${this.username}`);
    }

    async setGameMode(mode: 'survival' | 'creative' | 'adventure' | 'spectator'): Promise<void> {
        this.requireServer();
        await this.serverWrapper!.execute(`minecraft:gamemode ${mode} ${this.username}`);

        await poll(
            () => this.bot.game.gameMode === mode ? true : undefined,
            { message: `Game mode did not change to "${mode}"` }
        );
    }

    async teleport(x: number, y: number, z: number): Promise<void> {
        this.requireServer();
        await this.serverWrapper!.execute(`minecraft:tp ${this.username} ${x} ${y} ${z}`);

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

    async giveItem(item: string, count: number = 1): Promise<void> {
        this.requireServer();
        await this.serverWrapper!.execute(`minecraft:give ${this.username} ${item} ${count}`);

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
        await this.serverWrapper!.execute(cmd);
        await this.serverWrapper!.execute(`minecraft:say ${syncId}`);

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

        let outputBuffer = '';

        const dataHandler = (data: Buffer): void => {
            const output = data.toString();
            outputBuffer += output;
            process.stdout.write(output);

            if (output.includes('Done (') ||
                output.includes('DONE') ||
                output.includes('For help, type "help"') ||
                outputBuffer.includes('Done (')) {
                clearTimeout(timeout);
                serverProcess.stdout.removeListener('data', dataHandler);
                serverProcess.stderr.removeListener('data', stderrHandler);
                setTimeout(resolve, 3000);
            }
        };

        const stderrHandler = (data: Buffer): void => {
            const output = data.toString();
            outputBuffer += output;
            process.stderr.write(output);
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
    error?: string;
    stack?: string;
    lineNumber?: number;
    columnNumber?: number;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
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

    console.log('\nStarting Paper server...');

    const jvmArgsString = process.env.JVM_ARGS || '';
    const jvmArgs = jvmArgsString.split(' ').filter(arg => arg.trim() !== '');

    console.log(`JVM Arguments: ${jvmArgs.join(' ')}`);

    const serverProcess = spawn(javaPath!, [...jvmArgs, '-jar', serverJar, '--nogui'], {
        cwd: serverDir,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    try {
        await waitForServerStart(serverProcess);
        console.log('Server started successfully\n');

        // Check if TypeScript was compiled (dist directory exists with spec files)
        const distDir = join(process.cwd(), 'dist');
        const hasCompiledTests = existsSync(distDir);

        let testFiles: string[] = [];

        if (hasCompiledTests) {
            // Look for compiled .spec.js files in dist directory
            const distFiles = (await readdir(distDir))
                .filter(file => file.endsWith('.spec.js'))
                .map(file => join('dist', file));
            testFiles.push(...distFiles);
        }

        // Also look for .spec.js files in the root (for pure JavaScript tests)
        const rootFiles = (await readdir(process.cwd()))
            .filter(file => file.endsWith('.spec.js') && !file.startsWith('dist'));
        testFiles.push(...rootFiles);

        // Apply file filter if provided
        if (testFileFilter) {
            const patterns = testFileFilter.split(',').map(p => p.trim());
            console.log(`Filtering test files with patterns: ${JSON.stringify(patterns)}\n`);
            testFiles = testFiles.filter(file =>
                patterns.some(pattern => {
                    const fileName = file.replace(/^dist[/\\]/, '').replace(/\.spec\.js$/, '');
                    const matches = fileName.includes(pattern) || file.includes(pattern);
                    console.log(`  Testing ${file} (basename: ${fileName}) against pattern "${pattern}": ${matches}`);
                    return matches;
                })
            );
        }

        console.log(`Found ${testFiles.length} test file(s)${testFileFilter ? ` matching filter: ${testFileFilter}` : ''}\n`);

        for (const file of testFiles) {
            console.log(`\nRunning tests from: ${file}`);

            testRegistry.length = 0;
            await import(pathToFileURL(join(process.cwd(), file)).href);

            for (const testCase of testRegistry) {
                // Apply test name filter if provided
                if (testNameFilter) {
                    const patterns = testNameFilter.split(',').map(p => p.trim());
                    const matches = patterns.some(pattern => testCase.name.includes(pattern));
                    if (!matches) {
                        console.log(`  Test: ${testCase.name} - SKIPPED (filter: ${testNameFilter})`);
                        continue;
                    }
                }

                console.log(`  Test: ${testCase.name}`);

                messageBuffer.length = 0;

                const uniqueId = randomUUID().split('-')[0];
                const botUsername = `Test_${uniqueId}`;
                console.log(`[Bot] Creating bot: ${botUsername}`);

                const bot = mineflayer.createBot({
                    host: 'localhost',
                    port: 25565,
                    username: botUsername,
                    version: process.env.MC_VERSION,
                    auth: 'offline'
                });

                currentPlayer = bot;
                activeBots.push(bot);

                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Bot failed to spawn within 10 seconds'));
                    }, 10000);

                    bot.once('spawn', () => {
                        console.log(`[Bot] ${botUsername} spawned successfully`);
                        clearTimeout(timeout);
                        resolve();
                    });

                    bot.once('error', (err: Error) => {
                        console.log(`[Bot] Connection error: ${err.message}`);
                        clearTimeout(timeout);
                        reject(err);
                    });

                    bot.once('kicked', (reason: string) => {
                        console.log(`[Bot] Kicked: ${reason}`);
                        clearTimeout(timeout);
                        reject(new Error(`Bot was kicked: ${reason}`));
                    });

                    bot.once('end', (reason: string) => {
                        console.log(`[Bot] Connection ended: ${reason}`);
                    });
                });

                bot.on('message', (jsonMsg: unknown) => {
                    const message = String(jsonMsg);
                    console.log(`[Bot] Received message: "${message}"`);
                    messageBuffer.push(message);
                });

                bot.on('windowOpen', (window: unknown) => {
                    const win = window as { title?: string; type?: string | number; slots?: unknown[] };
                    console.log(`[DEBUG] Global windowOpen event - Title: "${win.title}", Type: ${win.type}, SlotCount: ${win.slots?.length}`);
                });

                bot.on('windowClose', (window: unknown) => {
                    const win = window as { title?: string };
                    console.log(`[DEBUG] windowClose event - Window: ${win?.title || 'unknown'}`);
                });

                (bot as Bot & { _client: EventEmitterLike })._client.on('open_window', (packet: unknown) => {
                    console.log(`[DEBUG] Raw open_window packet:`, JSON.stringify(packet));
                });

                const testStartTime = Date.now();

                try {
                    const server: ServerWrapper = {
                        execute: async (cmd: string) => {
                            console.log(`[Server] Executing: ${cmd}`);
                            serverProcess.stdin.write(cmd + '\n', (err) => {
                                if (err) console.error(`[Server] Write error: ${err}`);
                            });
                        }
                    };

                    const player = new PlayerWrapper(bot);
                    player.setServerWrapper(server);

                    await testCase.fn({ player, server });
                    const durationMs = Date.now() - testStartTime;
                    console.log(`    PASSED (${formatDuration(durationMs)})\n`);
                    testResults.push({ file, testName: testCase.name, passed: true, durationMs });
                } catch (error) {
                    const durationMs = Date.now() - testStartTime;
                    const errorMsg = (error as Error).message;
                    const stack = (error as Error).stack;
                    const location = extractLineNumberFromStack(stack, file);

                    if (!location) {
                        console.log(`[DEBUG] Could not extract line number from stack for file "${file}"`);
                        console.log(`[DEBUG] Stack:\n${stack}`);
                    }

                    console.log(`    FAILED (${formatDuration(durationMs)}): ${errorMsg}\n`);

                    testResults.push({
                        file,
                        testName: testCase.name,
                        passed: false,
                        durationMs,
                        error: errorMsg,
                        stack,
                        lineNumber: location?.line,
                        columnNumber: location?.column
                    });
                } finally {
                    bot.removeAllListeners();

                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => {
                            console.log(`[WARNING] Bot ${bot.username} disconnect timeout, continuing anyway`);
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

                    currentPlayer = null;
                    const index = activeBots.indexOf(bot);
                    if (index > -1) activeBots.splice(index, 1);
                }
            }
        }

        console.log('\n========================================');
        console.log('Test Summary');
        console.log('========================================');

        const passed = testResults.filter(r => r.passed);
        const failed = testResults.filter(r => !r.passed);

        const totalDuration = testResults.reduce((sum, r) => sum + r.durationMs, 0);

        console.log(`Total: ${testResults.length}`);
        console.log(`Passed: ${passed.length}`);
        console.log(`Failed: ${failed.length}`);
        console.log(`Duration: ${formatDuration(totalDuration)}`);

        // Duration table
        const statusCol = 'Status';
        const testCol = 'Test';
        const durationCol = 'Duration';

        const statusWidth = Math.max(statusCol.length, ...(testResults.map(r => r.passed ? 'PASS' : 'FAIL').map(s => s.length)));
        const durationWidth = Math.max(durationCol.length, ...testResults.map(r => formatDuration(r.durationMs).length));
        const testWidth = Math.max(testCol.length, ...testResults.map(r => r.testName.length));

        const header = `  ${statusCol.padEnd(statusWidth)}  ${testCol.padEnd(testWidth)}  ${durationCol.padStart(durationWidth)}`;
        const separator = `  ${'─'.repeat(statusWidth)}  ${'─'.repeat(testWidth)}  ${'─'.repeat(durationWidth)}`;

        console.log(`\n${header}`);
        console.log(separator);

        for (const result of testResults) {
            const status = result.passed ? 'PASS' : 'FAIL';
            const duration = formatDuration(result.durationMs);
            console.log(`  ${status.padEnd(statusWidth)}  ${result.testName.padEnd(testWidth)}  ${duration.padStart(durationWidth)}`);
        }

        console.log(separator);
        console.log(`  ${''.padEnd(statusWidth)}  ${'Total'.padEnd(testWidth)}  ${formatDuration(totalDuration).padStart(durationWidth)}`);

        if (failed.length > 0) {
            console.log('\nFailed Tests:');
            for (const result of failed) {
                const filePath = result.file.replace(/^dist[/\\]/, '').replace(/\.spec\.js$/, '.spec.ts');
                const absolutePath = join(process.cwd(), filePath);

                const lineNumber = result.lineNumber;
                const columnNumber = result.columnNumber || 1;

                const fileUrl = pathToFileURL(absolutePath).href + (lineNumber ? `:${lineNumber}:${columnNumber}` : '');
                console.log(`  ✗ ${result.testName}`);
                console.log(`    ${result.error}`);
                console.log(`    ${fileUrl}`);
            }
            console.log('');

            exitCode = 1;

            throw new Error(`${failed.length} test(s) failed`);
        } else {
            console.log('\nAll tests passed!');
        }
    } finally {
        await Promise.all(activeBots.map(bot => {
            return new Promise<void>((resolve) => {
                const timeout = setTimeout(() => {
                    console.log(`[WARNING] Bot ${bot.username} cleanup timeout, forcing end`);
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

        // Check if server is still running before attempting to write
        if (serverProcess.exitCode === null && !serverProcess.killed) {
            try {
                serverProcess.stdin.write('stop\n');
            } catch (err) {
                console.log('[WARNING] Failed to send stop command to server:', (err as Error).message);
            }
        }

        // Wait for the server to exit gracefully
        await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                console.log('[WARNING] Server did not stop gracefully, forcing shutdown...');
                serverProcess.kill();
                resolve();
            }, 30000); // 30 second timeout

            serverProcess.once('exit', (code) => {
                clearTimeout(timeout);
                if (code !== 0) {
                    console.log(`[WARNING] Server exited with code: ${code}`);
                }
                resolve();
            });
        });

        // Clean up all listeners and streams
        serverProcess.removeAllListeners();
        serverProcess.stdin.end();
        serverProcess.stdout.destroy();
        serverProcess.stderr.destroy();

        // Safety net
        setTimeout(() => {
            process.exit(exitCode);
        }, 1000).unref();
    }
}

export { sleep, waitForAssertion, waitUntil } from './lib/utils.js';