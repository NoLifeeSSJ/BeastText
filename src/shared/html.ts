import { BeastDocument, RichNode, safeLink, textContent } from "./model";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const esc = (s: any) => escapeHtml(String(s ?? ""));
export function contentHtml(d: BeastDocument): string {
  function render(n: RichNode): string {
    const a = n.attrs ?? {};
    const inner = () => n.content?.map(render).join("") ?? "";
    let style = "";
    if (a.textAlign || a.align)
      style += `text-align:${esc(a.textAlign ?? a.align)};`;
    if (a.indent)
      style += `margin-left:${Math.min(Number(a.indent), 8) * 24}px;`;
    if (a.lineHeight) style += `line-height:${Number(a.lineHeight)};`;
    if (a.spaceBefore != null)
      style += `margin-top:${Number(a.spaceBefore)}pt;`;
    if (a.spaceAfter != null)
      style += `margin-bottom:${Number(a.spaceAfter)}pt;`;
    if (a.backgroundColor)
      style += `background-color:${esc(a.backgroundColor)};`;
    const attr = `${style ? ` style="${style}"` : ""}${a.styleName ? ` data-style="${esc(a.styleName)}"` : ""}`;
    switch (n.type) {
      case "doc":
        return inner();
      case "text": {
        let s = esc(n.text).replace(/\n/g, "<br>");
        for (const m of n.marks ?? []) {
          const ma = m.attrs ?? {};
          const tag = (
            {
              bold: "strong",
              italic: "em",
              underline: "u",
              strike: "s",
              code: "code",
              superscript: "sup",
              subscript: "sub",
            } as Record<string, string>
          )[m.type];
          if (tag) s = `<${tag}>${s}</${tag}>`;
          if (m.type === "link" && safeLink(ma.href ?? ""))
            s = `<a href="${esc(ma.href)}">${s}</a>`;
          if (m.type === "highlight")
            s = `<mark style="background-color:${esc(ma.color ?? "#fff0a6")}">${s}</mark>`;
          if (m.type === "textStyle") {
            let css = "";
            for (const [k, v] of Object.entries(ma))
              if (v && ["color", "fontFamily", "fontSize"].includes(k))
                css += `${({ color: "color", fontFamily: "font-family", fontSize: "font-size" } as Record<string, string>)[k]}:${esc(v)};`;
            s = `<span style="${css}">${s}</span>`;
          }
        }
        return s;
      }
      case "paragraph":
        return `<p${attr}>${inner() || "<br>"}</p>`;
      case "heading":
        return `<h${a.level} id="${esc(a.id ?? "")}"${attr}>${inner()}</h${a.level}>`;
      case "bulletList":
        return `<ul>${inner()}</ul>`;
      case "orderedList":
        return `<ol start="${Number(a.start ?? 1)}">${inner()}</ol>`;
      case "listItem":
        return `<li>${inner()}</li>`;
      case "blockquote":
        return `<blockquote${attr}>${inner()}</blockquote>`;
      case "codeBlock":
        return `<pre${attr}><code>${inner()}</code></pre>`;
      case "horizontalRule":
        return "<hr>";
      case "hardBreak":
        return "<br>";
      case "pageBreak":
        return '<div class="page-break" aria-label="Page break"></div>';
      case "image": {
        const image = d.assets[a.src?.replace("beast-asset:", "")];
        return image
          ? `<img src="data:${image.mime};base64,${image.data}" alt="${esc(a.alt)}" title="${esc(a.title)}" style="width:${Math.min(Number(a.width ?? 480), 1200)}px;max-width:100%;height:auto;display:block;margin-left:${a.textAlign === "left" || !a.textAlign ? 0 : "auto"};margin-right:${a.textAlign === "right" ? 0 : "auto"}">`
          : "";
      }
      case "table":
        return `<table>${inner()}</table>`;
      case "tableRow":
        return `<tr>${inner()}</tr>`;
      case "tableCell":
      case "tableHeader": {
        const tag = n.type === "tableCell" ? "td" : "th";
        return `<${tag} colspan="${Number(a.colspan ?? 1)}" rowspan="${Number(a.rowspan ?? 1)}" style="${style}border:${Number(a.borderWidth ?? 1)}px solid ${esc(a.borderColor ?? "#cbd5e1")};${a.colwidth?.[0] ? `width:${Number(a.colwidth[0])}px;` : ""}">${inner()}</${tag}>`;
      }
      case "toc": {
        let headings: RichNode[] = [];
        function collect(x: RichNode) {
          if (x.type === "heading") headings.push(x);
          x.content?.forEach(collect);
        }
        collect(d.content);
        return `<nav class="toc"><h2>Contents</h2>${headings.map((h) => `<p style="margin-left:${((h.attrs?.level ?? 1) - 1) * 18}px"><a href="#${esc(h.attrs?.id)}">${esc(textContent(h).trim())}</a></p>`).join("")}</nav>`;
      }
      default:
        return inner();
    }
  }
  return render(d.content);
}
export function documentCss(d: BeastDocument) {
  const p = d.page;
  return `@page{size:${p.size} ${p.orientation};margin:${p.marginTop}mm ${p.marginRight}mm ${p.marginBottom}mm ${p.marginLeft}mm}*{box-sizing:border-box}body{font-family:Aptos,Calibri,Arial,sans-serif;font-size:12pt;color:#202b3c;line-height:1.5;margin:0;overflow-wrap:anywhere}p{margin:0 0 8pt}h1,h2,h3{break-after:avoid}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:12pt 0}tr{break-inside:avoid}thead{display:table-header-group}td,th{padding:6pt;vertical-align:top}th{background:#eef2f6}img{max-width:100%;object-fit:contain}blockquote{border-left:3px solid #9ba8b8;padding-left:16pt;color:#526078}pre{white-space:pre-wrap;background:#f3f5f8;padding:12pt;font-family:Consolas,monospace}.page-break{break-after:page;height:0}a{color:#326b9e;text-decoration:underline}mark{color:inherit}.toc{border:1px solid #dbe2eb;padding:16pt}${Object.entries(
    d.styles,
  )
    .map(
      ([name, s]) =>
        `[data-style="${escapeHtml(name)}"]{font-family:"${escapeHtml(s.fontFamily)}",Arial,sans-serif;font-size:${s.fontSize}pt;color:${s.color};line-height:${s.lineHeight};margin-top:${s.spaceBefore}pt;margin-bottom:${s.spaceAfter}pt}`,
    )
    .join("")}`;
}
export function documentHtml(d: BeastDocument, includePageFields = true) {
  const cssText = (value: string) =>
    '"' +
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\r\n]/g, " ")
      .replace(/</g, "\\3c ")
      .replace(/>/g, "\\3e ") +
    '"';
  const pageFields = includePageFields
    ? `@page{@top-left{content:${cssText(d.page.header)};font:9px Arial;color:#697586}@bottom-center{content:${cssText(d.page.footer)}${d.page.pageNumbers ? ' " " counter(page) " / " counter(pages)' : ""};font:9px Arial;color:#697586}}`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'"><title>${escapeHtml(d.title)}</title><style>${documentCss(d)}${pageFields}</style></head><body>${contentHtml(d)}</body></html>`;
}
