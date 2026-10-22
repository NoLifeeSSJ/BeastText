# Known limitations and release gates

This is a working V1 implementation and a cross-built unsigned Windows x64 package. It is **not yet certified on Windows**. Do not describe the full requested definition of done as verified until the Windows acceptance checklist in TESTING.md is completed.

- Continuous editor; exact pages and page counts exist only in PDF preview/output. Fit-page controls adjust display scale; they do not create an on-screen paginated editor.
- Direct printing uses Chromium margin boxes for headers/footers and real page counters; PDF preview is the preferred way to inspect the final result. No physical printer was tested here.
- No floating images/text wrap, full tracked changes, footnotes, equations, mail merge, columns, macros or PDF editing.
- Paragraph styles are editable; reusable named character styles are not implemented. Mixed selections use active/mixed style controls rather than a full Word-style tri-state inspector for every mark.
- Inline images are block nodes, resize proportionally through properties, with captions as separate styled paragraphs. No drag resize handles. GIF/WebP insertion from a file is normalised to PNG by Electron; animated images are not preserved as animation.
- Comments use persistent text marks; deletion of an entire anchor retains an orphaned comment. Overlapping/nested comment ranges are outside the supported subset. Comment collection changes, page settings and style-definition edits are outside text undo history.
- Basic merged cells are available; complex merged-table pagination and repeating headers across all conversion paths are not guaranteed. Avoid page-break nodes inside cells; Insert Page Break places the break after the enclosing table.
- DOCX limitations and lossy-format warnings are documented in COMPATIBILITY.md. Custom paragraph style appearance does not round-trip perfectly through Word. Native files preserve the advertised native features.
- Typewriter scrolling and a word goal are available. There is no long-document virtualisation. Performance figures are measured on the Linux build machine, not a typical Windows laptop. Large content is processed with safety limits, but some conversion/ZIP work is synchronous in the main process.
- US/UK English dictionaries are bundled. No cloud spelling/grammar service. IME composition relies on the upstream Chromium/ProseMirror pipeline and still needs manual Windows IME verification.
- Multi-launch file routing, drag-and-drop paths and Windows shortcuts are implemented, but need Windows execution tests. Minimum window is 900×640; smaller desktop windows are not supported.
- The Windows package is unsigned. The EXE has BeastText icon/version metadata; publisher signing and SmartScreen reputation still require a release signing step. No certificate/account was invented.
- Local installer is provided; no online release has been published and no download-and-run URL is claimed. Installer syntax is tested; Windows install/reinstall/uninstall/registry behaviour is still a release gate.
- Source lives in `/workspace/BeastText` on this host. `C:\BeastTextV1` is the documented Windows destination; a Linux machine cannot create that actual Windows installation or run the Windows EXE.
