# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-ui.spec.ts >> redesigned app screens >> dashboard, settings, and login match the compact mock structure
- Location: tests\e2e\app-ui.spec.ts:39:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1282
Received:    1408
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
            - generic [ref=e56]: Dashboard
          - link "Create project" [ref=e57] [cursor=pointer]:
            - /url: /projects/new
            - img [ref=e58]
            - generic [ref=e60]: Create project
          - link "Settings" [ref=e61] [cursor=pointer]:
            - /url: /settings
            - img [ref=e62]
            - generic [ref=e65]: Settings
        - generic [ref=e66]:
          - generic [ref=e67]:
            - img [ref=e68]
            - text: Help
          - button "Sign out" [ref=e72] [cursor=pointer]:
            - img [ref=e73]
            - text: Sign out
    - main [ref=e76]:
      - generic [ref=e77]:
        - generic [ref=e78]:
          - heading "Projects" [level=1] [ref=e80]
          - link "Create project" [ref=e81] [cursor=pointer]:
            - /url: /projects/new
            - text: Create project
            - img [ref=e82]
        - generic [ref=e83]:
          - generic [ref=e84]:
            - img
            - textbox "Search projects" [ref=e85]
          - generic [ref=e86]: Placeholder library shown until projects are saved
        - table [ref=e88]:
          - rowgroup [ref=e89]:
            - row "Project name Preview Size Colors Created Updated Actions" [ref=e90]:
              - columnheader "Project name" [ref=e91]
              - columnheader "Preview" [ref=e92]
              - columnheader "Size" [ref=e93]
              - columnheader "Colors" [ref=e94]
              - columnheader "Created" [ref=e95]
              - columnheader "Updated" [ref=e96]
              - columnheader "Actions" [ref=e97]
          - rowgroup [ref=e98]:
            - row "Mountain Landscape mountain_landscape.png 96 x 96 22 May 12, 2025 10:45 AM May 12, 2025 10:45 AM" [ref=e99]:
              - cell "Mountain Landscape mountain_landscape.png" [ref=e100]:
                - link "Mountain Landscape" [ref=e101] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e102]: mountain_landscape.png
              - cell [ref=e103]
              - cell "96 x 96" [ref=e153]
              - cell "22" [ref=e154]:
                - generic [ref=e156]: "22"
              - cell "May 12, 2025 10:45 AM" [ref=e162]:
                - text: May 12, 2025
                - generic [ref=e163]: 10:45 AM
              - cell "May 12, 2025 10:45 AM" [ref=e164]:
                - text: May 12, 2025
                - generic [ref=e165]: 10:45 AM
              - cell [ref=e166]:
                - generic [ref=e167]:
                  - button "Duplicate placeholder" [ref=e168] [cursor=pointer]:
                    - img [ref=e169]
                  - button "Delete placeholder" [ref=e172] [cursor=pointer]:
                    - img [ref=e173]
            - row "City Skyline city_skyline.png 128 x 64 24 May 11, 2025 10:44 AM May 11, 2025 10:46 AM" [ref=e176]:
              - cell "City Skyline city_skyline.png" [ref=e177]:
                - link "City Skyline" [ref=e178] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e179]: city_skyline.png
              - cell [ref=e180]
              - cell "128 x 64" [ref=e230]
              - cell "24" [ref=e231]:
                - generic [ref=e233]: "24"
              - cell "May 11, 2025 10:44 AM" [ref=e239]:
                - text: May 11, 2025
                - generic [ref=e240]: 10:44 AM
              - cell "May 11, 2025 10:46 AM" [ref=e241]:
                - text: May 11, 2025
                - generic [ref=e242]: 10:46 AM
              - cell [ref=e243]:
                - generic [ref=e244]:
                  - button "Duplicate placeholder" [ref=e245] [cursor=pointer]:
                    - img [ref=e246]
                  - button "Delete placeholder" [ref=e249] [cursor=pointer]:
                    - img [ref=e250]
            - row "Forest Path forest_path.png 96 x 96 20 May 10, 2025 10:43 AM May 10, 2025 10:47 AM" [ref=e253]:
              - cell "Forest Path forest_path.png" [ref=e254]:
                - link "Forest Path" [ref=e255] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e256]: forest_path.png
              - cell [ref=e257]
              - cell "96 x 96" [ref=e307]
              - cell "20" [ref=e308]:
                - generic [ref=e310]: "20"
              - cell "May 10, 2025 10:43 AM" [ref=e316]:
                - text: May 10, 2025
                - generic [ref=e317]: 10:43 AM
              - cell "May 10, 2025 10:47 AM" [ref=e318]:
                - text: May 10, 2025
                - generic [ref=e319]: 10:47 AM
              - cell [ref=e320]:
                - generic [ref=e321]:
                  - button "Duplicate placeholder" [ref=e322] [cursor=pointer]:
                    - img [ref=e323]
                  - button "Delete placeholder" [ref=e326] [cursor=pointer]:
                    - img [ref=e327]
            - row "Sunset Over Sea sunset_over_sea.png 128 x 64 18 May 9, 2025 10:42 AM May 9, 2025 10:48 AM" [ref=e330]:
              - cell "Sunset Over Sea sunset_over_sea.png" [ref=e331]:
                - link "Sunset Over Sea" [ref=e332] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e333]: sunset_over_sea.png
              - cell [ref=e334]
              - cell "128 x 64" [ref=e384]
              - cell "18" [ref=e385]:
                - generic [ref=e387]: "18"
              - cell "May 9, 2025 10:42 AM" [ref=e393]:
                - text: May 9, 2025
                - generic [ref=e394]: 10:42 AM
              - cell "May 9, 2025 10:48 AM" [ref=e395]:
                - text: May 9, 2025
                - generic [ref=e396]: 10:48 AM
              - cell [ref=e397]:
                - generic [ref=e398]:
                  - button "Duplicate placeholder" [ref=e399] [cursor=pointer]:
                    - img [ref=e400]
                  - button "Delete placeholder" [ref=e403] [cursor=pointer]:
                    - img [ref=e404]
            - row "Pixel Character pixel_character.png 64 x 64 16 May 8, 2025 10:41 AM May 8, 2025 10:49 AM" [ref=e407]:
              - cell "Pixel Character pixel_character.png" [ref=e408]:
                - link "Pixel Character" [ref=e409] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e410]: pixel_character.png
              - cell [ref=e411]
              - cell "64 x 64" [ref=e461]
              - cell "16" [ref=e462]:
                - generic [ref=e464]: "16"
              - cell "May 8, 2025 10:41 AM" [ref=e470]:
                - text: May 8, 2025
                - generic [ref=e471]: 10:41 AM
              - cell "May 8, 2025 10:49 AM" [ref=e472]:
                - text: May 8, 2025
                - generic [ref=e473]: 10:49 AM
              - cell [ref=e474]:
                - generic [ref=e475]:
                  - button "Duplicate placeholder" [ref=e476] [cursor=pointer]:
                    - img [ref=e477]
                  - button "Delete placeholder" [ref=e480] [cursor=pointer]:
                    - img [ref=e481]
            - row "Retro Car retro_car.png 96 x 64 19 May 8, 2025 10:40 AM May 8, 2025 10:50 AM" [ref=e484]:
              - cell "Retro Car retro_car.png" [ref=e485]:
                - link "Retro Car" [ref=e486] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e487]: retro_car.png
              - cell [ref=e488]
              - cell "96 x 64" [ref=e538]
              - cell "19" [ref=e539]:
                - generic [ref=e541]: "19"
              - cell "May 8, 2025 10:40 AM" [ref=e547]:
                - text: May 8, 2025
                - generic [ref=e548]: 10:40 AM
              - cell "May 8, 2025 10:50 AM" [ref=e549]:
                - text: May 8, 2025
                - generic [ref=e550]: 10:50 AM
              - cell [ref=e551]:
                - generic [ref=e552]:
                  - button "Duplicate placeholder" [ref=e553] [cursor=pointer]:
                    - img [ref=e554]
                  - button "Delete placeholder" [ref=e557] [cursor=pointer]:
                    - img [ref=e558]
            - row "Game Tileset game_tileset.png 128 x 128 32 May 8, 2025 10:39 AM May 8, 2025 10:51 AM" [ref=e561]:
              - cell "Game Tileset game_tileset.png" [ref=e562]:
                - link "Game Tileset" [ref=e563] [cursor=pointer]:
                  - /url: /projects/mock-editor
                - paragraph [ref=e564]: game_tileset.png
              - cell [ref=e565]
              - cell "128 x 128" [ref=e615]
              - cell "32" [ref=e616]:
                - generic [ref=e618]: "32"
              - cell "May 8, 2025 10:39 AM" [ref=e624]:
                - text: May 8, 2025
                - generic [ref=e625]: 10:39 AM
              - cell "May 8, 2025 10:51 AM" [ref=e626]:
                - text: May 8, 2025
                - generic [ref=e627]: 10:51 AM
              - cell [ref=e628]:
                - generic [ref=e629]:
                  - button "Duplicate placeholder" [ref=e630] [cursor=pointer]:
                    - img [ref=e631]
                  - button "Delete placeholder" [ref=e634] [cursor=pointer]:
                    - img [ref=e635]
        - generic [ref=e638]:
          - generic [ref=e639]: Showing 1 to 7 of 7 projects
          - generic [ref=e640]:
            - button "<" [ref=e641] [cursor=pointer]
            - button "1" [ref=e642] [cursor=pointer]
            - button ">" [ref=e643] [cursor=pointer]
            - button "25 / page" [ref=e644] [cursor=pointer]
  - button "Open Next.js Dev Tools" [ref=e650] [cursor=pointer]:
    - img [ref=e651]
  - alert [ref=e654]
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
> 19  |   expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
      |                                ^ Error: expect(received).toBeLessThanOrEqual(expected)
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
  81  |     await expect(page.getByText("0 of 2 cropped")).toBeVisible();
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
```