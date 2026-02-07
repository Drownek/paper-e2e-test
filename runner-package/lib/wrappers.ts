import type {Bot} from 'mineflayer';

interface RawItem {
    name: string;
    displayName: string;
    slot: number;
    count: number;
    nbt?: {
        value?: {
            display?: {
                value?: {
                    Name?: { value: string };
                    Lore?: { value: { value: string[] } };
                }
            }
        }
    };
}

export interface Window {
    title: string;
    type: string | number;
    slots: (RawItem | null)[];
}

export class ItemWrapper {
    raw: RawItem;
    name: string;
    slot: number;
    count: number;

    constructor(rawItem: RawItem) {
        this.raw = rawItem;
        this.name = rawItem.name;
        this.slot = rawItem.slot;
        this.count = rawItem.count;
    }

    static parseChat(raw: string): string {
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed !== 'object') return parsed;
            
            const extractText = (obj: any): string => {
                if (typeof obj === 'string') return obj;
                if (!obj || typeof obj !== 'object') return '';
                
                let result = obj.text || '';
                
                if (Array.isArray(obj.extra)) {
                    result += obj.extra.map(extractText).join('');
                }
                
                return result;
            };
            
            return extractText(parsed);
        } catch (e) {
            return raw;
        }
    }

    getDisplayName(): string {
        const nbtName = this.raw.nbt?.value?.display?.value?.Name?.value;

        if (nbtName) {
            return ItemWrapper.parseChat(nbtName);
        }

        return this.raw.displayName || this.name;
    }

    getLore(): string[] {
        const nbtLore = this.raw.nbt?.value?.display?.value?.Lore?.value?.value;

        if (!nbtLore || !Array.isArray(nbtLore)) return [];

        return nbtLore.map(line => ItemWrapper.parseChat(line));
    }

    hasLore(text: string): boolean {
        return this.getLore().some(line =>
            line.toLowerCase().includes(text.toLowerCase())
        );
    }
}

export class GuiWrapper {
    bot: Bot;
    window: Window;
    title: string;
    items: ItemWrapper[];

    constructor(bot: Bot, window: Window) {
        this.bot = bot;
        this.window = window;
        this.title = ItemWrapper.parseChat(window.title);
        this.items = window.slots
            .filter((item): item is RawItem => item != null)
            .map(item => new ItemWrapper(item));
    }

    hasItem(predicate: (item: ItemWrapper) => boolean): boolean {
        return this.items.some(predicate);
    }

    findItem(predicate: (item: ItemWrapper) => boolean): ItemWrapper | undefined {
        return this.items.find(predicate);
    }

    findAllItems(predicate: (item: ItemWrapper) => boolean): ItemWrapper[] {
        return this.items.filter(predicate);
    }

    async clickItem(predicate: (item: ItemWrapper) => boolean): Promise<void> {
        const item = this.findItem(predicate);
        if (!item) {
            throw new Error(`[GUI] Failed to click: Item not found matching criteria in "${this.title}"`);
        }

        const lore = item.getLore();
        console.log(`[GUI] Clicking item: ${item.getDisplayName()}`);
        console.log(`  Material: ${item.name}`);
        console.log(`  Slot: ${item.slot}`);
        if (lore.length > 0) {
            console.log(`  Lore: ${lore.join(' | ')}`);
        }
        
        await this.bot.clickWindow(item.slot, 0, 0);
    }
}

