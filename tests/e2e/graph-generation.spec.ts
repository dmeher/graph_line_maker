import { expect, test } from "@playwright/test";

const editorUrl = "http://localhost:3000/dev/editor-test";

const vectorizedFixtureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480" viewBox="0 0 320 480">
  <g fill="none" stroke="#111827" stroke-linecap="round" stroke-linejoin="round">
    <path d="M92 458 C116 390 130 318 116 238 C111 205 91 181 70 153" stroke-width="8"/>
    <path d="M145 456 C172 405 202 347 221 280 C234 232 241 183 265 126" stroke-width="7"/>
    <path d="M54 315 C38 300 31 279 39 264 C57 253 79 270 82 292 C81 310 68 322 54 315 Z" stroke-width="4"/>
    <path d="M75 266 C74 241 88 220 109 221 C130 225 139 251 127 273 C110 295 82 290 75 266 Z" stroke-width="4"/>
    <path d="M181 328 C165 305 169 279 189 269 C214 265 233 290 223 314 C215 337 194 343 181 328 Z" stroke-width="4"/>
    <path d="M218 188 C199 169 199 140 220 129 C243 121 269 142 268 168 C263 196 236 206 218 188 Z" stroke-width="4"/>
    <path d="M123 105 C107 85 112 58 133 48 C155 43 174 64 168 86 C161 109 137 118 123 105 Z" stroke-width="4"/>
  </g>
</svg>`;

function collectConsole(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

async function canvasMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas"))
      .filter((canvas) => canvas.width > 200 && canvas.height > 200)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    const canvas = canvases[0];
    if (!canvas) return null;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    const { width, height } = canvas;
    const data = context.getImageData(0, 0, width, height).data;
    let totalBlack = 0;
    let totalFillGray = 0;
    let maxTopRowBlack = 0;
    const artifactRows: Array<{ y: number; black: number }> = [];
    const topLimit = Math.floor(height * 0.28);

    for (let y = 0; y < height; y += 1) {
      let rowBlack = 0;
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];
        const isBlackInk = alpha > 160 && red < 70 && green < 80 && blue < 95;
        const isFillGray =
          alpha > 160 &&
          red >= 130 &&
          red <= 235 &&
          green >= 130 &&
          green <= 235 &&
          blue >= 130 &&
          blue <= 235 &&
          Math.abs(red - green) <= 20 &&
          Math.abs(green - blue) <= 28;
        if (isBlackInk) {
          rowBlack += 1;
          totalBlack += 1;
        }
        if (isFillGray) totalFillGray += 1;
      }

      if (y < topLimit) {
        maxTopRowBlack = Math.max(maxTopRowBlack, rowBlack);
        if (rowBlack > width * 0.7) artifactRows.push({ y, black: rowBlack });
      }
    }

    return {
      canvasCount: canvases.length,
      width,
      height,
      totalBlack,
      totalFillGray,
      maxTopRowBlack,
      artifactRows,
    };
  });
}

async function waitForRenderedCanvas(page: import("@playwright/test").Page) {
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width >= 320 && canvas.height >= 320),
  );
}

async function mockVectorizer(page: import("@playwright/test").Page) {
  await page.route("**/api/vectorize", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: vectorizedFixtureSvg,
  }));
}

async function openSourceInspector(page: import("@playwright/test").Page, mobile = false) {
  if (mobile) await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Original image Visible" }).click();
  if (mobile) await page.getByRole("button", { name: "Properties", exact: true }).click();
  await page.getByRole("tab", { name: "Selection" }).click();
  return {
    lineAdjustment: page.getByLabel("Line adjustment").first(),
    inkThreshold: page.getByLabel("Ink threshold").first(),
    fidelity: page.getByLabel("Fidelity").first(),
  };
}

test.describe("graph generation", () => {
  test("desktop editor preserves vector fill regions and exposes native-quality controls", async ({ page }, testInfo) => {
    const consoleErrors = collectConsole(page);

    await mockVectorizer(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(editorUrl);
    const controls = await openSourceInspector(page);
    await expect(controls.lineAdjustment).toHaveValue("0");
    await expect(controls.inkThreshold).toHaveValue("210");
    await waitForRenderedCanvas(page);

    const thinMetrics = await canvasMetrics(page);
    expect(thinMetrics).not.toBeNull();
    expect(thinMetrics?.canvasCount).toBeGreaterThan(0);
    expect(thinMetrics?.totalBlack).toBeGreaterThan(1000);
    expect(thinMetrics?.totalFillGray).toBeGreaterThan(500);
    expect(thinMetrics?.artifactRows).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("desktop-vector-controls.png"), fullPage: false });

    await controls.lineAdjustment.fill("-1");
    await expect(controls.lineAdjustment).toHaveValue("-1");
    await controls.inkThreshold.fill("200");
    await expect(controls.inkThreshold).toHaveValue("200");
    const initialFidelity = await controls.fidelity.inputValue();
    const changedFidelity = initialFidelity === "smooth" ? "exact" : "smooth";
    await controls.fidelity.selectOption(changedFidelity);
    await expect(controls.fidelity).toHaveValue(changedFidelity);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(controls.fidelity).toHaveValue(initialFidelity);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(controls.fidelity).toHaveValue(changedFidelity);
    await page.waitForTimeout(700);

    const adjustedMetrics = await canvasMetrics(page);
    expect(adjustedMetrics).not.toBeNull();
    expect(adjustedMetrics?.artifactRows).toEqual([]);
    expect(adjustedMetrics?.totalBlack).toBeGreaterThan(1000);
    expect(consoleErrors).toEqual([]);
  });

  test("mobile editor renders without framework overlay", async ({ page }, testInfo) => {
    const consoleErrors = collectConsole(page);

    await mockVectorizer(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(editorUrl);
    const controls = await openSourceInspector(page, true);
    await expect(controls.lineAdjustment).toBeVisible();
    await expect(controls.inkThreshold).toBeVisible();
    await expect(page.getByText(/Next\.js|Unhandled Runtime Error|Build Error/i)).toHaveCount(0);
    await waitForRenderedCanvas(page);

    const metrics = await canvasMetrics(page);
    expect(metrics).not.toBeNull();
    expect(metrics?.totalBlack).toBeGreaterThan(1000);

    await page.screenshot({ path: testInfo.outputPath("mobile-editor.png"), fullPage: false });
    expect(consoleErrors).toEqual([]);
  });
});
