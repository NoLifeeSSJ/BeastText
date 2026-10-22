import { describe, it, expect } from "vitest";
import { exportDocx, importDocx, markdownExport } from "../src/main/conversion";
import { fromTemplate } from "../src/shared/templates";
import { unzipSync, strFromU8 } from "fflate";
describe("supported conversions", () => {
  it("exports and imports headings, lists, tables, text formatting, links and inline images", async () => {
    const d = fromTemplate("minutes");
    const asset = crypto.randomUUID();
    d.assets[asset] = {
      mime: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4Z8AAAAASUVORK5CYII=",
    };
    d.content.content!.push(
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold example", marks: [{ type: "bold" }] },
          {
            type: "text",
            text: "Read online",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
      {
        type: "image",
        attrs: {
          src: `beast-asset:${asset}`,
          alt: "Small image",
          width: 100,
          height: 100,
        },
      },
    );
    const bytes = await exportDocx(d);
    const entries = unzipSync(bytes);
    const xml = strFromU8(entries["word/document.xml"]);
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("w:hyperlink");
    expect(xml).toContain("w:drawing");
    expect(xml).toContain("w:pgSz");
    const imported = await importDocx(bytes);
    expect(imported.html).toContain("<h1>");
    expect(imported.html).toContain("<table>");
    expect(imported.html).toContain("<strong>Bold example</strong>");
    expect(imported.html).toContain("https://example.com");
    expect(imported.html).toContain("data:image/png;base64,");
    expect(imported.warnings.length).toBeGreaterThan(0);
  });
  it("exports a documented Markdown subset", () => {
    const md = markdownExport(fromTemplate("essay"));
    expect(md).toContain("# Introduction");
    expect(md).toContain("Essay title");
  });
  it("rejects archives that are not DOCX", async () => {
    await expect(importDocx(Buffer.from("bad"))).rejects.toThrow();
  });
  it("preserves embedded line breaks in printed HTML and DOCX", async () => {
    const d = fromTemplate("minutes");
    const bytes = await exportDocx(d);
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    expect(xml).toContain("<w:br/>");
    const { contentHtml } = await import("../src/shared/html");
    expect(contentHtml(d)).toContain(
      "Chair: Name<br>Present: Names<br>Apologies: Names",
    );
  });
});
