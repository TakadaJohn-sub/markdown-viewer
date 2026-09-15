import { useEffect, useState, type RefObject } from 'react'

/**
 * True once `ref`'s element has entered the viewport (with `rootMargin` of slack on each
 * side), and stays true afterward — used to lazily render a Mermaid diagram only once it's
 * about to be seen (§4.3), not the instant the document mounts.
 */
export function useInViewport(ref: RefObject<Element | null>, rootMargin = '100% 0px'): boolean {
  const [inViewport, setInViewport] = useState(false)

  useEffect(() => {
    if (inViewport) return
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setInViewport(true)
      },
      { rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin, inViewport])

  return inViewport
}
