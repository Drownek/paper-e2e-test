export function extractSpecLocation(error: Error): string | null {
    const match = error.stack?.match(/(file:\/\/\/)?([A-Z]:)?[\/\\]\S*\.spec\.(ts|js):\d+:\d+/);
    if (!match) return null;
    const raw = match[0];
    if (raw.startsWith("file:///")) return raw;
    const path = raw.replace(/\\/g, "/");
    return path.startsWith("/") ? `file://${path}` : `file:///${path}`;
}