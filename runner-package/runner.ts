import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import mineflayer, { Bot } from 'mineflayer';
import { readdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { ItemWrapper, GuiWrapper, createPlayerExtensions, Window, LiveGuiHandle, GuiItemLocator } from './lib/wrappers.js';
import { Matchers } from "./lib/expect.js";
import { randomUUID } from "node:crypto";
import { install as installSourceMapSupport } from 'source-map-support';
import { captureCallSite, extractLineNumberFromStack } from './lib/stack-trace.js';

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


const testRegistry: TestCase[] = [];
let currentPlayer: Bot | null = null;
let messageBuffer: string[] = [];
const activeBots: Bot[] = [];

export function test(name: string, fn: (context: TestContext) => Promise<void>): void {
    testRegistry.push({ name, fn });
}

function waitFor<T>(
    checkFn: () => T | undefined,
    emitter: EventEmitterLike | null,
    eventName: string,
    predicateFn: (...args: unknown[]) => T | undefined,
    timeoutMsg: string,
    timeoutMs: number = 5000
): Promise<T> {
    const result = checkFn();
    if (result) return Promise.resolve(result);

    return new Promise((resolve, reject) => {
        if (!emitter) {
            reject(new Error('No event emitter available'));
            return;
        }

        let handler: (...args: unknown[]) => void;
        const timeout = setTimeout(() => {
            emitter.removeListener(eventName, handler);
            reject(new Error(`Timeout: ${timeoutMsg}`));
        }, timeoutMs);

        handler = (...args: unknown[]) => {
            const res = predicateFn(...args);
            if (res) {
                clearTimeout(timeout);
                emitter.removeListener(eventName, handler);
                resolve(res);
            }
        };

        emitter.on(eventName, handler);
    });
}

class RunnerMatchers<T = unknown> extends Matchers<T> {
    private readonly callSite: string;

    constructor(actual: T, isNot: boolean = false) {
        super(actual, isNot);

        this.callSite = captureCallSite(RunnerMatchers);
    }

    private async waitAbit(ms: number = 500) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async toHaveReceivedMessage(this: RunnerMatchers<PlayerWrapper>, expectedMessage: string, strict: boolean = false): Promise<void> {
        const player = this.actual;
        const bot = player.bot;
        const isMatch = (msg: string): boolean => strict ? msg === expectedMessage : msg.includes(expectedMessage);

        if (this.isNot) {
            await this.waitAbit(500);
            const found = messageBuffer.find(isMatch);
            if (found) {
                const error = new Error(`Expected NOT to receive message matching "${expectedMessage}", but received: "${found}"`);
                error.stack = this.callSite;
                throw error;
            }
            return;
        }

        try {
            const checkFn = (): string | undefined => messageBuffer.find(isMatch);
            await waitFor(
                checkFn,
                bot,
                'message',
                (jsonMsg: unknown): string | undefined => {
                    const msgStr = String(jsonMsg);
                    return isMatch(msgStr) ? msgStr : undefined;
                },
                `Expected message "${expectedMessage}" not received`
            );
        } catch (error) {
            // Replace the error stack with our captured call site
            const newError = new Error((error as Error).message);
            newError.stack = this.callSite;
            throw newError;
        }
    }

    async toContainItem(this: RunnerMatchers<PlayerWrapper>, itemName: string): Promise<void> {
        const player = this.actual;
        const bot = player.bot;
        const checkFn = (): boolean => bot.inventory.items().some(item => item.name.includes(itemName));

        if (this.isNot) {
            await this.waitAbit(500);
            if (checkFn()) {
                const error = new Error(`Expected inventory NOT to contain item "${itemName}", but it was found`);
                error.stack = this.callSite;
                throw error;
            }
            return;
        }

        try {
            await waitFor(checkFn, bot, 'windowUpdate', checkFn, `Expected item "${itemName}" not found`);
        } catch (error) {
            // Replace the error stack with our captured call site
            const newError = new Error((error as Error).message);
            newError.stack = this.callSite;
            throw newError;
        }
    }

    async toHaveLore(this: RunnerMatchers<GuiItemLocator>, expectedLore: string, options: { timeout?: number; pollingRate?: number } = {}): Promise<void> {
        const { timeout = 5000, pollingRate = 100 } = options;
        const locator = this.actual;
        const startTime = Date.now();

        const checkFn = (): boolean => {
            const loreText = locator.loreText();
            return loreText.includes(expectedLore);
        };

        if (this.isNot) {
            // For negative assertions, poll until the lore no longer matches or timeout
            while (Date.now() - startTime < timeout) {
                if (!checkFn()) {
                    return; // Success: lore doesn't match
                }
                await new Promise(resolve => setTimeout(resolve, pollingRate));
            }
            const error = new Error(`Expected locator NOT to have lore containing "${expectedLore}", but it does`);
            error.stack = this.callSite;
            throw error;
        }

        // For positive assertions, poll until the lore matches or timeout
        while (Date.now() - startTime < timeout) {
            if (checkFn()) {
                return; // Success: lore matches
            }
            await new Promise(resolve => setTimeout(resolve, pollingRate));
        }

        const currentLore = locator.loreText();
        const error = new Error(
            `Expected locator to have lore containing "${expectedLore}", but got: "${currentLore}"`
        );
        error.stack = this.callSite;
        throw error;
    }
}
export function expect<T>(target: T): RunnerMatchers<T> {
    return new RunnerMatchers(target);
}

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
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    async makeOp(): Promise<void> {
        if (!this.serverWrapper) {
            throw new Error('ServerWrapper not set. This should not happen in test context.');
        }
        await this.serverWrapper.execute(`minecraft:op ${this.username}`);
    }

    async deOp(): Promise<void> {
        if (!this.serverWrapper) {
            throw new Error('ServerWrapper not set. This should not happen in test context.');
        }
        await this.serverWrapper.execute(`minecraft:deop ${this.username}`);
    }

    async setGameMode(mode: 'survival' | 'creative' | 'adventure' | 'spectator'): Promise<void> {
        if (!this.serverWrapper) {
            throw new Error('ServerWrapper not set. This should not happen in test context.');
        }
        await this.serverWrapper.execute(`minecraft:gamemode ${mode} ${this.username}`);
    }

    async teleport(x: number, y: number, z: number): Promise<void> {
        if (!this.serverWrapper) {
            throw new Error('ServerWrapper not set. This should not happen in test context.');
        }
        await this.serverWrapper.execute(`minecraft:tp ${this.username} ${x} ${y} ${z}`);
    }

    async giveItem(item: string, count: number = 1): Promise<void> {
        if (!this.serverWrapper) {
            throw new Error('ServerWrapper not set. This should not happen in test context.');
        }
        await this.serverWrapper.execute(`minecraft:give ${this.username} ${item} ${count}`);
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
            console.log(output);

            if (output.includes('Done (') ||
                output.includes('DONE') ||
                output.includes('For help, type "help"') ||
                outputBuffer.includes('Done (')) {
                clearTimeout(timeout);
                console.log('\nServer ready detected\n');
                serverProcess.stdout.removeListener('data', dataHandler);
                setTimeout(resolve, 3000);
            }
        };

        serverProcess.stdout.on('data', dataHandler);

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
    error?: string;
    stack?: string;
    lineNumber?: number;
    columnNumber?: number;
}

