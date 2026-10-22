import { _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "beast-output-"));
const output = path.resolve("docs/verification");
await fs.mkdir(output, { recursive: true });
const app = await electron.launch({
  args: ["--no-sandbox", "--disable-gpu", path.resolve(".")],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":99",
    BEASTTEXT_DATA: root,
  },
});
try {
  const page = await app.firstWindow();
  await page
    .getByRole("button", { name: "New document", exact: true })
    .waitFor();
  const sources = {
    report: path.resolve("samples/report.beasttext"),
    tables: path.resolve("samples/several-tables.beasttext"),
  };
  const doc = await page.evaluate(async ({ report, tables }) => {
    const a = (await window.beast.open(report)).doc,
      b = (await window.beast.open(tables)).doc;
    a.title = "Rich document verification";
    a.page.header = "BeastText layout verification";
    a.page.footer = "Offline writing";
    a.content.content.push({ type: "pageBreak" }, ...b.content.content);
    return a;
  }, sources);
  for (const format of ["pdf", "docx", "html"]) {
    const target = path.join(output, `rich-document.${format}`);
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, target);
    await page.evaluate(
      async ({ doc, format }) => window.beast.export(doc, format),
      { doc, format },
    );
  }
  const printBytes = await app.evaluate(
    async ({ BrowserWindow }, { html, pdf }) => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      await win.loadFile(html);
      await win.webContents.executeJavaScript(
        "Promise.all(Array.from(document.images).map(i=>i.decode()))",
      );
      const bytes = await win.webContents.printToPDF({
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: false,
      });
      win.destroy();
      return Array.from(bytes);
    },
    {
      html: path.join(output, "rich-document.html"),
      pdf: path.join(output, "rich-document-print-css.pdf"),
    },
  );
  await fs.writeFile(
    path.join(output, "rich-document-print-css.pdf"),
    Buffer.from(printBytes),
  );
  await app.evaluate(
    ({ BrowserWindow }, file) =>
      BrowserWindow.getAllWindows()[0].webContents.send("beast:open", [file]),
    path.join(output, "rich-document.docx"),
  );
  await page
    .getByRole("button", { name: "Continue editing", exact: true })
    .click();
  const editor = page.getByRole("textbox", { name: "Document editor" });
  await editor.locator("table").first().waitFor();
  await editor.locator("img").waitFor();
  await page.screenshot({ path: path.join(output, "imported-docx.png") });
  console.log(
    "Rich PDF, print CSS PDF, DOCX/HTML and imported DOCX screenshot verified.",
  );
} finally {
  const ended = new Promise((r) => app.process().once("exit", r));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await ended;
  await fs.rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
