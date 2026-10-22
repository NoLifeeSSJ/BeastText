import nspell from "nspell";
import fs from "node:fs/promises";
import path from "node:path";
import { atomicWrite } from "./storage";
export class LocalSpelling {
  private engines: Record<string, ReturnType<typeof nspell>> = {};
  private words = new Set<string>();
  private cache = new Map<string, boolean>();
  constructor(
    private dictionaries: string,
    private data: string,
  ) {}
  async initialise() {
    for (const [language, file] of [
      ["en-US", "en-us"],
      ["en-GB", "en-gb"],
    ]) {
      const [aff, dic] = await Promise.all(
        ["aff", "dic"].map((ext) =>
          fs.readFile(path.join(this.dictionaries, `${file}.${ext}`), "utf8"),
        ),
      );
      this.engines[language] = nspell({ aff, dic });
    }
    try {
      const words: unknown = JSON.parse(
        await fs.readFile(
          path.join(this.data, "personal-dictionary.json"),
          "utf8",
        ),
      );
      if (Array.isArray(words))
        for (const word of words)
          if (typeof word === "string" && this.valid(word))
            this.words.add(word);
    } catch {
      /* A missing/corrupt personal dictionary never changes its original file here. */
    }
    for (const word of this.words)
      for (const engine of Object.values(this.engines)) engine.add(word);
  }
  private valid(word: string) {
    return (
      word.length > 0 && word.length <= 100 && !/[\s\u0000-\u001f]/.test(word)
    );
  }
  private engine(language: string) {
    return this.engines[language] ?? this.engines["en-US"];
  }
  correct(word: string, language: string) {
    if (!this.valid(word)) return true;
    const key = language + "\0" + word;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const value = this.engine(language).correct(word);
    if (this.cache.size > 10000) this.cache.clear();
    this.cache.set(key, value);
    return value;
  }
  check(words: string[], language: string) {
    return words.filter((word) => !this.correct(word, language));
  }
  suggestions(word: string, language: string) {
    return this.valid(word)
      ? this.engine(language).suggest(word).slice(0, 8)
      : [];
  }
  async add(word: string) {
    if (!this.valid(word))
      throw new Error("Use a single dictionary word of 1–100 characters.");
    const next = new Set(this.words);
    next.add(word);
    await atomicWrite(
      path.join(this.data, "personal-dictionary.json"),
      JSON.stringify([...next].sort()),
    );
    this.words = next;
    for (const engine of Object.values(this.engines)) engine.add(word);
    this.cache.clear();
  }
}

// Serialized into the trusted renderer; no document text is embedded in code.
// Native context-menu word detection is inconsistent across Electron platforms.
export function editorWordAtPoint(
  x: number,
  y: number,
  select = false,
  expected = "",
) {
  const range = document.caretRangeFromPoint(x, y);
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return "";
  const textNode = range.startContainer;
  const editor = textNode.parentElement?.closest<HTMLElement>(
    '.beast-editor[contenteditable="true"]',
  );
  if (!editor) return "";
  const text = textNode.textContent ?? "",
    offset = range.startOffset;
  const left =
    text
      .slice(Math.max(0, offset - 100), offset)
      .match(/[\p{L}\p{N}'’-]+$/u)?.[0] ?? "";
  const right =
    text.slice(offset, offset + 100).match(/^[\p{L}\p{N}'’-]+/u)?.[0] ?? "";
  const word = left + right;
  if (!word || word.length > 100) return "";
  if (select && word === expected) {
    editor.focus({ preventScroll: true });
    range.setStart(textNode, offset - left.length);
    range.setEnd(textNode, offset + right.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return word;
}
