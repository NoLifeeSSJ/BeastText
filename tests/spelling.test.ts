import { it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { LocalSpelling } from "../src/main/spelling";
it("uses bundled local US/UK dictionaries for checking and corrections", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "beast-spell-"));
  try {
    const spell = new LocalSpelling(
      path.resolve("resources/dictionaries"),
      root,
    );
    await spell.initialise();
    expect(spell.check(["writing", "speling"], "en-US")).toEqual(["speling"]);
    expect(spell.suggestions("speling", "en-US")).toContain("spelling");
    expect(spell.correct("colour", "en-GB")).toBe(true);
    expect(spell.correct("colour", "en-US")).toBe(false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
it("persists user-added words across app restarts without altering dictionaries", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "beast-spell-"));
  try {
    let spell = new LocalSpelling(path.resolve("resources/dictionaries"), root);
    await spell.initialise();
    expect(spell.correct("BeastText", "en-US")).toBe(false);
    await spell.add("BeastText");
    spell = new LocalSpelling(path.resolve("resources/dictionaries"), root);
    await spell.initialise();
    expect(spell.correct("BeastText", "en-US")).toBe(true);
    expect(spell.correct("BeastText", "en-GB")).toBe(true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
