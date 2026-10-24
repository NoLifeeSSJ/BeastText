BeastText 1.1.1 adds a reusable PowerShell updater and complete version history.

Updating no longer requires editing a version number in a command. Update-BeastText.ps1 discovers the newest published Windows release, including prereleases, shows the cumulative changelog and runs the checksum-verifying installer. Documents, settings and recovery stay separate from application files. Close BeastText before updating.

Use CheckOnly to preview the version/history without installing, Version to select an explicit release, Root for a custom installation, or ReleaseDirectory for an offline bundle. The updater and CHANGELOG.md are included as release downloads; the full history is also installed with the documentation. The initial release candidates are clearly labelled as unpublished.

The app retains the clearer File screen, multi-format Save as and remembered dark mode from 1.1.0. This remains an unsigned Windows x64 prerelease with the conversion/manual-acceptance limits documented in COMPATIBILITY.md and TESTING.md.

The release workflow gates publication on build, unit tests, desktop journeys, Windows packaging, online updater discovery/history preview, real updater reinstallation with preserved data, shortcut checks and uninstallation.
