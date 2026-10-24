import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FilePlus2,
  FileText,
  FolderOpen,
  Moon,
  Monitor,
  Printer,
  Save,
  Settings as SettingsIcon,
  Sun,
  X,
} from "lucide-react";
import {
  documentFormats,
  editableFormatForPath,
  type DocumentFormat,
} from "../shared/formats";
import type { Recent, Settings } from "../shared/bridge";

export type FileView = "home" | "saveAs" | "print";
export default function FileMenu({
  view,
  onView,
  title,
  file,
  dirty,
  recents,
  theme,
  onTheme,
  onBack,
  onAction,
  onOpen,
  onSaveAs,
  busy,
}: {
  view: FileView;
  onView: (view: FileView) => void;
  title: string;
  file: string | null;
  dirty: boolean;
  recents: Recent[];
  theme: Settings["theme"];
  onTheme: (theme: Settings["theme"]) => void;
  onBack: () => void;
  onAction: (name: string) => void;
  onOpen: (file: string) => void;
  onSaveAs: (format: DocumentFormat) => void;
  busy: boolean;
}) {
  const [format, setFormat] = useState<DocumentFormat>(
    editableFormatForPath(file) ?? "docx",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [view]);
  const chosen = documentFormats.find((f) => f.id === format)!;
  const nav = (
    label: string,
    Icon: typeof Save,
    action: () => void,
    selected = false,
  ) => (
    <button
      className={"file-nav-item " + (selected ? "selected" : "")}
      onClick={action}
      aria-current={selected ? "page" : undefined}
      disabled={busy}
    >
      <Icon size={19} /> {label}
    </button>
  );
  return (
    <section className="file-screen" aria-label="File menu" aria-busy={busy}>
      <aside className="file-navigation">
        <button className="file-back" onClick={onBack} disabled={busy}>
          <ArrowLeft size={20} /> Back to document <kbd>Esc</kbd>
        </button>
        <nav aria-label="File actions">
          {nav("Document", FileText, () => onView("home"), view === "home")}
          {nav("New", FilePlus2, () => onAction("new"))}
          {nav("Open", FolderOpen, () => onAction("open"))}
          <hr />
          {nav("Save", Save, () => onAction("save"))}
          {nav("Save as", Copy, () => onView("saveAs"), view === "saveAs")}
          {nav("Save a Copy", Copy, () => onAction("copy"))}
          {nav("Print", Printer, () => onView("print"), view === "print")}
          <hr />
          {nav("Save as template", FilePlus2, () => onAction("template"))}
          {nav("Close document", X, () => onAction("close"))}
        </nav>
        <div className="file-navigation-bottom">
          {nav("Settings", SettingsIcon, () => onAction("settings"))}
          <span className="appearance-label">APP APPEARANCE</span>
          <div
            className="appearance-options"
            role="group"
            aria-label="App appearance"
          >
            {(
              [
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
                ["system", "System", Monitor],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => onTheme(value)}
                aria-pressed={theme === value}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="file-content">
        <div className="file-eyebrow">
          BEASTTEXT /{" "}
          {view === "saveAs"
            ? "SAVE AS"
            : view === "print"
              ? "PRINT"
              : "YOUR DOCUMENT"}
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {view === "saveAs"
            ? "Save it your way."
            : view === "print"
              ? "Ready for the page."
              : title}
        </h1>
        {view === "home" && (
          <>
            <p className="file-intro">
              Everything you need to save, share and finish your document.
            </p>
            <div className="file-document-card">
              <div className="file-document-icon">
                <FileText size={30} />
              </div>
              <div>
                <strong>{title}</strong>
                <p>
                  {dirty
                    ? "Changes waiting to be saved"
                    : file
                      ? "All changes saved"
                      : "Choose a location when you’re ready"}
                </p>
                <span className="file-location">
                  {file ?? "Not saved to a file yet"}
                </span>
              </div>
            </div>
            <div className="file-shortcuts">
              <button onClick={() => onAction("save")} disabled={busy}>
                <Save size={23} />
                <strong>Save</strong>
                <span>Keep your latest changes</span>
                <kbd>Ctrl S</kbd>
              </button>
              <button onClick={() => onView("saveAs")} disabled={busy}>
                <Copy size={23} />
                <strong>Save as</strong>
                <span>Choose a name, location and format</span>
                <kbd>Ctrl Shift S</kbd>
              </button>
              <button onClick={() => onView("print")} disabled={busy}>
                <Printer size={23} />
                <strong>Print & preview</strong>
                <span>See exactly how your pages look</span>
              </button>
            </div>
            <div className="file-section-heading">
              <h2>Recent documents</h2>
              <button onClick={() => onAction("open")} disabled={busy}>
                <FolderOpen size={16} /> Browse files
              </button>
            </div>
            {recents.length ? (
              <div className="file-recents">
                {recents.slice(0, 5).map((recent) => (
                  <button
                    key={recent.path}
                    onClick={() => onOpen(recent.path)}
                    disabled={busy}
                  >
                    <FileText size={20} />
                    <span>
                      <strong>{recent.name}</strong>
                      <small>{recent.path}</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">
                Documents you open and save will appear here.
              </p>
            )}
          </>
        )}
        {view === "saveAs" && (
          <>
            <p className="file-intro">
              Choose a format, then pick a file name and location.
            </p>
            <div
              className="file-format-grid"
              role="group"
              aria-label="Document format"
            >
              {documentFormats.map((item) => (
                <button
                  key={item.id}
                  className={
                    "file-format " + (format === item.id ? "selected" : "")
                  }
                  aria-pressed={format === item.id}
                  onClick={() => setFormat(item.id)}
                  disabled={busy}
                >
                  <span className={"format-badge format-" + item.id}>
                    {item.id === "beasttext" ? "BT" : item.id.toUpperCase()}
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                  {format === item.id && <Check size={18} />}
                </button>
              ))}
            </div>
            <div className="format-detail" role="note">
              <strong>
                {chosen.name} <span>.{chosen.id}</span>
              </strong>
              <p>{chosen.detail}</p>
              {format !== "beasttext" && format !== "pdf" && (
                <small>
                  After saving, Ctrl S updates this file. Keep a BeastText copy
                  if you also need features this format omits.
                </small>
              )}
            </div>
            <div className="file-save-footer">
              <span>
                Your document: <strong>{title}</strong>
              </span>
              <button
                className="primary"
                onClick={() => onSaveAs(format)}
                disabled={busy}
              >
                {busy
                  ? "Saving…"
                  : format === "pdf"
                    ? "Save PDF copy"
                    : "Choose location & save"}
                <ArrowRight size={17} />
              </button>
            </div>
          </>
        )}
        {view === "print" && (
          <>
            <p className="file-intro">
              Preview your layout, print your document or save a PDF to share.
            </p>
            <div className="file-print-card">
              <Printer size={42} />
              <div>
                <h2>{title}</h2>
                <p>
                  Preview includes page breaks, margins, headers, footers and
                  page numbers.
                </p>
                <div className="file-print-actions">
                  <button
                    className="primary"
                    onClick={() => onAction("preview")}
                    disabled={busy}
                  >
                    Print preview
                  </button>
                  <button onClick={() => onAction("print")} disabled={busy}>
                    <Printer size={17} /> Print document
                  </button>
                  <button
                    onClick={() => {
                      setFormat("pdf");
                      onView("saveAs");
                    }}
                    disabled={busy}
                  >
                    Save PDF copy
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </section>
  );
}
