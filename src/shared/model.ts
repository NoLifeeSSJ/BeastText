import { z } from "zod";
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, any>;
  marks?: { type: string; attrs?: Record<string, any> }[];
  content?: RichNode[];
};
const color = z.string().regex(/^(#[0-9a-fA-F]{3,8}|transparent)$/);
export const pageSchema = z
  .object({
    size: z.enum(["A4", "Letter"]),
    orientation: z.enum(["portrait", "landscape"]),
    marginTop: z.number().min(5).max(60),
    marginBottom: z.number().min(5).max(60),
    marginLeft: z.number().min(5).max(60),
    marginRight: z.number().min(5).max(60),
    header: z.string().max(500),
    footer: z.string().max(500),
    pageNumbers: z.boolean(),
    differentFirstPage: z.boolean(),
  })
  .strict();
export const styleSchema = z
  .object({
    fontFamily: z.string().max(100),
    fontSize: z.number().min(6).max(144),
    color,
    lineHeight: z.number().min(1).max(3),
    spaceBefore: z.number().min(0).max(100),
    spaceAfter: z.number().min(0).max(100),
  })
  .strict();
export type Style = z.infer<typeof styleSchema>;
export const commentSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().min(1).max(10000),
    author: z.string().max(100),
    created: z.string().datetime(),
    resolved: z.boolean(),
  })
  .strict();
const envelope = z
  .object({
    format: z.literal("BeastText"),
    version: z.literal(1),
    id: z.string().uuid(),
    title: z.string().max(250),
    created: z.string().datetime(),
    modified: z.string().datetime(),
    content: z.any(),
    page: pageSchema,
    styles: z.record(styleSchema),
    assets: z.record(
      z
        .object({
          mime: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
          data: z.string().max(36_000_000),
        })
        .strict(),
    ),
    comments: z.array(commentSchema).max(2000),
    goal: z.number().int().min(0).max(1_000_000),
    metadata: z
      .object({
        author: z.string().max(200),
        description: z.string().max(2000),
      })
      .strict(),
  })
  .strict();
