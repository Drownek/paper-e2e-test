class AssertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssertionError';
    }
}

export class Matchers<T = unknown> {
    protected actual: T;
    protected isNot: boolean;

    constructor(actual: T, isNot: boolean = false) {
        this.actual = actual;
        this.isNot = isNot;
    }

    get not(): this {
        return new (this.constructor as new (actual: T, isNot: boolean) => this)(this.actual, !this.isNot);
    }

    protected _assert(condition: boolean, passMessage: string, failMessage: string): void {
        const shouldPass = this.isNot ? !condition : condition;
        if (!shouldPass) {
            throw new AssertionError(this.isNot ? passMessage : failMessage);
        }
    }

    toBe(expected: any): void {
        const pass = Object.is(this.actual, expected);
        this._assert(
            pass,
            `Expected value not to be ${expected}, but it was`,
            `Expected ${this.actual} to be ${expected}`
        );
    }

    toEqual(expected: any): void {
        const pass = this._deepEqual(this.actual, expected);
        this._assert(
            pass,
            `Expected value not to equal ${JSON.stringify(expected)}, but it did`,
            `Expected ${JSON.stringify(this.actual)} to equal ${JSON.stringify(expected)}`
        );
    }

    toBeTruthy(): void {
        this._assert(
            !!this.actual,
            `Expected value not to be truthy, but it was ${this.actual}`,
            `Expected ${this.actual} to be truthy`
        );
    }

    toBeFalsy(): void {
        this._assert(
            !this.actual,
            `Expected value not to be falsy, but it was ${this.actual}`,
            `Expected ${this.actual} to be falsy`
        );
    }

    toBeNull(): void {
        this._assert(
            this.actual === null,
            `Expected value not to be null, but it was`,
            `Expected ${this.actual} to be null`
        );
    }

    toBeUndefined(): void {
        this._assert(
            this.actual === undefined,
            `Expected value not to be undefined, but it was`,
            `Expected ${this.actual} to be undefined`
        );
    }

    toBeDefined(): void {
        this._assert(
            this.actual !== undefined,
            `Expected value to be undefined, but it was ${this.actual}`,
            `Expected value to be defined`
        );
    }

    toBeNaN(): void {
        this._assert(
            Number.isNaN(this.actual),
            `Expected value not to be NaN, but it was`,
            `Expected ${this.actual} to be NaN`
        );
    }

    toBeGreaterThan(this: Matchers<number>, expected: number): void {
        this._assert(
            this.actual > expected,
            `Expected ${this.actual} not to be greater than ${expected}`,
            `Expected ${this.actual} to be greater than ${expected}`
        );
    }

    toBeGreaterThanOrEqual(this: Matchers<number>, expected: number): void {
        this._assert(
            this.actual >= expected,
            `Expected ${this.actual} not to be greater than or equal to ${expected}`,
            `Expected ${this.actual} to be greater than or equal to ${expected}`
        );
    }

    toBeLessThan(this: Matchers<number>, expected: number): void {
        this._assert(
            this.actual < expected,
            `Expected ${this.actual} not to be less than ${expected}`,
            `Expected ${this.actual} to be less than ${expected}`
        );
    }

    toBeLessThanOrEqual(this: Matchers<number>, expected: number): void {
        this._assert(
            this.actual <= expected,
            `Expected ${this.actual} not to be less than or equal to ${expected}`,
            `Expected ${this.actual} to be less than or equal to ${expected}`
        );
    }

    toBeCloseTo(this: Matchers<number>, expected: number, precision: number = 2): void {
        const pass = Math.abs(this.actual - expected) < Math.pow(10, -precision) / 2;
        this._assert(
            pass,
            `Expected ${this.actual} not to be close to ${expected}`,
            `Expected ${this.actual} to be close to ${expected}`
        );
    }

    toContain(item: any): void {
        const pass = this._contains(this.actual, item);
        this._assert(
            pass,
            `Expected ${JSON.stringify(this.actual)} not to contain ${JSON.stringify(item)}`,
            `Expected ${JSON.stringify(this.actual)} to contain ${JSON.stringify(item)}`
        );
    }

    toContainEqual(item: any): void {
        if (Array.isArray(this.actual)) {
            const pass = this.actual.some((element: any) => this._deepEqual(element, item));
            this._assert(
                pass,
                `Expected array not to contain equal value ${JSON.stringify(item)}`,
                `Expected array to contain equal value ${JSON.stringify(item)}`
            );
        } else {
            this.toContain(item);
        }
    }

    toHaveLength(expected: number): void {
        const actualLength = (this.actual as { length?: number })?.length;
        this._assert(
            actualLength === expected,
            `Expected length not to be ${expected}, but it was`,
            `Expected length to be ${expected}, but got ${actualLength}`
        );
    }

    toHaveProperty(keyPath: string | string[], value?: any): void {
        const hasProperty = this._hasProperty(this.actual, keyPath);
        if (value !== undefined) {
            const actualValue = this._getProperty(this.actual, keyPath);
            const pass = hasProperty && this._deepEqual(actualValue, value);
            this._assert(
                pass,
                `Expected not to have property ${keyPath} with value ${JSON.stringify(value)}`,
                `Expected to have property ${keyPath} with value ${JSON.stringify(value)}, but got ${JSON.stringify(actualValue)}`
            );
        } else {
            this._assert(
                hasProperty,
                `Expected not to have property ${keyPath}`,
                `Expected to have property ${keyPath}`
            );
        }
    }