export function createPlayerExtensions(bot: Bot) {
    return {
        async waitForGuiItem(
            itemMatcher: (item: ItemWrapper) => boolean,
            options: { timeout?: number; pollingRate?: number } = {}
        ): Promise<ItemWrapper> {
            const { timeout = 5000, pollingRate = 100 } = options;
            const startTime = Date.now();

            return new Promise((resolve, reject) => {
                const checkForItem = () => {
                    const elapsed = Date.now() - startTime;
                    
                    if (elapsed >= timeout) {
                        clearInterval(pollInterval);
                        reject(new Error(`[Player] Timeout waiting for GUI item (${timeout}ms)`));
                        return;
                    }

                    // Check if there's a current window open
                    if (!bot.currentWindow) {
                        return; // Continue polling
                    }

                    const window = bot.currentWindow as Window;
                    const items = window.slots
                        .filter((item): item is RawItem => item != null)
                        .map(item => new ItemWrapper(item));

                    const matchedItem = items.find(itemMatcher);
                    
                    if (matchedItem) {
                        clearInterval(pollInterval);
                        console.log(`[Player] Found GUI item: ${matchedItem.getDisplayName()} at slot ${matchedItem.slot}`);
                        resolve(matchedItem);
                    }
                };

                // Start polling
                const pollInterval = setInterval(checkForItem, pollingRate);
                
                // Initial check
                checkForItem();
            });
        },

        async clickGuiItem(
            itemMatcher: (item: ItemWrapper) => boolean,
            options: { timeout?: number; pollingRate?: number } = {}
        ): Promise<void> {
            const { timeout = 5000, pollingRate = 100 } = options;
            const startTime = Date.now();

            return new Promise((resolve, reject) => {
                const checkForItem = async () => {
                    const elapsed = Date.now() - startTime;
                    
                    if (elapsed >= timeout) {
                        clearInterval(pollInterval);
                        reject(new Error(`[Player] Timeout waiting for GUI item to click (${timeout}ms)`));
                        return;
                    }

                    if (!bot.currentWindow) {
                        return;
                    }

                    const window = bot.currentWindow as Window;
                    const items = window.slots
                        .filter((item): item is RawItem => item != null)
                        .map(item => new ItemWrapper(item));

                    const matchedItem = items.find(itemMatcher);
                    
                    if (matchedItem) {
                        clearInterval(pollInterval);
                        
                        const lore = matchedItem.getLore();
                        console.log(`[Player] Clicking GUI item: ${matchedItem.getDisplayName()}`);
                        console.log(`  Material: ${matchedItem.name}`);
                        console.log(`  Slot: ${matchedItem.slot}`);
                        if (lore.length > 0) {
                            console.log(`  Lore: ${lore.join(' | ')}`);
                        }
                        
                        try {
                            await bot.clickWindow(matchedItem.slot, 0, 0);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }
                };

                const pollInterval = setInterval(checkForItem, pollingRate);
                
                checkForItem();
            });
        },

        async waitForGui(
            guiMatcher: (gui: GuiWrapper) => boolean,
            options: { timeout?: number } = {}
        ): Promise<void> {
            const { timeout = 5000 } = options;

            const matches = (window: Window): boolean => {
                const gui = new GuiWrapper(bot, window);
                return guiMatcher(gui);
            };

            return new Promise((resolve, reject) => {
                const deadline = setTimeout(() => {
                    cleanup();
                    reject(new Error(`[Player] Timeout waiting for GUI matching predicate (${timeout}ms)`));
                }, timeout);

                const handler = (window: unknown) => {
                    const win = window as Window;
                    // Wait for next tick to allow mineflayer to process window items packet
                    setImmediate(() => {
                        if (matches(win)) {
                            cleanup();
                            console.log(`[Player] GUI matched: "${ItemWrapper.parseChat(win.title)}"`);
                            resolve();
                        }
                    });
                };

                const cleanup = () => {
                    clearTimeout(deadline);
                    bot.removeListener('windowOpen', handler);
                };

                if (bot.currentWindow) {
                    const currentWin = bot.currentWindow as Window;
                    // Wait for next tick to ensure slots are populated
                    setImmediate(() => {
                        if (matches(currentWin)) {
                            cleanup();
                            console.log(`[Player] GUI already open: "${ItemWrapper.parseChat(currentWin.title)}"`);
                            resolve();
                        } else {
                            // If doesn't match after waiting, listen for windowOpen
                            bot.on('windowOpen', handler);
                        }
                    });
                } else {
                    bot.on('windowOpen', handler);
                }
            });
        }
    };
}
