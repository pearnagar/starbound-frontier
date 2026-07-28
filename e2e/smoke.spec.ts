import { expect, test } from '@playwright/test'

test('application shell loads without console or page errors', async ({ page }) => {
  const pageErrors: Error[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Starbound Frontier' })).toBeVisible()

  expect(
    pageErrors,
    `Uncaught page errors: ${pageErrors.map((e) => e.message).join(', ')}`,
  ).toHaveLength(0)
  expect(consoleErrors, `Console errors: ${consoleErrors.join(', ')}`).toHaveLength(0)
})
