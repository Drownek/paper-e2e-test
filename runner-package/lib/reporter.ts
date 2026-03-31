import pc from 'picocolors';
import { extractSpecLocation } from './stack-trace.js';
import type { TestResult } from './types.js';

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    return `${seconds.toFixed(1)}s`;
}

export function printTestSummary(testResults: TestResult[]): number {
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

        return 1;
    } else {
        console.log(`\n${pc.green(pc.bold('All tests passed!'))}`);
        return 0;
    }
}