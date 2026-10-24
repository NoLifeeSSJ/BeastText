import type { BeastDocument } from "../shared/model";
import { textContent, validateDocument } from "../shared/model";
import type { EditableFormat } from "../shared/formats";
import { documentHtml } from "../shared/html";
import { exportDocx, markdownExport } from "./conversion";
import { encodeNative } from "./storage";

export async function documentBytes(
  input: BeastDocument,
  format: EditableFormat,
) {
  const doc = validateDocument(input);
  switch (format) {
    case "beasttext":
      return encodeNative(doc);
    case "docx":
      return exportDocx(doc);
    case "html":
      return documentHtml(doc);
    case "md":
      return markdownExport(doc);
    case "txt":
      return textContent(doc.content);
    default:
      throw new Error("Unsupported document format.");
  }
}
