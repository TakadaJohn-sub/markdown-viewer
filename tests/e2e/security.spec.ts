import { pathToFileURL } from 'node:url'
import { toAssetUrl } from '../../shared/asset-url'
import { expect, fixturePath, test } from './fixtures'

test('the renderer has no Node.js access and only the documented API', async ({ page }) => {
  const globals = await page.evaluate(() => ({
    require: typeof (window as { require?: unknown }).require,
    process: typeof (window as { process?: unknown }).process,
    api: Object.keys(window.mdv).sort(),
  }))
  expect(globals).toEqual({
    require: 'undefined',
    process: 'undefined',
    api: [
      'followLink',
      'getInitialState',
      'goBack',
      'goForward',
      'onDocument',
      'onFileState',
      'onMenuCommand',
      'openDialog',
      'openDroppedFiles',
      'reload',
      'setCustomCss',
      'setTocVisible',
    ],
  })
})

test('the Content Security Policy blocks eval, injected scripts and inline handlers', async ({ app, page }) => {
  // page.evaluate() itself is exempt from the eval check (CDP allowUnsafeEvalBlockedByCSP),
  // so eval is exercised through a string timer and executeJavaScript instead.
  const result = await page.evaluate(async () => {
    const flags = window as { injected?: boolean; handlerRan?: boolean; timerRan?: boolean }
    const violations: string[] = []
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`),
    )

    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- string timers compile code at runtime, which CSP must refuse.
    setTimeout('window.timerRan = true', 0)

    const script = document.createElement('script')
    script.textContent = 'window.injected = true'
    document.body.append(script)

    const container = document.createElement('div')
    container.innerHTML = '<img src="data:," onerror="window.handlerRan = true">'
    document.body.append(container)

    await new Promise((resolve) => setTimeout(resolve, 200))
    return {
      timerRan: flags.timerRan === true,
      injected: flags.injected === true,
      handlerRan: flags.handlerRan === true,
      violations,
    }
  })
  expect(result).toMatchObject({ timerRan: false, injected: false, handlerRan: false })
  expect(result.violations).toEqual(
    expect.arrayContaining(['script-src eval', 'script-src-elem inline', 'script-src-attr inline']),
  )

  const evalOutcome: unknown = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(
      "(() => { try { (0, eval)('1'); return 'allowed' } catch (error) { return error.name } })()",
    ),
  )
  expect(evalOutcome).toBe('EvalError')
})

test('the page cannot navigate away or open new windows', async ({ app, page }) => {
  expect(await page.evaluate(() => window.open('https://example.com/'))).toBeNull()
  for (const url of ['https://example.com/', 'file:///etc/hosts']) {
    await page.evaluate((target) => {
      window.location.href = target
    }, url)
  }
  await page.waitForTimeout(500)

  // Ask the main process directly: Playwright keeps waiting for the navigation it saw start.
  const state = await app.evaluate(async ({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows()
    const contents = windows[0]?.webContents
    return {
      windows: windows.length,
      url: contents?.getURL(),
      welcomeShown: (await contents?.executeJavaScript("!!document.querySelector('[data-testid=welcome]')")) as boolean,
    }
  })
  expect(state).toEqual({ windows: 1, url: 'app://bundle/index.html', welcomeShown: true })
})

test('local images load only through the image-only asset scheme', async ({ page }) => {
  const fileUrl = (name: string) => pathToFileURL(fixturePath(name)).href

  const result = await page.evaluate(
    async ({ image, notImage, rawFile }) => {
      const load = (src: string) =>
        new Promise<string>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(`loaded ${img.naturalWidth}x${img.naturalHeight}`)
          img.onerror = () => resolve('error')
          img.src = src
        })
      let fetchOutcome = 'allowed'
      try {
        await fetch(image)
      } catch {
        fetchOutcome = 'blocked'
      }
      return { image: await load(image), notImage: await load(notImage), rawFile: await load(rawFile), fetchOutcome }
    },
    {
      image: toAssetUrl(fileUrl('pixel.png')),
      notImage: toAssetUrl(fileUrl('hello.md')),
      rawFile: fileUrl('pixel.png'),
    },
  )

  expect(result).toEqual({ image: 'loaded 1x1', notImage: 'error', rawFile: 'error', fetchOutcome: 'blocked' })
})

test('web permissions are denied', async ({ page }) => {
  const states = await page.evaluate(() =>
    Promise.all(
      (['geolocation', 'notifications'] as PermissionName[]).map(
        async (name) => (await navigator.permissions.query({ name })).state,
      ),
    ),
  )
  expect(states).toEqual(['denied', 'denied'])
})
