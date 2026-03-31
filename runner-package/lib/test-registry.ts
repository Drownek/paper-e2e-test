import type { TestContext } from './types.js';

type Hook = (context: TestContext) => Promise<void>;

interface DescribeScope {
    label: string;
    beforeHooks: Hook[];
    afterHooks: Hook[];
}

interface TestCase {
    name: string;
    fn: (context: TestContext) => Promise<void>;
}

export const testRegistry: TestCase[] = [];
export const scopeStack: DescribeScope[] = [{ label: '', beforeHooks: [], afterHooks: [] }];

export function test(name: string, fn: (context: TestContext) => Promise<void>): void {
    const labels = scopeStack.map(s => s.label).filter(l => l);
    const fullName = [...labels, name].join(' > ');

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
        fn();
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