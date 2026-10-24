import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  session,
  nativeImage,
  clipboard,
} from "electron";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { defaults, Settings, Recent } from "../shared/bridge";
import {
  validateDocument,
  BeastDocument,
  textContent,
  cloneAsNew,
} from "../shared/model";
import { documentHtml, escapeHtml } from "../shared/html";
import {
  atomicWrite,
  encodeNative,
  decodeNative,
  fingerprint,
  SafetyStore,
} from "./storage";
import { importDocx } from "./conversion";
import { LocalSpelling, editorWordAtPoint } from "./spelling";
import {
  documentFormats,
  editableFormatForPath,
  type EditableFormat,
} from "../shared/formats";
import { documentBytes } from "./document-files";
app.setPath("userData", path.join(app.getPath("appData"), "BeastText"));
if (process.env.BEASTTEXT_DATA)
  app.setPath("userData", path.resolve(process.env.BEASTTEXT_DATA));
app.setName("BeastText");
app.setAppUserModelId("com.beastapps.beasttext");
let spellingReady = false;
let spelling: LocalSpelling;
let main: BrowserWindow;
let closeAllowed = false;
let safety: SafetyStore;
let preferences: { settings: Settings; recent: Recent[]; session: string[] } = {
  settings: { ...defaults },
  recent: [],
  session: [],
};
const filters = [
  {
    name: "Documents",
    extensions: ["beasttext", "docx", "txt", "md", "markdown", "html", "htm"],
  },
  { name: "BeastText document", extensions: ["beasttext"] },
];
const root = () => app.getPath("userData");
const log = async (message: string) => {
  await fs
    .appendFile(
      path.join(root(), "logs", "beasttext.log"),
      `${new Date().toISOString()} ${message}\n`,
    )
    .catch(() => {});
};
const persist = () =>
  atomicWrite(
    path.join(root(), "settings.json"),
    JSON.stringify(preferences, null, 2),
  );
const settingsSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]),
    font: z.string().max(100),
    fontSize: z.number().min(6).max(144),
    pageSize: z.enum(["A4", "Letter"]),
    margin: z.number().min(5).max(60),
    saveLocation: z.string().max(4096),
    recoverySeconds: z.number().int().min(5).max(3600),
    backupRetention: z.number().int().min(0).max(50),
    spellLanguage: z.string().max(30),
    wordCount: z.boolean(),
    startup: z.enum(["home", "blank"]),
    restoreSession: z.boolean(),
    warmPaper: z.boolean(),
    typewriter: z.boolean(),
    autoSave: z.boolean(),
  })
  .strict();
