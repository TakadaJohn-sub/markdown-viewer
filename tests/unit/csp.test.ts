import { describe, expect, it } from 'vitest'
import { PRODUCTION_CSP, developmentCsp } from '../../electron/security/csp'

const directive = (policy: string, name: string) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))

describe('PRODUCTION_CSP', () => {
  it('only runs scripts from the bundle', () => {
    expect(directive(PRODUCTION_CSP, 'script-src')).toBe("script-src 'self'")
    expect(PRODUCTION_CSP).not.toContain('unsafe-eval')
  })

  it('denies everything not listed and blocks embedding', () => {
    expect(directive(PRODUCTION_CSP, 'default-src')).toBe("default-src 'none'")
    expect(directive(PRODUCTION_CSP, 'object-src')).toBe("object-src 'none'")
    expect(directive(PRODUCTION_CSP, 'frame-src')).toBe("frame-src 'none'")
    expect(directive(PRODUCTION_CSP, 'base-uri')).toBe("base-uri 'none'")
  })

  it('loads local images only through the asset scheme', () => {
    expect(directive(PRODUCTION_CSP, 'img-src')).toBe("img-src 'self' mdv-asset: https: data:")
  })
})

describe('developmentCsp', () => {
  it('allows the HMR websocket and the React Refresh preamble only in development', () => {
    const policy = developmentCsp('http://localhost:5173/')
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self' ws://localhost:5173")
    expect(directive(policy, 'script-src')).toBe("script-src 'self' 'unsafe-inline'")
    expect(policy).not.toContain('unsafe-eval')
  })
})
