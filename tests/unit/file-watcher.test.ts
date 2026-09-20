import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileWatcher } from '../../electron/file-watcher'
import type { FileWatchEvent } from '../../shared/ipc'

const dirs: string[] = []

function tempFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-watch-'))
  dirs.push(dir)
  const filePath = path.join(dir, 'doc.md')
  fs.writeFileSync(filePath, content)
  return filePath
}

/** Polls instead of a fixed sleep, so a test moves on the moment the event actually fires
 * rather than always paying the full debounce window. */
async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

function collector(): { events: FileWatchEvent[]; onEvent: (event: FileWatchEvent) => void } {
  const events: FileWatchEvent[] = []
  return { events, onEvent: (event) => events.push(event) }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('FileWatcher', () => {
  it('reports a changed file', async () => {
    const filePath = tempFile('first')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(filePath)
      fs.writeFileSync(filePath, 'second')
      await waitFor(() => events.length > 0)
      expect(events).toEqual(['changed'])
    } finally {
      watcher.stop()
    }
  })

  it('catches a change made before the watcher went live, even if no fs event ever arrives', async () => {
    // macOS drops fs events from before the stream is armed; simulate that worst case with a
    // watcher that never fires, so only the post-arm re-check can notice the change.
    vi.spyOn(fs, 'watch').mockImplementation(
      () => Object.assign(new EventEmitter(), { close() {} }) as unknown as fs.FSWatcher,
    )
    const filePath = tempFile('first')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(filePath)
      fs.writeFileSync(filePath, 'second')
      await waitFor(() => events.length > 0)
      expect(events).toEqual(['changed'])
    } finally {
      watcher.stop()
    }
  })

  it('does not report a rewrite of identical content', async () => {
    const filePath = tempFile('same')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(filePath)
      fs.writeFileSync(filePath, 'same')
      // Give the debounced check a chance to run and (correctly) find nothing to report.
      await new Promise((resolve) => setTimeout(resolve, 400))
      expect(events).toEqual([])
    } finally {
      watcher.stop()
    }
  })

  it('reports a deleted file and does not repeat it', async () => {
    const filePath = tempFile('content')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(filePath)
      fs.rmSync(filePath)
      await waitFor(() => events.includes('deleted'))
      expect(events).toEqual(['deleted'])
      // A second recheck while it's still missing must not fire 'deleted' again.
      watcher.recheck()
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(events).toEqual(['deleted'])
    } finally {
      watcher.stop()
    }
  })

  it('reports a deleted-then-recreated file as deleted, then restored', async () => {
    const filePath = tempFile('content')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(filePath)
      fs.rmSync(filePath)
      await waitFor(() => events.includes('deleted'))
      fs.writeFileSync(filePath, 'recreated')
      await waitFor(() => events.includes('restored'))
      expect(events).toEqual(['deleted', 'restored'])
    } finally {
      watcher.stop()
    }
  })

  it('recheck() catches a change even without waiting for an fs event', async () => {
    const filePath = tempFile('first')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(filePath)
      fs.writeFileSync(filePath, 'second')
      watcher.recheck()
      await waitFor(() => events.length > 0)
      expect(events).toEqual(['changed'])
    } finally {
      watcher.stop()
    }
  })

  it('reports nothing once stopped', async () => {
    const filePath = tempFile('first')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    await watcher.watch(filePath)
    watcher.stop()
    fs.writeFileSync(filePath, 'second')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(events).toEqual([])
  })

  it('switching to watch a different file resets what counts as a change', async () => {
    const fileA = tempFile('a1')
    const fileB = tempFile('b1')
    const { events, onEvent } = collector()
    const watcher = new FileWatcher(onEvent)
    try {
      await watcher.watch(fileA)
      await watcher.watch(fileB)
      fs.writeFileSync(fileA, 'a2') // no longer being watched
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(events).toEqual([])
      fs.writeFileSync(fileB, 'b2')
      await waitFor(() => events.length > 0)
      expect(events).toEqual(['changed'])
    } finally {
      watcher.stop()
    }
  })
})
