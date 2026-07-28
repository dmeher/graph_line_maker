import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function expectCommandCanvasBox(
  locator: Locator,
  expected: { x: number; y: number; width: number; height: number },
) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Command Canvas element is not measurable");
  expect(Math.abs(box.x - expected.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.y - expected.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.width - expected.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - expected.height)).toBeLessThanOrEqual(2);
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

  test("desktop editor exposes the Command Canvas pods and command workflow", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await mockVectorizer(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/dev/editor-test");

    const toolbar = page.locator(".editor-dark-toolbar");
    await expect(page.locator('[data-editor-layout="atelier"]')).toBeVisible();
    await expect(page.locator('[data-editor-design="floating-studio"]')).toBeVisible();
    await expect(page.locator('[data-editor-generation="command-canvas"]')).toBeVisible();
    await expect(page.locator('[data-editor-region="tool-rail"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Lasso" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: /Switch editor to (light|dark) mode/ })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Open command palette" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Save project", exact: true })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Export project", exact: true })).toBeVisible();
    await expect(page.locator('[data-editor-pod="tools"]')).toBeVisible();
    await expect(page.locator('[data-editor-pod="scene"]')).toBeVisible();
    await expect(page.locator('[data-editor-pod="selection"]')).toHaveCount(0);
    await expect(page.locator('[data-editor-pod="navigator"]')).toBeVisible();
    await expect(page.locator('[data-editor-pod="focus"]')).toBeVisible();
    await expect(page.locator(".editor-document-panel").getByRole("tab", { name: /Layers/ })).toHaveAttribute("aria-controls", "editor-document-panel-layers");
    await expect(page.locator(".editor-document-panel").getByRole("tabpanel", { name: /Layers/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Canvas" })).toBeAttached();
    const inspector = page.locator(".editor-inspector");
    const inspectorModes = inspector.getByRole("tablist", { name: "Inspector modes" });
    await expect(inspectorModes).toHaveAttribute("aria-orientation", "horizontal");
    for (const mode of ["Document", "Selection", "Create", "Color"]) {
      await expect(inspectorModes.getByRole("tab", { name: mode, exact: true })).toBeVisible();
    }
    await expect(page.locator(".editor-inspector").getByRole("tablist", { name: "Document views" })).toBeVisible();
    await expect(page.locator(".editor-inspector").getByRole("tab", { name: "Selection" })).toBeVisible();
    await expect(page.locator(".editor-inspector").getByRole("tab", { name: "Create" })).toBeVisible();
    await expect(page.locator('[data-focus-console-shelf="graph"]')).toBeVisible();
    await expect(page.locator(".focus-console__workspace")).toBeVisible();
    await expect(page.locator(".focus-console__command-shelf")).toBeVisible();
    const documentShelf = page.locator('[data-focus-console-shelf="graph"]');
    await expect(documentShelf.getByRole("spinbutton", { name: "Width" })).toBeVisible();
    await expect(documentShelf.getByRole("spinbutton", { name: "Height" })).toBeVisible();
    const documentSizePanel = page.locator(".editor-inspector").getByRole("tabpanel", { name: "Size" });
    await expect(documentSizePanel.locator(".editor-inspector__flat-section-heading")).toContainText("Graph and artwork size");
    await expect(documentSizePanel.locator(".editor-inspector-disclosure")).toHaveCount(0);
    await inspector.getByRole("tab", { name: "Create" }).click();
    await expect(
      page.locator('[data-focus-console-shelf="draw"]').getByRole("group", { name: "Create mode" }),
    ).toBeVisible();
    await expect(page.locator(".editor-inspector__create-workbench")).toBeVisible();
    await inspector.getByRole("tab", { name: "Color" }).click();
    await expect(page.locator('[data-focus-console-shelf="palette"]')).toBeVisible();
    await inspector.getByRole("tab", { name: "Document" }).click();
    await expect(page.locator('[data-focus-console-shelf="graph"]')).toBeVisible();
    const statusAnnouncer = page.locator('.editor-status-announcer[aria-live="polite"][data-editor-region="status-bar"]');
    await expect(statusAnnouncer).toHaveCount(1);
    const canvasLoader = page.locator(".editor-canvas-loader");
    await expect(canvasLoader).toHaveCount(1);
    await expect(canvasLoader).toHaveAttribute("aria-hidden", "true");
    await expect(canvasLoader).toHaveAttribute("data-visible", "false");
    const canvasWorkspace = page.getByRole("region", { name: "Canvas workspace" });
    await expect(canvasWorkspace).toHaveAttribute("aria-busy", "false");
    await expect(canvasWorkspace).toHaveAttribute("data-canvas-loading", "false");
    await expect(canvasWorkspace).toHaveAttribute("data-canvas-state", "ready");
    await expect(canvasLoader).toHaveAttribute("data-phase", /^(assets|render|error)$/);
    const navigatorStatus = page.locator('[data-editor-pod="navigator"] [data-navigator-status="visual"]');
    await expect(navigatorStatus).toBeVisible();
    await expect(navigatorStatus.locator("[data-status-item]")).toHaveCount(2);
    await expect(navigatorStatus.locator(".editor-navigator-status__label")).not.toHaveText("");
    await expect(page.locator("[data-status-capsule]")).toHaveCount(0);
    await expect(page.locator(".editor-canvas-processing")).toHaveCount(0);
    const gridNumberToggle = page.locator('[data-editor-region="navigator"]').getByRole("button", { name: "Toggle graph grid numbers" });
    await gridNumberToggle.click();
    await expect(canvasLoader).toHaveAttribute("data-visible", "false");
    await gridNumberToggle.click();
    await expect(canvasLoader).toHaveAttribute("data-visible", "false");

    const toolRail = page.locator('[data-editor-region="tool-rail"]');
    const drawLineTool = toolRail.getByRole("button", { name: "Draw Line" });
    await drawLineTool.click();
    await expect(drawLineTool).toHaveAttribute("aria-pressed", "true");
    await expect(canvasLoader).toHaveAttribute("data-visible", "false");
    const lineWorkbench = inspector.locator('.editor-inspector__create-workbench[data-create-tool="line"]');
    await expect(lineWorkbench).toBeVisible();
    await expect(lineWorkbench.locator(".editor-inspector__lens-tabs")).toHaveCount(0);
    await expect(lineWorkbench.getByRole("button", { name: "Line" })).toHaveAttribute("aria-pressed", "true");
    await expect(lineWorkbench.getByRole("button", { name: "Arrow" })).toBeVisible();
    await expect(lineWorkbench.getByLabel("Thickness")).toBeVisible();
    await expect(lineWorkbench.getByLabel("Line style")).toHaveValue("solid");

    const drawShapeTool = toolRail.getByRole("button", { name: "Draw Shape" });
    await drawShapeTool.click();
    await expect(drawShapeTool).toHaveAttribute("aria-pressed", "true");
    const shapeWorkbench = inspector.locator('.editor-inspector__create-workbench[data-create-tool="shape"]');
    await expect(shapeWorkbench).toBeVisible();
    await expect(shapeWorkbench.locator(".editor-inspector__lens-tabs")).toHaveCount(0);
    await expect(shapeWorkbench.locator('.editor-inspector__kind-grid--shape [aria-pressed="true"]')).toHaveCount(0);
    await shapeWorkbench.getByRole("button", { name: "Rectangle" }).click();
    await expect(shapeWorkbench.getByRole("button", { name: "Rectangle" })).toHaveAttribute("aria-pressed", "true");

    const lassoTool = toolRail.getByRole("button", { name: "Lasso" });
    await lassoTool.click();
    await expect(lassoTool).toHaveAttribute("aria-pressed", "true");
    await toolRail.getByRole("button", { name: "Select" }).click();

    await toolbar.getByRole("button", { name: "Export project", exact: true }).click();
    const exportMenu = page.getByRole("menu", { name: "Export format" });
    await expect(exportMenu.getByRole("menuitem")).toHaveCount(4);
    await expect(exportMenu.getByRole("menuitem", { name: "PNG" })).toBeVisible();
    await expect(exportMenu.getByRole("menuitem", { name: "PDF" })).toBeVisible();
    await expect(exportMenu.getByRole("menuitem", { name: "JSON" })).toBeVisible();
    await expect(exportMenu.getByRole("menuitem", { name: "Print" })).toBeVisible();
    await toolbar.getByRole("button", { name: "Export project", exact: true }).click();

    await page.keyboard.press("Control+K");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.getByRole("combobox", { name: "Search commands" }).fill("open assets");
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-panel-tabpanel="library"]')).toBeVisible();
    await expect(page.locator('[data-assets-pane="sources"]')).toBeVisible();
    await expect(page.locator('[data-assets-pane="clipart"]')).toBeVisible();
    await expect(page.locator('[data-panel-tabpanel="library"]').getByRole("heading", { name: "Sources" })).toBeVisible();
    await expect(page.locator('[data-panel-tabpanel="library"]').getByRole("heading", { name: "Reusable clipart" })).toBeVisible();
    await expect(page.getByLabel("Add source images")).toBeAttached();
    await expect(page.locator('input[type="file"][aria-label="Upload clipart"]')).toBeAttached();
    await page.locator(".editor-document-panel").getByRole("tab", { name: /Layers/ }).click();
    await page.locator('[data-panel-tabpanel="layers"]').getByRole("button", { name: /^Select / }).first().click();
    const backgroundRemovalTool = toolRail.getByRole("button", { name: "Remove background" });
    await backgroundRemovalTool.click();
    await expect(backgroundRemovalTool).toHaveAttribute("aria-pressed", "true");
    const imageEraserTool = toolRail.getByRole("button", { name: "Erase image" });
    await imageEraserTool.click();
    await expect(imageEraserTool).toHaveAttribute("aria-pressed", "true");
    const fillTool = toolRail.getByRole("button", { name: "Fill" });
    await fillTool.click();
    await expect(fillTool).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-focus-console-shelf="palette"]')).toBeVisible();
    await toolRail.getByRole("button", { name: "Select" }).click();
    await inspector.getByRole("tab", { name: "Selection" }).click();
    const selectionViews = inspector.getByRole("tablist", { name: "Selection views" });
    await expect(selectionViews).toBeVisible();
    await expect(selectionViews.getByRole("tab", { name: "Size" })).toBeVisible();
    await expect(selectionViews.getByRole("tab", { name: "Trace" })).toBeVisible();
    await expect(selectionViews.getByRole("tab", { name: "Placement" })).toBeVisible();
    const dimensionUnit = inspector.getByRole("group", { name: "Source dimension unit" });
    await expect(dimensionUnit.getByRole("button", { name: /centimeters/ })).toBeVisible();
    await expect(dimensionUnit.getByRole("button", { name: /inches/ })).toBeVisible();
    await expect(inspector.locator(".editor-inspector__selection-identity")).toHaveCount(0);
    await expect(inspector.locator("[data-inspector-context-heading]")).toHaveCount(0);
    const focusConsole = page.locator('[data-editor-pod="focus"]');
    const selectionShelf = focusConsole.locator('[data-focus-command-shelf="selection"]');
    await expect(selectionShelf).toBeVisible();
    const selectionCommands = selectionShelf.getByRole("toolbar", { name: "Selection commands" });
    await expect(selectionCommands).toBeVisible();
    for (const action of [
      "Copy selection",
      "Paste layers",
      "Rotate selection left",
      "Rotate selection right",
      "Flip selection horizontally",
      "Flip selection vertically",
      "Nudge selection left",
      "Nudge selection up",
      "Nudge selection down",
      "Nudge selection right",
    ]) {
      await expect(selectionCommands.getByRole("button", { name: action, exact: true })).toBeVisible();
    }
    await expect(selectionCommands.getByRole("button", { name: "Copy selection", exact: true })).toBeEnabled();
    await selectionCommands.getByRole("button", { name: "Copy selection", exact: true }).click();
    await expect(selectionCommands.getByRole("button", { name: "Paste layers", exact: true })).toBeEnabled();
    await expect(focusConsole.getByRole("button", { name: "Duplicate selection", exact: true })).toHaveCount(0);
    await expect(focusConsole.getByRole("button", { name: "Lock selection", exact: true })).toHaveCount(0);
    await expect(focusConsole.getByRole("button", { name: "Unlock selection", exact: true })).toHaveCount(0);
    const layerListActions = page.locator('[data-panel-tabpanel="layers"]').getByRole("toolbar", { name: "Layer list actions" });
    await expect(layerListActions).toBeVisible();
    for (const action of ["Group selected layers", "Ungroup selected layers", "Move selected layer up", "Move selected layer down"]) {
      await expect(layerListActions.getByRole("button", { name: action })).toBeVisible();
    }
    await expect(layerListActions.locator('input[aria-label="Replace selected source"]')).toBeAttached();
    await expect(page.locator('[data-panel-tabpanel="layers"]').getByRole("button", { name: /^(Lock|Unlock) / }).first()).toBeVisible();
    for (const title of ["Tools", "Scene", "Focus Console"]) {
      await expect(page.getByRole("button", { name: `Resize ${title} module` })).toBeAttached();
    }
    await expect(page.getByRole("button", { name: "Resize Navigator module" })).toHaveCount(0);
    const selectionTransformStrip = page.locator('[data-editor-region="selection-transform-strip"]');
    await expect(selectionTransformStrip).toBeAttached();
    for (const action of [
      "Rotate selection left",
      "Rotate selection right",
      "Flip selection horizontally",
      "Flip selection vertically",
      "Duplicate selection",
    ]) {
      await expect(selectionTransformStrip.getByRole("button", { name: action })).toBeEnabled();
    }
    const moreSelectionActions = selectionTransformStrip.getByRole("button", { name: "More selection actions" });
    await moreSelectionActions.click();
    await selectionTransformStrip.getByRole("menuitem", { name: "Hide selection" }).click();
    await moreSelectionActions.click();
    await expect(selectionTransformStrip.getByRole("menuitem", { name: "Show selection" })).toBeVisible();
    await selectionTransformStrip.getByRole("menuitem", { name: "Show selection" }).click();
    await moreSelectionActions.click();
    await selectionTransformStrip.getByRole("menuitem", { name: "Lock selection" }).click();
    await expect(moreSelectionActions).toBeEnabled();
    await expect(selectionTransformStrip.getByRole("button", { name: "Rotate selection left" })).toBeDisabled();
    await moreSelectionActions.click();
    await expect(selectionTransformStrip.getByRole("menuitem", { name: "Unlock selection" })).toBeEnabled();
    await expect(selectionTransformStrip.getByRole("menuitem", { name: "Delete selection" })).toBeDisabled();
    await selectionTransformStrip.getByRole("menuitem", { name: "Unlock selection" }).click();
    await expect(selectionTransformStrip.getByRole("button", { name: "Rotate selection left" })).toBeEnabled();
    await page.getByRole("button", { name: "Crop selection" }).click();
    await expect(page.getByRole("dialog", { name: "Crop source image" })).toBeVisible();
    await page.getByRole("dialog", { name: "Crop source image" }).getByRole("button", { name: "Cancel" }).click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width > 300 && canvas.height > 300));
    await expect(page.locator('.editor-canvas-panel canvas[title^="Drag image"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });

  test("Command Canvas modules float, reset, and control the view without remounting artwork", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await mockVectorizer(page);
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.addInitScript(() => localStorage.removeItem("gpm.editor.command-canvas.layout.v1"));
    await page.goto("/dev/editor-test");
    const artworkCanvas = page.locator('.editor-canvas-panel canvas[title^="Drag image"]');
    await expect(artworkCanvas).toHaveCount(1);

    const tools = page.locator('[data-editor-pod="tools"]');
    const scene = page.locator('[data-editor-pod="scene"]');
    const focus = page.locator('[data-editor-pod="focus"]');
    await expectCommandCanvasBox(page.locator(".editor-command-bar"), { x: 180, y: 22, width: 1264, height: 56 });
    await expectCommandCanvasBox(tools, { x: 426, y: 108, width: 68, height: 500 });
    await expectCommandCanvasBox(scene, { x: 16, y: 108, width: 400, height: 904 });
    await expect(page.locator('[data-editor-pod="selection"]')).toHaveCount(0);
    await expectCommandCanvasBox(page.locator('[data-editor-pod="navigator"]'), { x: 1154, y: 112, width: 356, height: 116 });
    await expectCommandCanvasBox(focus, { x: 1088, y: 241, width: 430, height: 771 });
    await expect(page.locator('[data-editor-pod="navigator"] [data-navigator-status="visual"]')).toBeVisible();
    await expect(page.locator("[data-status-capsule]")).toHaveCount(0);

    const focusContent = focus.locator('[data-pod-content-mounted="true"]');
    await focus.getByRole("button", { name: "Collapse Focus Console module", exact: true }).click();
    await expect(focus).toHaveAttribute("data-collapsed", "true");
    await expect(focusContent).toBeAttached();
    await expect(focus.getByText("Focus Console", { exact: true })).toBeVisible();
    await expect(
      focus.locator(".command-canvas-pod__header .command-canvas-pod__meta"),
    ).toBeHidden();
    await focus.getByRole("button", { name: "Expand Focus Console module", exact: true }).click();
    await expect(focus).toHaveAttribute("data-collapsed", "false");
    await expectCommandCanvasBox(focus, { x: 1088, y: 241, width: 430, height: 771 });

    await expect(tools.getByRole("button", { name: /Collapse Tools|Expand Tools/ })).toHaveCount(0);
    await expect(tools.getByRole("button", { name: "Tools module options" })).toHaveCount(0);
    await expect(tools).toHaveAttribute("data-collapsed", "false");
    await expect(tools.locator('[data-pod-content-mounted="true"]')).toBeAttached();
    const toolsHandle = tools.locator(".command-canvas-pod__drag-handle");
    const toolsHandleBox = await toolsHandle.boundingBox();
    if (!toolsHandleBox) throw new Error("Tools drag handle is not measurable");
    await page.mouse.move(toolsHandleBox.x + toolsHandleBox.width / 2, toolsHandleBox.y + toolsHandleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(520, 190, { steps: 8 });
    await page.mouse.up();
    await expect(tools).toHaveAttribute("data-dock", "floating");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("gpm.editor.command-canvas.layout.v1") ?? "{}")?.modules?.tools?.dock)).toBe("floating");
    await page.keyboard.press("Control+K");
    await page.getByRole("combobox", { name: "Search commands" }).fill("reset workspace layout");
    await page.keyboard.press("Enter");
    await expect(tools).toHaveAttribute("data-dock", "tool-spine");

    const sceneResizeTarget = page.getByRole("button", { name: "Resize Scene module" });
    const resizeBox = await sceneResizeTarget.boundingBox();
    if (!resizeBox) throw new Error("Scene resize target is not measurable");
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 40, resizeBox.y + resizeBox.height / 2 + 32, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await scene.boundingBox())?.width ?? 0).toBeGreaterThan(330);
    await expect.poll(async () => (await scene.boundingBox())?.height ?? 0).toBeGreaterThan(440);
    await expect.poll(() => page.evaluate(() => {
      const sceneLayout = JSON.parse(localStorage.getItem("gpm.editor.command-canvas.layout.v1") ?? "{}")?.modules?.scene;
      return Boolean(sceneLayout?.width && sceneLayout?.height);
    })).toBe(true);

    const sceneHandle = scene.locator(".command-canvas-pod__drag-handle");
    const handleBox = await sceneHandle.boundingBox();
    if (!handleBox) throw new Error("Scene drag handle is not measurable");
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(620, 170, { steps: 8 });
    await page.mouse.up();
    await expect(scene).toHaveAttribute("data-dock", "floating");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("gpm.editor.command-canvas.layout.v1") ?? "{}")?.modules?.scene?.dock)).toBe("floating");

    const floatingSceneBox = await scene.boundingBox();
    const floatingHandleBox = await sceneHandle.boundingBox();
    if (!floatingSceneBox || !floatingHandleBox) throw new Error("Floating Scene module is not measurable");
    const handleOffsetX = floatingHandleBox.x + floatingHandleBox.width / 2 - floatingSceneBox.x;
    const handleOffsetY = floatingHandleBox.y + floatingHandleBox.height / 2 - floatingSceneBox.y;
    await page.mouse.move(floatingHandleBox.x + floatingHandleBox.width / 2, floatingHandleBox.y + floatingHandleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(16 + handleOffsetX, 108 + handleOffsetY, { steps: 8 });
    await page.mouse.up();
    await expect(scene).toHaveAttribute("data-dock", "left-main");

    await scene.getByRole("button", { name: "Scene module options" }).click();
    await page.getByRole("menuitem", { name: "Float" }).click();
    await expect(scene).toHaveAttribute("data-dock", "floating");

    await page.keyboard.press("Control+K");
    await page.getByRole("combobox", { name: "Search commands" }).fill("reset workspace layout");
    await page.keyboard.press("Enter");
    await expect(scene).toHaveAttribute("data-dock", "left-main");
    await expectCommandCanvasBox(scene, { x: 16, y: 108, width: 400, height: 904 });

    const navigator = page.locator('[data-editor-region="navigator"]');
    for (let index = 0; index < 8; index += 1) {
      await navigator.getByRole("button", { name: "Zoom in" }).click();
    }
    const scroller = page.locator(".editor-canvas-panel__stage");
    await expect.poll(() => scroller.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await expect.poll(() => scroller.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe("none");
    await expect(navigator.locator("canvas")).toHaveCount(0);
    await expect(navigator.getByRole("group", { name: "Navigator view controls" })).toBeVisible();
    await expect(navigator.getByRole("button", { name: "Fit canvas to view" })).toBeVisible();
    await expect(navigator.getByRole("button", { name: /Collapse Navigator|Expand Navigator/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Navigator module options" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Resize Navigator module" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Move Navigator module/ })).toHaveCount(0);
    await expect(page.locator('[data-editor-pod="navigator"]')).toHaveAttribute("data-dock", "right-top");
    await expect(artworkCanvas).toHaveCount(1);
    expect(consoleErrors).toEqual([]);
  });

  test("tablet editor opens mounted edge drawers without replacing the canvas", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await mockVectorizer(page);
    await page.setViewportSize({ width: 900, height: 720 });
    await page.goto("/dev/editor-test");

    const previewCanvas = page.locator('.editor-canvas-panel canvas[title^="Drag image"]');
    const focusConsole = page.locator('[data-editor-pod="focus"]');
    await expect(previewCanvas).toHaveCount(1);
    await expect(focusConsole).toHaveCount(1);
    await page.getByRole("button", { name: "Show layers" }).click();
    await expect(page.locator('[data-editor-pod="scene"]')).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Hide layers" }).click();
    await page.getByRole("button", { name: "Show properties" }).click();
    await expect(focusConsole).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Hide properties" }).click();
    await expect(focusConsole).toBeAttached();
    await page.getByRole("button", { name: "Open navigator" }).click();
    await expect(page.locator('[data-editor-region="navigator"]')).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });

  test("mobile editor keeps the canvas mounted while drawers open", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await mockVectorizer(page);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto("/dev/editor-test");
    await expect(page.locator('[data-editor-generation="command-canvas"]')).toBeVisible();
    const previewCanvas = page.locator('.editor-canvas-panel canvas[title^="Drag image"]');
    const focusConsole = page.locator('[data-editor-pod="focus"]');
    await expect(previewCanvas).toBeVisible();
    await expect(focusConsole).toHaveCount(1);

    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await expect(page.locator(".editor-inspector").getByRole("tablist", { name: "Document views" })).toBeVisible();
    await expect(page.locator('[data-focus-console-shelf="graph"]')).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await expect(focusConsole).toBeAttached();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await expect(page.locator('[data-editor-pod="scene"]')).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lasso" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove background" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Erase image" })).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Tools", exact: true }).click();
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    await expect(page.locator('[data-editor-region="navigator"]')).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("button", { name: /PNG image/ })).toBeVisible();
    await expect(previewCanvas).toBeAttached();
    await expectNoHorizontalOverflow(page);
    expect(consoleErrors).toEqual([]);
  });
});
