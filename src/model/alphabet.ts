import { POINT_SIGNS } from './points';

/**
 * A shelf of the handwriting studio's alphabet: one script in one case, or
 * all the symbols, or the points of drawings (these have no case). The pills
 * under the alphabet pick it.
 */
export type Shelf = 'cyr-lower' | 'cyr-upper' | 'lat-lower' | 'lat-upper' | 'sym' | 'points';

export interface CharGroup {
  id: string;
  title: string;
  chars: string[];
  shelf: Shelf;
}

const range = (from: string, to: string) =>
  Array.from({ length: to.codePointAt(0)! - from.codePointAt(0)! + 1 }, (_, i) =>
    String.fromCodePoint(from.codePointAt(0)! + i),
  );

// Ё/ё live outside the contiguous А–я block.
const cyrLower = [...range('а', 'е'), 'ё', ...range('ж', 'я')];
const cyrUpper = [...range('А', 'Е'), 'Ё', ...range('Ж', 'Я')];

/** Common English letter pairs for capturing natural cursive joins. */
export const SUGGESTED_PAIRS = [
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es',
  'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar', 'st', 'to', 'nt', 'ng',
];

export const CHAR_GROUPS: CharGroup[] = [
  { id: 'cyr-lower', title: 'Russian', chars: cyrLower, shelf: 'cyr-lower' },
  { id: 'ukr-lower', title: 'Ukrainian', chars: ['і', 'ї', 'є'], shelf: 'cyr-lower' },
  { id: 'pairs', title: 'Letter pairs', chars: SUGGESTED_PAIRS, shelf: 'lat-lower' },
  { id: 'cyr-upper', title: 'Russian', chars: cyrUpper, shelf: 'cyr-upper' },
  { id: 'ukr-upper', title: 'Ukrainian', chars: ['І', 'Ї', 'Є'], shelf: 'cyr-upper' },
  { id: 'lat-lower', title: 'Latin', chars: range('a', 'z'), shelf: 'lat-lower' },
  { id: 'lat-upper', title: 'Latin', chars: range('A', 'Z'), shelf: 'lat-upper' },
  { id: 'digits', title: 'Digits', chars: range('0', '9'), shelf: 'sym' },
  { id: 'punct', title: 'Symbols', chars: [...'.,!?:;-—«»"()№%+=/'], shelf: 'sym' },
  // Roman numerals as written by hand (sticks with serifs): used for I, II, IV чверті… instead of drawn sticks.
  { id: 'roman', title: 'Roman numerals', chars: ['Ⅰ', 'Ⅴ', 'Ⅹ', 'Ⅼ', 'Ⅽ', 'Ⅾ', 'Ⅿ'], shelf: 'sym' },
  { id: 'math', title: 'Formulas', chars: [...'αβγδεθλμπρσφωΔΣΩ×·−±≠≈≤≥<>°′⊥∥∠△√∞∈→'], shelf: 'sym' },
  // Drawn, not written: a drawing's points take these variants (the open circle comes first, it is the usual one on an epure).
  { id: 'points', title: 'Drawing markers', chars: [POINT_SIGNS[2], POINT_SIGNS[0], POINT_SIGNS[1], POINT_SIGNS[3]], shelf: 'points' },
];

const isLatin = (key: string) => /\p{Script=Latin}/u.test(key);

/** The shelf a letter, pair or sign is found on. */
export function shelfOf(key: string): Shelf {
  const group = CHAR_GROUPS.find((g) => g.chars.includes(key));
  if (group) return group.shelf;
  if (isPair(key)) return isLatin(key) ? 'lat-lower' : 'cyr-lower';
  return 'sym';
}

/** Own pairs go to their script's lowercase shelf. */
export const pairShelf = (pair: string): Shelf => (isLatin(pair) ? 'lat-lower' : 'cyr-lower');

/** Lowercase letters that stay within the x-height (no ascender or descender in cursive). */
const X_HEIGHT_LETTERS = new Set([...'аеёжийклмнопстчшъыьэюяґіїєaceimnorsuvwxz']);

/**
 * A lowercase letter written much taller than the x-height is probably a
 * capital (or written at the wrong size): the engine would learn that size.
 */
export function looksTooTall(ch: string, yMax: number, xHeight: number): boolean {
  return X_HEIGHT_LETTERS.has(ch) && yMax > xHeight * 1.35;
}

/** Characters (or pairs) that may join neighbours in cursive. */
export function isLetter(ch: string): boolean {
  return /^\p{L}/u.test(ch);
}

/** A key is a single character or a letter pair (2–3 letters). */
export function isPair(key: string): boolean {
  return [...key].length > 1;
}

export const PANGRAM = 'The quick brown fox jumps over the lazy dog';

/** Change a phrase's case: Аа = capital first letter, АА = all capitals, аа = all small. */
export function changeCase(text: string, mode: 'capital' | 'upper' | 'lower'): string {
  if (mode === 'upper') return text.toUpperCase();
  const lower = text.toLowerCase();
  if (mode === 'lower') return lower;
  return lower.replace(/\p{L}/u, (ch) => ch.toUpperCase());
}
