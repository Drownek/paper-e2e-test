export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Polls `fn` until it returns a non-undefined value, or throws on timeout.
 * Simple, race-condition-free, works with any state.
 */
export async function poll<T>(
    fn: () => T | undefined | Promise<T | undefined>,
    options: {
        timeout?: number;
        interval?: number;
        message?: string;
    } = {}
): Promise<T> {
    const { timeout = 5000, interval = 50, message = 'poll() timed out' } = options;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        const result = await fn();
        if (result !== undefined) return result;
        await sleep(interval);
    }

    throw new Error(`Timeout: ${message}`);
}

/**
 * Polls `fn` until it resolves without throwing, or the timeout elapses.
 * Useful for assertions that may not be immediately true.
 */
export async function waitForAssertion(
    fn: () => Promise<void>,
    { timeout = 5000, interval = 250 } = {}
): Promise<void> {
    const start = Date.now();
    let lastError: unknown;

    while (Date.now() - start < timeout) {
        try {
            await fn();
            return; // passed
        } catch (e) {
            lastError = e;
            await sleep(interval);
        }
    }
    throw lastError;
}

/**
 * Polls `predicate` until it returns `true`, or the timeout elapses.
 * Useful for waiting on a condition that may not be immediately true.
 *
 * @throws {Error} if the condition is not met within the timeout.
 */
export async function waitUntil(
    predicate: () => boolean | Promise<boolean>,
    {
        timeout = 5000,
        interval = 250,
        message = "waitUntil timed out: condition was not met",
    } = {}
): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        if (await predicate()) {
            return; // condition met
        }
        await sleep(interval);
    }

    throw new Error(message);
}