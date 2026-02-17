/**
 * Utilities for capturing and parsing V8 stack traces.
 *
 * Two concerns live here:
 *   1. Capturing a call-site stack string at a known point (e.g. inside expect()),
 *      so that assertion errors can point back to the test file rather than runner internals.
 *   2. Parsing a raw stack string to extract the first frame that references a given test file,
 *      returning its line and column numbers.
 */

export interface StackLocation {
    line: number;
    column: number;
}

/**
 * Walk a V8 stack string and return the location of the first frame that
 * references `testFile`.
 *
 * Handles both URL-style frames (`file:///C:/…:line:col`) and plain path
 * frames (`at Something (C:/…:line:col)`).  The `testFile` value is
 * normalized from a compiled `dist/*.spec.js` path back to the original
 * `*.spec.ts` source path before matching, so source-mapped stacks resolve
 * correctly.
 *
 * @returns The `{line, column}` of the matching frame, or `null` if no frame
 *   references the given test file.
 */
export function extractLineNumberFromStack(stack: string | undefined, testFile: string): StackLocation | null {
    if (!stack) return null;

    // Normalize the test file path to the form that will appear in a
    // source-mapped stack: forward slashes, no leading `dist/`, `.spec.ts` extension.
    const normalizedTestFile = testFile
        .replace(/\\/g, '/')
        .replace(/^dist\//, '')
        .replace(/\.spec\.js$/, '.spec.ts');

    const lines = stack.split('\n');

    for (const line of lines) {
        const location = matchFileUrlFrame(line, normalizedTestFile, testFile)
            ?? matchPlainPathFrame(line, normalizedTestFile, testFile);

        if (location) return location;
    }

    return null;
}

// ---------------------------------------------------------------------------
// Internal helpers – each matches one stack-frame style
// ---------------------------------------------------------------------------

/**
 * Match a `file:///` URL-style frame, e.g.:
 *   at file:///C:/project/dist/foo.spec.js:12:5
 */
function matchFileUrlFrame(line: string, normalizedTestFile: string, rawTestFile: string): StackLocation | null {
    const match = line.match(/file:\/\/\/(.+?):(\d+):(\d+)/);
    if (!match) return null;

    const filePath = match[1].replace(/\\/g, '/');

    if (referencesTestFile(filePath, normalizedTestFile, rawTestFile)) {
        return { line: parseInt(match[2], 10), column: parseInt(match[3], 10) };
    }

    return null;
}

/**
 * Match a plain-path frame, e.g.:
 *   at Object.<anonymous> (C:/project/dist/foo.spec.js:12:5)
 *   at C:/project/dist/foo.spec.js:12:5
 */
function matchPlainPathFrame(line: string, normalizedTestFile: string, rawTestFile: string): StackLocation | null {
    const match = line.match(/at\s+(?:.*?\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (!match) return null;

    const filePath = match[1].replace(/\\/g, '/');

    if (referencesTestFile(filePath, normalizedTestFile, rawTestFile)) {
        return { line: parseInt(match[2], 10), column: parseInt(match[3], 10) };
    }

    return null;
}

/**
 * Return `true` when `filePath` (from a stack frame) refers to the same test
 * file as the normalized or raw test-file strings.
 */
function referencesTestFile(filePath: string, normalizedTestFile: string, rawTestFile: string): boolean {
    const rawNormalised = rawTestFile.replace(/\\/g, '/');
    return (
        filePath.includes(normalizedTestFile) ||
        filePath.endsWith(normalizedTestFile) ||
        filePath.includes(rawNormalised)
    );
}
