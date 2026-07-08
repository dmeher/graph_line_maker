import { expect, test, type Page } from "@playwright/test";

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page, selector = "body") {
  const overflow = await page.locator(selector).first().evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

const flowerSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
  <rect width="320" height="420" fill="#fff"/>
  <g fill="none" stroke="#222" stroke-linecap="round" stroke-linejoin="round">
    <path d="M160 196 C130 160 111 105 129 45 C154 62 166 88 160 196Z" stroke-width="7"/>
    <path d="M161 196 C180 132 214 75 258 54 C269 117 227 174 161 196Z" stroke-width="7"/>
    <path d="M159 198 C107 183 72 147 65 92 C115 99 151 137 159 198Z" stroke-width="7"/>
    <path d="M160 196 L160 326" stroke-width="8"/>
    <path d="M154 286 C104 242 58 243 28 271 C66 316 111 320 154 286Z" stroke-width="7"/>
    <path d="M166 284 C207 240 257 230 294 257 C257 306 210 318 166 284Z" stroke-width="7"/>
    <path d="M88 330 H236 L222 392 H103 Z" stroke-width="8"/>
    <path d="M70 312 H254 V338 H70 Z" stroke-width="8"/>
  </g>
</svg>
`);

test.describe("redesigned app screens", () => {
  test("dashboard, settings, and login match the compact mock structure", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /Create project/i })).toBeVisible();
    await expect(page.getByText("Project name")).toBeVisible();
    await expect(page.getByRole("main").locator("tbody tr").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Signed-in user")).toBeVisible();
    await expect(page.getByText("Allowed users")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add user/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in with email OTP" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verify code" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.locator('input[aria-label^="OTP"]')).toHaveCount(6);
    await expectNoHorizontalOverflow(page);

    expect(consoleErrors).toEqual([]);
  });

  test("create project supports multi-file crop review without submitting to the database", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.goto("/projects/new");
    await expect(page.getByRole("heading", { name: "Project details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Crop review" })).toBeVisible();
    await expect(page.locator(".create-workbench-details").getByText("tulip_01.png")).toBeVisible();

    await page.locator('input[type="file"]').first().setInputFiles([
      { name: "flower-line.svg", mimeType: "image/svg+xml", buffer: flowerSvg },
      { name: "flower-copy.svg", mimeType: "image/svg+xml", buffer: flowerSvg },
    ]);

    await expect(page.locator(".create-workbench-details").getByText("flower-line.svg")).toBeVisible();
    await expect(page.locator(".create-workbench-details").getByText("flower-copy.svg")).toBeVisible();
    await expect(page.getByText("0 of 2 cropped")).toBeVisible();
    await expect(page.getByRole("button", { name: /Next image/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start conversion/i })).toBeEnabled();
    await expectNoHorizontalOverflow(page);

    expect(consoleErrors).toEqual([]);
  });

  test("mock editor exposes all primary editing and export regions", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.setViewportSize({ width: 1488, height: 1056 });
    await page.goto("/projects/mock-editor");
    const toolbar = page.locator(".editor-dark-toolbar");
    await expect(toolbar.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "PNG" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "PDF" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "JSON" })).toBeVisible();
    await expect(page.getByText("Sources")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Canvas" })).toBeVisible();
    await expect(page.getByText("Inspector")).toBeVisible();
    await expect(page.getByRole("button", { name: "Graph" })).toBeVisible();
    await page.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width > 500 && canvas.height > 500));
    await expectNoHorizontalOverflow(page);
    await expectNoHorizontalOverflow(page, ".editor-panel");

    expect(consoleErrors).toEqual([]);
  });

  test("mobile editor keeps source, canvas, and controls tabs reachable", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/projects/mock-editor");
    await expect(page.getByRole("button", { name: "Canvas" })).toBeVisible();
    await page.getByRole("button", { name: "Controls" }).click();
    await expect(page.getByText("Inspector")).toBeVisible();
    await page.getByRole("button", { name: "Source" }).last().click();
    await expect(page.getByText("Sources")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoHorizontalOverflow(page, ".editor-panel");

    expect(consoleErrors).toEqual([]);
  });
});
