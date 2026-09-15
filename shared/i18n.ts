import type { DocumentErrorCode } from './ipc'
import type { ThemeSource } from './theme'

export type Locale = 'ja' | 'en'

export function resolveLocale(tag: string): Locale {
  return tag.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export interface Messages {
  appName: string
  menu: {
    file: string
    open: string
    openRecent: string
    edit: string
    find: string
    findNext: string
    findPrevious: string
    view: string
    reload: string
    goBack: string
    goForward: string
    toggleToc: string
    customCss: string
    appearance: string
    theme: Record<ThemeSource, string>
    actualSize: string
    zoomIn: string
    zoomOut: string
    reloadUi: string
  }
  dialog: {
    openTitle: string
    markdownFilter: string
  }
  welcome: {
    dropHint: string
    openButton: string
    defaultAppHint: string
  }
  dropOverlay: string
  lossyEncoding: string
  error: {
    title: string
    retry: string
    openAnother: string
    renderFailed: string
    codes: Record<DocumentErrorCode, string>
  }
  banner: {
    largeFileSkipHighlight: string
    linkNotFound: string
    linkUnsupported: string
    fileDeleted: string
  }
  mermaid: {
    renderFailed: string
  }
  toc: {
    title: string
    empty: string
  }
  confirmLarge: {
    title: string
    message: string
    showPlainText: string
    renderAnyway: string
  }
  customCssPanel: {
    title: string
    placeholder: string
    close: string
  }
  image: {
    notFound: string
    insecure: string
  }
  codeBlock: {
    copy: string
    copied: string
  }
  search: {
    placeholder: string
    caseSensitive: string
    previous: string
    next: string
    close: string
    noMatches: string
    manyMatches: string
  }
}

const ja: Messages = {
  appName: 'Markdown Viewer',
  menu: {
    file: 'ファイル',
    open: '開く…',
    openRecent: '最近使った項目を開く',
    edit: '編集',
    find: '検索',
    findNext: '次を検索',
    findPrevious: '前を検索',
    view: '表示',
    reload: '再読み込み',
    goBack: '戻る',
    goForward: '進む',
    toggleToc: '目次を表示',
    customCss: 'カスタムCSS…',
    appearance: '外観',
    theme: { system: 'システムに合わせる', light: 'ライト', dark: 'ダーク' },
    actualSize: '実際のサイズ',
    zoomIn: '拡大',
    zoomOut: '縮小',
    reloadUi: 'UI を再読み込み',
  },
  dialog: {
    openTitle: 'Markdown ファイルを開く',
    markdownFilter: 'Markdown',
  },
  welcome: {
    dropHint: '.md ファイルをここにドラッグ＆ドロップ',
    openButton: 'ファイルを開く',
    defaultAppHint:
      'Finder で .md ファイルを選び「情報を見る」→「このアプリケーションで開く」→「すべてを変更」で、ダブルクリックで開けるようになります。',
  },
  dropOverlay: 'ドロップして開く',
  lossyEncoding: '文字コードを判別できませんでした。一部の文字が正しく表示されていない可能性があります。',
  error: {
    title: 'ファイルを開けませんでした',
    retry: '再試行',
    openAnother: '別のファイルを開く',
    renderFailed: '表示の処理中にエラーが発生しました。',
    codes: {
      'not-found': 'ファイルが見つかりません。',
      'permission-denied': 'ファイルを読み取る権限がありません。',
      'not-a-file': 'ファイルではありません。',
      'not-markdown': 'Markdown ファイルではありません。',
      'too-large': 'ファイルが大きすぎます（上限 20 MB）。',
      binary: 'バイナリファイルのため表示できません。',
      'read-failed': 'ファイルの読み込み中にエラーが発生しました。',
    },
  },
  banner: {
    largeFileSkipHighlight: 'ファイルが大きいため、コードのハイライトを省略しています。',
    linkNotFound: 'リンク先が見つかりません。',
    linkUnsupported: 'このリンクは開けません。',
    fileDeleted: 'ファイルが削除されました。',
  },
  mermaid: {
    renderFailed: '図を表示できませんでした',
  },
  toc: {
    title: '目次',
    empty: '見出しがありません',
  },
  confirmLarge: {
    title: '大きなファイルです',
    message: 'このファイルは大きいため、表示に時間がかかる場合があります。',
    showPlainText: 'プレーンテキストで表示',
    renderAnyway: 'それでもレンダリングする',
  },
  customCssPanel: {
    title: 'カスタムCSS',
    placeholder: '/* ここにCSSを入力すると、この文書に即座に反映されます */',
    close: '閉じる',
  },
  image: {
    notFound: '[ 画像が見つかりません ]',
    insecure: '[ 安全でない画像です (http) ]',
  },
  codeBlock: {
    copy: 'Copy',
    copied: 'Copied',
  },
  search: {
    placeholder: '検索',
    caseSensitive: '大文字と小文字を区別',
    previous: '前を検索',
    next: '次を検索',
    close: '閉じる',
    noMatches: '見つかりません',
    manyMatches: '10000+',
  },
}

const en: Messages = {
  appName: 'Markdown Viewer',
  menu: {
    file: 'File',
    open: 'Open…',
    openRecent: 'Open Recent',
    edit: 'Edit',
    find: 'Find',
    findNext: 'Find Next',
    findPrevious: 'Find Previous',
    view: 'View',
    reload: 'Reload',
    goBack: 'Back',
    goForward: 'Forward',
    toggleToc: 'Show Table of Contents',
    customCss: 'Custom CSS…',
    appearance: 'Appearance',
    theme: { system: 'Use System Setting', light: 'Light', dark: 'Dark' },
    actualSize: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    reloadUi: 'Reload UI',
  },
  dialog: {
    openTitle: 'Open Markdown File',
    markdownFilter: 'Markdown',
  },
  welcome: {
    dropHint: 'Drop a .md file here',
    openButton: 'Open File',
    defaultAppHint:
      'To open .md files with a double-click, select one in Finder, choose Get Info → Open with, and click Change All.',
  },
  dropOverlay: 'Drop to open',
  lossyEncoding: 'The text encoding could not be detected. Some characters may not display correctly.',
  error: {
    title: 'The file could not be opened',
    retry: 'Try Again',
    openAnother: 'Open Another File',
    renderFailed: 'An error occurred while preparing the document.',
    codes: {
      'not-found': 'The file was not found.',
      'permission-denied': 'You do not have permission to read this file.',
      'not-a-file': 'This is not a file.',
      'not-markdown': 'This is not a Markdown file.',
      'too-large': 'The file is too large (limit: 20 MB).',
      binary: 'This is a binary file and cannot be displayed.',
      'read-failed': 'An error occurred while reading the file.',
    },
  },
  banner: {
    largeFileSkipHighlight: 'This file is large, so syntax highlighting has been skipped.',
    linkNotFound: 'That link could not be found.',
    linkUnsupported: 'That link could not be opened.',
    fileDeleted: 'This file has been deleted.',
  },
  mermaid: {
    renderFailed: 'Could not render this diagram',
  },
  toc: {
    title: 'Table of Contents',
    empty: 'No headings',
  },
  confirmLarge: {
    title: 'Large file',
    message: 'This file is large and may take a moment to display.',
    showPlainText: 'Show as Plain Text',
    renderAnyway: 'Render Anyway',
  },
  customCssPanel: {
    title: 'Custom CSS',
    placeholder: '/* Type CSS here — it applies to this document immediately */',
    close: 'Close',
  },
  image: {
    notFound: '[ Image not found ]',
    insecure: '[ Insecure image (http) ]',
  },
  codeBlock: {
    copy: 'Copy',
    copied: 'Copied',
  },
  search: {
    placeholder: 'Find',
    caseSensitive: 'Match case',
    previous: 'Previous match',
    next: 'Next match',
    close: 'Close',
    noMatches: 'No matches',
    manyMatches: '10000+',
  },
}

export const MESSAGES: Record<Locale, Messages> = { ja, en }
