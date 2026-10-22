import type { BeastDocument } from "./model";
export type Recent = {
  path: string;
  name: string;
  opened: string;
  pinned: boolean;
};
export type Settings = {
  theme: "light" | "dark" | "system";
  font: string;
  fontSize: number;
  pageSize: "A4" | "Letter";
  margin: number;
  saveLocation: string;
  recoverySeconds: number;
  backupRetention: number;
  spellLanguage: string;
  wordCount: boolean;
  startup: "home" | "blank";
  restoreSession: boolean;
  warmPaper: boolean;
  typewriter: boolean;
  autoSave: boolean;
};
export const defaults: Settings = {
  theme: "light",
  font: "Aptos",
  fontSize: 12,
  pageSize: "A4",
  margin: 25,
  saveLocation: "",
  recoverySeconds: 30,
  backupRetention: 5,
  spellLanguage: "en-US",
  wordCount: true,
  startup: "home",
  restoreSession: true,
  warmPaper: false,
  typewriter: false,
  autoSave: false,
};
export type Opened = {
  doc?: BeastDocument;
  html?: string;
  text?: string;
  kind?: "text" | "markdown" | "html" | "docx";
  path: string | null;
  fingerprint: string | null;
  warnings: string[];
};
export type SaveResult = { path: string; fingerprint: string } | null;
export type Bootstrap = {
  spellingReady: boolean;
  settings: Settings;
  recent: Recent[];
  recoveries: { doc: BeastDocument; file: string | null; modified: string }[];
  templates: { id: string; name: string }[];
  version: string;
  spelling: string[];
  session: string[];
};
export type Bridge = {
  bootstrap(): Promise<Bootstrap>;
  clipboard(): Promise<{ text: string; html: string }>;
  pathForFile(file: File): string;
  open(path?: string): Promise<Opened | null>;
  save(
    doc: BeastDocument,
    path: string | null,
    baseline: string | null,
    mode: "save" | "as" | "copy",
  ): Promise<SaveResult>;
  export(
    doc: BeastDocument,
    format: "txt" | "md" | "html" | "docx" | "pdf",
  ): Promise<string | null>;
  print(doc: BeastDocument, preview: boolean): Promise<void>;
  recovery(doc: BeastDocument, path: string | null): Promise<void>;
  clearRecovery(id: string): Promise<void>;
  settings(settings: Settings): Promise<void>;
  recent(
    action: "pin" | "remove" | "clear" | "reveal",
    file?: string,
  ): Promise<Recent[]>;
  image(): Promise<{ mime: string; data: string } | null>;
  template(doc?: BeastDocument, id?: string): Promise<any>;
  shell(target: "logs" | "recovery" | "backups" | "documents"): Promise<void>;
  session(paths: string[]): Promise<void>;
  onOpen(fn: (paths: string[]) => void): () => void;
  onClose(fn: () => void): () => void;
  closeReady(): void;
  minimise(): void;
  maximise(): void;
  close(): void;
};
declare global {
  interface Window {
    beast: Bridge;
  }
}