export type BeastDocument = Omit<z.infer<typeof envelope>, "content"> & {
  content: RichNode;
};
export const styleNames = [
  "Normal",
  "Title",
  "Subtitle",
  "Heading 1",
  "Heading 2",
  "Heading 3",
  "Quote",
  "Caption",
  "Code block",
] as const;
export const defaultPage = {
  size: "A4" as const,
  orientation: "portrait" as const,
  marginTop: 22,
  marginBottom: 22,
  marginLeft: 25,
  marginRight: 25,
  header: "",
  footer: "",
  pageNumbers: true,
  differentFirstPage: false,
};
export const defaultStyles: Record<string, Style> = Object.fromEntries(
  styleNames.map((name) => [
    name,
    {
      fontFamily: name === "Code block" ? "Consolas" : "Aptos",
      fontSize:
        (
          {
            Title: 32,
            Subtitle: 16,
            "Heading 1": 24,
            "Heading 2": 18,
            "Heading 3": 14,
            Caption: 10,
          } as Record<string, number>
        )[name] ?? 12,
      color: name === "Subtitle" || name === "Caption" ? "#64748b" : "#202b3c",
      lineHeight: 1.5,
      spaceBefore: name.startsWith("Heading") ? 16 : 0,
      spaceAfter: 8,
    },
  ]),
);
export function newDocument(
  title = "Untitled",
  content: RichNode = { type: "doc", content: [{ type: "paragraph" }] },
): BeastDocument {
  const now = new Date().toISOString();
  return {
    format: "BeastText",
    version: 1,
    id: crypto.randomUUID(),
    title,
    created: now,
    modified: now,
    content,
    page: { ...defaultPage },
    styles: structuredClone(defaultStyles),
    assets: {},
    comments: [],
    goal: 0,
    metadata: { author: "", description: "" },
  };
}
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "image",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "pageBreak",
  "toc",
]);
const marks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "superscript",
  "subscript",
  "link",
  "textStyle",
  "highlight",
  "comment",
]);
const attrNames = new Set([
  "type",
  "align",
  "level",
  "textAlign",
  "styleName",
  "indent",
  "lineHeight",
  "spaceBefore",
  "spaceAfter",
  "backgroundColor",
  "start",
  "language",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "colspan",
  "rowspan",
  "colwidth",
  "borderColor",
  "borderWidth",
  "href",
  "target",
  "rel",
  "class",
  "color",
  "fontFamily",
  "fontSize",
  "background",
  "commentId",
  "id",
]);
export function safeLink(s: string) {
  return (
    /^(https?:\/\/|mailto:|#[\w-])/i.test(s) &&
    s.length <= 4096 &&
    !/[\u0000-\u001f]/.test(s)
  );
}
function checkAttrs(attrs: Record<string, any> = {}) {
  for (const [k, v] of Object.entries(attrs)) {
    if (!attrNames.has(k))
      throw new Error(`Unsupported document attribute: ${k}`);
    if (v === null || v === "") continue;
    if (
      (k === "lineHeight" && (Number(v) < 1 || Number(v) > 3)) ||
      (["spaceBefore", "spaceAfter"].includes(k) &&
        (Number(v) < 0 || Number(v) > 100)) ||
      (k === "indent" && (Number(v) < 0 || Number(v) > 8)) ||
      (["colspan", "rowspan"].includes(k) &&
        (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 100))
    )
      throw new Error("Invalid paragraph or table dimensions");
    if (
      ["textAlign", "align"].includes(k) &&
      !["left", "center", "right", "justify"].includes(String(v))
    )
      throw new Error("Invalid alignment");
    if (k === "colwidth") {
      if (
        !Array.isArray(v) ||
        v.length > 100 ||
        v.some((n) => typeof n !== "number" || n < 1 || n > 20000)
      )
        throw new Error("Invalid table widths");
      continue;
    }
    if (
      typeof v !== "string" &&
      typeof v !== "number" &&
      typeof v !== "boolean"
    )
      throw new Error("Invalid attribute value");
    if (typeof v === "number" && (!Number.isFinite(v) || Math.abs(v) > 100000))
      throw new Error("Invalid numeric attribute");
    if (
      typeof v === "string" &&
      (v.length > 4096 || /[<>\u0000-\u0008]/.test(v))
    )
      throw new Error("Invalid document attribute");
    if (
      /color|background/i.test(k) &&
      typeof v === "string" &&
      !/^(#[a-f\d]{3,8}|transparent|rgb\([\d ,]+\))$/i.test(v)
    )
      throw new Error("Invalid colour");
    if (k === "href" && typeof v === "string" && !safeLink(v))
      throw new Error("Unsafe hyperlink");
    if (
      k === "src" &&
      typeof v === "string" &&
      !/^beast-asset:[a-f\d-]{36}$/.test(v)
    )
      throw new Error("Images must be embedded assets");
    if (
      ["fontFamily", "fontSize", "textAlign", "styleName", "language"].includes(
        k,
      ) &&
      typeof v === "string" &&
      /[;{}\\]/.test(v)
    )
      throw new Error("Invalid text style");
  }
}
export function validateDocument(input: unknown): BeastDocument {
  const d = envelope.parse(input) as BeastDocument;
  if (!d.styles.Normal)
    throw new Error("The Normal paragraph style is missing");
  let count = 0;
  function walk(n: RichNode, depth: number) {
    if (
      !n ||
      typeof n !== "object" ||
      !nodes.has(n.type) ||
      depth > 64 ||
      ++count > 300000
    )
      throw new Error("Invalid or excessive document structure");
    if (
      Object.keys(n).some(
        (k) => !["type", "text", "attrs", "marks", "content"].includes(k),
      )
    )
      throw new Error("Unknown document field");
    const blocks = [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "blockquote",
      "codeBlock",
      "horizontalRule",
      "image",
      "table",
      "pageBreak",
      "toc",
    ];
    const children = n.content ?? [];
    let allowed: string[] = [];
    if (
      n.type === "doc" ||
      n.type === "blockquote" ||
      n.type === "tableCell" ||
      n.type === "tableHeader"
    )
      allowed = blocks;
    else if (n.type === "paragraph" || n.type === "heading")
      allowed = ["text", "hardBreak"];
    else if (n.type === "codeBlock") allowed = ["text"];
    else if (n.type === "bulletList" || n.type === "orderedList")
      allowed = ["listItem"];
    else if (n.type === "listItem") allowed = blocks;
    else if (n.type === "table") allowed = ["tableRow"];
    else if (n.type === "tableRow") allowed = ["tableCell", "tableHeader"];
    if (
      !Array.isArray(children) ||
      children.some((c) => !allowed.includes(c?.type))
    )
      throw new Error("Invalid document child structure");
    if (
      [
        "doc",
        "blockquote",
        "bulletList",
        "orderedList",
        "listItem",
        "table",
        "tableRow",
        "tableCell",
        "tableHeader",
      ].includes(n.type) &&
      !children.length
    )
      throw new Error("Empty structural node");
    if (n.type === "listItem" && children[0]?.type !== "paragraph")
      throw new Error("List items must start with a paragraph");
    if (n.type === "text" && (!n.text || typeof n.text !== "string"))
      throw new Error("Text nodes must contain text");
    if (n.marks && n.type !== "text")
      throw new Error("Formatting marks require text");
    checkAttrs(n.attrs);
    if (
      n.text !== undefined &&
      (n.type !== "text" ||
        typeof n.text !== "string" ||
        n.text.length > 5_000_000)
    )
      throw new Error("Invalid text node");
    if (n.marks) {
      if (!Array.isArray(n.marks) || n.marks.length > 20)
        throw new Error("Invalid marks");
      for (const m of n.marks) {
        if (!marks.has(m.type)) throw new Error("Unsupported text formatting");
        checkAttrs(m.attrs);
      }
    }
    if (n.content) {
      if (!Array.isArray(n.content)) throw new Error("Invalid content");
      n.content.forEach((c) => walk(c, depth + 1));
    }
    if (n.type === "image") {
      const id = n.attrs?.src?.replace("beast-asset:", "");
      if (!id || !d.assets[id]) throw new Error("Missing embedded image");
    }
    if (n.type === "heading" && ![1, 2, 3].includes(n.attrs?.level))
      throw new Error("Invalid heading level");
    if (n.type === "tableRow" && (n.content?.length ?? 0) > 100)
      throw new Error("Table is too wide");
  }
  if (d.content?.type !== "doc") throw new Error("Expected a document root");
  walk(d.content, 0);
  let total = 0;
  for (const [id, a] of Object.entries(d.assets)) {
    if (
      !/^[a-f\d-]{36}$/.test(id) ||
      !/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        a.data,
      )
    )
      throw new Error("Invalid embedded asset");
    total += a.data.length;
    if (total > 80_000_000) throw new Error("Embedded assets exceed 60 MB");
  }
  return d;
}
export function textContent(n: RichNode): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  const s = (n.content ?? []).map(textContent).join("");
  return [
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "tableRow",
  ].includes(n.type)
    ? s + "\n"
    : s;
}
export function statistics(content: RichNode, selection = "") {
  const text = textContent(content).trimEnd();
  const words = (s: string) =>
    (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
  let paragraphs = 0;
  function walk(n: RichNode) {
    if (["paragraph", "heading", "codeBlock"].includes(n.type)) paragraphs++;
    n.content?.forEach(walk);
  }
  walk(content);
  return {
    words: words(text),
    characters: Array.from(text).length,
    withoutSpaces: Array.from(text.replace(/\s/g, "")).length,
    paragraphs,
    readingMinutes: Math.ceil(words(text) / 220),
    selectedWords: words(selection),
    selectedCharacters: Array.from(selection).length,
  };
}
export const compatibilityNotice =
  "DOCX conversion supports paragraphs, headings, common text formatting, lists, hyperlinks, basic tables and inline images. Complex Word layouts, fields, floating objects, comments, tracked changes and custom styles may be lost. Imported files are never overwritten automatically.";
export function cloneAsNew(d: BeastDocument): BeastDocument {
  return {
    ...structuredClone(d),
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  };
}
