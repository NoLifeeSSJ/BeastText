import React, { useState, useEffect, useRef, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import { generateJSON, Editor } from "@tiptap/core";
import { marked } from "marked";
import {
  FileText,
  Plus,
  FolderOpen,
  Save,
  Printer,
  Download,
  Search,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Minus,
  Square,
  Sun,
  Moon,
  Pin,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Image as ImageIcon,
  Table2,
  Link,
  Highlighter,
  Type,
  Heading,
  Quote,
  Code,
  PanelLeft,
  PanelRight,
  Maximize,
  Focus,
  MessageSquare,
  Check,
  Trash2,
  Copy,
  Scissors,
  Clipboard,
  FilePlus2,
  BookOpen,
  Clock,
  ShieldCheck,
  Info,
  RefreshCw,
  CheckSquare,
  Eye,
  Palette,
  WrapText,
  CornerDownLeft,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { BeastDocument, RichNode, Style } from "../shared/model";
import {
  newDocument,
  statistics,
  styleNames,
  cloneAsNew,
  compatibilityNotice,
  textContent,
  validateDocument,
} from "../shared/model";
import { defaults, Settings, Recent, Bootstrap } from "../shared/bridge";
import { templates, fromTemplate } from "../shared/templates";
import { documentCss } from "../shared/html";
import {
  editorExtensions,
  findMatches,
  searchKey,
  sanitiseHtml,
} from "./extensions";
type Tab = {
  key: string;
  doc: BeastDocument;
  path: string | null;
  baseline: string | null;
  dirty: boolean;
  revision: number;
};
type Ask = {
  title: string;
  message?: string;
  fields?: { key: string; label: string; value: string; type?: string }[];
  choices: { label: string; value: string; danger?: boolean }[];
};
type AskFn = (
  options: Ask,
) => Promise<{ choice: string; values: Record<string, string> }>;
function Button({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  children,
  small = false,
}: any) {
  return (
    <button
      className={`tool ${active ? "active" : ""} ${small ? "small" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={17} />} {children}
    </button>
  );
}
function Modal({ ask, resolve }: { ask: Ask; resolve: (r: any) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(
    Object.fromEntries((ask.fields ?? []).map((f) => [f.key, f.value])),
  );
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        resolve({ choice: "cancel", values });
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          resolve({ choice: ask.choices[0].value, values });
        }}
      >
        <h2>{ask.title}</h2>
        {ask.message && <p className="dialog-message">{ask.message}</p>}
        {ask.fields?.map((f) => (
          <label className="field" key={f.key}>
            {f.label}
            <input
              autoFocus={f === ask.fields?.[0]}
              type={f.type ?? "text"}
              value={values[f.key]}
              onChange={(e) =>
                setValues({ ...values, [f.key]: e.target.value })
              }
            />
          </label>
        ))}
        <div className="dialog-actions">
          {ask.choices.map((c, i) => (
            <button
              key={c.value}
              type="button"
              className={c.danger ? "danger" : i === 0 ? "primary" : ""}
              onClick={() => resolve({ choice: c.value, values })}
            >
              {c.label}
            </button>
          ))}
        </div>
      </form>
    </dialog>
  );
}
function SettingsDialog({
  initial,
  spelling,
  onClose,
  onSave,
}: {
  initial: Settings;
  spelling: string[];
  onClose: () => void;
  onSave: (s: Settings) => void;
}) {
  const [s, setS] = useState(initial);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const field = (
    key: keyof Settings,
    label: string,
    type = "text",
    min?: number,
    max?: number,
  ) => (
    <label className="field">
      {label}
      <input
        type={type}
        min={min}
        max={max}
        value={String(s[key])}
        onChange={(e) =>
          setS({
            ...s,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
      />
    </label>
  );
  const check = (key: keyof Settings, label: string) => (
    <label className="check">
      <input
        type="checkbox"
        checked={!!s[key]}
        onChange={(e) => setS({ ...s, [key]: e.target.checked })}
      />
      {label}
    </label>
  );
  return (
    <dialog className="dialog settings-dialog" ref={ref} onCancel={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(s);
        }}
      >
        <div className="section-title">
          <h2>Make yourself at home</h2>
          <button type="button" aria-label="Close settings" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          Preferences apply to this computer. Document settings travel with each
          file.
        </p>
        <div className="settings-grid">
          <label className="field">
            Application theme
            <select
              value={s.theme}
              onChange={(e) => setS({ ...s, theme: e.target.value as any })}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          {field("font", "Default font")}
          {field("fontSize", "Default font size (pt)", "number", 6, 144)}
          <label className="field">
            Default page size
            <select
              value={s.pageSize}
              onChange={(e) => setS({ ...s, pageSize: e.target.value as any })}
            >
              <option>A4</option>
              <option>Letter</option>
            </select>
          </label>
          {field("margin", "Default margins (mm)", "number", 5, 60)}
          {field("saveLocation", "Default save folder (absolute path)")}
          {field(
            "recoverySeconds",
            "Recovery interval (seconds)",
            "number",
            5,
            3600,
          )}
          {field(
            "backupRetention",
            "Backups retained per document",
            "number",
            0,
            50,
          )}
          <label className="field">
            Spelling language
            <select
              value={s.spellLanguage}
              onChange={(e) => setS({ ...s, spellLanguage: e.target.value })}
            >
              {[...new Set([s.spellLanguage, ...spelling])].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <small>
              {spelling.length
                ? "US and UK English dictionaries are bundled for offline spelling."
                : "No local dictionaries reported on this system."}
            </small>
          </label>
          <label className="field">
            Startup
            <select
              value={s.startup}
              onChange={(e) => setS({ ...s, startup: e.target.value as any })}
            >
              <option value="home">Start screen</option>
              <option value="blank">Blank document</option>
            </select>
          </label>
        </div>
        <div className="settings-checks">
          {check("restoreSession", "Restore named documents from last session")}
          {check(
            "autoSave",
            "Also save named documents automatically (recovery stays enabled)",
          )}
          {check("warmPaper", "Warm writing surface")}
          {check("wordCount", "Show word count in status bar")}
          {check("typewriter", "Keep the current paragraph near the centre")}
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={() => setS({ ...defaults })}>
            Reset to defaults
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save preferences
          </button>
        </div>
      </form>
    </dialog>
  );
}
export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]),
    [active, setActive] = useState<string | null>(null),
    [boot, setBoot] = useState<Bootstrap | null>(null),
    [settings, setSettings] = useState<Settings>({ ...defaults }),
    [recents, setRecents] = useState<Recent[]>([]),
    [showSettings, setShowSettings] = useState(false),
    [askState, setAskState] = useState<{
      ask: Ask;
      resolve: (x: any) => void;
    } | null>(null),
    [toast, setToast] = useState(""),
    [recoveries, setRecoveries] = useState<Bootstrap["recoveries"]>([]),
    [userTemplates, setUserTemplates] = useState<
      { id: string; name: string }[]
    >([]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(active);
  activeRef.current = active;
  const initialized = useRef(false);
  const saveLocks = useRef(new Set<string>());
  const notify = useCallback((text: string) => setToast(text), []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const ask = useCallback<AskFn>(
    (options) =>
      new Promise((resolve) => setAskState({ ask: options, resolve })),
    [],
  );
  const run = useCallback(
    async (fn: () => Promise<any>) => {
      try {
        await fn();
      } catch (e: any) {
        notify(
          e.message.replace(
            /^Error invoking remote method '[^']+': Error: /,
            "",
          ),
        );
      }
    },
    [notify],
  );
  useEffect(() => {
    document.documentElement.dataset.theme =
      settings.theme === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : settings.theme;
  }, [settings.theme]);
  const add = useCallback(
    (
      doc: BeastDocument,
      file: string | null = null,
      baseline: string | null = null,
      dirty = false,
    ) => {
      if (tabsRef.current.some((t) => t.doc.id === doc.id))
        doc = cloneAsNew(doc);
      const tab = {
        key: crypto.randomUUID(),
        doc,
        path: file,
        baseline,
        dirty,
        revision: 0,
      };
      setTabs((t) => [...t, tab]);
      setActive(tab.key);
      return tab.key;
    },
    [],
  );
  const create = useCallback(
    (id = "blank") => {
      const d = fromTemplate(id);
      d.styles.Normal.fontFamily = settings.font;
      d.styles.Normal.fontSize = settings.fontSize;
      d.page.size = settings.pageSize;
      d.page.marginLeft =
        d.page.marginRight =
        d.page.marginTop =
        d.page.marginBottom =
          settings.margin;
      add(d, null, null, id !== "blank");
    },
    [settings, add],
  );
  const update = useCallback(
    (key: string, changes: Partial<BeastDocument>) =>
      setTabs((ts) =>
        ts.map((t) =>
          t.key === key
            ? {
                ...t,
                doc: {
                  ...t.doc,
                  ...changes,
                  modified: new Date().toISOString(),
                },
                dirty: true,
                revision: t.revision + 1,
              }
            : t,
        ),
      ),
    [],
  );
  const open = useCallback(
    async (file?: string) => {
      const existing = file
        ? tabsRef.current.find((t) => t.path === file)
        : undefined;
      if (existing) {
        setActive(existing.key);
        return;
      }
      const result = await window.beast.open(file);
      if (!result) return;
      const duplicate = tabsRef.current.find((t) => t.path === result.path);
      if (duplicate) {
        setActive(duplicate.key);
        return;
      }
      let d = result.doc;
      let native = !!d;
      if (!d) {
        d = newDocument(
          result.path
            ?.split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, "") || "Imported document",
        );
        if (result.kind === "text") {
          d.content = {
            type: "doc",
            content: (result.text ?? "").split(/\r?\n/).map((text) => ({
              type: "paragraph",
              content: text ? [{ type: "text", text }] : undefined,
            })),
          };
        } else {
          const input =
            result.kind === "markdown"
              ? await marked.parse(result.text ?? "")
              : (result.html ?? result.text ?? "");
          const safe = sanitiseHtml(input, d);
          d.content = generateJSON(
            safe.html,
            editorExtensions(() => d!),
          ) as RichNode;
          if (safe.skippedImages)
            result.warnings.push(
              `${safe.skippedImages} remote or unsupported images were removed; remote content is never fetched.`,
            );
        }
        const page = (result as any).page;
        if (page) {
          if (page.width && page.height) {
            d.page.orientation =
              page.width > page.height ? "landscape" : "portrait";
            d.page.size =
              Math.abs(Math.min(page.width, page.height) - 12240) < 150
                ? "Letter"
                : "A4";
          }
          for (const [key, field] of [
            ["top", "marginTop"],
            ["bottom", "marginBottom"],
            ["left", "marginLeft"],
            ["right", "marginRight"],
          ])
            if (page[key])
              (d.page as any)[field] = Math.min(
                60,
                Math.max(5, (page[key] * 25.4) / 1440),
              );
        }
      }
      validateDocument(d);
      add(
        d,
        native ? result.path : null,
        native ? result.fingerprint : null,
        !native,
      );
      setRecents((await window.beast.bootstrap()).recent);
      if (result.warnings.length)
        await ask({
          title: "Import compatibility",
          message: result.warnings.join("\n\n"),
          choices: [{ label: "Continue editing", value: "ok" }],
        });
    },
    [add, ask],
  );
  const save = useCallback(
    async (key = activeRef.current, mode: "save" | "as" | "copy" = "save") => {
      const t = tabsRef.current.find((t) => t.key === key);
      if (!t || saveLocks.current.has(t.key)) return false;
      saveLocks.current.add(t.key);
      try {
        const result = await window.beast.save(t.doc, t.path, t.baseline, mode);
        if (!result) return false;
        if (mode !== "copy")
          setTabs((ts) =>
            ts.map((x) =>
              x.key === t.key
                ? {
                    ...x,
                    path: result.path,
                    baseline: result.fingerprint,
                    dirty: x.revision !== t.revision,
                  }
                : x,
            ),
          );
        notify(
          mode === "copy"
            ? "A separate copy was saved."
            : "Document saved safely.",
        );
        setRecents((await window.beast.bootstrap()).recent);
        return true;
      } finally {
        saveLocks.current.delete(t.key);
      }
    },
    [notify],
  );
  const closeTab = useCallback(
    async (key: string) => {
      const t = tabsRef.current.find((t) => t.key === key);
      if (!t) return true;
      if (t.dirty) {
        const answer = await ask({
          title: `Save changes to “${t.doc.title}”?`,
          message:
            "Your document has changes that have not been saved to its file.",
          choices: [
            { label: "Save document", value: "save" },
            { label: "Discard changes", value: "discard", danger: true },
            { label: "Cancel", value: "cancel" },
          ],
        });
        if (answer.choice === "cancel") return false;
        if (answer.choice === "save" && !(await save(key))) return false;
      }
      await window.beast.clearRecovery(t.doc.id);
      const remaining = tabsRef.current.filter((t) => t.key !== key);
      tabsRef.current = remaining;
      setTabs(remaining);
      if (activeRef.current === key) setActive(remaining.at(-1)?.key ?? null);
      return true;
    },
    [ask, save],
  );
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void run(async () => {
      const b = await window.beast.bootstrap();
      setBoot(b);
      setSettings(b.settings);
      setRecents(b.recent);
      setRecoveries(b.recoveries);
      setUserTemplates(b.templates);
      const files = [
        ...new Set([...((b as any).launchPaths ?? []), ...b.session]),
      ];
      for (const f of files) await run(() => open(f));
      if (!files.length && b.settings.startup === "blank") {
        const d = fromTemplate("blank");
        d.styles.Normal.fontFamily = b.settings.font;
        d.styles.Normal.fontSize = b.settings.fontSize;
        add(d);
      }
    });
  }, [run, open, add]);
  useEffect(
    () =>
      window.beast.onOpen((files) => {
        for (const f of files) void run(() => open(f));
      }),
    [open, run],
  );
  useEffect(
    () =>
      window.beast.onClose(
        () =>
          void run(async () => {
            const named = tabsRef.current
              .map((t) => t.path)
              .filter(Boolean) as string[];
            for (const t of [...tabsRef.current])
              if (!(await closeTab(t.key))) return;
            await window.beast.session(named);
            window.beast.closeReady();
          }),
      ),
    [closeTab, run],
  );
  useEffect(() => {
    const timer = setInterval(
      () =>
        void run(async () => {
          for (const t of tabsRef.current.filter((t) => t.dirty)) {
            await window.beast.recovery(t.doc, t.path);
            if (settings.autoSave && t.path) await save(t.key);
          }
          if (tabsRef.current.some((t) => t.dirty))
            notify(
              "Recovery snapshot updated. Your document file is unchanged unless automatic saving is enabled.",
            );
        }),
      settings.recoverySeconds * 1000,
    );
    return () => clearInterval(timer);
  }, [settings.recoverySeconds, settings.autoSave, save, run, notify]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("dialog")) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = e.key.toLowerCase();
      if (["n", "o", "s", "p", "w", "tab"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        if (k === "n") create();
        if (k === "o") void run(() => open());
        if (k === "s")
          void run(() => save(activeRef.current, e.shiftKey ? "as" : "save"));
        if (k === "p") {
          const t = tabsRef.current.find((t) => t.key === activeRef.current);
          if (t) void run(() => window.beast.print(t.doc, false));
        }
        if (k === "w" && activeRef.current)
          void run(() => closeTab(activeRef.current!));
        if (k === "tab") {
          const index = tabsRef.current.findIndex(
            (t) => t.key === activeRef.current,
          );
          setActive(
            tabsRef.current[
              (index + (e.shiftKey ? -1 : 1) + tabsRef.current.length) %
                tabsRef.current.length
            ]?.key ?? null,
          );
        }
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [create, open, save, closeTab, run]);
  const action = async (name: string, format?: string) => {
    const tab = tabsRef.current.find((t) => t.key === activeRef.current);
    if (name === "new") return create();
    if (name === "open") return open();
    if (name === "home") return setActive(null);
    if (name === "settings") return setShowSettings(true);
    if (name === "save") return save();
    if (name === "as" || name === "copy") return save(activeRef.current, name);
    if (name === "close" && tab) return closeTab(tab.key);
    if (name === "about")
      return ask({
        title: `BeastText ${boot?.version ?? "1.0.0"}`,
        message:
          "An independent, offline writing workspace.\n\nElectron + Tiptap / ProseMirror. Continuous editing; accurate pagination in PDF print preview. No tracked changes or floating layouts. DOCX is a defined conversion subset.\n\nSee docs/COMPATIBILITY.md and docs/TESTING.md for support and verification details.",
        choices: [{ label: "Got it", value: "ok" }],
      });
    if (!tab) return;
    if (name === "print" || name === "preview")
      return window.beast.print(tab.doc, name === "preview");
    if (name === "export") {
      const needsNotice = ["docx", "md", "txt"].includes(format ?? "");
      if (needsNotice) {
        const r = await ask({
          title: `Export ${format?.toUpperCase()}`,
          message:
            format === "docx"
              ? compatibilityNotice
              : format === "txt"
                ? "Plain text contains text only. Formatting, images, comments and page settings are omitted."
                : "Markdown preserves headings, emphasis, lists, links and code. Tables, comments, page layout and custom styles have limited or no representation.",
          choices: [
            { label: "Export a copy", value: "ok" },
            { label: "Cancel", value: "cancel" },
          ],
        });
        if (r.choice !== "ok") return;
      }
      const result = await window.beast.export(tab.doc, format as any);
      if (result) notify(`Exported ${format?.toUpperCase()} to ${result}`);
    }
    if (name === "template") {
      const result = await window.beast.template(tab.doc);
      setUserTemplates((ts) => [
        ...ts.filter((t) => t.id !== result.id),
        result,
      ]);
      notify("Saved as a reusable template.");
    }
  };
  const updateRecent = (a: "pin" | "remove" | "clear" | "reveal", p?: string) =>
    void run(async () => setRecents(await window.beast.recent(a, p)));
  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
          const p = window.beast.pathForFile(file);
          if (p) void run(() => open(p));
          else notify("Use Open document to select this file.");
        }
      }}
    >
      <header className="titlebar">
        <button
          className="brand"
          onClick={() => setActive(null)}
          title="BeastText home"
        >
          <span className="brand-symbol">
            B<span>t</span>
          </span>
          <span>
            Beast<span className="brand-text">Text</span>
          </span>
        </button>
        <span className="titlebar-caption">
          {active
            ? tabs.find((t) => t.key === active)?.doc.title
            : "Your space to write"}{" "}
          {active && tabs.find((t) => t.key === active)?.dirty ? "•" : ""}
        </span>
        <div className="titlebar-actions">
          <button
            aria-label="Minimise window"
            onClick={() => window.beast.minimise()}
          >
            <Minus size={15} />
          </button>
          <button
            aria-label="Maximise or restore window"
            onClick={() => window.beast.maximise()}
          >
            <Square size={13} />
          </button>
          <button
            className="window-close"
            aria-label="Close window"
            onClick={() => window.beast.close()}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      {tabs.length > 0 && (
        <div className="tabbar" role="tablist">
          <button
            className={!active ? "home-tab active" : "home-tab"}
            aria-label="Start screen"
            onClick={() => setActive(null)}
          >
            <FileText size={16} />
          </button>
          {tabs.map((t) => (
            <div
              key={t.key}
              className={`document-tab ${active === t.key ? "selected" : ""}`}
            >
              <button
                role="tab"
                aria-selected={active === t.key}
                onClick={() => setActive(t.key)}
              >
                <FileText size={14} />
                <span>{t.doc.title}</span>
                {t.dirty && (
                  <span className="dirty-dot" aria-label="Unsaved changes" />
                )}
              </button>
              <button
                aria-label={`Close ${t.doc.title}`}
                onClick={() => void run(() => closeTab(t.key))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            className="add-tab"
            aria-label="New document (Ctrl+N)"
            onClick={() => create()}
          >
            <Plus size={17} />
          </button>
        </div>
      )}
      {!active ? (
        <div className="start-screen">
          <aside className="start-sidebar">
            <div className="workspace-label">YOUR WORKSPACE</div>
            <button className="sidebar-link selected">
              <FileText size={18} /> Documents
            </button>
            <button
              className="sidebar-link"
              onClick={() => void run(() => open())}
            >
              <FolderOpen size={18} /> Open a document <span>Ctrl O</span>
            </button>
            <div className="sidebar-bottom">
              <div className="offline-note">
                <span className="online-dot" /> Offline, and all yours
              </div>
              <button
                className="sidebar-link"
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon size={17} /> Settings
              </button>
              <button
                className="sidebar-link"
                onClick={() => void run(() => action("about"))}
              >
                <Info size={17} /> About BeastText
              </button>
            </div>
          </aside>
          <main className="start-content">
            <div className="welcome-top">
              <div>
                <span className="eyebrow">A LITTLE SPACE. A BIG IDEA.</span>
                <h1>What will you write today?</h1>
                <p className="muted">
                  From the first thought to the final draft. Make it yours.
                </p>
              </div>
              <button className="primary" onClick={() => create()}>
                <Plus size={17} /> New document
              </button>
            </div>
            {recoveries.length > 0 && (
              <section className="recovery-banner">
                <ShieldCheck size={23} />
                <div>
                  <strong>Pick up where you left off</strong>
                  <p>
                    {recoveries.length} recovery snapshot
                    {recoveries.length === 1 ? "" : "s"} available. These are
                    separate from saved files.
                  </p>
                  {recoveries.map((r) => (
                    <div className="recovery-item" key={r.doc.id}>
                      <span>
                        {r.doc.title} ·{" "}
                        {new Date(
                          r.modified || r.doc.modified,
                        ).toLocaleString()}
                      </span>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const d = cloneAsNew(r.doc);
                            await window.beast.recovery(d, null);
                            add(d, null, null, true);
                            setRecoveries((rs) =>
                              rs.filter((x) => x.doc.id !== r.doc.id),
                            );
                            await window.beast.clearRecovery(r.doc.id);
                          })
                        }
                      >
                        Recover as new
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const answer = await ask({
                              title: "Discard recovery snapshot?",
                              message:
                                "This removes this recovery version only. Any saved document is kept.",
                              choices: [
                                {
                                  label: "Discard snapshot",
                                  value: "discard",
                                  danger: true,
                                },
                                { label: "Cancel", value: "cancel" },
                              ],
                            });
                            if (answer.choice === "discard") {
                              await window.beast.clearRecovery(r.doc.id);
                              setRecoveries((rs) =>
                                rs.filter((x) => x.doc.id !== r.doc.id),
                              );
                            }
                          })
                        }
                      >
                        Discard
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="section-title">
              <h2>Start with a little inspiration</h2>
              <span className="muted">Made for your everyday writing</span>
            </div>
            <div className="template-grid">
              {templates.map((t, i) => (
                <button
                  key={t.id}
                  className={`template-card template-${i % 4}`}
                  onClick={() => create(t.id)}
                >
                  <div className="template-paper">
                    {t.id === "blank" ? (
                      <Plus size={26} />
                    ) : (
                      <>
                        <div className="paper-title" />
                        {[1, 2, 3, 4, 5].map((n) => (
                          <div className={`paper-line line-${n}`} key={n} />
                        ))}
                        {["minutes", "proposal", "guide"].includes(t.id) && (
                          <div className="paper-table" />
                        )}
                      </>
                    )}
                  </div>
                  <span className="template-name">{t.name}</span>
                  <small>{t.description}</small>
                </button>
              ))}
            </div>
            {userTemplates.length > 0 && (
              <>
                <h2>Your templates</h2>
                <div className="user-templates">
                  {userTemplates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() =>
                        void run(async () => {
                          const d = await window.beast.template(
                            undefined,
                            t.id,
                          );
                          add(cloneAsNew(d), null, null, true);
                        })
                      }
                    >
                      <FilePlus2 size={19} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="section-title recent-heading">
              <h2>Recent documents</h2>
              {recents.length > 0 && (
                <button
                  className="text-button"
                  onClick={() => updateRecent("clear")}
                >
                  Clear list
                </button>
              )}
            </div>
            {recents.length === 0 ? (
              <div className="empty-recents">
                <div>
                  <Clock size={22} />
                </div>
                <strong>Your next chapter starts here</strong>
                <p>
                  Documents you open will appear here. Your files stay on your
                  computer.
                </p>
                <button
                  className="text-button"
                  onClick={() => void run(() => open())}
                >
                  Open a document <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <div className="recent-list">
                {[...recents]
                  .sort((a, b) => Number(b.pinned) - Number(a.pinned))
                  .map((r) => (
                    <div className="recent-row" key={r.path}>
                      <div className="recent-icon">
                        <FileText size={22} />
                      </div>
                      <button
                        className="recent-name"
                        onClick={() => void run(() => open(r.path))}
                      >
                        <strong>{r.name}</strong>
                        <small>{r.path}</small>
                      </button>
                      <time>{new Date(r.opened).toLocaleString()}</time>
                      <button
                        title="Pin recent document"
                        aria-label={`Pin ${r.name}`}
                        className={r.pinned ? "pinned" : ""}
                        onClick={() => updateRecent("pin", r.path)}
                      >
                        <Pin size={16} />
                      </button>
                      <button
                        title="Reveal in File Explorer"
                        onClick={() => updateRecent("reveal", r.path)}
                      >
                        <FolderOpen size={16} />
                      </button>
                      <button
                        title="Remove from recent list"
                        onClick={() => updateRecent("remove", r.path)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
            <div className="home-footer">
              <span className="brand-symbol mini">
                B<span>t</span>
              </span>
              <span>Thoughtfully made for the words that matter.</span>
              <span>BeastText {boot?.version}</span>
            </div>
          </main>
        </div>
      ) : null}
      {tabs.map((t) => (
        <div
          className="workspace-container"
          key={t.key}
          hidden={active !== t.key}
        >
          <Workspace
            tab={t}
            active={active === t.key}
            settings={settings}
            update={(changes) => update(t.key, changes)}
            action={(name, format) => void run(() => action(name, format))}
            ask={ask}
            notify={notify}
            run={run}
          />
        </div>
      ))}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {askState && (
        <Modal
          key={askState.ask.title}
          ask={askState.ask}
          resolve={(r) => {
            askState.resolve(r);
            setAskState(null);
          }}
        />
      )}
      {showSettings && (
        <SettingsDialog
          initial={settings}
          spelling={boot?.spelling ?? []}
          onClose={() => setShowSettings(false)}
          onSave={(s) =>
            void run(async () => {
              await window.beast.settings(s);
              setSettings(s);
              setShowSettings(false);
              notify("Preferences saved.");
            })
          }
        />
      )}
    </div>
  );
}
function Workspace({
  tab,
  active,
  settings,
  update,
  action,
  ask,
  notify,
  run,
}: {
  tab: Tab;
  active: boolean;
  settings: Settings;
  update: (changes: Partial<BeastDocument>) => void;
  action: (name: string, format?: string) => void;
  ask: AskFn;
  notify: (text: string) => void;
  run: (fn: () => Promise<any>) => Promise<void>;
}) {
  const docRef = useRef(tab.doc);
  docRef.current = tab.doc;
  const [shelf, setShelf] = useState("Home"),
    [outline, setOutline] = useState(true),
    [properties, setProperties] = useState(false),
    [focus, setFocus] = useState(false),
    [zoom, setZoom] = useState(100),
    [search, setSearch] = useState(false),
    [replace, setReplace] = useState(false),
    [query, setQuery] = useState(""),
    [replacement, setReplacement] = useState(""),
    [matchCase, setMatchCase] = useState(false),
    [wholeWord, setWholeWord] = useState(false),
    [matchIndex, setMatchIndex] = useState(0),
    [tick, setTick] = useState(0),
    [counts, setCounts] = useState(statistics(tab.doc.content)),
    [reviewPanel, setReviewPanel] = useState(false),
    [selectedText, setSelectedText] = useState("");
  const docScroll = useRef<HTMLDivElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editor = useEditor(
    {
      extensions: editorExtensions(() => docRef.current),
      content: tab.doc.content,
      editorProps: {
        attributes: {
          class: "beast-editor",
          spellcheck: "true",
          "aria-label": "Document editor",
          "data-testid": "document-editor",
        },
        transformPastedHTML: (html) => {
          const safe = sanitiseHtml(html, docRef.current);
          update({ assets: { ...docRef.current.assets } });
          if (safe.skippedImages)
            notify("Remote images were removed from pasted content.");
          return safe.html;
        },
        handlePaste: (_view, event) => {
          const image = Array.from(event.clipboardData?.files ?? []).find((f) =>
            f.type.startsWith("image/"),
          );
          if (image) {
            event.preventDefault();
            void run(() => insertImage(image));
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const content = editor.getJSON() as RichNode;
        update({ content });
        setTick((t) => t + 1);
        if (countTimer.current) clearTimeout(countTimer.current);
        countTimer.current = setTimeout(
          () =>
            setCounts(
              statistics(
                content,
                editor.state.doc.textBetween(
                  editor.state.selection.from,
                  editor.state.selection.to,
                  " ",
                ),
              ),
            ),
          150,
        );
      },
      onSelectionUpdate: ({ editor }) => {
        setSelectedText(
          editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            " ",
          ),
        );
        setTick((t) => t + 1);
      },
    },
    [tab.key],
  );
  useEffect(
    () => () => {
      if (countTimer.current) clearTimeout(countTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (active && editor) editor.commands.focus();
  }, [active, editor]);
  useEffect(() => {
    if (search) setTimeout(() => searchInput.current?.focus(), 30);
  }, [search]);
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(searchKey, {
        query: search ? query : "",
        matchCase,
        wholeWord,
      }),
    );
    setMatchIndex(0);
  }, [editor, query, matchCase, wholeWord, search]);
  const matches =
    editor && search
      ? findMatches(editor.state.doc, { query, matchCase, wholeWord })
      : [];
  const jump = (direction: number) => {
    if (!editor || !matches.length) return;
    const i = (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(i);
    editor.chain().focus().setTextSelection(matches[i]).scrollIntoView().run();
  };
  useEffect(() => {
    if (!active || !editor) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("dialog")) return;
      if (
        (e.ctrlKey || e.metaKey) &&
        ["f", "h", "k"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "k") void run(link);
        else {
          setSearch(true);
          setReplace(e.key.toLowerCase() === "h");
        }
      }
      if (e.key === "Escape") {
        setFocus(false);
        setSearch(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, editor]);
  useEffect(() => {
    if (settings.typewriter && editor && active) {
      const dom = editor.view.domAtPos(editor.state.selection.head).node;
      const element =
        dom.nodeType === 1 ? (dom as HTMLElement) : dom.parentElement;
      element?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [tick, settings.typewriter, editor, active]);
  async function insertImage(file?: File) {
    if (!editor) return;
    let raw: { mime: string; data: string } | null;
    if (file) {
      if (file.size > 25 * 1024 * 1024)
        throw new Error("Choose an image smaller than 25 MB.");
      raw = {
        mime: file.type,
        data: await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1]);
          r.onerror = reject;
          r.readAsDataURL(file);
        }),
      };
    } else raw = await window.beast.image();
    if (!raw) return;
    const img = new window.Image();
    img.src = `data:${raw.mime};base64,${raw.data}`;
    await img.decode();
    let source = raw;
    if (img.width > 2400 || img.height > 2400) {
      const answer = await ask({
        title: "Optimise this image?",
        message: `This image is ${img.width} × ${img.height} pixels. Reducing it to 2400 pixels on its longest side saves space while keeping print quality for ordinary document use.`,
        choices: [
          { label: "Optimise image", value: "yes" },
          { label: "Keep original", value: "no" },
          { label: "Cancel", value: "cancel" },
        ],
      });
      if (answer.choice === "cancel") return;
      if (answer.choice === "yes") {
        const canvas = document.createElement("canvas"),
          scale = 2400 / Math.max(img.width, img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        source = {
          mime: "image/png",
          data: canvas.toDataURL("image/png").split(",")[1],
        };
      }
    }
    const id = crypto.randomUUID();
    const assets = { ...docRef.current.assets, [id]: source as any };
    docRef.current = { ...docRef.current, assets };
    update({ assets });
    const width = Math.min(img.width, 550);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: `beast-asset:${id}`,
          alt: "",
          title: "",
          width,
          height: Math.round((width * img.height) / img.width),
        },
      })
      .run();
  }
  async function link() {
    if (!editor) return;
    const answer = await ask({
      title: "Insert or edit hyperlink",
      fields: [
        {
          key: "url",
          label: "URL, email (mailto:), or heading anchor (#id)",
          value: editor.getAttributes("link").href ?? "https://",
        },
      ],
      choices: [
        { label: "Apply link", value: "apply" },
        { label: "Remove link", value: "remove" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (answer.choice === "remove")
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    if (answer.choice === "apply") {
      const url = answer.values.url.trim();
      if (!/^(https?:\/\/|mailto:|#[\w-])/i.test(url))
        throw new Error("Use an https://, http://, mailto: or #heading link.");
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  }
  async function comment() {
    if (!editor) return;
    if (editor.state.selection.empty)
      throw new Error("Select some text to anchor a comment.");
    const answer = await ask({
      title: "Add comment",
      fields: [
        { key: "text", label: "Your comment", value: "" },
        {
          key: "author",
          label: "Author",
          value: docRef.current.metadata.author || "Me",
        },
      ],
      choices: [
        { label: "Add comment", value: "add" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (answer.choice !== "add" || !answer.values.text.trim()) return;
    const id = crypto.randomUUID();
    editor.chain().focus().setMark("comment", { commentId: id }).run();
    update({
      comments: [
        ...docRef.current.comments,
        {
          id,
          text: answer.values.text.trim(),
          author: answer.values.author.slice(0, 100),
          created: new Date().toISOString(),
          resolved: false,
        },
      ],
    });
    setReviewPanel(true);
    setProperties(true);
  }
  async function insertTable() {
    if (!editor) return;
    const answer = await ask({
      title: "Insert a table",
      fields: [
        { key: "rows", label: "Rows (1–50)", value: "3", type: "number" },
        { key: "columns", label: "Columns (1–12)", value: "3", type: "number" },
      ],
      choices: [
        { label: "Insert table", value: "insert" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (answer.choice !== "insert") return;
    const rows = Number(answer.values.rows),
      cols = Number(answer.values.columns);
    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(cols) ||
      rows < 1 ||
      rows > 50 ||
      cols < 1 ||
      cols > 12
    )
      throw new Error("Use 1–50 rows and 1–12 columns.");
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
  }
  async function rename() {
    const r = await ask({
      title: "Name your document",
      fields: [
        { key: "title", label: "Document title", value: docRef.current.title },
      ],
      choices: [
        { label: "Rename", value: "rename" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (r.choice === "rename" && r.values.title.trim())
      update({ title: r.values.title.slice(0, 250) });
  }
  async function headerFooter() {
    const r = await ask({
      title: "Headers & footers",
      message:
        "Shown in paginated PDF preview, exported PDF and DOCX. Page fields are generated by the print engine.",
      fields: [
        {
          key: "header",
          label: "Header text",
          value: docRef.current.page.header,
        },
        {
          key: "footer",
          label: "Footer text",
          value: docRef.current.page.footer,
        },
      ],
      choices: [
        { label: "Apply", value: "apply" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (r.choice === "apply")
      update({
        page: {
          ...docRef.current.page,
          header: r.values.header.slice(0, 500),
          footer: r.values.footer.slice(0, 500),
        },
      });
  }
  async function modifyStyle() {
    const name = currentStyle;
    const s = docRef.current.styles[name] ?? docRef.current.styles.Normal;
    const r = await ask({
      title: `Modify ${name} style`,
      message:
        "Updates every paragraph using this style. Direct formatting still takes precedence.",
      fields: [
        { key: "fontFamily", label: "Font family", value: s.fontFamily },
        {
          key: "fontSize",
          label: "Size in points (6–144)",
          value: String(s.fontSize),
          type: "number",
        },
        { key: "color", label: "Text colour", value: s.color, type: "color" },
        {
          key: "lineHeight",
          label: "Line spacing (1–3)",
          value: String(s.lineHeight),
        },
        {
          key: "spaceBefore",
          label: "Space before (pt)",
          value: String(s.spaceBefore),
          type: "number",
        },
        {
          key: "spaceAfter",
          label: "Space after (pt)",
          value: String(s.spaceAfter),
          type: "number",
        },
      ],
      choices: [
        { label: "Update style", value: "update" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (r.choice !== "update") return;
    const style = {
      fontFamily: r.values.fontFamily,
      fontSize: Number(r.values.fontSize),
      color: r.values.color,
      lineHeight: Number(r.values.lineHeight),
      spaceBefore: Number(r.values.spaceBefore),
      spaceAfter: Number(r.values.spaceAfter),
    };
    if (
      style.fontSize < 6 ||
      style.fontSize > 144 ||
      style.lineHeight < 1 ||
      style.lineHeight > 3 ||
      style.spaceBefore < 0 ||
      style.spaceBefore > 100 ||
      style.spaceAfter < 0 ||
      style.spaceAfter > 100
    )
      throw new Error("Check the style size, spacing and paragraph values.");
    update({ styles: { ...docRef.current.styles, [name]: style } });
  }
  function applyStyle(name: string) {
    if (!editor) return;
    const c = editor.chain().focus();
    if (name.startsWith("Heading"))
      c.setHeading({ level: Number(name.slice(-1)) as 1 | 2 | 3 })
        .updateAttributes("heading", { styleName: name })
        .run();
    else if (name === "Code block")
      c.setCodeBlock().updateAttributes("codeBlock", { styleName: name }).run();
    else if (name === "Quote")
      c.setParagraph()
        .updateAttributes("paragraph", { styleName: name })
        .toggleBlockquote()
        .run();
    else
      c.setParagraph().updateAttributes("paragraph", { styleName: name }).run();
  }
  function insertDocumentBlock(content: RichNode[]) {
    if (!editor) return;
    let pos = editor.state.selection.to;
    const from = editor.state.selection.$from;
    for (let depth = from.depth; depth > 0; depth--)
      if (from.node(depth).type.name === "table") pos = from.after(depth);
    editor.view.dispatch(closeHistory(editor.state.tr));
    editor.chain().focus().insertContentAt(pos, content).run();
  }
  function paragraphChange(attrs: Record<string, any>) {
    if (!editor) return;
    for (const [key, value] of Object.entries(attrs)) {
      if (
        (["spaceBefore", "spaceAfter"].includes(key) &&
          (value < 0 || value > 100)) ||
        (key === "lineHeight" && (value < 1 || value > 3))
      ) {
        notify(
          "Use paragraph spacing from 0–100 pt and line spacing from 1–3.",
        );
        return;
      }
    }
    const name = editor.isActive("heading")
      ? "heading"
      : editor.isActive("codeBlock")
        ? "codeBlock"
        : "paragraph";
    editor.chain().focus().updateAttributes(name, attrs).run();
  }
  function changeCase(mode: "upper" | "lower" | "title") {
    if (!editor || editor.state.selection.empty) {
      notify("Select text to change its case.");
      return;
    }
    const { from, to } = editor.state.selection;
    const changes: { from: number; to: number; text: string; marks: any }[] =
      [];
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return;
      const start = Math.max(from, pos),
        end = Math.min(to, pos + node.nodeSize);
      const text = node.text!.slice(start - pos, end - pos);
      changes.push({
        from: start,
        to: end,
        text:
          mode === "upper"
            ? text.toLocaleUpperCase()
            : mode === "lower"
              ? text.toLocaleLowerCase()
              : text.replace(
                  /\p{L}[\p{L}'’-]*/gu,
                  (w) =>
                    w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase(),
                ),
        marks: node.marks,
      });
    });
    const tr = closeHistory(editor.state.tr);
    for (const c of changes.reverse())
      tr.replaceWith(c.from, c.to, editor.schema.text(c.text, c.marks));
    editor.view.dispatch(tr);
    editor.commands.focus();
  }
  function removeComment(id: string) {
    if (!editor) return;
    const tr = editor.state.tr;
    editor.state.doc.descendants((n, pos) => {
      if (
        n.isText &&
        n.marks.some(
          (m) => m.type.name === "comment" && m.attrs.commentId === id,
        )
      )
        tr.removeMark(pos, pos + n.nodeSize, editor.schema.marks.comment);
    });
    editor.view.dispatch(tr);
    update({ comments: docRef.current.comments.filter((c) => c.id !== id) });
  }
  function navigateComment(id: string) {
    if (!editor) return;
    let from = -1,
      to = -1;
    editor.state.doc.descendants((n, pos) => {
      if (
        n.isText &&
        n.marks.some(
          (m) => m.type.name === "comment" && m.attrs.commentId === id,
        )
      ) {
        if (from < 0) from = pos;
        to = pos + n.nodeSize;
      }
    });
    if (from >= 0)
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .scrollIntoView()
        .run();
    else
      notify(
        "The text anchoring this comment has been deleted. The comment has been retained.",
      );
  }
  if (!editor) return null;
  const currentAttrs = editor.getAttributes(
    editor.isActive("heading")
      ? "heading"
      : editor.isActive("codeBlock")
        ? "codeBlock"
        : "paragraph",
  );
  const currentStyle = currentAttrs.styleName ?? "Normal";
  const imageAttrs = editor.getAttributes("image");
  const isImage = editor.isActive("image");
  const isTable = editor.isActive("table");
  const headings: { text: string; level: number; pos: number; id: string }[] =
    [];
  editor.state.doc.descendants((n, pos) => {
    if (n.type.name === "heading")
      headings.push({
        text: n.textContent || "Untitled heading",
        level: n.attrs.level,
        pos,
        id: n.attrs.id,
      });
  });
  const command = (fn: () => any) => () => {
    try {
      fn();
    } catch (e: any) {
      notify(e.message);
    }
  };
  const formatButton = (
    Icon: any,
    label: string,
    mark: string,
    fn: () => any,
  ) => (
    <Button
      icon={Icon}
      label={label}
      active={editor.isActive(mark)}
      onClick={command(fn)}
    />
  );
  const selectedCounts = statistics({ type: "doc" }, selectedText);
  return (
    <div className={`workspace ${focus ? "focus-mode" : ""}`}>
      <div className="commandbar">
        <button
          className="file-tab"
          onClick={() => setShelf(shelf === "File" ? "Home" : "File")}
        >
          File <ChevronDown size={13} />
        </button>
        {["Home", "Insert", "Layout", "Review", "View"].map((name) => (
          <button
            className={shelf === name ? "current" : ""}
            key={name}
            onClick={() => setShelf(name)}
          >
            {name}
          </button>
        ))}
        <div className="quick-actions">
          <Button
            icon={Undo2}
            label="Undo (Ctrl+Z)"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <Button
            icon={Redo2}
            label="Redo (Ctrl+Y)"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          />
          <span className="quick-divider" />
          <Button
            icon={Save}
            label="Save (Ctrl+S)"
            onClick={() => action("save")}
          />
          <Button
            icon={Printer}
            label="Print (Ctrl+P)"
            onClick={() => action("print")}
          />
          <button className="export-button" onClick={() => setShelf("File")}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>
      <div className="ribbon" aria-label={`${shelf} commands`}>
        {shelf === "File" ? (
          <>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={FilePlus2}
                  label="New document (Ctrl+N)"
                  onClick={() => action("new")}
                >
                  New
                </Button>
                <Button
                  icon={FolderOpen}
                  label="Open (Ctrl+O)"
                  onClick={() => action("open")}
                >
                  Open
                </Button>
                <Button
                  icon={Save}
                  label="Save (Ctrl+S)"
                  onClick={() => action("save")}
                >
                  Save
                </Button>
                <Button
                  icon={Copy}
                  label="Save As (Ctrl+Shift+S)"
                  onClick={() => action("as")}
                >
                  Save As
                </Button>
                <Button
                  icon={Copy}
                  label="Save a Copy"
                  onClick={() => action("copy")}
                >
                  Save a copy
                </Button>
              </div>
              <small>Document</small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                {["docx", "pdf", "html", "md", "txt"].map((f) => (
                  <button
                    className="format-export"
                    key={f}
                    onClick={() => action("export", f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <small>Export a separate file</small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={Eye}
                  label="Paginated print preview"
                  onClick={() => action("preview")}
                >
                  Preview
                </Button>
                <Button
                  icon={Printer}
                  label="Print document"
                  onClick={() => action("print")}
                />
                <Button
                  icon={FilePlus2}
                  label="Save as reusable template"
                  onClick={() => action("template")}
                />
                <Button
                  icon={X}
                  label="Close current document"
                  onClick={() => action("close")}
                />
              </div>
              <small>Finish & share</small>
            </div>
          </>
        ) : null}
        {shelf === "Home" ? (
          <>
            <div className="ribbon-group clipboard-group">
              <div className="tool-row">
                <Button
                  icon={Scissors}
                  label="Cut (Ctrl+X)"
                  onClick={() => {
                    editor.commands.focus();
                    document.execCommand("cut");
                  }}
                />
                <Button
                  icon={Copy}
                  label="Copy (Ctrl+C)"
                  onClick={() => {
                    editor.commands.focus();
                    document.execCommand("copy");
                  }}
                />
                <Button
                  icon={Clipboard}
                  label="Paste (Ctrl+V)"
                  onClick={() =>
                    void run(async () => {
                      const c = await window.beast.clipboard();
                      const safe = c.html
                        ? sanitiseHtml(c.html, docRef.current)
                        : null;
                      if (safe) {
                        update({ assets: { ...docRef.current.assets } });
                        editor.chain().focus().insertContent(safe.html).run();
                      } else
                        editor
                          .chain()
                          .focus()
                          .insertContent(
                            c.text.split("\n").map((text: string) => ({
                              type: "paragraph",
                              content: text ? [{ type: "text", text }] : [],
                            })),
                          )
                          .run();
                    })
                  }
                />
              </div>
              <small>Clipboard</small>
            </div>
            <div className="ribbon-group font-group">
              <div className="tool-row">
                <select
                  aria-label="Font family"
                  value={editor.getAttributes("textStyle").fontFamily ?? ""}
                  onChange={(e) =>
                    editor.chain().focus().setFontFamily(e.target.value).run()
                  }
                >
                  <option value="">Mixed / style font</option>
                  {[
                    "Aptos",
                    "Arial",
                    "Calibri",
                    "Cambria",
                    "Georgia",
                    "Times New Roman",
                    "Verdana",
                    "Consolas",
                    "Segoe UI",
                  ].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                <input
                  aria-label="Font size"
                  type="number"
                  min={6}
                  max={144}
                  placeholder="12"
                  defaultValue={
                    parseFloat(editor.getAttributes("textStyle").fontSize) ||
                    tab.doc.styles[currentStyle]?.fontSize ||
                    12
                  }
                  key={editor.getAttributes("textStyle").fontSize ?? "size"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const size = Number(e.currentTarget.value);
                      if (size >= 6 && size <= 144)
                        editor.chain().focus().setFontSize(`${size}pt`).run();
                    }
                  }}
                  onBlur={(e) => {
                    const size = Number(e.target.value);
                    if (size >= 6 && size <= 144)
                      editor.chain().setFontSize(`${size}pt`).run();
                  }}
                  title="Font size in points; type a size and press Enter"
                />
              </div>
              <div className="tool-row">
                {formatButton(Bold, "Bold (Ctrl+B)", "bold", () =>
                  editor.chain().focus().toggleBold().run(),
                )}
                {formatButton(Italic, "Italic (Ctrl+I)", "italic", () =>
                  editor.chain().focus().toggleItalic().run(),
                )}
                {formatButton(
                  Underline,
                  "Underline (Ctrl+U)",
                  "underline",
                  () => editor.chain().focus().toggleUnderline().run(),
                )}
                {formatButton(Strikethrough, "Strikethrough", "strike", () =>
                  editor.chain().focus().toggleStrike().run(),
                )}
                <Button
                  label="Superscript"
                  active={editor.isActive("superscript")}
                  onClick={() =>
                    editor.chain().focus().toggleSuperscript().run()
                  }
                >
                  x²
                </Button>
                <Button
                  label="Subscript"
                  active={editor.isActive("subscript")}
                  onClick={() => editor.chain().focus().toggleSubscript().run()}
                >
                  x₂
                </Button>
                <label className="color-control" title="Text colour">
                  <Type size={16} />
                  <input
                    type="color"
                    aria-label="Text colour"
                    value={editor.getAttributes("textStyle").color ?? "#202b3c"}
                    onChange={(e) =>
                      editor.chain().focus().setColor(e.target.value).run()
                    }
                  />
                </label>
                <label className="color-control" title="Highlight colour">
                  <Highlighter size={16} />
                  <input
                    type="color"
                    aria-label="Highlight colour"
                    value={editor.getAttributes("highlight").color ?? "#fff0a6"}
                    onChange={(e) =>
                      editor
                        .chain()
                        .focus()
                        .setHighlight({ color: e.target.value })
                        .run()
                    }
                  />
                </label>
                <Button
                  icon={Type}
                  label="Clear direct formatting"
                  onClick={() => editor.chain().focus().unsetAllMarks().run()}
                />
              </div>
              <small>Font</small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                {[
                  [AlignLeft, "left"],
                  [AlignCenter, "center"],
                  [AlignRight, "right"],
                  [AlignJustify, "justify"],
                ].map(([Icon, align]) => (
                  <Button
                    key={align as string}
                    icon={Icon}
                    label={`Align ${align}`}
                    active={editor.isActive({ textAlign: align })}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .setTextAlign(align as string)
                        .run()
                    }
                  />
                ))}
                <select
                  className="spacing-select"
                  aria-label="Line spacing"
                  value={currentAttrs.lineHeight ?? ""}
                  onChange={(e) =>
                    paragraphChange({ lineHeight: Number(e.target.value) })
                  }
                >
                  <option value="" disabled>
                    Spacing
                  </option>
                  {[1, 1.15, 1.5, 2, 2.5, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="tool-row">
                {formatButton(List, "Bulleted list", "bulletList", () =>
                  editor.chain().focus().toggleBulletList().run(),
                )}
                {formatButton(ListOrdered, "Numbered list", "orderedList", () =>
                  editor.chain().focus().toggleOrderedList().run(),
                )}
                <Button
                  icon={IndentDecrease}
                  label="Decrease indent"
                  onClick={() =>
                    editor.isActive("listItem")
                      ? editor.chain().focus().liftListItem("listItem").run()
                      : paragraphChange({
                          indent: Math.max(0, (currentAttrs.indent ?? 0) - 1),
                        })
                  }
                />
                <Button
                  icon={IndentIncrease}
                  label="Increase indent / nest list"
                  onClick={() =>
                    editor.isActive("listItem")
                      ? editor.chain().focus().sinkListItem("listItem").run()
                      : paragraphChange({
                          indent: Math.min(8, (currentAttrs.indent ?? 0) + 1),
                        })
                  }
                />
                <Button
                  icon={Quote}
                  label="Quote"
                  active={editor.isActive("blockquote")}
                  onClick={() => applyStyle("Quote")}
                />
              </div>
              <small>Paragraph</small>
            </div>
            <div className="ribbon-group style-group">
              <div className="style-options">
                {["Normal", "Heading 1", "Heading 2", "Title"].map((n) => (
                  <button
                    key={n}
                    aria-label={n}
                    className={currentStyle === n ? "chosen" : ""}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyStyle(n)}
                  >
                    <span className={n.toLowerCase().replace(" ", "-")}>
                      {n === "Heading 1"
                        ? "Aa"
                        : n === "Heading 2"
                          ? "Aa"
                          : n === "Title"
                            ? "Aa"
                            : "Aa"}
                    </span>
                    <small>{n}</small>
                  </button>
                ))}
              </div>
              <small>
                <button
                  className="text-button"
                  onClick={() => {
                    setProperties(true);
                    setReviewPanel(false);
                  }}
                >
                  All styles & properties <ChevronRight size={11} />
                </button>
              </small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={Search}
                  label="Find (Ctrl+F)"
                  onClick={() => {
                    setSearch(!search);
                    setReplace(false);
                  }}
                />
                <Button
                  icon={RefreshCw}
                  label="Replace (Ctrl+H)"
                  onClick={() => {
                    setSearch(true);
                    setReplace(true);
                  }}
                />
              </div>
              <small>Editing</small>
            </div>
          </>
        ) : null}
        {shelf === "Insert" ? (
          <>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={ImageIcon}
                  label="Insert image from file"
                  onClick={() => void run(() => insertImage())}
                >
                  Image
                </Button>
                <Button
                  icon={Table2}
                  label="Insert table"
                  onClick={() => void run(insertTable)}
                >
                  Table
                </Button>
                <Button
                  icon={Link}
                  label="Insert or edit hyperlink (Ctrl+K)"
                  onClick={() => void run(link)}
                >
                  Link
                </Button>
                <Button
                  icon={MessageSquare}
                  label="Add comment to selection"
                  onClick={() => void run(comment)}
                >
                  Comment
                </Button>
              </div>
              <small>Rich content</small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={CornerDownLeft}
                  label="Insert explicit page break"
                  onClick={() =>
                    insertDocumentBlock([
                      { type: "pageBreak" },
                      { type: "paragraph" },
                    ])
                  }
                >
                  Page break
                </Button>
                <Button
                  icon={Minus}
                  label="Insert horizontal divider"
                  onClick={() =>
                    editor.chain().focus().setHorizontalRule().run()
                  }
                >
                  Divider
                </Button>
                <Button
                  icon={BookOpen}
                  label="Insert dynamic table of contents"
                  onClick={() =>
                    insertDocumentBlock([
                      { type: "toc" },
                      { type: "paragraph" },
                    ])
                  }
                >
                  Contents
                </Button>
                <Button
                  icon={Clock}
                  label="Insert date"
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .insertContent(
                        new Date().toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }),
                      )
                      .run()
                  }
                >
                  Date
                </Button>
                <Button
                  icon={Type}
                  label="Insert special character"
                  onClick={() =>
                    void run(async () => {
                      const r = await ask({
                        title: "Insert a symbol",
                        message:
                          "Copy a symbol, or type another Unicode character.\n© ® ™ ° ± × ÷ → ← • § € £ ¥ ✓ ☐ ☑ — …",
                        fields: [
                          { key: "symbol", label: "Character(s)", value: "©" },
                        ],
                        choices: [
                          { label: "Insert", value: "insert" },
                          { label: "Cancel", value: "cancel" },
                        ],
                      });
                      if (r.choice === "insert")
                        editor
                          .chain()
                          .focus()
                          .insertContent({
                            type: "text",
                            text: r.values.symbol,
                          })
                          .run();
                    })
                  }
                >
                  Symbol
                </Button>
              </div>
              <small>Document structure</small>
            </div>
          </>
        ) : null}
        {shelf === "Layout" ? (
          <>
            <div className="ribbon-group">
              <div className="tool-row">
                <label>
                  Paper{" "}
                  <select
                    aria-label="Page size"
                    value={tab.doc.page.size}
                    onChange={(e) =>
                      update({
                        page: { ...tab.doc.page, size: e.target.value as any },
                      })
                    }
                  >
                    <option>A4</option>
                    <option>Letter</option>
                  </select>
                </label>
                <label>
                  Orientation{" "}
                  <select
                    aria-label="Orientation"
                    value={tab.doc.page.orientation}
                    onChange={(e) =>
                      update({
                        page: {
                          ...tab.doc.page,
                          orientation: e.target.value as any,
                        },
                      })
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                <Button
                  icon={WrapText}
                  label="Custom page margins"
                  onClick={() =>
                    void run(async () => {
                      const r = await ask({
                        title: "Page margins",
                        fields: ["Top", "Bottom", "Left", "Right"].map(
                          (side) => ({
                            key: `margin${side}`,
                            label: `${side} (5–60 mm)`,
                            value: String(
                              (tab.doc.page as any)[`margin${side}`],
                            ),
                            type: "number",
                          }),
                        ),
                        choices: [
                          { label: "Apply", value: "apply" },
                          { label: "Cancel", value: "cancel" },
                        ],
                      });
                      if (r.choice === "apply") {
                        const values = Object.fromEntries(
                          Object.entries(r.values).map(([k, v]) => [
                            k,
                            Number(v),
                          ]),
                        );
                        if (Object.values(values).some((n) => n < 5 || n > 60))
                          throw new Error(
                            "Margins must be between 5 and 60 mm.",
                          );
                        update({ page: { ...tab.doc.page, ...values } });
                      }
                    })
                  }
                >
                  Margins
                </Button>
              </div>
              <small>Page setup · preview shows actual pagination</small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={Type}
                  label="Edit headers and footers"
                  onClick={() => void run(headerFooter)}
                >
                  Header & footer
                </Button>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={tab.doc.page.pageNumbers}
                    onChange={(e) =>
                      update({
                        page: {
                          ...tab.doc.page,
                          pageNumbers: e.target.checked,
                        },
                      })
                    }
                  />
                  Page number fields
                </label>
                <Button
                  icon={Eye}
                  label="Accurate paginated print preview"
                  onClick={() => action("preview")}
                >
                  Print preview
                </Button>
              </div>
              <small>Print & PDF</small>
            </div>
          </>
        ) : null}
        {shelf === "Review" ? (
          <>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={MessageSquare}
                  label="Add comment"
                  onClick={() => void run(comment)}
                >
                  New comment
                </Button>
                <Button
                  icon={PanelRight}
                  label="Show comments"
                  active={reviewPanel && properties}
                  onClick={() => {
                    setProperties(true);
                    setReviewPanel(true);
                  }}
                >
                  Comments
                </Button>
                <Button
                  icon={Search}
                  label="Find and replace"
                  onClick={() => {
                    setSearch(true);
                    setReplace(true);
                  }}
                >
                  Find & replace
                </Button>
                <Button
                  icon={Type}
                  label="Uppercase selection"
                  onClick={() => changeCase("upper")}
                >
                  UPPER
                </Button>
                <Button
                  icon={Type}
                  label="Lowercase selection"
                  onClick={() => changeCase("lower")}
                >
                  lower
                </Button>
                <Button
                  icon={Type}
                  label="Title case selection"
                  onClick={() => changeCase("title")}
                >
                  Title Case
                </Button>
              </div>
              <small>
                Writing tools · right-click misspellings for local suggestions
              </small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={BookOpen}
                  label="Word count and writing goal"
                  onClick={() => {
                    setProperties(true);
                    setReviewPanel(false);
                  }}
                >
                  Document statistics
                </Button>
                <Button
                  icon={Info}
                  label="Review feature limitations"
                  onClick={() =>
                    notify(
                      "Comments are anchored marks and saved natively. Overlapping comments and full tracked changes are not supported.",
                    )
                  }
                >
                  Review support
                </Button>
              </div>
              <small>No cloud service required</small>
            </div>
          </>
        ) : null}
        {shelf === "View" ? (
          <>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={PanelLeft}
                  label="Toggle heading outline"
                  active={outline}
                  onClick={() => setOutline(!outline)}
                >
                  Outline
                </Button>
                <Button
                  icon={PanelRight}
                  label="Toggle properties panel"
                  active={properties}
                  onClick={() => {
                    setProperties(!properties);
                    setReviewPanel(false);
                  }}
                >
                  Properties
                </Button>
                <Button
                  icon={Focus}
                  label="Focus mode (Esc to exit)"
                  active={focus}
                  onClick={() => setFocus(!focus)}
                >
                  Focus
                </Button>
                <Button
                  icon={Eye}
                  label="Paginated print preview"
                  onClick={() => action("preview")}
                >
                  Print preview
                </Button>
              </div>
              <small>Continuous editing · pagination in preview</small>
            </div>
            <div className="ribbon-group">
              <div className="tool-row">
                <Button
                  icon={ZoomOut}
                  label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(40, z - 10))}
                />
                <span>{zoom}%</span>
                <Button
                  icon={ZoomIn}
                  label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(200, z + 10))}
                />
                <button
                  onClick={() =>
                    setZoom(
                      Math.max(
                        40,
                        Math.min(
                          200,
                          Math.floor(
                            (((docScroll.current?.clientWidth ?? 900) - 100) /
                              (tab.doc.page.orientation === "portrait"
                                ? 794
                                : 1123)) *
                              100,
                          ),
                        ),
                      ),
                    )
                  }
                >
                  Fit width
                </button>
                <button
                  onClick={() =>
                    setZoom(
                      Math.max(
                        40,
                        Math.min(
                          120,
                          Math.floor(
                            (((docScroll.current?.clientHeight ?? 700) - 70) /
                              (tab.doc.page.orientation === "portrait"
                                ? 1123
                                : 794)) *
                              100,
                          ),
                        ),
                      ),
                    )
                  }
                >
                  Fit page width & height
                </button>
                <Button
                  icon={SettingsIcon}
                  label="Preferences"
                  onClick={() => action("settings")}
                />
              </div>
              <small>Display</small>
            </div>
          </>
        ) : null}
      </div>
      {isTable && (
        <div className="contextbar">
          <span>
            <Table2 size={15} /> TABLE
          </span>
          {[
            ["Add row", () => editor.chain().focus().addRowAfter().run()],
            ["Remove row", () => editor.chain().focus().deleteRow().run()],
            ["Add column", () => editor.chain().focus().addColumnAfter().run()],
            [
              "Remove column",
              () => editor.chain().focus().deleteColumn().run(),
            ],
            [
              "Header row",
              () => editor.chain().focus().toggleHeaderRow().run(),
            ],
            ["Merge cells", () => editor.chain().focus().mergeCells().run()],
            ["Split cell", () => editor.chain().focus().splitCell().run()],
            ["Delete table", () => editor.chain().focus().deleteTable().run()],
          ].map(([label, fn]) => (
            <button
              key={label as string}
              onMouseDown={(e) => e.preventDefault()}
              onClick={fn as any}
            >
              {label as string}
            </button>
          ))}
          <label>
            Cell fill
            <input
              type="color"
              aria-label="Table cell background"
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .setCellAttribute("backgroundColor", e.target.value)
                  .run()
              }
            />
          </label>
          <label>
            Border
            <input
              type="color"
              aria-label="Table border colour"
              onChange={(e) =>
                editor
                  .chain()
                  .focus()
                  .setCellAttribute("borderColor", e.target.value)
                  .run()
              }
            />
          </label>
          <select
            aria-label="Cell border width"
            onChange={(e) =>
              editor
                .chain()
                .focus()
                .setCellAttribute("borderWidth", Number(e.target.value))
                .run()
            }
          >
            <option value="1">1 px</option>
            <option value="0">None</option>
            <option value="2">2 px</option>
            <option value="3">3 px</option>
          </select>
        </div>
      )}
      {search && (
        <div className="findbar">
          <Search size={17} />
          <input
            ref={searchInput}
            placeholder="Find in document"
            aria-label="Find text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") jump(e.shiftKey ? -1 : 1);
            }}
          />
          <span className="match-count">
            {matches.length
              ? `${Math.min(matchIndex + 1, matches.length)} of ${matches.length}`
              : "No matches"}
          </span>
          <Button
            icon={ArrowUp}
            label="Previous match"
            disabled={!matches.length}
            onClick={() => jump(-1)}
          />
          <Button
            icon={ArrowDown}
            label="Next match"
            disabled={!matches.length}
            onClick={() => jump(1)}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
            />
            Match case
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
            />
            Whole word
          </label>
          <button onClick={() => setReplace(!replace)}>Replace</button>
          {replace && (
            <>
              <input
                aria-label="Replace with"
                placeholder="Replace with"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
              <button
                disabled={!matches.length}
                onClick={() => {
                  const m = matches[matchIndex] ?? matches[0];
                  if (m) editor.view.dispatch(closeHistory(editor.state.tr));
                  if (m)
                    editor
                      .chain()
                      .focus()
                      .insertContentAt(
                        m,
                        replacement ? { type: "text", text: replacement } : "",
                      )
                      .run();
                }}
              >
                Replace one
              </button>
              <button
                disabled={!matches.length}
                onClick={() => {
                  const tr = closeHistory(editor.state.tr);
                  for (const m of [...matches].reverse())
                    replacement
                      ? tr.insertText(replacement, m.from, m.to)
                      : tr.delete(m.from, m.to);
                  editor.view.dispatch(tr);
                  editor.view.dispatch(closeHistory(editor.state.tr));
                  notify(`Replaced ${matches.length} occurrences.`);
                }}
              >
                Replace all
              </button>
            </>
          )}
          <Button
            icon={X}
            label="Close find"
            onClick={() => setSearch(false)}
          />
        </div>
      )}
      <div className="document-meta">
        <div>
          <button className="document-name" onClick={() => void run(rename)}>
            {tab.doc.title}
            <ChevronDown size={12} />
          </button>
          <span className={tab.dirty ? "save-status unsaved" : "save-status"}>
            <span />
            {tab.dirty
              ? "Unsaved changes"
              : tab.path
                ? "Saved to this computer"
                : "New document"}
          </span>
        </div>
        <span
          className="format-label"
          title={tab.path ?? "Choose a save destination with Ctrl+S"}
        >
          {tab.path
            ? tab.path.split(/[\\/]/).pop()
            : "BeastText document · not yet saved"}
        </span>
        <button className="text-button" onClick={() => action("preview")}>
          <Eye size={14} /> Print preview
        </button>
      </div>
      <div className="editing-layout">
        {outline && (
          <aside className="outline-panel">
            <div className="panel-heading">
              DOCUMENT OUTLINE
              <button
                aria-label="Close outline"
                onClick={() => setOutline(false)}
              >
                <X size={14} />
              </button>
            </div>
            {headings.length ? (
              headings.map((h, i) => (
                <button
                  key={i}
                  className="outline-entry"
                  style={{ paddingLeft: 14 + (h.level - 1) * 13 }}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .setTextSelection(h.pos + 1)
                      .scrollIntoView()
                      .run()
                  }
                >
                  {h.text}
                </button>
              ))
            ) : (
              <div className="outline-empty">
                <Heading size={24} />
                <p>A little structure goes a long way.</p>
                <small>
                  Apply heading styles to build your document outline.
                </small>
              </div>
            )}
            <div className="outline-bottom">
              <ShieldCheck size={14} />
              <span>Recovery every {settings.recoverySeconds}s</span>
            </div>
          </aside>
        )}
        <div
          className={`document-scroll ${settings.warmPaper ? "warm-paper" : ""}`}
          ref={docScroll}
        >
          <div className="canvas-toolbar">
            <span>CONTINUOUS WRITING VIEW</span>
            <div>
              <Button
                icon={PanelLeft}
                label="Show outline"
                active={outline}
                onClick={() => setOutline(!outline)}
              />
              <Button
                icon={Focus}
                label="Toggle focus mode"
                active={focus}
                onClick={() => setFocus(!focus)}
              />
            </div>
          </div>
          <div
            className="document-width"
            style={{
              width: `${((tab.doc.page.orientation === "portrait" ? (tab.doc.page.size === "A4" ? 794 : 816) : tab.doc.page.size === "A4" ? 1123 : 1056) * zoom) / 100}px`,
            }}
          >
            <div className="ruler" aria-hidden="true">
              {Array.from({ length: 17 }, (_, i) => (
                <span key={i}>{i % 2 === 0 ? i : ""}</span>
              ))}
            </div>
            <article
              className={`document-paper doc-${tab.key}`}
              style={{
                zoom: zoom / 100,
                padding: `${tab.doc.page.marginTop}mm ${tab.doc.page.marginRight}mm ${tab.doc.page.marginBottom}mm ${tab.doc.page.marginLeft}mm`,
                minHeight:
                  tab.doc.page.orientation === "portrait" ? "297mm" : "210mm",
              }}
            >
              <style>
                {Object.entries(tab.doc.styles)
                  .map(
                    ([name, s]) =>
                      `.doc-${tab.key} .beast-editor [data-style="${name}"]{font-family:"${s.fontFamily.replace(/[";{}\\]/g, "")}",Arial,sans-serif;font-size:${s.fontSize}pt;color:${s.color};line-height:${s.lineHeight};margin-top:${s.spaceBefore}pt;margin-bottom:${s.spaceAfter}pt}`,
                  )
                  .join("")}
              </style>
              <EditorContent editor={editor} />
            </article>
          </div>
          <div className="canvas-note">
            <span>
              Write freely. Preview for precise pages and print layout.
            </span>
          </div>
        </div>
        {properties && (
          <aside className="properties-panel">
            <div className="panel-heading">
              {reviewPanel ? "COMMENTS" : "DOCUMENT PROPERTIES"}
              <button
                aria-label="Close properties"
                onClick={() => setProperties(false)}
              >
                <X size={14} />
              </button>
            </div>
            {reviewPanel ? (
              <>
                <button
                  className="comment-add"
                  onClick={() => void run(comment)}
                >
                  <Plus size={15} /> Add comment
                </button>
                {tab.doc.comments.length === 0 ? (
                  <p className="panel-muted">
                    Select text and add a comment to start a conversation with
                    your draft.
                  </p>
                ) : (
                  tab.doc.comments.map((c) => (
                    <div
                      className={`comment-card ${c.resolved ? "resolved" : ""}`}
                      key={c.id}
                    >
                      <button
                        className="comment-author"
                        onClick={() => navigateComment(c.id)}
                      >
                        {c.author}{" "}
                        <small>{c.resolved ? "Resolved" : "Open"}</small>
                      </button>
                      <p>{c.text}</p>
                      <small>{new Date(c.created).toLocaleString()}</small>
                      <div className="comment-actions">
                        <button
                          onClick={() =>
                            update({
                              comments: tab.doc.comments.map((x) =>
                                x.id === c.id
                                  ? { ...x, resolved: !x.resolved }
                                  : x,
                              ),
                            })
                          }
                        >
                          {c.resolved ? "Reopen" : "Resolve"}
                        </button>
                        <button
                          onClick={() =>
                            void run(async () => {
                              const r = await ask({
                                title: "Edit comment",
                                fields: [
                                  {
                                    key: "text",
                                    label: "Comment",
                                    value: c.text,
                                  },
                                ],
                                choices: [
                                  { label: "Update", value: "update" },
                                  { label: "Cancel", value: "cancel" },
                                ],
                              });
                              if (r.choice === "update" && r.values.text.trim())
                                update({
                                  comments: tab.doc.comments.map((x) =>
                                    x.id === c.id
                                      ? { ...x, text: r.values.text.trim() }
                                      : x,
                                  ),
                                });
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          aria-label="Delete comment"
                          onClick={() => removeComment(c.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                {isImage && (
                  <section className="property-section">
                    <h3>Selected image</h3>
                    <div className="tool-row">
                      {[
                        [AlignLeft, "left"],
                        [AlignCenter, "center"],
                        [AlignRight, "right"],
                      ].map(([Icon, align]) => (
                        <Button
                          key={align as string}
                          icon={Icon}
                          label={`Align image ${align}`}
                          active={imageAttrs.textAlign === align}
                          onClick={() =>
                            editor
                              .chain()
                              .focus()
                              .updateAttributes("image", { textAlign: align })
                              .run()
                          }
                        />
                      ))}
                    </div>
                    <label className="field">
                      Width (px)
                      <input
                        type="number"
                        min={30}
                        max={1200}
                        value={imageAttrs.width}
                        onChange={(e) => {
                          const w = Number(e.target.value);
                          if (w >= 30 && w <= 1200)
                            editor
                              .chain()
                              .focus()
                              .updateAttributes("image", {
                                width: w,
                                height: Math.round(
                                  w * (imageAttrs.height / imageAttrs.width),
                                ),
                              })
                              .run();
                        }}
                      />
                    </label>
                    <label className="field">
                      Alternative text
                      <input
                        value={imageAttrs.alt ?? ""}
                        onChange={(e) =>
                          editor.commands.updateAttributes("image", {
                            alt: e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="tool-row">
                      <button
                        onClick={() =>
                          editor
                            .chain()
                            .focus()
                            .insertContentAt(editor.state.selection.to, {
                              type: "paragraph",
                              attrs: { styleName: "Caption" },
                              content: [
                                {
                                  type: "text",
                                  text: imageAttrs.alt || "Image caption",
                                },
                              ],
                            })
                            .run()
                        }
                      >
                        Add caption
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const r = await window.beast.image();
                            if (!r) return;
                            const id = crypto.randomUUID();
                            const assets = {
                              ...docRef.current.assets,
                              [id]: r as any,
                            };
                            docRef.current = { ...docRef.current, assets };
                            update({ assets });
                            editor
                              .chain()
                              .focus()
                              .updateAttributes("image", {
                                src: `beast-asset:${id}`,
                              })
                              .run();
                          })
                        }
                      >
                        Replace
                      </button>
                      <button
                        onClick={() =>
                          editor.chain().focus().deleteSelection().run()
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </section>
                )}
                <section className="property-section">
                  <h3>Paragraph style</h3>
                  <select
                    aria-label="Named paragraph style"
                    value={currentStyle}
                    onChange={(e) => applyStyle(e.target.value)}
                  >
                    {styleNames.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    className="text-button"
                    onClick={() => void run(modifyStyle)}
                  >
                    Modify this style <ChevronRight size={12} />
                  </button>
                  <div className="property-row">
                    <label>
                      Before (pt)
                      <input
                        aria-label="Paragraph space before"
                        type="number"
                        min={0}
                        max={100}
                        value={
                          currentAttrs.spaceBefore ??
                          tab.doc.styles[currentStyle]?.spaceBefore ??
                          0
                        }
                        onChange={(e) =>
                          paragraphChange({
                            spaceBefore: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      After (pt)
                      <input
                        aria-label="Paragraph space after"
                        type="number"
                        min={0}
                        max={100}
                        value={
                          currentAttrs.spaceAfter ??
                          tab.doc.styles[currentStyle]?.spaceAfter ??
                          8
                        }
                        onChange={(e) =>
                          paragraphChange({
                            spaceAfter: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    Paragraph shading
                    <input
                      type="color"
                      aria-label="Paragraph shading"
                      value={currentAttrs.backgroundColor ?? "#ffffff"}
                      onChange={(e) =>
                        paragraphChange({ backgroundColor: e.target.value })
                      }
                    />
                  </label>
                </section>
                <section className="property-section">
                  <h3>Document at a glance</h3>
                  <dl className="statistics">
                    <div>
                      <dt>Words</dt>
                      <dd>{counts.words.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Characters</dt>
                      <dd>{counts.characters.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Without spaces</dt>
                      <dd>{counts.withoutSpaces.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Paragraphs</dt>
                      <dd>{counts.paragraphs.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Reading time (estimate)</dt>
                      <dd>{counts.readingMinutes} min</dd>
                    </div>
                    {selectedText && (
                      <div>
                        <dt>Selected words / characters</dt>
                        <dd>
                          {selectedCounts.selectedWords} /{" "}
                          {selectedCounts.selectedCharacters}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <label className="field">
                    Writing goal (words, 0 = off)
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      value={tab.doc.goal}
                      onChange={(e) =>
                        update({
                          goal: Math.max(
                            0,
                            Math.min(1000000, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  {tab.doc.goal > 0 && (
                    <>
                      <progress max={tab.doc.goal} value={counts.words} />
                      <small>
                        {Math.round((counts.words / tab.doc.goal) * 100)}% of
                        your goal
                      </small>
                    </>
                  )}
                </section>
                <section className="property-section">
                  <h3>Document details</h3>
                  <label className="field">
                    Author
                    <input
                      value={tab.doc.metadata.author}
                      onChange={(e) =>
                        update({
                          metadata: {
                            ...tab.doc.metadata,
                            author: e.target.value.slice(0, 200),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    Description
                    <textarea
                      value={tab.doc.metadata.description}
                      onChange={(e) =>
                        update({
                          metadata: {
                            ...tab.doc.metadata,
                            description: e.target.value.slice(0, 2000),
                          },
                        })
                      }
                    />
                  </label>
                  <small className="panel-muted">
                    Fonts fall back to Arial when unavailable. Inline images
                    only. See compatibility documentation for format limits.
                  </small>
                </section>
                <section className="property-section">
                  <button
                    className="text-button"
                    onClick={() =>
                      void run(() => window.beast.shell("recovery"))
                    }
                  >
                    Open recovery folder <ExternalLink size={12} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      void run(() => window.beast.shell("backups"))
                    }
                  >
                    Open backups <ExternalLink size={12} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void run(() => window.beast.shell("logs"))}
                  >
                    Open logs <ExternalLink size={12} />
                  </button>
                </section>
              </>
            )}
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <div>
          {settings.wordCount && (
            <button
              onClick={() => {
                setProperties(!properties);
                setReviewPanel(false);
              }}
            >
              {counts.words.toLocaleString()} words
              {selectedText
                ? ` · ${selectedCounts.selectedWords} selected`
                : ""}
            </button>
          )}
          <span>{settings.spellLanguage} · local spelling</span>
          <span>
            {tab.doc.page.size} · {tab.doc.page.orientation}
          </span>
        </div>
        <div>
          <Button
            icon={PanelLeft}
            label="Toggle navigation"
            active={outline}
            onClick={() => setOutline(!outline)}
          />
          <Button
            icon={Focus}
            label="Toggle focus"
            active={focus}
            onClick={() => setFocus(!focus)}
          />
          <span className="status-divider" />
          <button
            aria-label="Decrease zoom"
            onClick={() => setZoom((z) => Math.max(40, z - 10))}
          >
            <Minus size={13} />
          </button>
          <input
            aria-label="Editor zoom"
            type="range"
            min={40}
            max={200}
            step={10}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button
            aria-label="Increase zoom"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          >
            <Plus size={13} />
          </button>
          <button onClick={() => setZoom(100)}>{zoom}%</button>
        </div>
      </footer>
    </div>
  );
}
