import type { ElectronApplication, Page } from '@playwright/test'
import { clickMenuItem, expect, test } from './fixtures'

const prefersDark = (page: Page) => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)
const zoomLevel = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomLevel())

test('the Appearance menu drives prefers-color-scheme and is remembered', async ({ launch }) => {
  const first = await launch()
  await expect(first.page.getByTestId('welcome')).toBeVisible()

  await clickMenuItem(first.app, 'theme-dark')
  await expect.poll(() => prefersDark(first.page)).toBe(true)
  await clickMenuItem(first.app, 'theme-light')
  await expect.poll(() => prefersDark(first.page)).toBe(false)
  await clickMenuItem(first.app, 'theme-dark')
  await first.app.close()

  const second = await launch({ userDataDir: first.userDataDir })
  await expect.poll(() => prefersDark(second.page)).toBe(true)
  const checked = await second.app.evaluate(
    ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('theme-dark')?.checked,
  )
  expect(checked).toBe(true)
})

test('zoom applies to the window and is remembered', async ({ launch }) => {
  const first = await launch()
  await expect(first.page.getByTestId('welcome')).toBeVisible()

  await clickMenuItem(first.app, 'zoom-in')
  await clickMenuItem(first.app, 'zoom-in')
  expect(await zoomLevel(first.app)).toBe(1)
  await first.app.close()

  const second = await launch({ userDataDir: first.userDataDir })
  await expect.poll(() => zoomLevel(second.app)).toBe(1)
  await clickMenuItem(second.app, 'zoom-reset')
  expect(await zoomLevel(second.app)).toBe(0)
})
