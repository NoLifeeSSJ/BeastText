import { contextBridge, ipcRenderer, webUtils, webFrame } from "electron";
import type { Bridge } from "../shared/bridge";
const call = (name: string, ...args: any[]) =>
  ipcRenderer.invoke(`beast:${name}`, ...args);
const api: Bridge = {
  clipboard: () => call("clipboard"),
  pathForFile: (file) => webUtils.getPathForFile(file),
  bootstrap: () => call("bootstrap"),
  open: (p) => call("open", p),
  save: (...a) => call("save", ...a),
  export: (...a) => call("export", ...a),
  print: (...a) => call("print", ...a),
  recovery: (...a) => call("recovery", ...a),
  clearRecovery: (id) => call("clearRecovery", id),
  settings: (s) => call("settings", s),
  recent: (...a) => call("recent", ...a),
  image: () => call("image"),
  template: (...a) => call("template", ...a),
  shell: (t) => call("shell", t),
  session: (p) => call("session", p),
  onOpen: (fn) => {
    const listener = (_: unknown, p: string[]) => fn(p);
    ipcRenderer.on("beast:open", listener);
    return () => ipcRenderer.removeListener("beast:open", listener);
  },
  onClose: (fn) => {
    const listener = () => fn();
    ipcRenderer.on("beast:closing", listener);
    return () => ipcRenderer.removeListener("beast:closing", listener);
  },
  closeReady: () => ipcRenderer.send("beast:closeReady"),
  minimise: () => ipcRenderer.send("beast:minimise"),
  maximise: () => ipcRenderer.send("beast:maximise"),
  close: () => ipcRenderer.send("beast:close"),
};
// Chromium supplies word batches; all checking stays in the local main process.
// This avoids platform-dependent native suggestion behaviour on Windows.
webFrame.setSpellCheckProvider("en-US", {
  spellCheck(words, callback) {
    const unique = [...new Set(words.filter((word) => word.length <= 100))];
    const batches = [];
    for (let i = 0; i < unique.length; i += 1000)
      batches.push(call("spellCheck", unique.slice(i, i + 1000)));
    Promise.all(batches)
      .then((results) => callback(results.flat()))
      .catch(() => callback([]));
  },
});
contextBridge.exposeInMainWorld("beast", api);
