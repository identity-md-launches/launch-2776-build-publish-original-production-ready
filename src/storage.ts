export const SAVE_KEY = 'squeek-pouch:v1';
export interface Save { version: 1; stars: number[]; language: 'en' | 'zh'; sound: boolean; tutorialDone: boolean }
export function emptySave(): Save { return { version: 1, stars: Array(12).fill(0), language: 'en', sound: false, tutorialDone: false }; }
export function readSave(storage: Pick<Storage, 'getItem'>): Save {
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || 'null');
    if (!data || data.version !== 1) return emptySave();
    return { version: 1, stars: Array.from({ length: 12 }, (_, i) => Number.isInteger(data.stars?.[i]) && data.stars[i] >= 0 && data.stars[i] <= 3 ? data.stars[i] : 0), language: data.language === 'zh' ? 'zh' : 'en', sound: data.sound === true, tutorialDone: data.tutorialDone === true };
  } catch { return emptySave(); }
}
export function writeSave(storage: Pick<Storage, 'setItem'>, data: Save): boolean {
  try { storage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function isUnlocked(index: number, save: Save): boolean { return index === 0 || save.stars[index - 1] > 0; }
