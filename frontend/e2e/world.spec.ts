import { expect, test, type Page } from '@playwright/test'

async function stubPhotos(page: Page) {
  await page.route('https://www.immersivetourz.com/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  )
}

test('find a landmark, open its exact published panorama and return to its location', async ({
  page,
}) => {
  // Keep the automated suite deterministic and independent of the tour operator.
  await stubPhotos(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Explore Main Campus', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Find a place' }).click()
  await page.getByLabel('Search the directory').fill('Dutee')
  await page.getByRole('dialog').getByRole('button', { name: 'Dutee Chand Stadium Sports' }).click()
  await expect(page.getByRole('heading', { name: 'Dutee Chand Stadium' })).toBeVisible()
  const coords = await page.locator('.wc-coordinates').innerText()
  expect(coords).toMatch(/20\.358[0-9]° N/)
  await page.getByRole('button', { name: 'Enter 360° view' }).click()
  await expect(page).toHaveURL(/scene=390$/)
  await expect(page.locator('.wc-cube-face img')).toHaveCount(24)
  await expect(page.locator('.wc-cube-face img').first()).toHaveAttribute(
    'src',
    /panorama_4B98AB3A_7C5F_B2FE_41D4_AB3D8813665E_0/,
  )
  const initial = await page.locator('.wc-cube').getAttribute('style')
  await page.getByRole('button', { name: 'Turn right' }).click()
  await expect(page.locator('.wc-cube')).not.toHaveAttribute('style', initial!)
  await page.getByRole('button', { name: 'Reset panorama view' }).click()
  await expect(page.locator('.wc-cube')).toHaveAttribute('style', initial!)

  await expect(
    page.getByRole('link', { name: 'Open panorama on the official tour site' }),
  ).toHaveAttribute('href', /index\.html#media=390$/)
  await page.getByRole('button', { name: 'World map' }).click()
  await expect(page.locator('.wc-coordinates')).toHaveText(coords)
  await expect(page.getByRole('heading', { name: 'Dutee Chand Stadium' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset map view' }).click()
  await expect(page.getByRole('heading', { name: 'Dutee Chand Stadium' })).toHaveCount(0)
})

test('directory distinguishes repeated panorama titles and resolves the final view on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await stubPhotos(page)
  await page.goto('/')
  await page.getByRole('button', { name: '360° tours' }).click()
  await expect(page.getByRole('dialog').getByText('519 views', { exact: true })).toBeVisible()
  await page.getByLabel('Search the directory').fill('not-a-campus-view')
  await expect(page.getByText(/No matches/)).toBeVisible()
  await page.getByLabel('Search the directory').fill('Main Gate')
  await expect(page.getByRole('button', { name: /^Main Gate .*View 15$/ })).toBeVisible()
  await page.getByRole('button', { name: 'Main Gate (1) Official tour · View 519', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Open panorama on the official tour site' }),
  ).toHaveAttribute('href', /index\.html#media=519$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Main Gate (1)' })).toBeVisible()
  await page.getByRole('button', { name: 'World map' }).click()
  await expect(page.getByRole('button', { name: 'Find a place' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('locally rendered map supports keyboard, drag, zoom, theme persistence and the team route', async ({
  page,
}) => {
  await page.goto('/')
  const marker = page.getByRole('button', { name: 'Explore Main Campus', exact: true })
  await expect(marker).toBeVisible()
  const origin = await page.locator('.wc-coordinates').innerText()
  await page.locator('canvas').focus()
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('.wc-coordinates')).not.toHaveText(origin)
  const p = await marker.boundingBox()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(async () => (await marker.boundingBox())?.x).not.toBe(p?.x)
  await page.getByRole('button', { name: 'Reset map view' }).click()
  await page.mouse.move(280, 330)
  await page.mouse.down()
  await page.mouse.move(365, 340, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('.wc-coordinates')).not.toHaveText(origin)
  await page.getByRole('button', { name: 'Switch to night theme' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to day theme' })).toBeVisible()
  await page.getByRole('link', { name: 'Team workspace' }).click()
  await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible()
  await page.getByRole('link', { name: 'KIIT world' }).click()
  await expect(marker).toBeVisible()
})

test('official school and floor metadata makes unnamed interiors discoverable', async ({ page }) => {
  await stubPhotos(page)
  await page.goto('/?scene=46')
  await page.getByRole('button', { name: 'Find a scene' }).click()
  await page.getByLabel('Search the directory').fill('central library first floor')
  await page.getByRole('button', { name: /^First Floor Central Library · View 62$/ }).click()
  await expect(
    page.getByRole('link', { name: 'Open panorama on the official tour site' }),
  ).toHaveAttribute('href', /index\.html#media=62$/)
  await page.getByRole('button', { name: 'Find a scene' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Landmarks 18/ })
    .click()
  await page.getByLabel('Search the directory').fill('Architecture')
  await page.getByRole('button', { name: 'Architecture Building Learning' }).click()
  await expect(page.getByRole('heading', { name: 'Architecture Building' })).toBeVisible()
  await page.getByRole('button', { name: 'Enter 360° view' }).click()
  await expect(
    page.getByRole('link', { name: 'Open panorama on the official tour site' }),
  ).toHaveAttribute('href', /index\.html#media=242$/)
})

test('walk follows mapped streets with a visible avatar and mobile directional controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.world-pin').first()).toBeVisible()
  await page.getByRole('button', { name: 'Walk', exact: true }).click()
  await expect(page.getByLabel('Your position')).toBeVisible()
  const spawn = await page.locator('.wc-coordinates').innerText()
  await page.getByRole('button', { name: 'Walk right' }).click()
  await page.getByRole('button', { name: 'Walk right' }).click()
  await expect(page.locator('.wc-coordinates')).not.toHaveText(spawn)
  await page.getByRole('button', { name: 'End walk' }).click()
  await expect(page.getByLabel('Your position')).toHaveCount(0)
})
