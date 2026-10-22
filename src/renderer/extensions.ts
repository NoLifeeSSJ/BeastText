import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit, TableCell, TableHeader } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import DOMPurify from "dompurify";
import { BeastDocument, safeLink } from "../shared/model";
export const searchKey = new PluginKey("beastSearch");
export type SearchOptions = {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
};
export function findMatches(doc: PMNode, options: SearchOptions) {
  const ranges: { from: number; to: number }[] = [];
  if (!options.query) return ranges;
  const q = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(
    options.wholeWord ? `(?<![\\p{L}\\p{N}_])${q}(?![\\p{L}\\p{N}_])` : q,
    options.matchCase ? "gu" : "giu",
  );
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = node.textBetween(0, node.content.size, "", "\ufffc");
    let match;
    while ((match = rx.exec(text)) !== null) {
      ranges.push({
        from: pos + 1 + match.index,
        to: pos + 1 + match.index + match[0].length,
      });
    }
    return false;
  });
  return ranges;
}
const Search = Extension.create({
  name: "beastSearch",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => ({ query: "", matchCase: false, wholeWord: false }),
          apply: (tr, value) => tr.getMeta(searchKey) ?? value,
        },
        props: {
          decorations(state) {
            const value = searchKey.getState(state);
            return DecorationSet.create(
              state.doc,
              findMatches(state.doc, value).map((r) =>
                Decoration.inline(r.from, r.to, { class: "search-hit" }),
              ),
            );
          },
        },
      }),
    ];
  },
});
export const Comment = Mark.create({
  name: "comment",
  inclusive: false,
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (e) => e.getAttribute("data-comment-id"),
        renderHTML: (a) => ({ "data-comment-id": a.commentId }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "comment-anchor" }),
      0,
    ];
  },
});
const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }, { tag: "div.page-break" }];
  },
  renderHTML() {
    return [
      "div",
      { "data-page-break": "true", class: "page-break" },
      ["span", {}, "Page break"],
    ];
  },
});
const Toc = Node.create({
  name: "toc",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "nav[data-toc]" }];
  },
  renderHTML() {
    return [
      "nav",
      { "data-toc": "true", class: "toc-node" },
      "Contents · generated from headings in print and export",
    ];
  },
});
const ParagraphLayout = Extension.create({
  name: "paragraphLayout",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "blockquote", "codeBlock"],
        attributes: {
          styleName: {
            default: "Normal",
            parseHTML: (e) => e.dataset.style ?? "Normal",
            renderHTML: (a) => ({ "data-style": a.styleName }),
          },
          indent: {
            default: 0,
            parseHTML: (e) => Number(e.dataset.indent ?? 0),
            renderHTML: (a) => ({
              "data-indent": a.indent,
              style: `margin-left:${Math.min(a.indent, 8) * 24}px`,
            }),
          },
          lineHeight: {
            default: null,
            parseHTML: (e) => parseFloat(e.style.lineHeight) || null,
            renderHTML: (a) =>
              a.lineHeight ? { style: `line-height:${a.lineHeight}` } : {},
          },
          spaceBefore: {
            default: null,
            parseHTML: (e) => parseFloat(e.style.marginTop) || null,
            renderHTML: (a) =>
              a.spaceBefore != null
                ? { style: `margin-top:${a.spaceBefore}pt` }
                : {},
          },
          spaceAfter: {
            default: null,
            parseHTML: (e) => parseFloat(e.style.marginBottom) || null,
            renderHTML: (a) =>
              a.spaceAfter != null
                ? { style: `margin-bottom:${a.spaceAfter}pt` }
                : {},
          },
          backgroundColor: {
            default: null,
            parseHTML: (e) => e.style.backgroundColor || null,
            renderHTML: (a) =>
              a.backgroundColor
                ? { style: `background-color:${a.backgroundColor}` }
                : {},
          },
        },
      },
      {
        types: ["heading"],
        attributes: {
          id: {
            default: null,
            parseHTML: (e) => e.id || null,
            renderHTML: (a) => (a.id ? { id: a.id } : {}),
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((t) => t.docChanged)) return null;
          let tr = state.tr;
          state.doc.descendants((node, pos) => {
            if (node.type.name === "heading" && !node.attrs.id)
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                id: crypto.randomUUID(),
              });
            if (
              node.type.name === "paragraph" &&
              String(node.attrs.styleName).startsWith("Heading ")
            )
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                styleName: "Normal",
              });
          });
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});
const cellAttrs = {
  backgroundColor: {
    default: null,
    parseHTML: (e: HTMLElement) => e.style.backgroundColor || null,
    renderHTML: (a: any) =>
      a.backgroundColor
        ? { style: `background-color:${a.backgroundColor}` }
        : {},
  },
  borderColor: {
    default: "#cbd5e1",
    parseHTML: (e: HTMLElement) => e.style.borderColor || "#cbd5e1",
    renderHTML: (a: any) => ({ style: `border-color:${a.borderColor}` }),
  },
  borderWidth: {
    default: 1,
    parseHTML: (e: HTMLElement) => parseFloat(e.style.borderWidth) || 1,
    renderHTML: (a: any) => ({ style: `border-width:${a.borderWidth}px` }),
  },
};
const Cell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttrs };
  },
});
const HeaderCell = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttrs };
  },
});
export function editorExtensions(getDocument: () => BeastDocument) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: false,
        protocols: ["http", "https", "mailto"],
        isAllowedUri: (url) => safeLink(url),
      },
    }),
    TableKit.configure({
      table: { resizable: true, allowTableNodeSelection: true },
      tableCell: false,
      tableHeader: false,
    }),
    Cell,
    HeaderCell,
    Image.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          src: {
            default: null,
            parseHTML: (e) =>
              e.getAttribute("data-asset-src") || e.getAttribute("src"),
          },
          width: {
            default: 480,
            parseHTML: (e) =>
              Number(e.getAttribute("width")) || parseInt(e.style.width) || 480,
          },
          height: {
            default: 320,
            parseHTML: (e) => Number(e.getAttribute("height")) || 320,
          },
          textAlign: { default: "left" },
        };
      },
      renderHTML({ HTMLAttributes }) {
        const id = HTMLAttributes.src?.replace("beast-asset:", "");
        const image = getDocument().assets[id];
        return [
          "img",
          mergeAttributes(HTMLAttributes, {
            "data-asset-src": HTMLAttributes.src,
            src: image ? `data:${image.mime};base64,${image.data}` : "",
            style: `width:${HTMLAttributes.width}px;max-width:100%;height:auto;display:block;margin-left:${HTMLAttributes.textAlign === "left" ? 0 : "auto"};margin-right:${HTMLAttributes.textAlign === "right" ? 0 : "auto"}`,
          }),
        ];
      },
    }).configure({ allowBase64: false, inline: false }),
    TextStyleKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    Placeholder.configure({ placeholder: "Let your next idea take shape…" }),
    ParagraphLayout,
    PageBreak,
    Toc,
    Comment,
    Search,
  ];
}
export function sanitiseHtml(input: string, doc: BeastDocument) {
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      "p",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "del",
      "sup",
      "sub",
      "mark",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "hr",
      "br",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "img",
    ],
    ALLOWED_ATTR: [
      "style",
      "href",
      "src",
      "alt",
      "title",
      "width",
      "height",
      "colspan",
      "rowspan",
      "start",
      "data-style",
    ],
    ALLOW_DATA_ATTR: false,
  });
  const parsed = new DOMParser().parseFromString(clean, "text/html");
  let skippedImages = 0;
  for (const el of parsed.body.querySelectorAll<HTMLElement>("*")) {
    if (el.hasAttribute("style")) {
      const css = el.style;
      for (const property of Array.from(css))
        if (
          ![
            "color",
            "background-color",
            "font-family",
            "font-size",
            "font-weight",
            "font-style",
            "text-decoration",
            "text-align",
            "line-height",
            "margin-top",
            "margin-bottom",
          ].includes(property) ||
          /url\(|expression|[<>]/i.test(css.getPropertyValue(property))
        )
          css.removeProperty(property);
      if (!el.getAttribute("style")) el.removeAttribute("style");
    }
    if (el.tagName === "A" && !safeLink(el.getAttribute("href") ?? ""))
      el.removeAttribute("href");
    if (el.tagName === "IMG") {
      const src = el.getAttribute("src") ?? "";
      const match = src.match(
        /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-zA-Z0-9+/=]+)$/,
      );
      if (!match || src.length > 36_000_000) {
        el.remove();
        skippedImages++;
        continue;
      }
      const id = crypto.randomUUID();
      doc.assets[id] = { mime: match[1] as any, data: match[2] };
      el.setAttribute("src", `beast-asset:${id}`);
      el.setAttribute("data-asset-src", `beast-asset:${id}`);
    }
  }
  return { html: parsed.body.innerHTML, skippedImages };
}
