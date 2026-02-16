/**
 * General-purpose async test utilities.
 */

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Retries `fn` on an interval until it resolves without throwing, or the
 * timeout elapses. Useful for assertions that may not be immediately true
 * after triggering an action.
 */
export async function eventually(
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
