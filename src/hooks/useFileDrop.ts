import { useEffect, useState } from 'react'

const carriesFiles = (event: DragEvent): boolean => event.dataTransfer?.types.includes('Files') ?? false

/**
 * Makes the whole window a drop target and reports whether files are being dragged over it.
 * Every drag is cancelled so Chromium never navigates to a dropped file or link.
 */
export function useFileDrop(onFiles: (files: File[]) => void): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    // dragenter/dragleave fire for every child element crossed, so count the nesting.
    let depth = 0
    const onDragEnter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth += 1
      setActive(true)
    }
    const onDragLeave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setActive(false)
    }
    const onDragOver = (event: DragEvent) => {
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = carriesFiles(event) ? 'copy' : 'none'
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      depth = 0
      setActive(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) onFiles(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFiles])

  return active
}
