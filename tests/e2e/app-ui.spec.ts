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

async function expectNoPageVerticalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    pageHeight: document.documentElement.scrollHeight,
  }));
  expect(overflow.pageHeight).toBeLessThanOrEqual(overflow.viewportHeight + 2);
}

async function mockVectorizer(page: Page) {
  await page.route("**/api/vectorize", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><path d="M40 440 C80 300 150 180 280 40" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round"/></svg>',
  }));
}

const flowerSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
  <rect width="320" height="420" fill="#fff"/>
  <g fill="none" stroke="#222" stroke-linecap="round" stroke-linejoin="round">
    <path d="M160 196 C130 160 111 105 129 45 C154 62 166 88 160 196Z" stroke-width="7"/>
    <path d="M161 196 C180 132 214 75 258 54 C269 117 227 174 161 196Z" stroke-width="7"/>
    <path d="M159 198 C107 183 72 147 65 92 C115 99 151 137 159 198Z" stroke-width="7"/>
    <path d="M160 196 L160 326" stroke-width="8"/>
    <path d="M88 330 H236 L222 392 H103 Z" stroke-width="8"/>
  </g>
</svg>
`);

test.describe("redesigned app screens", () => {
  test("logout supports fetch cleanup and a native form redirect", async ({ request }) => {
    const jsonResponse = await request.post("/api/auth/logout", {
      headers: { accept: "application/json" },
    });
    expect(jsonResponse.status()).toBe(200);
    await expect(jsonResponse.json()).resolves.toEqual({ ok: true, redirectTo: "/login" });
    expect(jsonResponse.headers()["set-cookie"]).toContain("graph_pixel_session=");

    const formResponse = await request.post("/api/auth/logout", {
      headers: { accept: "text/html" },
      maxRedirects: 0,
    });
    expect(formResponse.status()).toBe(303);
    expect(new URL(formResponse.headers().location).pathname).toBe("/login");
    expect(formResponse.headers()["set-cookie"]).toContain("graph_pixel_session=");
  });

  test("login is a focused two-step OTP flow", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.route("**/api/auth/send-otp", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, resendAfterSeconds: 60, expiresInSeconds: 600 }),
    }));

    await page.goto("/login");
    await expect(page.locator(".atelier-auth")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to the studio" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveValue("");
    await expectNoPageVerticalOverflow(page);
    await page.getByLabel("Email address").fill("designer@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();

    await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
    await expect(page.locator('input[aria-label^="Code digit"]')).toHaveCount(6);
    await page.locator('input[aria-label="Code digit 1"]').fill("123456");
    await expect(page.getByRole("button", { name: "Verify and sign in" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await expectNoPageVerticalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });

  test("advanced crop keeps uploads unchanged until Detect artwork is requested", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/dev/crop-test");
    await expect(page.locator(".create-studio")).toHaveAttribute("data-workflow-state", "intake");

    await page.locator('input[type="file"]').setInputFiles([
      { name: "flower-line.svg", mimeType: "image/svg+xml", buffer: flowerSvg },
      { name: "flower-copy.svg", mimeType: "image/svg+xml", buffer: flowerSvg },
    ]);

    await expect(page.getByText("0 of 2 cropped")).toBeVisible();
    await expect(page.getByText("unchanged files upload at original quality")).toBeVisible();
    await page.getByRole("button", { name: "Detect artwork" }).click();
    await expect(page.getByText("1 of 2 cropped")).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Start conversion/i })).toBeEnabled();
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });

  test("desktop editor exposes the left tool deck and adaptive inspector", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await mockVectorizer(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/dev/editor-test");

    const toolbar = page.locator(".editor-dark-toolbar");
    await expect(page.locator('[data-editor-layout="atelier"]')).toBeVisible();
    await expect(page.locator('[data-editor-design="floating-studio"]')).toBeVisible();
    await expect(page.locator('[data-editor-region="tool-rail"]')).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /Switch editor to (light|dark) mode/ })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Save project", exact: true })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Export project", exact: true })).toBeVisible();
    await expect(page.locator(".editor-document-panel").getByText("Document", { exact: true })).toBeVisible();
    await expect(page.locator(".editor-document-panel").getByRole("tab", { name: /Layers/ })).toHaveAttribute("aria-controls", "editor-document-panel-layers");
    await expect(page.locator(".editor-document-panel").getByRole("tabpanel", { name: /Layers/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Canvas" })).toBeVisible();
    await expect(page.locator(".editor-inspector").getByRole("heading", { name: "Document" })).toBeVisible();
    await expect(page.locator(".editor-inspector").getByRole("tab", { name: "Selection" })).toBeVisible();
    await expect(page.locator(".editor-inspector").getByRole("tab", { name: "Create" })).toBeVisible();
    await expect(page.locator('[data-inspector-focus-shelf="document"]')).toBeVisible();
    await expect(page.locator(".editor-status-bar__state")).toHaveCount(1);
    await expect(page.locator(".editor-canvas-processing")).toHaveCount(0);

    await page.locator(".editor-document-panel").getByRole("tab", { name: /Assets/ }).click();
    await expect(page.locator('[data-panel-tabpanel="library"]')).toBeVisible();
    await expect(page.locator('[data-assets-pane="sources"]')).toBeVisible();
    await expect(page.locator('[data-assets-pane="clipart"]')).toBeVisible();
    await expect(page.locator('[data-panel-tabpanel="library"]').getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.locator('[data-panel-tabpanel="library"]').getByRole("heading", { name: "Reusable clipart" })).toBeVisible();
    await expect(page.getByLabel("Add source images")).toBeAttached();
    await expect(page.getByLabel("Upload clipart")).toBeAttached();
    await page.locator(".editor-document-panel").getByRole("tab", { name: /Layers/ }).click();
    await page.locator('[data-panel-tabpanel="layers"]').getByRole("button", { name: /^Select / }).first().click();
    await expect(page.locator('[data-inspector-focus-shelf="selection"]')).toBeVisible();
    await expect(page.getByRole("toolbar", { name: "Selected layer actions" })).toBeVisible();
    await page.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width > 300 && canvas.height > 300));
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });

  test("mobile editor keeps the canvas mounted while drawers open", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await mockVectorizer(page);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/dev/editor-test");
    await expect(page.locator('[data-editor-layout="atelier"]')).toBeVisible();
    const previewCanvas = page.locator(".editor-canvas-host canvas").first();
    await expect(previewCanvas).toBeVisible();

    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await expect(page.locator(".editor-inspector").getByRole("heading", { name: "Document" })).toBeVisible();
    await expect(page.locator('[data-inspector-focus-shelf="document"]')).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await expect(page.locator(".editor-document-panel").getByText("Document", { exact: true })).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });
});
