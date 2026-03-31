import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { readdir } from 'fs/promises';
import { join, basename } from 'path';
import { pathToFileURL } from 'url';
import { randomUUID } from 'node:crypto';
import { install as installSourceMapSupport } from 'source-map-support';
import pc from 'picocolors';

import { ItemWrapper, GuiWrapper } from './lib/wrappers.js';
import { PlayerWrapper } from './lib/player.js';
import { ServerWrapper } from './lib/server.js';
import { testRegistry, scopeStack } from './lib/test-registry.js';
import { messageBuffer, serverConsoleBuffer, createBot, disconnectAllBots, writeMcOutput } from './lib/bot-utils.js';
import { formatDuration, printTestSummary } from './lib/reporter.js';
import type { TestResult } from './lib/types.js';

// Enable source map support for accurate TypeScript stack traces
installSourceMapSupport();

// Re-export public API
export { ItemWrapper, GuiWrapper };
export { PlayerWrapper } from './lib/player.js';
export { ServerWrapper } from './lib/server.js';
export { test, opTest, describe, beforeEach, afterEach } from './lib/test-registry.js';
export { expect } from './lib/matchers.js';
export type { TestContext } from './lib/types.js';

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

                    const bot = createBot({
                        host: 'localhost',
                        port: 25565,
                        username: botUsername,
                        version: process.env.MC_VERSION,
                        auth: 'offline',
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
                    await disconnectAllBots();
                }
            }
        }

    } finally {
        await disconnectAllBots();

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

        exitCode = printTestSummary(testResults);

        setTimeout(() => {
            process.exit(exitCode);
        }, 1000).unref();
    }
}

export { sleep, waitForAssertion, waitUntil } from './lib/utils.js';
