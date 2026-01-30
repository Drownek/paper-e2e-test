import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import mineflayer, { Bot } from 'mineflayer';
import { readdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { ItemWrapper, GuiWrapper, createPlayerExtensions } from './lib/wrappers.js';
import { Matchers } from "./lib/expect.js";
import * as yaml from 'js-yaml';
import { randomUUID } from "node:crypto";

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
    constructor(actual: T, isNot: boolean = false) {
        super(actual, isNot);
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
                throw new Error(`Expected NOT to receive message matching "${expectedMessage}", but received: "${found}"`);
            }
            return;
        }

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
    }

    async toContainItem(this: RunnerMatchers<PlayerWrapper>, itemName: string): Promise<void> {
        const player = this.actual;
        const bot = player.bot;
        const checkFn = (): boolean => bot.inventory.items().some(item => item.name.includes(itemName));

        if (this.isNot) {
            await this.waitAbit(500);
            if (checkFn()) {
                throw new Error(`Expected inventory NOT to contain item "${itemName}", but it was found`);
            }
            return;
        }

        await waitFor(checkFn, bot, 'windowUpdate', checkFn, `Expected item "${itemName}" not found`);
    }
}
export function expect<T>(target: T): RunnerMatchers<T> {
    return new RunnerMatchers(target);
}

export class PlayerWrapper {
    bot: Bot;
    inventory: Bot['inventory'];
    username: string;
    waitForGui: (title: string | RegExp | ((title: string) => boolean), timeout?: number) => Promise<GuiWrapper>;

    constructor(bot: Bot) {
        this.bot = bot;
        this.inventory = bot.inventory;
        this.username = bot.username;

        const extensions = createPlayerExtensions(bot);
        this.waitForGui = extensions.waitForGui.bind(this);
    }

    async chat(message: string): Promise<void> {
        console.log(`[Bot] Chatting: ${message}`);
        this.bot.chat(message);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function configureBukkitSettings(serverDir: string): Promise<void> {
    const bukkitYmlPath = join(serverDir, 'bukkit.yml');

    try {
        let bukkitConfig: Record<string, unknown>;

        if (existsSync(bukkitYmlPath)) {
            const content = await readFile(bukkitYmlPath, 'utf-8');
            bukkitConfig = yaml.load(content) as Record<string, unknown>;
        } else {
            bukkitConfig = {};
        }

        if (!bukkitConfig.settings) {
            bukkitConfig.settings = {};
        }

        (bukkitConfig.settings as Record<string, unknown>)['connection-throttle'] = 0;

        const updatedContent = yaml.dump(bukkitConfig);
        await writeFile(bukkitYmlPath, updatedContent, 'utf-8');
        console.log('✓ Set connection-throttle to 0 in bukkit.yml');
    } catch (error) {
        console.warn(`Warning: Could not configure bukkit.yml: ${(error as Error).message}`);
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

    await configureBukkitSettings(serverDir);

    const jvmArgsString = process.env.JVM_ARGS || '-Xmx2G -Dcom.mojang.eula.agree=true';
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
                    const player = new PlayerWrapper(bot);
                    const server: ServerWrapper = {
                        execute: async (cmd: string) => {
                            console.log(`[Server] Executing: ${cmd}`);
                            serverProcess.stdin.write(cmd + '\n', (err) => {
                                if (err) console.error(`[Server] Write error: ${err}`);
                            });
                            await new Promise(r => setTimeout(r, 500));
                        }
                    };

                    await testCase.fn({ player, server });
                    console.log(`    PASSED\n`);
                    testResults.push({ file, testName: testCase.name, passed: true });
                } catch (error) {
                    const errorMsg = (error as Error).message;
                    console.log(`    FAILED: ${errorMsg}\n`);
                    testResults.push({ file, testName: testCase.name, passed: false, error: errorMsg });
                } finally {
                    bot.removeAllListeners('error');
                    bot.removeAllListeners('end');
                    bot.quit();
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
            failed.forEach(result => {
                console.log(`  ✗ ${result.file} > ${result.testName}`);
                console.log(`    ${result.error}`);
            });
            console.log('');
            throw new Error(`${failed.length} test(s) failed`);
        } else {
            console.log('\nAll tests passed!');
        }
    } finally {
        console.log('\nCleaning up active bots...');
        for (const bot of activeBots) {
            try {
                bot.quit();
            } catch (err) {
                // Ignore errors during cleanup
            }
        }
        activeBots.length = 0;

        // Wait for bots to disconnect
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('Stopping server...');
        serverProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
