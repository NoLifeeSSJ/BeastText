import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import { newDocument, validateDocument, statistics } from "../src/shared/model";
import {
  encodeNative,
  decodeNative,
  SafetyStore,
  atomicWrite,
  fingerprint,
} from "../src/main/storage";
import { fromTemplate, templates } from "../src/shared/templates";
import { documentHtml } from "../src/shared/html";
const pixel =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4Z8AAAAASUVORK5CYII=";
describe("native document safety", () => {
  it("roundtrips structured content, styles, comments, page layout and embedded assets", () => {
    const d = fromTemplate("report"),
      id = crypto.randomUUID(),
      comment = crypto.randomUUID();
    d.assets[id] = { mime: "image/png", data: pixel };
    d.content.content!.push(
      {
        type: "image",
        attrs: {
          src: `beast-asset:${id}`,
          width: 100,
          height: 100,
          alt: "Ünicode 🐻",
        },
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Review me",
            marks: [
              { type: "bold" },
              { type: "comment", attrs: { commentId: comment } },
            ],
          },
        ],
      },
      { type: "pageBreak" },
    );
    d.comments = [
      {
        id: comment,
        text: "Keep this",
        author: "Me",
        created: new Date().toISOString(),
        resolved: false,
      },
    ];
    d.page.header = "Test header";
    expect(decodeNative(encodeNative(d))).toEqual(d);
  });
  it("validates every built-in template", () => {
    expect(templates).toHaveLength(12);
    for (const t of templates)
      expect(() =>
        decodeNative(encodeNative(fromTemplate(t.id))),
      ).not.toThrow();
  });
  it("rejects unsupported versions, unsafe paths and oversized expansion", () => {
    const d = newDocument();
    const f = unzipSync(encodeNative(d));
    f["manifest.json"] = strToU8('{"format":"BeastText","version":99}');
    expect(() => decodeNative(zipSync(f))).toThrow(/version/);
    expect(() => decodeNative(zipSync({ "../escape": strToU8("x") }))).toThrow(
      /Unsafe/,
    );
    const bomb = zipSync({ "document.json": new Uint8Array(33 * 1024 * 1024) });
    expect(() => decodeNative(bomb)).toThrow(/safety limit/);
  });
  it("rejects damaged assets and missing asset references", () => {
    const d = newDocument(),
      id = crypto.randomUUID();
    d.assets[id] = { mime: "image/png", data: pixel };
    const f = unzipSync(encodeNative(d));
    f[`assets/${id}`][0] = 0;
    expect(() => decodeNative(zipSync(f))).toThrow(/damaged/);
    d.assets = {};
    d.content.content!.push({
      type: "image",
      attrs: { src: `beast-asset:${id}` },
    });
    expect(() => encodeNative(d)).toThrow(/Missing/);
  });
  it("rejects active content and unsafe links in the canonical model", () => {
    const d = newDocument();
    d.content.content = [{ type: "script" }];
    expect(() => validateDocument(d)).toThrow();
    d.content.content = [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ];
    expect(() => validateDocument(d)).toThrow(/Unsafe/);
  });
  it("escapes document and header text in exported HTML", () => {
    const d = newDocument("<script>alert(1)</script>");
    d.content.content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "<img src=x onerror=evil()>" }],
      },
    ];
    const html = documentHtml(d);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
  });
  it("counts Unicode words and distinguishes selected text", () => {
    const d = newDocument();
    d.content.content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Café déjà vu 🐻 中文" }],
      },
    ];
    const s = statistics(d.content, "déjà vu");
    expect(s.words).toBe(4);
    expect(s.selectedWords).toBe(2);
    expect(s.withoutSpaces).toBe(13);
  });
});
describe("file writes and recovery", () => {
  let root: string, store: SafetyStore;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "beast-test-"));
    store = new SafetyStore(root);
    await store.initialise();
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  it("writes atomically and detects external changes", async () => {
    const file = path.join(root, "Unicode café's 🐻.beasttext"),
      d = newDocument();
    await atomicWrite(file, encodeNative(d));
    const first = await fingerprint(file);
    d.title = "Changed";
    await atomicWrite(file, encodeNative(d));
    expect(await fingerprint(file)).not.toBe(first);
    expect((await fs.readdir(root)).some((n) => n.endsWith(".tmp"))).toBe(
      false,
    );
    expect(decodeNative(await fs.readFile(file)).title).toBe("Changed");
  });
  it("leaves an existing file intact after a failed write", async () => {
    const file = path.join(root, "original");
    await fs.writeFile(file, "original");
    await expect(
      atomicWrite(path.join(file, "child"), "replacement"),
    ).rejects.toThrow();
    expect(await fs.readFile(file, "utf8")).toBe("original");
  });
  it("recovers untitled work and clears only its snapshot", async () => {
    const d = fromTemplate("minutes");
    await store.recover(d, null);
    const recovered = await new SafetyStore(root).recoveries();
    expect(recovered[0].doc).toEqual(d);
    expect(recovered[0].file).toBe(null);
    await store.clearRecovery(d.id);
    expect(await store.recoveries()).toEqual([]);
  });
  it("retains a bounded number of independent backups", async () => {
    const file = path.join(root, "test.beasttext"),
      d = newDocument();
    for (let i = 0; i < 5; i++) {
      await atomicWrite(file, encodeNative({ ...d, title: `v${i}` }));
      await store.backup(file, d.id, 2);
    }
    const backups = await fs.readdir(path.join(root, "backups", d.id));
    expect(backups).toHaveLength(2);
    expect(
      decodeNative(
        await fs.readFile(
          path.join(root, "backups", d.id, backups.sort().at(-1)!),
        ),
      ).title,
    ).toBe("v4");
  });
  it("preserves the original bytes and extension of non-native backups", async () => {
    const file = path.join(root, "original.docx");
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x10, 0x20]);
    const d = newDocument();
    await fs.writeFile(file, bytes);
    await store.backup(file, d.id, 2);
    const directory = path.join(root, "backups", d.id);
    const names = await fs.readdir(directory);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/\.docx$/);
    expect(await fs.readFile(path.join(directory, names[0]))).toEqual(bytes);
  });
});
