import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  ExternalHyperlink,
  InternalHyperlink,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  LevelFormat,
  BorderStyle,
  VerticalAlign,
} from "docx";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { unzipSync, strFromU8 } from "fflate";
import { BeastDocument, RichNode, compatibilityNotice } from "../shared/model";
import { contentHtml } from "../shared/html";
export const markdownExport = (d: BeastDocument) =>
  new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  }).turndown(contentHtml(d));
export async function importDocx(bytes: Buffer) {
  let total = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      if (total > 100 * 1024 * 1024 || f.originalSize > 32 * 1024 * 1024)
        throw new Error("DOCX exceeds safe expansion limits.");
      if (/(^\/|(^|\/)\.\.(\/|$)|\\)/.test(f.name))
        throw new Error("Unsafe DOCX archive path.");
      return true;
    },
  });
  const xml = files["word/document.xml"]
    ? strFromU8(files["word/document.xml"])
    : "";
  if (!xml) throw new Error("Not a valid DOCX document.");
  const result = await mammoth.convertToHtml(
    { buffer: bytes },
    {
      externalFileAccess: false,
      styleMap: [
        "p[style-name='Title'] => p[data-style='Title']:fresh",
        "p[style-name='Subtitle'] => p[data-style='Subtitle']:fresh",
        "p[style-name='Caption'] => p[data-style='Caption']:fresh",
      ],
    },
  );
  const warnings = [
    compatibilityNotice,
    ...result.messages.map((m) => m.message),
  ];
  if (/<w:(ins|del|drawing|fldChar|commentRangeStart|sdt)\b/.test(xml))
    warnings.push(
      "This file contains fields, drawings or review structures. Check the imported result against the original.",
    );
  const size = xml.match(/<w:pgSz\b([^>]+)>?/);
  const margin = xml.match(/<w:pgMar\b([^>]+)>?/);
  const read = (s: string | undefined, k: string) => {
    const m = s?.match(new RegExp(`w:${k}="(\\d+)"`));
    return m ? Number(m[1]) : undefined;
  };
  return {
    html: result.value,
    warnings,
    page: {
      width: read(size?.[1], "w"),
      height: read(size?.[1], "h"),
      top: read(margin?.[1], "top"),
      bottom: read(margin?.[1], "bottom"),
      left: read(margin?.[1], "left"),
      right: read(margin?.[1], "right"),
    },
  };
}
export async function exportDocx(d: BeastDocument): Promise<Buffer> {
  const textRuns = (n: RichNode): any[] => {
    if (n.type === "text") {
      let opts: any = { text: n.text ?? "" };
      for (const m of n.marks ?? []) {
        switch (m.type) {
          case "bold":
            opts.bold = true;
            break;
          case "italic":
            opts.italics = true;
            break;
          case "underline":
            opts.underline = {};
            break;
          case "strike":
            opts.strike = true;
            break;
          case "superscript":
            opts.superScript = true;
            break;
          case "subscript":
            opts.subScript = true;
            break;
          case "code":
            opts.font = "Consolas";
            break;
          case "highlight":
            opts.shading = {
              fill: (m.attrs?.color ?? "#fff0a6").replace("#", ""),
            };
            break;
          case "textStyle":
            if (m.attrs?.color) opts.color = m.attrs.color.replace("#", "");
            if (m.attrs?.fontFamily) opts.font = m.attrs.fontFamily;
            if (m.attrs?.fontSize) opts.size = parseFloat(m.attrs.fontSize) * 2;
            break;
        }
      }
      const runs = String(opts.text)
        .split("\n")
        .flatMap((text, index) => [
          ...(index ? [new TextRun({ break: 1 })] : []),
          new TextRun({ ...opts, text }),
        ]);
      const link = n.marks?.find((m) => m.type === "link")?.attrs?.href;
      return link
        ? [
            link.startsWith("#")
              ? new InternalHyperlink({
                  anchor: link.slice(1),
                  children: runs,
                })
              : new ExternalHyperlink({ link, children: runs }),
          ]
        : runs;
    }
    if (n.type === "hardBreak") return [new TextRun({ break: 1 })];
    if (n.type === "image") {
      const a = d.assets[n.attrs?.src?.replace("beast-asset:", "")];
      if (!a) return [];
      return [
        new ImageRun({
          data: Buffer.from(a.data, "base64"),
          type:
            a.mime === "image/jpeg"
              ? "jpg"
              : a.mime === "image/gif"
                ? "gif"
                : "png",
          transformation: {
            width: Math.min(n.attrs?.width ?? 480, 650),
            height: Math.min(n.attrs?.height ?? 320, 850),
          },
          altText: {
            title: n.attrs?.title ?? "",
            description: n.attrs?.alt ?? "",
            name: n.attrs?.alt ?? "Image",
          },
        }),
      ];
    }
    return (n.content ?? []).flatMap(textRuns);
  };
  const blocks = (
    nodes: RichNode[],
    list?: { ordered: boolean; level: number },
  ): any[] =>
    nodes.flatMap((n) => {
      const a = n.attrs ?? {};
      if (n.type === "bulletList" || n.type === "orderedList")
        return (n.content ?? []).flatMap((li) =>
          blocks(li.content ?? [], {
            ordered: n.type === "orderedList",
            level: list ? list.level + 1 : 0,
          }),
        );
      if (n.type === "blockquote")
        return blocks(
          (n.content ?? []).map((c) => ({
            ...c,
            attrs: { ...c.attrs, styleName: "Quote", indent: 1 },
          })),
          list,
        );
      if (n.type === "table")
        return [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: (n.content ?? []).map(
              (r) =>
                new TableRow({
                  tableHeader: r.content?.every(
                    (c) => c.type === "tableHeader",
                  ),
                  children: (r.content ?? []).map(
                    (c) =>
                      new TableCell({
                        columnSpan: c.attrs?.colspan ?? 1,
                        rowSpan: c.attrs?.rowspan ?? 1,
                        verticalAlign: VerticalAlign.TOP,
                        shading: {
                          fill: (
                            c.attrs?.backgroundColor ??
                            (c.type === "tableHeader" ? "EEF2F6" : "FFFFFF")
                          ).replace("#", ""),
                        },
                        borders: Object.fromEntries(
                          ["top", "bottom", "left", "right"].map((k) => [
                            k,
                            {
                              style: BorderStyle.SINGLE,
                              size: (c.attrs?.borderWidth ?? 1) * 4,
                              color: (
                                c.attrs?.borderColor ?? "#CBD5E1"
                              ).replace("#", ""),
                            },
                          ]),
                        ) as any,
                        children: blocks(c.content ?? []),
                      }),
                  ),
                }),
            ),
          }),
        ];
      if (n.type === "pageBreak")
        return [new Paragraph({ children: [new PageBreak()] })];
      if (n.type === "horizontalRule")
        return [
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "CBD5E1" },
            },
            children: [],
          }),
        ];
      if (n.type === "toc") {
        const headings: RichNode[] = [];
        const walk = (x: RichNode) => {
          if (x.type === "heading") headings.push(x);
          x.content?.forEach(walk);
        };
        walk(d.content);
        return [
          new Paragraph({ text: "Contents", heading: HeadingLevel.HEADING_1 }),
          ...headings.map(
            (x) =>
              new Paragraph({
                children: textRuns(x),
                indent: { left: ((x.attrs?.level ?? 1) - 1) * 360 },
              }),
          ),
        ];
      }
      const styleName =
        a.styleName ??
        (n.type === "heading"
          ? `Heading ${a.level}`
          : n.type === "codeBlock"
            ? "Code block"
            : "Normal");
      const style = d.styles[styleName] ?? d.styles.Normal;
      const opts: any = {
        children: textRuns(n),
        alignment: (
          {
            left: AlignmentType.LEFT,
            center: AlignmentType.CENTER,
            right: AlignmentType.RIGHT,
            justify: AlignmentType.JUSTIFIED,
          } as any
        )[a.textAlign ?? "left"],
        spacing: {
          before: (a.spaceBefore ?? style.spaceBefore) * 20,
          after: (a.spaceAfter ?? style.spaceAfter) * 20,
          line: Math.round((a.lineHeight ?? style.lineHeight) * 240),
        },
        indent: { left: (a.indent ?? 0) * 360 },
        run: {
          font: style.fontFamily,
          size: style.fontSize * 2,
          color: style.color.replace("#", ""),
        },
      };
      if (n.type === "heading")
        opts.heading = (
          [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
          ] as const
        )[a.level - 1];
      if (a.id) opts.bookmark = { id: a.id, children: textRuns(n) };
      if (list) {
        if (list.ordered)
          opts.numbering = {
            reference: "beast-numbering",
            level: Math.min(list.level, 8),
          };
        else opts.bullet = { level: Math.min(list.level, 8) };
      }
      return [new Paragraph(opts)];
    });
  const p = d.page,
    portrait = p.size === "A4" ? [11906, 16838] : [12240, 15840];
  const mm = (v: number) => Math.round((v * 1440) / 25.4);
  const footChildren: any[] = [new TextRun(p.footer)];
  if (p.pageNumbers)
    footChildren.push(
      new TextRun({
        children: ["  ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
      }),
    );
  const document = new Document({
    creator: d.metadata.author,
    title: d.title,
    description: d.metadata.description,
    numbering: {
      config: [
        {
          reference: "beast-numbering",
          levels: Array.from({ length: 9 }, (_, i) => ({
            level: i,
            format: LevelFormat.DECIMAL,
            text: `%${i + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 360 * (i + 1), hanging: 180 } },
            },
          })),
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: d.styles.Normal.fontFamily,
            size: d.styles.Normal.fontSize * 2,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: p.differentFirstPage,
          page: {
            size: {
              width: portrait[0],
              height: portrait[1],
              orientation: p.orientation,
            },
            margin: {
              top: mm(p.marginTop),
              bottom: mm(p.marginBottom),
              left: mm(p.marginLeft),
              right: mm(p.marginRight),
              header: 360,
              footer: 360,
            },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({ text: p.header })],
          }),
          ...(p.differentFirstPage
            ? { first: new Header({ children: [new Paragraph("")] }) }
            : {}),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: footChildren,
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          ...(p.differentFirstPage
            ? { first: new Footer({ children: [new Paragraph("")] }) }
            : {}),
        },
        children: blocks(d.content.content ?? []),
      },
    ],
  });
  return Packer.toBuffer(document);
}