function filePath(input: unknown) {
  const s = z.string().min(1).max(4096).parse(input);
  if (!path.isAbsolute(s) || s.includes("\0"))
    throw new Error("Please select an absolute file path.");
  return path.normalize(s);
}
async function recent(file: string) {
  const old = preferences.recent.find((r) => r.path === file);
  preferences.recent = [
    {
      path: file,
      name: path.basename(file),
      opened: new Date().toISOString(),
      pinned: old?.pinned ?? false,
    },
    ...preferences.recent.filter((r) => r.path !== file),
  ].slice(0, 100);
  await persist();
}
async function open(file?: string) {
  if (!file) {
    const r = await dialog.showOpenDialog(main, {
      properties: ["openFile"],
      filters,
    });
    if (r.canceled) return null;
    file = r.filePaths[0];
  }
  file = filePath(file);
  const stat = await fs.stat(file).catch(() => {
    throw new Error(
      "This file is unavailable. It may have been moved, renamed, or disconnected.",
    );
  });
  if (!stat.isFile() || stat.size > 64 * 1024 * 1024)
    throw new Error("Select a document smaller than 64 MB.");
  const bytes = await fs.readFile(file);
  const base = {
    path: file,
    fingerprint: await fingerprint(file),
    warnings: [] as string[],
  };
  const ext = path.extname(file).toLowerCase();
  let result: any;
  if (ext === ".beasttext") result = { ...base, doc: decodeNative(bytes) };
  else if (ext === ".docx") {
    const imported = await importDocx(bytes);
    result = { ...base, ...imported, kind: "docx" };
  } else if ([".txt", ".md", ".markdown", ".html", ".htm"].includes(ext)) {
    result = {
      ...base,
      text: bytes.toString("utf8"),
      kind:
        ext === ".txt"
          ? "text"
          : ext === ".md" || ext === ".markdown"
            ? "markdown"
            : "html",
    };
  } else
    throw new Error(
      "Unsupported file type. Open BeastText, DOCX, text, Markdown or HTML.",
    );
  await recent(file);
  return result;
}
async function pickSave(d: BeastDocument, ext: string) {
  const description =
    documentFormats.find((format) => format.id === ext)?.name ??
    ext.toUpperCase();
  const r = await dialog.showSaveDialog(main, {
    title: "Save as " + description,
    buttonLabel: "Save",
    defaultPath: path.join(
      preferences.settings.saveLocation || app.getPath("documents"),
      `${d.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "Untitled"}.${ext}`,
    ),
    filters: [{ name: description, extensions: [ext] }],
  });
  if (r.canceled) return null;
  return r.filePath
    ? /\.[^/\\]+$/.test(r.filePath)
      ? r.filePath
      : `${r.filePath}.${ext}`
    : null;
}
async function save(
  input: unknown,
  target: string | null,
  baseline: string | null,
  mode: "save" | "as" | "copy",
  requestedFormat: EditableFormat = "beasttext",
) {
  let d = validateDocument(input);
  z.enum(["save", "as", "copy"]).parse(mode);
  z.enum(["beasttext", "docx", "txt", "html", "md"]).parse(requestedFormat);
  const format =
    target && mode === "save" ? editableFormatForPath(target) : requestedFormat;
  if (!format)
    throw new Error(
      "This file type cannot be saved. Choose Save as and a supported format.",
    );
  if (mode === "copy") d = cloneAsNew(d);
  let file =
    target && mode === "save" ? filePath(target) : await pickSave(d, format);
  if (!file) return null;
  if (editableFormatForPath(file) !== format)
    throw new Error(
      "The file extension must match the selected format: ." + format,
    );
  const bytes = await documentBytes(d, format);
  let before = await fingerprint(file);
  if (target && mode === "save" && before !== baseline) {
    const r = await dialog.showMessageBox(main, {
      type: "warning",
      title: "Document changed outside BeastText",
      message: "The file has changed or disappeared since you opened it.",
      detail:
        "Save a new copy to preserve both versions. BeastText will not overwrite the external change.",
      buttons: ["Save As…", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    });
    if (r.response === 1) return null;
    file = await pickSave(d, format);
    if (!file) return null;
    if (editableFormatForPath(file) !== format)
      throw new Error(
        "The file extension must match the selected format: ." + format,
      );
    const previousPath = filePath(target);
    if (
      process.platform === "win32"
        ? filePath(file).toLowerCase() === previousPath.toLowerCase()
        : filePath(file) === previousPath
    )
      throw new Error(
        "Choose a different file to preserve the external changes.",
      );
    before = await fingerprint(file);
  }
  await safety.backup(file, d.id, preferences.settings.backupRetention);
  if ((await fingerprint(file)) !== before)
    throw new Error(
      "The file changed while preparing to save. Your original file has not been overwritten. Try Save as to preserve both versions.",
    );
  await atomicWrite(file, bytes);
  await recent(file);
  if (mode !== "copy") await safety.clearRecovery(d.id);
  return { path: file, fingerprint: (await fingerprint(file))! };
}
async function renderForPrint(d: BeastDocument, includePageFields = false) {
  const temp = path.join(
    app.getPath("temp"),
    `beasttext-${crypto.randomUUID()}.html`,
  );
  await fs.writeFile(temp, documentHtml(d, includePageFields), "utf8");
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  try {
    await win.loadFile(temp);
    await win.webContents.executeJavaScript(
      "Promise.all([document.fonts.ready, ...Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))]).then(()=>true)",
    );
    return { win, temp };
  } catch (e) {
    win.destroy();
    await fs.unlink(temp).catch(() => {});
    throw e;
  }
}
async function pdf(d: BeastDocument) {
  const { win, temp } = await renderForPrint(d);
  try {
    const p = d.page;
    const template = (text: string, footer = false) =>
      `<div style="font:9px Arial;width:100%;padding:0 20mm;color:#697586;text-align:${footer ? "center" : "left"}">${escapeHtml(text)}${footer && p.pageNumbers ? ' <span class="pageNumber"></span> / <span class="totalPages"></span>' : ""}</div>`;
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: !!(p.header || p.footer || p.pageNumbers),
      headerTemplate: template(p.header),
      footerTemplate: template(p.footer, true),
      margins: {
        top: p.marginTop / 25.4,
        bottom: p.marginBottom / 25.4,
        left: p.marginLeft / 25.4,
        right: p.marginRight / 25.4,
      },
      landscape: p.orientation === "landscape",
      pageSize: p.size,
      generateTaggedPDF: true,
    });
  } finally {
    win.destroy();
    await fs.unlink(temp).catch(() => {});
  }
}
function handle(name: string, fn: (...args: any[]) => any) {
  ipcMain.handle(`beast:${name}`, async (event, ...args) => {
    if (
      event.sender !== main.webContents ||
      event.senderFrame !== main.webContents.mainFrame
    )
      throw new Error("Untrusted request");
    try {
      return await fn(...args);
    } catch (e: any) {
      await log(`Operation ${name} failed (${e.code ?? e.name ?? "Error"})`);
      throw new Error(
        e instanceof z.ZodError
          ? "The document or settings are invalid."
          : e.message || "The operation could not be completed.",
      );
    }
  });
}
async function initialise() {
  session.defaultSession.on("spellcheck-dictionary-initialized", () => {
    spellingReady = true;
  });
  const dictionaries = path.join(app.getAppPath(), "resources", "dictionaries");
  const dictionaryServer = http.createServer(async (req, res) => {
    try {
      const name = (req.url ?? "").slice(1).toLowerCase();
      if (!/^en-(us|gb)-10-2\.bdic$/.test(name)) {
        res.writeHead(404).end();
        return;
      }
      const bytes = await fs.readFile(path.join(dictionaries, name));
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": bytes.length,
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    dictionaryServer.on("error", reject);
    dictionaryServer.listen(0, "127.0.0.1", resolve);
  });
  const dictionaryPort = (dictionaryServer.address() as any).port;
  session.defaultSession.setSpellCheckerDictionaryDownloadURL(
    `http://127.0.0.1:${dictionaryPort}/`,
  );
  app.on("will-quit", () => dictionaryServer.close());
  safety = new SafetyStore(root());
  await safety.initialise();
  spelling = new LocalSpelling(dictionaries, root());
  await spelling.initialise();
  spellingReady = true;
  try {
    const s = JSON.parse(
      await fs.readFile(path.join(root(), "settings.json"), "utf8"),
    );
    preferences = {
      settings: settingsSchema.parse({ ...defaults, ...s.settings }),
      recent: z
        .array(
          z.object({
            path: z.string(),
            name: z.string(),
            opened: z.string(),
            pinned: z.boolean(),
          }),
        )
        .max(100)
        .parse(s.recent ?? []),
      session: z
        .array(z.string())
        .max(100)
        .parse(s.session ?? []),
    };
  } catch {
    await log("Started with default settings");
  }
  main = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    backgroundColor: "#f4f6f9",
    icon: path.join(__dirname, "../../resources/beasttext.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler(
    (_web, _permission, callback) => callback(false),
  );
  session.defaultSession.on("will-download", (_event, item) => item.cancel());
  main.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  main.webContents.on("will-navigate", (e) => e.preventDefault());
  if (
    preferences.settings.spellLanguage &&
    session.defaultSession.availableSpellCheckerLanguages.includes(
      preferences.settings.spellLanguage,
    )
  )
    session.defaultSession.setSpellCheckerLanguages([
      preferences.settings.spellLanguage,
    ]);
  main.webContents.on("context-menu", async (_event, params) => {
    try {
      let word = params.misspelledWord;
      let selectedInEditor = false;
      if (
        !word &&
        params.isEditable &&
        !/\s/.test(params.selectionText.trim())
      ) {
        const atPoint = await main.webContents.executeJavaScript(
          `(${editorWordAtPoint.toString()})(${Number(params.x)},${Number(params.y)})`,
        );
        if (
          atPoint &&
          !spelling.correct(atPoint, preferences.settings.spellLanguage)
        ) {
          word = atPoint;
          const selected = await main.webContents.executeJavaScript(
            `(${editorWordAtPoint.toString()})(${Number(params.x)},${Number(params.y)},true,${JSON.stringify(word)})`,
          );
          selectedInEditor = selected === word;
        }
      }
      const items: Electron.MenuItemConstructorOptions[] = [];
      if (word && !spelling.correct(word, preferences.settings.spellLanguage)) {
        for (const suggestion of spelling.suggestions(
          word,
          preferences.settings.spellLanguage,
        ))
          items.push({
            label: suggestion,
            click: () => {
              if (selectedInEditor)
                void main.webContents.insertText(suggestion);
              else main.webContents.replaceMisspelling(suggestion);
            },
          });
        items.push({
          label: "Add to personal dictionary",
          click: () => {
            void spelling
              .add(word)
              .then(() => {
                session.defaultSession.addWordToSpellCheckerDictionary(word);
                main.webContents.send("beast:dictionaryChanged");
              })
              .catch(() => log("Could not save personal dictionary"));
          },
        });
      }
      items.push(
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      );
      Menu.buildFromTemplate(items).popup({ window: main });
    } catch {
      await log("Could not show editor context menu");
    }
  });
  main.on("close", (e) => {
    if (!closeAllowed) {
      e.preventDefault();
      main.webContents.send("beast:closing");
    }
  });
  for (const [name, fn] of Object.entries({
    minimise: () => main.minimize(),
    maximise: () => (main.isMaximized() ? main.unmaximize() : main.maximize()),
    close: () => main.close(),
    closeReady: () => {
      closeAllowed = true;
      main.close();
    },
  }))
    ipcMain.on(`beast:${name}`, (e) => {
      if (e.sender === main.webContents) fn();
    });
  handle("spellCheck", (input: unknown) => {
    const words = z.array(z.string().max(100)).max(10000).parse(input);
    return spelling.check(words, preferences.settings.spellLanguage);
  });
  handle("bootstrap", async () => ({
    spellingReady,
    settings: preferences.settings,
    recent: preferences.recent,
    recoveries: await safety.recoveries(),
    templates: (await fs.readdir(path.join(root(), "templates")))
      .filter((n) => n.endsWith(".beasttext"))
      .map((n) => ({ id: n, name: n.replace(".beasttext", "") })),
    version: app.getVersion(),
    spelling: ["en-US", "en-GB"],
    session: preferences.settings.restoreSession ? preferences.session : [],
    launchPaths: process.argv
      .slice(app.isPackaged ? 1 : 2)
      .filter(
        (s) =>
          !s.startsWith("-") && /\.(beasttext|docx|txt|md|html?)$/i.test(s),
      ),
  }));
  handle("clipboard", async () => {
    const items = await clipboard.read();
    const item = items.find((i) => i.types.includes("text/html"));
    const html = item ? await (await item.getType("text/html")).text() : "";
    return { text: await clipboard.readText(), html };
  });
  handle("open", open);
  handle("save", save);
  handle("export", async (input: unknown, format: string) => {
    const d = validateDocument(input);
    z.enum(["txt", "md", "html", "docx", "pdf"]).parse(format);
    const target = await pickSave(d, format);
    if (!target) return null;
    const actual = path.extname(target).toLowerCase();
    if (
      format === "pdf"
        ? actual !== ".pdf"
        : editableFormatForPath(target) !== format
    )
      throw new Error(
        "The file extension must match the selected format: ." + format,
      );
    const bytes =
      format === "pdf"
        ? await pdf(d)
        : await documentBytes(d, format as EditableFormat);
    await atomicWrite(target, bytes);
    return target;
  });
  handle("print", async (input: unknown, preview: boolean) => {
    const d = validateDocument(input);
    if (preview) {
      const temp = path.join(
        app.getPath("temp"),
        `BeastText-preview-${crypto.randomUUID()}.pdf`,
      );
      await fs.writeFile(temp, await pdf(d));
      const view = new BrowserWindow({
        width: 1100,
        height: 850,
        title: `${d.title} — Print preview`,
        webPreferences: {
          sandbox: true,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      view.on("closed", () => void fs.unlink(temp).catch(() => {}));
      await view.loadFile(temp);
    } else {
      const { win, temp } = await renderForPrint(d, true);
      try {
        await new Promise<void>((resolve, reject) =>
          win.webContents.print(
            {
              silent: false,
              printBackground: true,
              pageSize: d.page.size,
              landscape: d.page.orientation === "landscape",
              margins: { marginType: "none" },
            },
            (ok, reason) =>
              ok || reason === "cancelled"
                ? resolve()
                : reject(new Error(reason)),
          ),
        );
      } finally {
        win.destroy();
        await fs.unlink(temp).catch(() => {});
      }
    }
  });
  handle("recovery", async (input: unknown, file: string | null) =>
    safety.recover(validateDocument(input), file ? filePath(file) : null),
  );
  handle("clearRecovery", (id: string) =>
    safety.clearRecovery(z.string().uuid().parse(id)),
  );
  handle("settings", async (input: unknown) => {
    preferences.settings = settingsSchema.parse(input);
    const lang = preferences.settings.spellLanguage;
    if (session.defaultSession.availableSpellCheckerLanguages.includes(lang))
      session.defaultSession.setSpellCheckerLanguages([lang]);
    await persist();
  });
  handle("recent", async (action: string, file?: string) => {
    z.enum(["pin", "remove", "clear", "reveal"]).parse(action);
    if (action === "clear") preferences.recent = [];
    else if (action === "remove")
      preferences.recent = preferences.recent.filter((r) => r.path !== file);
    else if (action === "pin")
      preferences.recent = preferences.recent.map((r) =>
        r.path === file ? { ...r, pinned: !r.pinned } : r,
      );
    else if (file) shell.showItemInFolder(filePath(file));
    await persist();
    return preferences.recent;
  });
  handle("image", async () => {
    const r = await dialog.showOpenDialog(main, {
      filters: [
        { name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
      ],
      properties: ["openFile"],
    });
    if (r.canceled) return null;
    const f = r.filePaths[0];
    if ((await fs.stat(f)).size > 25 * 1024 * 1024)
      throw new Error("Choose an image smaller than 25 MB.");
    const image = nativeImage.createFromPath(f);
    if (image.isEmpty()) throw new Error("The image could not be decoded.");
    return { mime: "image/png", data: image.toPNG().toString("base64") };
  });
  handle("template", async (input?: unknown, id?: string) => {
    if (input) {
      const d = validateDocument(input);
      const name =
        d.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 150) ||
        "Template";
      await atomicWrite(
        path.join(root(), "templates", `${name}.beasttext`),
        encodeNative(d),
      );
      return { id: `${name}.beasttext`, name };
    }
    if (id) {
      if (path.basename(id) !== id || !id.endsWith(".beasttext"))
        throw new Error("Invalid template name");
      return decodeNative(
        await fs.readFile(path.join(root(), "templates", id)),
      );
    }
  });
  handle("shell", async (target: string) => {
    z.enum(["logs", "recovery", "backups", "documents"]).parse(target);
    const result = await shell.openPath(
      target === "documents"
        ? app.getPath("documents")
        : path.join(root(), target),
    );
    if (result) throw new Error(result);
  });
  handle("session", async (paths: unknown) => {
    preferences.session = z.array(z.string().max(4096)).max(100).parse(paths);
    await persist();
  });
  if (process.env.BEASTTEXT_DEV_URL === "http://127.0.0.1:5173")
    await main.loadURL(process.env.BEASTTEXT_DEV_URL);
  else await main.loadFile(path.join(__dirname, "../renderer/index.html"));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, args) => {
    if (main) {
      if (main.isMinimized()) main.restore();
      main.focus();
      main.webContents.send(
        "beast:open",
        args.filter((s) => /\.(beasttext|docx|txt|md|html?)$/i.test(s)),
      );
    }
  });
  app
    .whenReady()
    .then(initialise)
    .catch(async (e) => {
      console.error(e.message);
      app.exit(1);
    });
  app.on("window-all-closed", () => app.quit());
}
