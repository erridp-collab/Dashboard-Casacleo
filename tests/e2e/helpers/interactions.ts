import { expect, type Locator } from "@playwright/test";

function keyFor(char: string): string {
  if (/[0-9]/.test(char)) return `Digit${char}`;
  return char;
}

/**
 * Types text one keystroke at a time with a short pause between characters,
 * like a real user — never `.fill()`, which writes the final value in one
 * JS call and skips exactly the intermediate state where this class of bug
 * lives (bug 2, 2026-08-19: the Drawer stole focus and number inputs were
 * never re-canonicalized by React — both were invisible to `.fill()`-based
 * tests). Assumes `locator` is already empty and focused (see
 * `clearRealistically`). Only handles single-digit and single-letter
 * characters, which covers every field this suite currently exercises.
 */
export async function typeRealistically(locator: Locator, text: string, delayMs = 200): Promise<void> {
  const page = locator.page();
  for (const char of text) {
    await page.keyboard.press(keyFor(char));
    await page.waitForTimeout(delayMs);
  }
}

/** Empties a field like a user would (select all + backspace), not `.fill("")` — the same intermediate-state reasoning as `typeRealistically`. */
export async function clearRealistically(locator: Locator): Promise<void> {
  await locator.click();
  const page = locator.page();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(200);
}

/** Runs `action` and asserts `locator` still has DOM focus afterward — the regression shape for the Drawer/ConfirmDialog focus-steal bug (2026-08-19). */
export async function expectKeepsFocus(locator: Locator, action: () => Promise<void>): Promise<void> {
  await action();
  const isFocused = await locator.evaluate((el) => el === document.activeElement);
  expect(isFocused, "il focus non deve spostarsi dal campo durante l'interazione").toBe(true);
}
