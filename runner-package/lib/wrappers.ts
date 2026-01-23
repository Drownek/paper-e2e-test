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

interface Window {
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

    getTitle(): string {
        return this.title;
    }

    findItem(predicate: (item: ItemWrapper) => boolean): ItemWrapper | undefined {
        return this.items.find(predicate);
    }

    findAllItems(predicate: (item: ItemWrapper) => boolean): ItemWrapper[] {
        return this.items.filter(predicate);
    }

    getItems(): ItemWrapper[] {
        return this.items;
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
        async waitForGui(titleMatcher: string | RegExp | ((title: string) => boolean), timeout: number = 5000): Promise<GuiWrapper> {
            const matches = (actual: string): boolean => {
                const parsed = ItemWrapper.parseChat(actual);
                if (titleMatcher instanceof RegExp) {
                    return titleMatcher.test(parsed);
                } else if (titleMatcher instanceof Function) {
                    return titleMatcher(parsed);
                } else {
                    return parsed.includes(titleMatcher);
                }
            };

            // If its currently open, return it immediately
            if (bot.currentWindow && matches(bot.currentWindow.title)) {
                const currentWindow = bot.currentWindow as Window;
                console.log(`[Player] GUI was already open: "${ItemWrapper.parseChat(currentWindow.title)}"`);
                return new Promise(resolve => resolve(new GuiWrapper(bot, currentWindow)));
            }

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    bot.removeListener('windowOpen', handler);
                    reject(new Error(`[Player] Timeout waiting for GUI matching: ${titleMatcher} (${timeout}ms)`));
                }, timeout);

                const handler = (window: unknown) => {
                    const win = window as Window;
                    if (matches(win.title)) {
                        clearTimeout(timeoutId);
                        bot.removeListener('windowOpen', handler);

                        console.log(`[Player] GUI Opened: "${ItemWrapper.parseChat(win.title)}"`);
                        resolve(new GuiWrapper(bot, win));
                    }
                };

                bot.on('windowOpen', handler);
            });
        }
    };
}
