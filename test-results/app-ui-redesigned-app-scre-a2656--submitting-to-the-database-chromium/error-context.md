# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-ui.spec.ts >> redesigned app screens >> create project supports multi-file crop review without submitting to the database
- Location: tests\e2e\app-ui.spec.ts:66:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('0 of 2 cropped')
Expected: visible
Error: strict mode violation: getByText('0 of 2 cropped') resolved to 2 elements:
    1) <p class="text-sm font-semibold text-[#101828]">…</p> aka getByText('of 2 cropped').first()
    2) <p class="font-semibold text-[#101828]">…</p> aka getByText('of 2 cropped').nth(1)

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('0 of 2 cropped')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - button "Menu" [ref=e5] [cursor=pointer]:
          - img [ref=e6]
        - link "Graph Pixel Maker dashboard" [ref=e7] [cursor=pointer]:
          - /url: /dashboard
          - generic [ref=e8]:
            - img "Graph Pixel Maker" [ref=e9]
            - paragraph [ref=e20]: Graph Pixel Maker
      - generic [ref=e21]:
        - generic [ref=e22]:
          - img [ref=e23]
          - generic [ref=e25]: Online
        - button "Home" [ref=e26] [cursor=pointer]:
          - img [ref=e27]
        - button "Apps" [ref=e30] [cursor=pointer]:
          - img [ref=e31]
        - button "Help" [ref=e33] [cursor=pointer]:
          - img [ref=e34]
        - button "Theme" [ref=e37] [cursor=pointer]:
          - img [ref=e38]
        - generic [ref=e40]:
          - generic [ref=e41]: TE
          - generic [ref=e42]:
            - paragraph [ref=e43]: Testing Admin
            - paragraph [ref=e44]: admin
          - img [ref=e45]
    - complementary [ref=e47]:
      - navigation "Primary" [ref=e48]:
        - generic [ref=e49]:
          - link "Dashboard" [ref=e50] [cursor=pointer]:
            - /url: /dashboard
            - img [ref=e51]
            - generic [ref=e53]: Dashboard
          - link "Create project" [ref=e54] [cursor=pointer]:
            - /url: /projects/new
            - img [ref=e55]
            - generic [ref=e57]: Create project
          - link "Settings" [ref=e58] [cursor=pointer]:
            - /url: /settings
            - img [ref=e59]
            - generic [ref=e62]: Settings
        - generic [ref=e63]:
          - generic [ref=e64]:
            - img [ref=e65]
            - text: Help
          - button "Sign out" [ref=e69] [cursor=pointer]:
            - img [ref=e70]
            - text: Sign out
    - main [ref=e73]:
      - generic [ref=e75]:
        - generic [ref=e76]:
          - complementary [ref=e77]:
            - heading "Project details" [level=2] [ref=e78]
            - generic [ref=e79]: Title *
            - textbox "Title *" [ref=e80]: flower-line
            - generic [ref=e81]: Description
            - textbox "Description" [ref=e82]: Tulip flower pattern for cross stitch
            - paragraph [ref=e83]: 37 / 500
            - heading "Upload files" [level=2] [ref=e84]
            - paragraph [ref=e85]: Up to 12 images/PDF/SVG (line art recommended)
            - generic [ref=e86] [cursor=pointer]:
              - generic [ref=e87]:
                - img [ref=e88]
                - generic [ref=e91]: Drag & drop files here
                - text: or click to browse
                - generic [ref=e92]: PNG, JPG, SVG, PDF - Max 12 files - Max 50MB each
              - button "Drag & drop files here or click to browse PNG, JPG, SVG, PDF - Max 12 files - Max 50MB each" [ref=e93]
            - generic [ref=e94]:
              - paragraph [ref=e95]: Files (2 / 12)
              - button "Clear all" [ref=e96] [cursor=pointer]
            - generic [ref=e97]:
              - button "flower-line.svg 320 x 420 Full image" [ref=e98] [cursor=pointer]:
                - generic [ref=e99]:
                  - generic [ref=e100]: flower-line.svg
                  - text: 320 x 420
                - generic [ref=e101]: Full image
              - button "flower-copy.svg 320 x 420 Full image" [ref=e102] [cursor=pointer]:
                - generic [ref=e103]:
                  - generic [ref=e104]: flower-copy.svg
                  - text: 320 x 420
                - generic [ref=e105]: Full image
          - complementary [ref=e106]:
            - generic [ref=e107]:
              - generic [ref=e108]:
                - paragraph [ref=e109]: Zoom
                - button [ref=e110] [cursor=pointer]:
                  - img [ref=e111]
                - paragraph [ref=e114]: 100%
                - button [ref=e115] [cursor=pointer]:
                  - img [ref=e116]
              - button "Fit" [ref=e119] [cursor=pointer]:
                - img [ref=e120]
                - text: Fit
              - button "Full image" [ref=e123] [cursor=pointer]:
                - img [ref=e124]
                - text: Full image
              - button "Reset crop" [ref=e129] [cursor=pointer]:
                - img [ref=e130]
                - text: Reset crop
              - paragraph [ref=e133]: Rotate
              - generic [ref=e134]:
                - button [ref=e135] [cursor=pointer]:
                  - img [ref=e136]
                - button [ref=e139] [cursor=pointer]:
                  - img [ref=e140]
              - generic [ref=e143]:
                - paragraph [ref=e144]:
                  - text: Original
                  - text: 320 x 420
                - paragraph [ref=e145]:
                  - text: Crop
                  - text: 860 x 1060
                - paragraph [ref=e146]:
                  - text: Aspect
                  - text: Auto
                - paragraph [ref=e147]:
                  - text: Selection
                  - text: Active
          - main [ref=e148]:
            - generic [ref=e149]:
              - generic [ref=e150]:
                - heading "Crop review" [level=1] [ref=e151]
                - generic [ref=e152]: Crop each image for best results
              - generic [ref=e153]:
                - generic [ref=e154]:
                  - paragraph [ref=e155]: flower-line.svg
                  - paragraph [ref=e156]: 320 x 420 - image/svg+xml - 852 B
                - button "View original" [ref=e157] [cursor=pointer]:
                  - text: View original
                  - img [ref=e158]
            - generic [ref=e163]:
              - generic [ref=e164]: Preparing crop
              - generic [ref=e173]:
                - button "Free" [ref=e174] [cursor=pointer]
                - button "1:1" [ref=e175] [cursor=pointer]
                - button "4:3" [ref=e176] [cursor=pointer]
                - button "16:9" [ref=e177] [cursor=pointer]
                - button "3:4" [ref=e178] [cursor=pointer]
                - button "2:3" [ref=e179] [cursor=pointer]
                - button "Custom" [ref=e180] [cursor=pointer]
            - generic [ref=e181]:
              - button "Previous image" [ref=e182] [cursor=pointer]:
                - img [ref=e183]
                - text: Previous image
              - paragraph [ref=e185]: 0 of 2 cropped
              - button "Next image" [ref=e186] [cursor=pointer]:
                - text: Next image
                - img [ref=e187]
        - generic [ref=e189]:
          - generic [ref=e190]:
            - paragraph [ref=e191]:
              - img [ref=e192]
              - text: Crop review ready.
            - paragraph [ref=e194]: Project creation uploads source files when you start conversion.
          - generic [ref=e195]:
            - generic [ref=e196]:
              - generic [ref=e198]: 0%
              - generic [ref=e199]:
                - paragraph [ref=e200]: 0 of 2 cropped
                - paragraph [ref=e201]: Crop optional before conversion
              - generic [ref=e202]:
                - img [ref=e203]
                - paragraph [ref=e206]: "2"
                - paragraph [ref=e207]: Total files
              - generic [ref=e208]:
                - img [ref=e209]
                - paragraph [ref=e212]: "0"
                - paragraph [ref=e213]: Cropped
              - generic [ref=e214]:
                - img [ref=e215]
                - paragraph [ref=e218]: "2"
                - paragraph [ref=e219]: Remaining
            - generic [ref=e220]:
              - button "Clear all crops" [ref=e221] [cursor=pointer]:
                - img [ref=e222]
                - text: Clear all crops
              - button "Start conversion ->" [ref=e225] [cursor=pointer]:
                - img [ref=e226]
                - text: Start conversion ->
  - button "Open Next.js Dev Tools" [ref=e237] [cursor=pointer]:
    - img [ref=e238]
  - alert [ref=e241]
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | function collectConsoleErrors(page: Page) {
  4   |   const errors: string[] = [];
  5   |   page.on("console", (message) => {
  6   |     if (message.type() === "error") errors.push(message.text());
  7   |   });
  8   |   page.on("pageerror", (error) => {
  9   |     errors.push(error.message);
  10  |   });
  11  |   return errors;
  12  | }
  13  | 
  14  | async function expectNoHorizontalOverflow(page: Page, selector = "body") {
  15  |   const overflow = await page.locator(selector).first().evaluate((element) => ({
  16  |     clientWidth: element.clientWidth,
  17  |     scrollWidth: element.scrollWidth,
  18  |   }));
  19  |   expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
  20  | }
  21  | 
  22  | const flowerSvg = Buffer.from(`
  23  | <svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
  24  |   <rect width="320" height="420" fill="#fff"/>
  25  |   <g fill="none" stroke="#222" stroke-linecap="round" stroke-linejoin="round">
  26  |     <path d="M160 196 C130 160 111 105 129 45 C154 62 166 88 160 196Z" stroke-width="7"/>
  27  |     <path d="M161 196 C180 132 214 75 258 54 C269 117 227 174 161 196Z" stroke-width="7"/>
  28  |     <path d="M159 198 C107 183 72 147 65 92 C115 99 151 137 159 198Z" stroke-width="7"/>
  29  |     <path d="M160 196 L160 326" stroke-width="8"/>
  30  |     <path d="M154 286 C104 242 58 243 28 271 C66 316 111 320 154 286Z" stroke-width="7"/>
  31  |     <path d="M166 284 C207 240 257 230 294 257 C257 306 210 318 166 284Z" stroke-width="7"/>
  32  |     <path d="M88 330 H236 L222 392 H103 Z" stroke-width="8"/>
  33  |     <path d="M70 312 H254 V338 H70 Z" stroke-width="8"/>
  34  |   </g>
  35  | </svg>
  36  | `);
  37  | 
  38  | test.describe("redesigned app screens", () => {
  39  |   test("dashboard, settings, and login match the compact mock structure", async ({ page }) => {
  40  |     const consoleErrors = collectConsoleErrors(page);
  41  | 
  42  |     await page.goto("/dashboard");
  43  |     await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  44  |     await expect(page.getByRole("main").getByRole("link", { name: /Create project/i })).toBeVisible();
  45  |     await expect(page.getByText("Project name")).toBeVisible();
  46  |     await expect(page.getByRole("main").locator("tbody tr").first()).toBeVisible();
  47  |     await expectNoHorizontalOverflow(page);
  48  | 
  49  |     await page.goto("/settings");
  50  |     await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  51  |     await expect(page.getByText("Signed-in user")).toBeVisible();
  52  |     await expect(page.getByText("Allowed users")).toBeVisible();
  53  |     await expect(page.getByRole("button", { name: /Add user/i })).toBeVisible();
  54  |     await expectNoHorizontalOverflow(page);
  55  | 
  56  |     await page.goto("/login");
  57  |     await expect(page.getByRole("heading", { name: "Sign in with email OTP" })).toBeVisible();
  58  |     await expect(page.getByRole("heading", { name: "Verify code" })).toBeVisible();
  59  |     await expect(page.getByLabel("Email")).toBeVisible();
  60  |     await expect(page.locator('input[aria-label^="OTP"]')).toHaveCount(6);
  61  |     await expectNoHorizontalOverflow(page);
  62  | 
  63  |     expect(consoleErrors).toEqual([]);
  64  |   });
  65  | 
  66  |   test("create project supports multi-file crop review without submitting to the database", async ({ page }) => {
  67  |     const consoleErrors = collectConsoleErrors(page);
  68  | 
  69  |     await page.goto("/projects/new");
  70  |     await expect(page.getByRole("heading", { name: "Project details" })).toBeVisible();
  71  |     await expect(page.getByRole("heading", { name: "Crop review" })).toBeVisible();
  72  |     await expect(page.locator(".create-workbench-details").getByText("tulip_01.png")).toBeVisible();
  73  | 
  74  |     await page.locator('input[type="file"]').first().setInputFiles([
  75  |       { name: "flower-line.svg", mimeType: "image/svg+xml", buffer: flowerSvg },
  76  |       { name: "flower-copy.svg", mimeType: "image/svg+xml", buffer: flowerSvg },
  77  |     ]);
  78  | 
  79  |     await expect(page.locator(".create-workbench-details").getByText("flower-line.svg")).toBeVisible();
  80  |     await expect(page.locator(".create-workbench-details").getByText("flower-copy.svg")).toBeVisible();
> 81  |     await expect(page.getByText("0 of 2 cropped")).toBeVisible();
      |                                                    ^ Error: expect(locator).toBeVisible() failed
  82  |     await expect(page.getByRole("button", { name: /Next image/i })).toBeVisible();
  83  |     await expect(page.getByRole("button", { name: /Start conversion/i })).toBeEnabled();
  84  |     await expectNoHorizontalOverflow(page);
  85  | 
  86  |     expect(consoleErrors).toEqual([]);
  87  |   });
  88  | 
  89  |   test("mock editor exposes all primary editing and export regions", async ({ page }) => {
  90  |     const consoleErrors = collectConsoleErrors(page);
  91  | 
  92  |     await page.setViewportSize({ width: 1488, height: 1056 });
  93  |     await page.goto("/projects/mock-editor");
  94  |     const toolbar = page.locator(".editor-dark-toolbar");
  95  |     await expect(toolbar.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
  96  |     await expect(toolbar.getByRole("button", { name: "Save" })).toBeVisible();
  97  |     await expect(toolbar.getByRole("button", { name: "PNG" })).toBeVisible();
  98  |     await expect(toolbar.getByRole("button", { name: "PDF" })).toBeVisible();
  99  |     await expect(toolbar.getByRole("button", { name: "JSON" })).toBeVisible();
  100 |     await expect(page.getByText("Sources")).toBeVisible();
  101 |     await expect(page.getByRole("heading", { name: "Canvas" })).toBeVisible();
  102 |     await expect(page.getByText("Inspector")).toBeVisible();
  103 |     await expect(page.getByRole("button", { name: "Graph" })).toBeVisible();
  104 |     await page.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).some((canvas) => canvas.width > 500 && canvas.height > 500));
  105 |     await expectNoHorizontalOverflow(page);
  106 |     await expectNoHorizontalOverflow(page, ".editor-panel");
  107 | 
  108 |     expect(consoleErrors).toEqual([]);
  109 |   });
  110 | 
  111 |   test("mobile editor keeps source, canvas, and controls tabs reachable", async ({ page }) => {
  112 |     const consoleErrors = collectConsoleErrors(page);
  113 | 
  114 |     await page.setViewportSize({ width: 390, height: 844 });
  115 |     await page.goto("/projects/mock-editor");
  116 |     await expect(page.getByRole("button", { name: "Canvas" })).toBeVisible();
  117 |     await page.getByRole("button", { name: "Controls" }).click();
  118 |     await expect(page.getByText("Inspector")).toBeVisible();
  119 |     await page.getByRole("button", { name: "Source" }).last().click();
  120 |     await expect(page.getByText("Sources")).toBeVisible();
  121 |     await expectNoHorizontalOverflow(page);
  122 |     await expectNoHorizontalOverflow(page, ".editor-panel");
  123 | 
  124 |     expect(consoleErrors).toEqual([]);
  125 |   });
  126 | });
  127 | 
```