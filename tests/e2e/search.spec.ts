import { clickMenuItem, expect, fixturePath, test } from './fixtures'

async function openSearch(app: import('@playwright/test').ElectronApplication, page: import('@playwright/test').Page) {
  await clickMenuItem(app, 'find')
  const input = page.getByRole('textbox', { name: /検索|Find/ })
  await expect(input).toBeFocused()
  return input
}

test.describe('Search (§16)', () => {
  test('opens via the menu, counts matches, and closes on Escape', async ({ app, page }) => {
    await test.step('open the document', async () => {
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
      }, fixturePath('search.md'))
      await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
      await expect(page.getByTestId('document')).toBeVisible()
    })

    const input = await openSearch(app, page)
    await input.fill('apple')
    // Case-insensitive by default: Apple, apple, APPLE.
    await expect(page.locator('.search-bar__count')).toHaveText('1 / 3')

    await page.getByRole('button', { name: /大文字と小文字|Match case/ }).click()
    // Case-sensitive: only the lowercase "apple".
    await expect(page.locator('.search-bar__count')).toHaveText('1 / 1')

    await page.keyboard.press('Escape')
    await expect(page.locator('.search-bar')).toHaveCount(0)
  })

  test('Next/Previous wrap around and Enter/Shift+Enter do the same from the input', async ({ app, page }) => {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
    }, fixturePath('search.md'))
    await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
    await expect(page.getByTestId('document')).toBeVisible()

    const input = await openSearch(app, page)
    await input.fill('apple')
    await expect(page.locator('.search-bar__count')).toHaveText('1 / 3')

    await page.getByRole('button', { name: /次を検索|Next match/ }).click()
    await expect(page.locator('.search-bar__count')).toHaveText('2 / 3')
    await input.press('Enter')
    await expect(page.locator('.search-bar__count')).toHaveText('3 / 3')
    // Wraps back to the first match.
    await input.press('Enter')
    await expect(page.locator('.search-bar__count')).toHaveText('1 / 3')
    await input.press('Shift+Enter')
    await expect(page.locator('.search-bar__count')).toHaveText('3 / 3')
  })

  test('shows a distinct state for zero matches', async ({ app, page }) => {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
    }, fixturePath('search.md'))
    await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
    await expect(page.getByTestId('document')).toBeVisible()

    const input = await openSearch(app, page)
    await input.fill('xyz-not-present')
    await expect(page.locator('.search-bar__count')).toContainText(/見つかりません|No matches/)
    await expect(input).toHaveClass(/search-bar__input--empty/)
  })

  test('IME composition does not move to the next match on Enter', async ({ app, page }) => {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
    }, fixturePath('search.md'))
    await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
    await expect(page.getByTestId('document')).toBeVisible()

    const input = await openSearch(app, page)
    await input.fill('apple')
    await expect(page.locator('.search-bar__count')).toHaveText('1 / 3')
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true })
    // Still on the first match — a composing Enter must not have advanced it.
    await expect(page.locator('.search-bar__count')).toHaveText('1 / 3')
  })

  test('re-focuses and selects existing text when Find is triggered again while already open', async ({ app, page }) => {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
    }, fixturePath('search.md'))
    await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
    await expect(page.getByTestId('document')).toBeVisible()

    const input = await openSearch(app, page)
    await input.fill('apple')
    await page.locator('.markdown-body').click() // move focus elsewhere
    await expect(input).not.toBeFocused()

    await clickMenuItem(app, 'find')
    await expect(input).toBeFocused()
    const selected = await input.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0))
    expect(selected).toBe('apple')
  })
})
