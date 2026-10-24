export type EditableFormat = "beasttext" | "docx" | "txt" | "html" | "md";
export type DocumentFormat = EditableFormat | "pdf";
export const documentFormats: {
  id: DocumentFormat;
  name: string;
  description: string;
  detail: string;
}[] = [
  {
    id: "docx",
    name: "Word document",
    description: "Share and edit in Microsoft Word",
    detail:
      "Saves common formatting, headings, lists, basic tables and inline images. Complex Word layouts, comments and some custom styles are not preserved.",
  },
  {
    id: "pdf",
    name: "PDF document",
    description: "A finished copy for sharing or printing",
    detail:
      "Creates a paginated PDF copy. Your editable document and its save location stay unchanged.",
  },
  {
    id: "beasttext",
    name: "BeastText document",
    description: "Keep every BeastText editing feature",
    detail:
      "Preserves formatting, images, comments, styles and page settings. Best for continuing your work in BeastText.",
  },
  {
    id: "txt",
    name: "Plain text",
    description: "Simple text that opens almost anywhere",
    detail:
      "Saves text only, using UTF-8. Formatting, images, comments and page settings are omitted.",
  },
  {
    id: "html",
    name: "Web page",
    description: "A self-contained HTML document",
    detail:
      "Includes styled content and embedded images. Editing comments are omitted. Page appearance can vary between browsers.",
  },
  {
    id: "md",
    name: "Markdown",
    description: "Readable text with lightweight formatting",
    detail:
      "Preserves headings, emphasis, lists, links and code. Images, tables, comments and page layout have limited or no representation.",
  },
];
export function editableFormatForPath(
  file: string | null,
): EditableFormat | null {
  const extension = file?.split(".").pop()?.toLowerCase();
  if (extension === "htm") return "html";
  if (extension === "markdown") return "md";
  return ["beasttext", "docx", "txt", "html", "md"].includes(extension ?? "")
    ? (extension as EditableFormat)
    : null;
}
