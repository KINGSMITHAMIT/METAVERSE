import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

test.use({ actionTimeout: 15_000 })
test.setTimeout(85_000)

const origin = 'http://localhost:5173'

async function account(browser: Browser, username: string) {
  const context = await browser.newContext({ permissions: ['microphone'] })
  const page = await context.newPage()
  await page.goto(origin + '/?space=team')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill('playwright-demo-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your workspaces' })).toBeVisible()
  return { context, page, username }
}

async function setup(browser: Browser) {
  const suffix = Math.random().toString(36).slice(2, 10)
  const alice = await account(browser, 'alice-' + suffix)
  const bob = await account(browser, 'bob-' + suffix)
  await alice.page.getByLabel('Workspace name').fill('Field Lab')
  await alice.page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(alice.page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15_000 })
  await alice.page.getByLabel('Teammate username').fill(bob.username)
  await alice.page.getByRole('button', { name: 'Create invitation' }).click()
  const code = await alice.page.locator('.invite code').textContent()
  const list = await alice.page.request.get(origin + '/api/workspaces').then(response => response.json())
  return { alice, bob, code: code!, id: list[0].id as string }
}

async function accept(page: Page, code: string) {
  await page.getByLabel('Invitation code').fill(code)
  await page.getByRole('button', { name: 'Join workspace' }).click()
  await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15_000 })
}

function visible(page: Page, username: string) {
  return page.getByRole('list', { name: 'Visible players' }).getByRole('listitem').filter({ hasText: username })
}

async function walk(page: Page, key: string, count: number) {
  for (let step = 0; step < count; step++) {
    await page.keyboard.press(key)
    await page.waitForTimeout(100)
  }
}

async function voiceTicket(page: Page, id: string) {
  const csrf = await page.request.get(origin + '/api/csrf').then(response => response.json())
  return page.request.post(origin + '/api/workspaces/' + id + '/voice', { headers: { 'X-CSRF-TOKEN': csrf.token } })
}

test('invited browser receives movement, wall collisions and a fresh replacement snapshot', async ({ browser }) => {
  const { alice, bob, code, id } = await setup(browser)
  expect((await bob.page.request.get(origin + '/api/workspaces/' + id)).status()).toBe(403)
  const outsider = await bob.page.evaluate(workspace => new Promise(resolve => {
    const ws = new WebSocket('ws://localhost:5173/ws/campus?workspace=' + workspace)
    ws.onopen = () => { ws.close(); resolve(true) }
    ws.onerror = () => resolve(false)
  }), id)
  expect(outsider).toBe(false)
  await bob.page.addInitScript(() => {
    const Native = window.WebSocket
    let blocked = false
    let connection: WebSocket | undefined
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        const gameplay = String(url).includes('/ws/campus')
        super(gameplay && blocked ? 'ws://localhost:5173/unavailable-test-socket' : url, protocols)
        if (gameplay) connection = this
      }
    }
    window.addEventListener('test-socket-drop', () => { blocked = true; connection?.close(4000) })
    window.addEventListener('test-socket-resume', () => { blocked = false })
  })
  await bob.page.reload()
  await accept(bob.page, code)
  await expect(visible(alice.page, bob.username)).toHaveCount(1)
  await walk(bob.page, 'ArrowLeft', 7)
  await expect(visible(alice.page, bob.username)).toHaveAttribute('data-position', '1, 12')
  await expect(bob.page.getByText(/Movement blocked/)).toBeAttached()
  if (process.env.POSITION_MODE !== 'nearby') {
    await expect(visible(bob.page, alice.username)).toHaveCount(1)
  }
  await bob.page.evaluate(() => window.dispatchEvent(new Event('test-socket-drop')))
  await expect(bob.page.getByText('reconnecting', { exact: true })).toBeVisible()
  await walk(alice.page, 'ArrowLeft', 1)
  await bob.page.evaluate(() => window.dispatchEvent(new Event('test-socket-resume')))
  await expect(bob.page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(visible(bob.page, alice.username)).toHaveAttribute('data-position', '5, 12')
  const secondTab = await bob.context.newPage()
  await secondTab.goto(origin + '/?space=team')
  await secondTab.getByRole('button', { name: 'Field Lab' }).click()
  await expect(secondTab.getByText('Live', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(bob.page.getByText('taken over', { exact: true })).toBeVisible()
  await expect(visible(alice.page, bob.username)).toHaveCount(1)
  await walk(secondTab, 'ArrowRight', 1)
  await expect(visible(alice.page, bob.username)).toHaveAttribute('data-position', '2, 12')
  await alice.context.close()
  await bob.context.close()
})

test('real LiveKit voice checks position, opt-in and host removal', async ({ browser }) => {
  test.skip(process.env.VOICE_E2E !== '1', 'Run with VOICE_E2E=1 and local LiveKit credentials.')
  const { alice, bob, code, id } = await setup(browser)
  const outsider = await account(browser, 'other-' + Math.random().toString(36).slice(2, 10))
  expect((await voiceTicket(outsider.page, id)).status()).toBe(403)
  await accept(bob.page, code)
  expect((await voiceTicket(bob.page, id)).status()).toBe(403)
  await Promise.all([alice.page, bob.page].map(async page => {
    await walk(page, 'ArrowUp', 6)
    await walk(page, 'ArrowRight', 15)
    await expect(page.getByLabel('Your position')).toContainText('21, 6')
  }))
  for (const page of [alice.page, bob.page]) {
    await page.getByRole('button', { name: 'Join voice' }).click()
    await expect(page.getByText('Voice connected')).toBeVisible({ timeout: 12_000 })
  }
  await expect(alice.page.locator('.voice audio')).toHaveCount(1, { timeout: 12_000 })
  await expect(bob.page.locator('.voice audio')).toHaveCount(1, { timeout: 12_000 })
  await walk(alice.page, 'ArrowLeft', 1)
  await expect(alice.page.getByText('Voice connected')).toHaveCount(0)
  await expect(bob.page.locator('.voice audio')).toHaveCount(0)
  expect((await voiceTicket(alice.page, id)).status()).toBe(403)
  await alice.page.getByRole('button', { name: 'Remove ' + bob.username + ' from voice' }).click()
  await expect(bob.page.getByText('Voice connected')).toHaveCount(0, { timeout: 8000 })
  expect((await voiceTicket(bob.page, id)).status()).toBe(403)
  await alice.context.close()
  await bob.context.close()
  await outsider.context.close()
})

test('mobile campus preview supports room focus, both views and keyboard help', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/?space=team')
  const campus = page.getByRole('region', { name: 'Campus scene' })
  const canvas = campus.locator('canvas')
  await expect(canvas).toHaveAttribute('width', '980')
  await page.getByRole('button', { name: 'Meeting room Opt-in private voice' }).click()
  await expect(campus.getByRole('button', { name: 'Reset view' })).toBeVisible()
  await page.getByRole('button', { name: 'Floor plan' }).click()
  await expect(canvas).toHaveAttribute('width', '960')
  await campus.getByRole('button', { name: 'Reset view' }).click()
  await expect(campus.getByText('Building overview')).toBeVisible()
  await page.getByRole('button', { name: 'Diorama' }).click()
  await expect(canvas).toHaveAttribute('width', '980')
  const guide = page.getByRole('button', { name: 'Field guide' })
  await guide.click()
  await expect(page.getByRole('dialog', { name: 'Campus field guide' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(guide).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
