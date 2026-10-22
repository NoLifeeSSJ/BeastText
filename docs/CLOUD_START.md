# Cloud desktop startup

Use the existing isolated checkout at `/workspace/BeastText`. Do not propose or create a Git worktree unless the user explicitly requests one. Dependencies, compiled outputs and release files can be retained in the snapshot; GUI/display processes must be restarted in a new task.

For the selected Linux cloud machine, from `/workspace/BeastText`:

```bash
export XDG_CACHE_HOME=/workspace/.cache
export XDG_CONFIG_HOME=/workspace/.config
export XDG_DATA_HOME=/workspace/.local/share
source scripts/cloud-display.sh
node scripts/cloud-start.mjs
```

The display helper reuses a working X display or starts the installed Xorg dummy driver on `:99`, bound without TCP. The cloud launcher uses Playwright to launch the actual Electron application, opens a blank document when necessary, and verifies that the document editor is editable before reporting readiness. It keeps the desktop process running. Its outer `--no-sandbox` flag is for this already-isolated Linux container only; production Windows launch is the packaged EXE, without that flag. BrowserWindow sandbox and context isolation remain enabled.

The cloud profile is `/workspace/.local/BeastText`. This is separate from test profiles and Windows `%APPDATA%\BeastText`. No credentials or external services are required. For implementation changes use `npm run dev` on a normal desktop, or rebuild with `npm run build` before the cloud launcher. Re-run `bash scripts/cloud-install.sh` only when dependencies/build outputs need reproducing.

Useful automated readiness checks, from the same working directory and display, are `npm test` and `npm run test:e2e`. The latter performs native save/reopen, editing, conversion and crash recovery in temporary profiles. An open process or X socket alone does not establish application readiness. Stop only application/display processes started for this task. No localhost preview links are supported by onboarding; report desktop/test results in text.

Windows release creation: `npm run package:win`. Review `docs/TESTING.md` and `docs/KNOWN_LIMITATIONS.md`; cross-built artifacts do not prove Windows installer/shortcut/IME/printer behavior. Installation, startup and configuration draft persistence do not publish a release or prove restoration in a new task.
