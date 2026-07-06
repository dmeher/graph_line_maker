import { expect, test } from "@playwright/test";

const editorUrl = "http://localhost:3000/dev/editor-test";

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
        if (rowBlack > width * 0.18) artifactRows.push({ y, black: rowBlack });
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

test.describe("graph generation", () => {
  test("desktop editor preserves fill regions, removes scanline artifact, and changes line thickness", async ({ page }, testInfo) => {
    const consoleErrors = collectConsole(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(editorUrl);
    await expect(page.getByLabel("Image line size")).toHaveValue("0");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width > 1000 && canvas.height > 1000),
    );

    const thinMetrics = await canvasMetrics(page);
    expect(thinMetrics).not.toBeNull();
    expect(thinMetrics?.canvasCount).toBeGreaterThan(0);
    expect(thinMetrics?.totalBlack).toBeGreaterThan(1000);
    expect(thinMetrics?.totalFillGray).toBeGreaterThan(1000);
    expect(thinMetrics?.artifactRows).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("desktop-line-size-0.png"), fullPage: false });

    await page.getByLabel("Fill width").fill("48");
    await expect(page.getByLabel("Fill width")).toHaveValue("48");
    await page.waitForTimeout(700);
    const highFillWidthMetrics = await canvasMetrics(page);
    expect(highFillWidthMetrics).not.toBeNull();
    expect(highFillWidthMetrics?.artifactRows).toEqual([]);
    expect(highFillWidthMetrics?.totalFillGray ?? 0).toBeLessThan((thinMetrics?.totalFillGray ?? 0) * 0.35);

    await page.getByLabel("Fill width").fill("7");
    await expect(page.getByLabel("Fill width")).toHaveValue("7");
    await page.waitForTimeout(700);
    const restoredFillMetrics = await canvasMetrics(page);
    expect(restoredFillMetrics).not.toBeNull();
    expect(restoredFillMetrics?.totalFillGray ?? 0).toBeGreaterThan(highFillWidthMetrics?.totalFillGray ?? 0);

    await page.getByLabel("Image line size").fill("3");
    await expect(page.getByLabel("Image line size")).toHaveValue("3");
    await page.waitForTimeout(700);
    const mediumMetrics = await canvasMetrics(page);
    expect(mediumMetrics).not.toBeNull();
    expect(mediumMetrics?.artifactRows).toEqual([]);
    expect(mediumMetrics?.totalBlack ?? 0).toBeGreaterThan(thinMetrics?.totalBlack ?? 0);

    await page.getByLabel("Image line size").fill("6");
    await expect(page.getByLabel("Image line size")).toHaveValue("6");
    await page.waitForTimeout(700);
    const thickMetrics = await canvasMetrics(page);
    expect(thickMetrics).not.toBeNull();
    expect(thickMetrics?.artifactRows).toEqual([]);
    expect(thickMetrics?.totalBlack ?? 0).toBeGreaterThan(mediumMetrics?.totalBlack ?? 0);

    await page.getByLabel("Gap closing").fill("1");
    await expect(page.getByLabel("Gap closing")).toHaveValue("1");
    await page.getByLabel("Gap closing").fill("0");
    await expect(page.getByLabel("Gap closing")).toHaveValue("0");

    await page.screenshot({ path: testInfo.outputPath("desktop-line-size-6.png"), fullPage: false });
    expect(consoleErrors).toEqual([]);
  });

  test("mobile editor renders without framework overlay", async ({ page }, testInfo) => {
    const consoleErrors = collectConsole(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(editorUrl);
    await page.getByRole("button", { name: "Controls" }).click();
    await expect(page.getByLabel("Image line size")).toBeVisible();
    await expect(page.getByLabel("Fill width")).toBeVisible();
    await expect(page.getByText(/Next\.js|Unhandled Runtime Error|Build Error/i)).toHaveCount(0);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width > 1000 && canvas.height > 1000),
    );

    const metrics = await canvasMetrics(page);
    expect(metrics).not.toBeNull();
    expect(metrics?.totalBlack).toBeGreaterThan(1000);

    await page.screenshot({ path: testInfo.outputPath("mobile-editor.png"), fullPage: false });
    expect(consoleErrors).toEqual([]);
  });
});
