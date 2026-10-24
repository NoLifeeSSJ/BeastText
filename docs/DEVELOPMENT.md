# Development and release

Use the existing isolated checkout. Do not create Git worktrees for ordinary cloud tasks. This repository started empty; the implementation is reviewable as new files. No changes were made to BeastSnip or BeastNotes, and no commit/push/publication is implied.

## Repeatable setup

Node 22.12+ is required by Electron 45. Node 24 and npm 11 were used in cloud validation. Use `npm ci`, not a floating dependency refresh. Electron 45 downloads its binary on first use; run `npm exec install-electron -- --no` explicitly during environment setup. Its bundled checksum metadata verifies the download. On proxy-based cloud hosts Node's `NODE_USE_ENV_PROXY=1` is needed by the downloader. Keep TLS checks enabled.

The cloud user's home directory is read-only. Point only caches/data to writable workspace locations:

```sh
export npm_config_cache=/workspace/.cache/npm
export XDG_CACHE_HOME=/workspace/.cache
export XDG_CONFIG_HOME=/workspace/.config
export XDG_DATA_HOME=/workspace/.local/share
export electron_config_cache=/workspace/.cache/electron
export ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder
export NODE_USE_ENV_PROXY=1
npm ci
npm exec install-electron -- --no
npm run build
npm test
```

`npm run dev` builds the privileged process/preload, starts Vite on a fixed loopback endpoint and opens Electron. Renderer edits use Vite HMR; main/preload changes require restarting development. The renderer production CSP doesn't allow remote scripts, fonts or images. Editor packages and styles are bundled for offline use.

## Desktop validation

`npm run test:e2e` launches the actual production-built app with a temporary profile. Native file dialogs and spelling-menu popup presentation are deterministically stubbed in the test process; file I/O, Electron IPC, editing, conversion, recovery and PDF generation remain real. No development backdoor is added to the renderer. Linux test launches disable Chromium's outer sandbox only for the already-isolated test container; production BrowserWindows retain sandbox/context isolation.

Use an existing X11 display or Xvfb. This cloud machine lacked Xvfb but had Xorg's dummy driver. A task-local config at `/tmp/beasttext-xorg.conf` starts display `:99` via Xorg. That display process must restart in a new machine; it is not a retained dependency. Do not expose localhost as a user-facing web preview.

```sh
DISPLAY=:99 npm run test:e2e
npm run samples
DISPLAY=:99 npm run benchmark
```

`PERFORMANCE.json` measures native encoding/decoding, DOCX export and recovery writes. `DESKTOP_PERFORMANCE.json` measures actual Electron rendering, editing/search and process memory with clearly stated instrumentation. Both are one-run measurements of repetitive sample content, not comparative performance promises.

## Windows package

```sh
npm run package:win
```

Electron-builder creates a self-contained x64 ZIP and edits BeastText icon/version metadata. Code signing is deliberately disabled until a real signing certificate is configured. The release script generates `release.json` (file, size, SHA-256) and copies installer scripts. Never replace release hashes just to make an untrusted download pass: regenerate only from a newly built, verified artifact. Installer/update paths remain separate from source and per-user data.

The GitHub Actions Windows workflow published the prior prerelease after passing all gates; each new version must pass its own tag run. It builds, runs unit/Electron tests, creates the package and invokes `scripts/verify-windows.ps1` to exercise real installation/reinstallation/shortcut/uninstallation with paths containing spaces/apostrophes. The script does not claim physical-printer or IME coverage. A release must also manually launch the installed shortcut, test input composition/high DPI, preview representative documents and print to a real printer if physical printing is to be certified.

## Updating dependencies and dictionaries

Keep `package.json` and the lockfile consistent. Run tests/build and `npm audit --omit=dev` on updates. `npm run licenses` refreshes the installed licence inventory. The original archive package was upgraded to fflate 0.8.3 after the audit identified a malformed ZIP64 infinite-loop advisory in 0.8.2.

Native fallback dictionaries are copied from the official Electron 45 release archive and verified against its published SHA-256. Portable checking uses nspell with dictionary-en 4.0.0 and dictionary-en-gb 3.0.0; their affix/data files and MIT/BSD notices are bundled in resources/dictionaries (see PORTABLE_SOURCE.json). Their source and upstream COPYING/LICENSE files are in `resources/dictionaries`. Preserve those notices when redistributing. Adding a language requires bundled affix/data files, an engine language mapping and a settings language entry; no runtime cloud dependency is needed.

## Publishing a GitHub prerelease

Push a version tag matching `package.json`, for example `v1.0.0`. The Windows workflow runs the build, unit/Electron tests and installer acceptance, then uploads the ZIP, `release.json` and both PowerShell scripts to a GitHub prerelease. Its job-scoped GitHub Actions token has repository-content write permission; no personal token is stored in source. Tag creation requests publication; a tag alone is not evidence that the workflow passed or the assets are available. Check the workflow and release before distributing download commands. Large generated archives belong in Release assets, not Git history.