    toMatch(expected: string | RegExp): void {
        const regex = expected instanceof RegExp ? expected : new RegExp(expected);
        this._assert(
            regex.test(this.actual as string),
            `Expected "${this.actual}" not to match ${regex}`,
            `Expected "${this.actual}" to match ${regex}`
        );
    }

    toMatchObject(expected: any): void {
        const pass = this._matchObject(this.actual, expected);
        this._assert(
            pass,
            `Expected object not to match ${JSON.stringify(expected)}`,
            `Expected ${JSON.stringify(this.actual)} to match object ${JSON.stringify(expected)}`
        );
    }

    toThrow(expected?: string | RegExp | Function): void {
        if (typeof this.actual !== 'function') {
            throw new AssertionError('Expected value to be a function');
        }

        let didThrow = false;
        let thrownError: any;

        try {
            this.actual();
        } catch (error) {
            didThrow = true;
            thrownError = error;
        }

        if (!didThrow) {
            this._assert(false, '', 'Expected function to throw an error, but it did not');
            return;
        }

        if (expected === undefined) {
            this._assert(didThrow, 'Expected function not to throw', '');
        } else if (typeof expected === 'string') {
            this._assert(
                thrownError.message.includes(expected),
                `Expected error not to include "${expected}"`,
                `Expected error to include "${expected}", but got "${thrownError.message}"`
            );
        } else if (expected instanceof RegExp) {
            this._assert(
                expected.test(thrownError.message),
                `Expected error not to match ${expected}`,
                `Expected error to match ${expected}, but got "${thrownError.message}"`
            );
        } else if (typeof expected === 'function') {
            this._assert(
                thrownError instanceof expected,
                `Expected error not to be instance of ${expected.name}`,
                `Expected error to be instance of ${expected.name}`
            );
        }
    }

    async toThrowAsync(expected?: string | RegExp | Function): Promise<void> {
        if (typeof this.actual !== 'function') {
            throw new AssertionError('Expected value to be a function');
        }

        let didThrow = false;
        let thrownError: any;

        try {
            await this.actual();
        } catch (error) {
            didThrow = true;
            thrownError = error;
        }

        if (!didThrow) {
            this._assert(false, '', 'Expected async function to throw an error, but it did not');
            return;
        }

        if (expected === undefined) {
            this._assert(didThrow, 'Expected async function not to throw', '');
        } else if (typeof expected === 'string') {
            this._assert(
                thrownError.message.includes(expected),
                `Expected error not to include "${expected}"`,
                `Expected error to include "${expected}", but got "${thrownError.message}"`
            );
        } else if (expected instanceof RegExp) {
            this._assert(
                expected.test(thrownError.message),
                `Expected error not to match ${expected}`,
                `Expected error to match ${expected}, but got "${thrownError.message}"`
            );
        } else if (typeof expected === 'function') {
            this._assert(
                thrownError instanceof expected,
                `Expected error not to be instance of ${expected.name}`,
                `Expected error to be instance of ${expected.name}`
            );
        }
    }

    toBeInstanceOf(expected: Function): void {
        this._assert(
            this.actual instanceof expected,
            `Expected value not to be instance of ${expected.name}`,
            `Expected value to be instance of ${expected.name}`
        );
    }

    protected _deepEqual(a: any, b: any): boolean {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.constructor !== b.constructor) return false;

        if (a instanceof Date) return a.getTime() === b.getTime();
        if (a instanceof RegExp) return a.toString() === b.toString();

        if (Array.isArray(a)) {
            if (a.length !== b.length) return false;
            return a.every((val, idx) => this._deepEqual(val, b[idx]));
        }

        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            return keysA.every(key => this._deepEqual(a[key], b[key]));
        }

        return false;
    }

    protected _contains(container: any, item: any): boolean {
        if (typeof container === 'string') {
            return container.includes(item);
        }
        if (Array.isArray(container)) {
            return container.includes(item);
        }
        if (container instanceof Set || container instanceof Map) {
            return container.has(item);
        }
        if (typeof container === 'object' && container !== null) {
            return item in container;
        }
        return false;
    }

    protected _hasProperty(obj: any, keyPath: string | string[]): boolean {
        const keys = Array.isArray(keyPath) ? keyPath : keyPath.split('.');
        let current = obj;
        for (const key of keys) {
            if (current == null || !(key in current)) {
                return false;
            }
            current = current[key];
        }
        return true;
    }

    protected _getProperty(obj: any, keyPath: string | string[]): any {
        const keys = Array.isArray(keyPath) ? keyPath : keyPath.split('.');
        let current = obj;
        for (const key of keys) {
            if (current == null) return undefined;
            current = current[key];
        }
        return current;
    }

    protected _matchObject(actual: any, expected: any): boolean {
        if (expected == null || typeof expected !== 'object') {
            return this._deepEqual(actual, expected);
        }

        if (actual == null || typeof actual !== 'object') {
            return false;
        }

        for (const key in expected) {
            if (!this._matchObject(actual[key], expected[key])) {
                return false;
            }
        }

        return true;
    }
}

export function expect<T>(actual: T): Matchers<T> {
    return new Matchers(actual);
}
