import type { PlayerWrapper } from './player.js';
import type { ServerWrapper } from './server.js';

export interface TestContext {
    player: PlayerWrapper;
    server: ServerWrapper;
    createPlayer: (options?: { username?: string }) => Promise<PlayerWrapper>;
    signal: AbortSignal;
}

export interface TestResult {
    file: string;
    testName: string;
    passed: boolean;
    durationMs: number;
    error?: Error;
}