export async function runTestSession(): Promise<void> {
    const serverJar = process.env.SERVER_JAR;
    const serverDir = process.env.SERVER_DIR;
    const javaPath = process.env.JAVA_PATH;
    const testFileFilter = process.env.TEST_FILES;
    const testNameFilter = process.env.TEST_NAMES;
    const testResults: TestResult[] = [];

    if (!serverJar || !serverDir) {
        throw new Error('SERVER_JAR, JAVA_PATH and SERVER_DIR environment variables must be set');
    }

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
                    version: '1.19.4',
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

                try {
                    const server: ServerWrapper = {
                        execute: async (cmd: string) => {
                            console.log(`[Server] Executing: ${cmd}`);
                            serverProcess.stdin.write(cmd + '\n', (err) => {
                                if (err) console.error(`[Server] Write error: ${err}`);
                            });
                            await new Promise(r => setTimeout(r, 500));
                        }
                    };

                    const player = new PlayerWrapper(bot);
                    player.setServerWrapper(server);

                    await testCase.fn({ player, server });
                    console.log(`    PASSED\n`);
                    testResults.push({ file, testName: testCase.name, passed: true });
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    const stack = (error as Error).stack;
                    const location = extractLineNumberFromStack(stack, file);

                    console.log(`    FAILED: ${errorMsg}\n`);

                    testResults.push({
                        file,
                        testName: testCase.name,
                        passed: false,
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

        console.log(`Total: ${testResults.length}`);
        console.log(`Passed: ${passed.length}`);
        console.log(`Failed: ${failed.length}`);

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
            
            setTimeout(() => {
                process.exit(1);
            }, 1000).unref();
            
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

        serverProcess.stdin.write('stop\n');

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

        // Give the event loop a moment to drain, then force exit
        setTimeout(() => {
            process.exit(0);
        }, 1000).unref();
    }
}
