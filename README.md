# Markdown Viewer

A lightweight, read-only desktop app for viewing Markdown files on macOS. Built with Electron and React — no editing, no note-taking, just a fast, secure viewer.

## Features

- CommonMark + GitHub Flavored Markdown (tables, task lists, strikethrough, footnotes, autolinks)
- Syntax-highlighted code blocks (Shiki, light/dark aware)
- Mermaid diagrams
- KaTeX math (inline and display)
- GitHub-style Alerts (`> [!NOTE]`, `[!TIP]`, `[!WARNING]`, etc.)
- Full-text search and a table of contents
- Light / Dark / System theme, with support for custom CSS
- Navigates between linked Markdown files in the same window, with back/forward history
- Watches the open file and reloads automatically when it changes on disk
- Sandboxed, security-hardened Electron setup — no Node.js access in the renderer, strict Content-Security-Policy, no `file://` loading

## Installation

Download the latest `.dmg` from [Releases](https://github.com/TakadaJohn-sub/markdown-viewer/releases), open it, and drag **Markdown Viewer** into Applications.

This build isn't code-signed yet, so on first launch macOS will say it "cannot be opened because Apple cannot check it for malicious software." To open it anyway:

1. Right-click (Control-click) **Markdown Viewer** in Applications and choose **Open**.
2. Confirm **Open** in the dialog that appears.

You only need to do this once — after that it opens normally.

## Development

```bash
npm install
npm run dev
```

### Testing

```bash
npm run test       # unit tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright)
npm run typecheck
npm run lint
```

### Building

```bash
npm run package   # unpacked build, for local testing
npm run dist       # signed-locally dmg + zip, for distribution
```

## Known limitations

- Unsigned build — see Installation above. Proper Apple notarization is planned for a future release.
- macOS only for now.
- Read-only by design — this is a viewer, not an editor.

## Design documentation

For the architecture and the reasoning behind it, see [`Markdown Viewer 設計方針書.md`](<./Markdown Viewer 設計方針書.md>) (Japanese).

## License

[MIT](./LICENSE)
