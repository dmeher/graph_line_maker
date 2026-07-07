# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-ui.spec.ts >> redesigned app screens >> mock editor exposes all primary editing and export regions
- Location: tests\e2e\app-ui.spec.ts:89:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1490
Received:    1616
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
      - generic [ref=e74]:
        - generic [ref=e75]:
          - generic [ref=e76]:
            - link "Back to dashboard" [ref=e77] [cursor=pointer]:
              - /url: /dashboard
              - img "Graph Pixel Maker" [ref=e78]
              - generic [ref=e88]: Graph Pixel Maker
            - button "Menu" [ref=e90] [cursor=pointer]:
              - img [ref=e91]
            - button "Undo" [ref=e92] [cursor=pointer]:
              - img [ref=e93]
            - button "Redo" [ref=e96] [cursor=pointer]:
              - img [ref=e97]
            - button "Pan" [ref=e100] [cursor=pointer]:
              - img [ref=e101]
            - button "Select" [ref=e106] [cursor=pointer]:
              - img [ref=e107]
            - button "Show Original" [ref=e109] [cursor=pointer]:
              - img [ref=e110]
              - generic [ref=e113]: Show Original
            - button "Grid" [ref=e114] [cursor=pointer]:
              - img [ref=e115]
              - generic [ref=e117]: Grid
            - generic [ref=e118]:
              - button "Zoom out" [ref=e119] [cursor=pointer]:
                - img [ref=e120]
              - generic [ref=e123]: 100%
              - button "Zoom in" [ref=e124] [cursor=pointer]:
                - img [ref=e125]
          - generic [ref=e128]:
            - button "Save" [ref=e129] [cursor=pointer]:
              - img [ref=e130]
              - text: Save
            - button "Export" [ref=e132] [cursor=pointer]:
              - img [ref=e133]
              - text: Export
              - img [ref=e136]
            - button "PNG" [ref=e138] [cursor=pointer]:
              - img [ref=e139]
              - text: PNG
            - button "PDF" [ref=e144] [cursor=pointer]:
              - img [ref=e145]
              - text: PDF
            - button "Print" [ref=e148] [cursor=pointer]:
              - img [ref=e149]
              - text: Print
            - button "JSON" [ref=e153] [cursor=pointer]:
              - img [ref=e154]
              - text: JSON
            - button "More" [ref=e159] [cursor=pointer]:
              - img [ref=e160]
        - generic [ref=e164]:
          - complementary [ref=e166]:
            - generic [ref=e167]:
              - heading "Sources" [level=2] [ref=e168]
              - generic [ref=e169]:
                - button "Crop source" [ref=e170] [cursor=pointer]:
                  - img [ref=e171]
                - generic "Add images" [ref=e174] [cursor=pointer]:
                  - img [ref=e175]
                  - button [ref=e178]
            - generic [ref=e179]:
              - paragraph [ref=e180]: Deer Pattern
              - paragraph [ref=e181]: 1 source ready
            - generic [ref=e184]:
              - generic [ref=e186]:
                - button "1 deer-line-art.png Ready" [ref=e187] [cursor=pointer]:
                  - generic [ref=e188]: "1"
                  - generic [ref=e189]:
                    - generic [ref=e190]: deer-line-art.png
                    - generic [ref=e191]:
                      - img [ref=e192]
                      - text: Ready
                  - img [ref=e195]
                - generic [ref=e197]:
                  - button "Move up" [disabled] [ref=e198]:
                    - img [ref=e199]
                  - button "Move down" [disabled] [ref=e201]:
                    - img [ref=e202]
                  - button "Lock image" [ref=e204] [cursor=pointer]:
                    - img [ref=e205]
                  - generic "Replace image and keep current position, size, and transform" [ref=e208] [cursor=pointer]:
                    - img [ref=e209]
                    - button [ref=e214]
                  - button "Remove source" [ref=e215] [cursor=pointer]:
                    - img [ref=e216]
              - generic [ref=e220]:
                - button "2 Ground Painted cell" [ref=e221] [cursor=pointer]:
                  - generic [ref=e222]: "2"
                  - generic [ref=e225]:
                    - generic [ref=e226]: Ground
                    - generic [ref=e227]:
                      - img [ref=e228]
                      - text: Painted cell
                  - img [ref=e231]
                - generic [ref=e233]:
                  - button "Move up" [disabled] [ref=e234]:
                    - img [ref=e235]
                  - button "Move down" [disabled] [ref=e237]:
                    - img [ref=e238]
                  - button "Lock drawing" [ref=e240] [cursor=pointer]:
                    - img [ref=e241]
                  - button "Remove drawing" [ref=e244] [cursor=pointer]:
                    - img [ref=e245]
            - generic [ref=e248] [cursor=pointer]:
              - img [ref=e249]
              - text: Add images
              - button "Add images" [ref=e252]
            - generic [ref=e253]:
              - generic [ref=e254]:
                - generic [ref=e255]: Project name
                - textbox "Project name" [ref=e256]: Deer Pattern
              - generic [ref=e257]:
                - generic [ref=e258]: Description
                - textbox "Description" [ref=e259]: Mock editor project for UI validation.
            - button "Resize source panel" [ref=e260] [cursor=pointer]:
              - img [ref=e263]
          - generic [ref=e267]:
            - generic [ref=e268]:
              - heading "Canvas" [level=1] [ref=e270]
              - generic [ref=e271]:
                - button "Hide source panel" [ref=e272] [cursor=pointer]:
                  - img [ref=e273]
                - button "Hide controls panel" [ref=e276] [cursor=pointer]:
                  - img [ref=e277]
                - button "Show original" [ref=e280] [cursor=pointer]:
                  - img [ref=e281]
                - button "Zoom out" [ref=e284] [cursor=pointer]:
                  - img [ref=e285]
                - button "Zoom in" [ref=e288] [cursor=pointer]:
                  - img [ref=e289]
            - generic [ref=e292]:
              - generic [ref=e293]:
                - button "Select" [ref=e294] [cursor=pointer]:
                  - img [ref=e295]
                  - text: Select
                - button "Pan" [ref=e297] [cursor=pointer]:
                  - img [ref=e298]
                  - text: Pan
                - button "Pencil" [ref=e303] [cursor=pointer]:
                  - img [ref=e304]
                  - text: Pencil
                - button "Fill" [ref=e308] [cursor=pointer]:
                  - img [ref=e309]
                  - text: Fill
                - button "Zoom" [ref=e312] [cursor=pointer]:
                  - img [ref=e313]
                  - text: Zoom
              - generic [ref=e316]:
                - generic "Drag image to move it; arrow keys move selected image by 0.1cm; Space or Ctrl plus drag pans the view" [ref=e317]
                - generic:
                  - generic: "1"
                  - generic: "2"
                  - generic: "3"
                  - generic: "4"
                  - generic: "5"
                  - generic: "6"
                  - generic: "7"
                  - generic: "8"
                  - generic: "9"
                  - generic: "10"
                  - generic: "11"
                  - generic: "12"
                  - generic: "13"
                  - generic: "14"
                  - generic: "15"
                  - generic: "16"
                  - generic: "17"
                  - generic: "18"
                  - generic: "19"
                  - generic: "20"
                  - generic: "21"
                  - generic: "22"
                  - generic: "23"
                  - generic: "24"
                  - generic: "25"
                  - generic: "26"
                  - generic: "27"
                  - generic: "28"
                  - generic: "29"
                  - generic: "30"
                  - generic: "31"
                  - generic: "32"
                  - generic: "33"
                  - generic: "34"
                  - generic: "35"
                  - generic: "36"
                  - generic: "37"
                  - generic: "38"
                  - generic: "39"
                  - generic: "40"
                  - generic: "41"
                  - generic: "42"
                  - generic: "43"
                  - generic: "44"
                  - generic: "45"
                  - generic: "46"
                  - generic: "47"
                  - generic: "48"
                  - generic: "49"
                  - generic: "50"
                  - generic: "51"
                  - generic: "52"
                  - generic: "53"
                  - generic: "54"
                  - generic: "55"
                  - generic: "56"
                  - generic: "57"
                  - generic: "58"
                  - generic: "59"
                  - generic: "60"
                  - generic: "61"
                  - generic: "62"
                  - generic: "63"
                  - generic: "64"
                  - generic: "65"
                  - generic: "66"
                  - generic: "67"
                  - generic: "68"
                  - generic: "69"
                  - generic: "70"
                  - generic: "71"
                  - generic: "72"
                  - generic: "73"
                  - generic: "74"
                  - generic: "75"
                  - generic: "76"
                  - generic: "77"
                  - generic: "78"
                  - generic: "79"
                  - generic: "80"
                  - generic: "81"
                  - generic: "82"
                  - generic: "83"
                  - generic: "84"
                  - generic: "85"
                  - generic: "86"
                  - generic: "87"
                  - generic: "88"
                  - generic: "89"
                  - generic: "90"
                  - generic: "91"
                  - generic: "92"
                  - generic: "93"
                  - generic: "94"
                  - generic: "95"
                  - generic: "96"
                  - generic: "97"
                  - generic: "98"
                  - generic: "99"
                  - generic: "100"
                  - generic: "101"
                  - generic: "102"
                  - generic: "103"
                  - generic: "104"
                  - generic: "105"
                  - generic: "106"
                  - generic: "107"
                  - generic: "108"
                  - generic: "109"
                  - generic: "110"
                  - generic: "111"
                  - generic: "112"
                  - generic: "113"
                  - generic: "114"
                  - generic: "115"
                  - generic: "116"
                  - generic: "117"
                  - generic: "118"
                  - generic: "119"
                  - generic: "120"
                  - generic: "121"
                  - generic: "122"
                  - generic: "123"
                  - generic: "124"
                  - generic: "125"
                  - generic: "126"
                  - generic: "127"
                  - generic: "128"
                  - generic: "129"
                  - generic: "130"
                  - generic: "131"
                  - generic: "132"
                  - generic: "133"
                  - generic: "134"
                  - generic: "135"
                  - generic: "136"
                  - generic: "137"
                  - generic: "138"
                  - generic: "139"
                  - generic: "140"
                  - generic: "141"
                  - generic: "142"
                  - generic: "143"
                  - generic: "144"
                  - generic: "145"
                  - generic: "146"
                  - generic: "147"
                  - generic: "148"
                  - generic: "149"
                  - generic: "150"
                  - generic: "1"
                  - generic: "2"
                  - generic: "3"
                  - generic: "4"
                  - generic: "5"
                  - generic: "6"
                  - generic: "7"
                  - generic: "8"
                  - generic: "9"
                  - generic: "10"
                  - generic: "11"
                  - generic: "12"
                  - generic: "13"
                  - generic: "14"
                  - generic: "15"
                  - generic: "16"
                  - generic: "17"
                  - generic: "18"
                  - generic: "19"
                  - generic: "20"
                  - generic: "21"
                  - generic: "22"
                  - generic: "23"
                  - generic: "24"
                  - generic: "25"
                  - generic: "26"
                  - generic: "27"
                  - generic: "28"
                  - generic: "29"
                  - generic: "30"
                  - generic: "31"
                  - generic: "32"
                  - generic: "33"
                  - generic: "34"
                  - generic: "35"
                  - generic: "36"
                  - generic: "37"
                  - generic: "38"
                  - generic: "39"
                  - generic: "40"
                  - generic: "41"
                  - generic: "42"
                  - generic: "43"
                  - generic: "44"
                  - generic: "45"
                  - generic: "46"
                  - generic: "47"
                  - generic: "48"
                  - generic: "49"
                  - generic: "50"
                  - generic: "51"
                  - generic: "52"
                  - generic: "53"
                  - generic: "54"
                  - generic: "55"
                  - generic: "56"
                  - generic: "57"
                  - generic: "58"
                  - generic: "59"
                  - generic: "60"
                  - generic: "61"
                  - generic: "62"
                  - generic: "63"
                  - generic: "64"
                  - generic: "65"
                  - generic: "66"
                  - generic: "67"
                  - generic: "68"
                  - generic: "69"
                  - generic: "70"
                  - generic: "71"
                  - generic: "72"
                  - generic: "73"
                  - generic: "74"
                  - generic: "75"
                  - generic: "76"
                  - generic: "77"
                  - generic: "78"
                  - generic: "79"
                  - generic: "80"
                  - generic: "81"
                  - generic: "82"
                  - generic: "83"
                  - generic: "84"
                  - generic: "85"
                  - generic: "86"
                  - generic: "87"
                  - generic: "88"
                  - generic: "89"
                  - generic: "90"
                  - generic: "91"
                  - generic: "92"
                  - generic: "93"
                  - generic: "94"
                  - generic: "95"
                  - generic: "96"
                  - generic: "97"
                  - generic: "98"
                  - generic: "99"
                  - generic: "100"
                  - generic: "101"
                  - generic: "102"
                  - generic: "103"
                  - generic: "104"
                  - generic: "105"
                  - generic: "106"
                  - generic: "107"
                  - generic: "108"
                  - generic: "109"
                  - generic: "110"
                  - generic: "111"
                  - generic: "112"
                  - generic: "113"
                  - generic: "114"
                  - generic: "115"
                  - generic: "116"
                  - generic: "117"
                  - generic: "118"
                  - generic: "119"
                  - generic: "120"
                  - generic: "121"
                  - generic: "122"
                  - generic: "123"
                  - generic: "124"
                  - generic: "125"
                  - generic: "126"
                  - generic: "127"
                  - generic: "128"
                  - generic: "129"
                  - generic: "130"
                  - generic: "131"
                  - generic: "132"
                  - generic: "133"
                  - generic: "134"
                  - generic: "135"
                  - generic: "136"
                  - generic: "137"
                  - generic: "138"
                  - generic: "139"
                  - generic: "140"
                  - generic: "141"
                  - generic: "142"
                  - generic: "143"
                  - generic: "144"
                  - generic: "145"
                  - generic: "146"
                  - generic: "147"
                  - generic: "148"
                  - generic: "149"
                  - generic: "150"
                  - generic: "1"
                  - generic: "2"
                  - generic: "3"
                  - generic: "4"
                  - generic: "5"
                  - generic: "6"
                  - generic: "7"
                  - generic: "8"
                  - generic: "9"
                  - generic: "10"
                  - generic: "11"
                  - generic: "12"
                  - generic: "13"
                  - generic: "14"
                  - generic: "15"
                  - generic: "16"
                  - generic: "17"
                  - generic: "18"
                  - generic: "19"
                  - generic: "20"
                  - generic: "21"
                  - generic: "22"
                  - generic: "23"
                  - generic: "24"
                  - generic: "25"
                  - generic: "26"
                  - generic: "27"
                  - generic: "28"
                  - generic: "29"
                  - generic: "30"
                  - generic: "31"
                  - generic: "32"
                  - generic: "33"
                  - generic: "34"
                  - generic: "35"
                  - generic: "36"
                  - generic: "37"
                  - generic: "38"
                  - generic: "39"
                  - generic: "40"
                  - generic: "41"
                  - generic: "42"
                  - generic: "43"
                  - generic: "44"
                  - generic: "45"
                  - generic: "46"
                  - generic: "47"
                  - generic: "48"
                  - generic: "49"
                  - generic: "50"
                  - generic: "51"
                  - generic: "52"
                  - generic: "53"
                  - generic: "54"
                  - generic: "55"
                  - generic: "56"
                  - generic: "57"
                  - generic: "58"
                  - generic: "59"
                  - generic: "60"
                  - generic: "61"
                  - generic: "62"
                  - generic: "63"
                  - generic: "64"
                  - generic: "65"
                  - generic: "66"
                  - generic: "67"
                  - generic: "68"
                  - generic: "69"
                  - generic: "70"
                  - generic: "71"
                  - generic: "72"
                  - generic: "73"
                  - generic: "74"
                  - generic: "75"
                  - generic: "76"
                  - generic: "77"
                  - generic: "78"
                  - generic: "79"
                  - generic: "80"
                  - generic: "81"
                  - generic: "82"
                  - generic: "83"
                  - generic: "84"
                  - generic: "85"
                  - generic: "86"
                  - generic: "87"
                  - generic: "88"
                  - generic: "89"
                  - generic: "90"
                  - generic: "91"
                  - generic: "92"
                  - generic: "93"
                  - generic: "94"
                  - generic: "95"
                  - generic: "96"
                  - generic: "97"
                  - generic: "98"
                  - generic: "99"
                  - generic: "100"
                  - generic: "101"
                  - generic: "102"
                  - generic: "103"
                  - generic: "104"
                  - generic: "105"
                  - generic: "106"
                  - generic: "107"
                  - generic: "108"
                  - generic: "109"
                  - generic: "110"
                  - generic: "111"
                  - generic: "112"
                  - generic: "113"
                  - generic: "114"
                  - generic: "115"
                  - generic: "116"
                  - generic: "117"
                  - generic: "118"
                  - generic: "119"
                  - generic: "120"
                  - generic: "121"
                  - generic: "122"
                  - generic: "123"
                  - generic: "124"
                  - generic: "125"
                  - generic: "126"
                  - generic: "127"
                  - generic: "128"
                  - generic: "129"
                  - generic: "130"
                  - generic: "131"
                  - generic: "132"
                  - generic: "133"
                  - generic: "134"
                  - generic: "135"
                  - generic: "136"
                  - generic: "137"
                  - generic: "138"
                  - generic: "139"
                  - generic: "140"
                  - generic: "141"
                  - generic: "142"
                  - generic: "143"
                  - generic: "144"
                  - generic: "145"
                  - generic: "146"
                  - generic: "147"
                  - generic: "148"
                  - generic: "149"
                  - generic: "150"
                  - generic: "1"
                  - generic: "2"
                  - generic: "3"
                  - generic: "4"
                  - generic: "5"
                  - generic: "6"
                  - generic: "7"
                  - generic: "8"
                  - generic: "9"
                  - generic: "10"
                  - generic: "11"
                  - generic: "12"
                  - generic: "13"
                  - generic: "14"
                  - generic: "15"
                  - generic: "16"
                  - generic: "17"
                  - generic: "18"
                  - generic: "19"
                  - generic: "20"
                  - generic: "21"
                  - generic: "22"
                  - generic: "23"
                  - generic: "24"
                  - generic: "25"
                  - generic: "26"
                  - generic: "27"
                  - generic: "28"
                  - generic: "29"
                  - generic: "30"
                  - generic: "31"
                  - generic: "32"
                  - generic: "33"
                  - generic: "34"
                  - generic: "35"
                  - generic: "36"
                  - generic: "37"
                  - generic: "38"
                  - generic: "39"
                  - generic: "40"
                  - generic: "41"
                  - generic: "42"
                  - generic: "43"
                  - generic: "44"
                  - generic: "45"
                  - generic: "46"
                  - generic: "47"
                  - generic: "48"
                  - generic: "49"
                  - generic: "50"
                  - generic: "51"
                  - generic: "52"
                  - generic: "53"
                  - generic: "54"
                  - generic: "55"
                  - generic: "56"
                  - generic: "57"
                  - generic: "58"
                  - generic: "59"
                  - generic: "60"
                  - generic: "61"
                  - generic: "62"
                  - generic: "63"
                  - generic: "64"
                  - generic: "65"
                  - generic: "66"
                  - generic: "67"
                  - generic: "68"
                  - generic: "69"
                  - generic: "70"
                  - generic: "71"
                  - generic: "72"
                  - generic: "73"
                  - generic: "74"
                  - generic: "75"
                  - generic: "76"
                  - generic: "77"
                  - generic: "78"
                  - generic: "79"
                  - generic: "80"
                  - generic: "81"
                  - generic: "82"
                  - generic: "83"
                  - generic: "84"
                  - generic: "85"
                  - generic: "86"
                  - generic: "87"
                  - generic: "88"
                  - generic: "89"
                  - generic: "90"
                  - generic: "91"
                  - generic: "92"
                  - generic: "93"
                  - generic: "94"
                  - generic: "95"
                  - generic: "96"
                  - generic: "97"
                  - generic: "98"
                  - generic: "99"
                  - generic: "100"
                  - generic: "101"
                  - generic: "102"
                  - generic: "103"
                  - generic: "104"
                  - generic: "105"
                  - generic: "106"
                  - generic: "107"
                  - generic: "108"
                  - generic: "109"
                  - generic: "110"
                  - generic: "111"
                  - generic: "112"
                  - generic: "113"
                  - generic: "114"
                  - generic: "115"
                  - generic: "116"
                  - generic: "117"
                  - generic: "118"
                  - generic: "119"
                  - generic: "120"
                  - generic: "121"
                  - generic: "122"
                  - generic: "123"
                  - generic: "124"
                  - generic: "125"
                  - generic: "126"
                  - generic: "127"
                  - generic: "128"
                  - generic: "129"
                  - generic: "130"
                  - generic: "131"
                  - generic: "132"
                  - generic: "133"
                  - generic: "134"
                  - generic: "135"
                  - generic: "136"
                  - generic: "137"
                  - generic: "138"
                  - generic: "139"
                  - generic: "140"
                  - generic: "141"
                  - generic: "142"
                  - generic: "143"
                  - generic: "144"
                  - generic: "145"
                  - generic: "146"
                  - generic: "147"
                  - generic: "148"
                  - generic: "149"
                  - generic: "150"
                - generic:
                  - generic:
                    - generic: Page 2
                  - generic:
                    - generic: Page 3
                  - generic:
                    - generic: Page 4
                  - generic:
                    - generic: Page 5
                  - generic:
                    - generic: Page 6
                  - generic:
                    - generic: Page 2
                  - generic:
                    - generic: Page 3
                  - generic:
                    - generic: Page 4
                  - generic:
                    - generic: Page 5
                  - generic:
                    - generic: Page 6
                  - generic:
                    - generic: Page 7
                  - generic:
                    - generic: Page 8
            - generic [ref=e318]:
              - generic [ref=e319]: "X: 37"
              - generic [ref=e320]: "Y: 112"
              - generic [ref=e321]: "Cell: 0,0"
              - generic [ref=e322]: "Color: #000000"
              - generic [ref=e324]: "Snap: On"
          - complementary [ref=e326]:
            - generic [ref=e327]:
              - heading "Inspector" [level=2] [ref=e328]
              - button "Reset settings" [ref=e329] [cursor=pointer]:
                - img [ref=e330]
            - generic [ref=e335]:
              - button "Graph" [ref=e336] [cursor=pointer]
              - button "Source" [ref=e337] [cursor=pointer]
              - button "Draw" [ref=e338] [cursor=pointer]
              - button "Palette" [ref=e339] [cursor=pointer]
              - button "Print" [ref=e340] [cursor=pointer]
            - generic [ref=e342]:
              - button "Parameters" [expanded] [ref=e343] [cursor=pointer]:
                - generic [ref=e344]: Parameters
                - img [ref=e346]
              - generic [ref=e348]:
                - generic [ref=e349]:
                  - generic [ref=e350]:
                    - generic [ref=e351]: Width (cells)
                    - spinbutton "Width (cells)" [ref=e352]: "150"
                  - generic [ref=e353]:
                    - generic [ref=e354]: Height (cells)
                    - spinbutton "Height (cells)" [ref=e355]: "150"
                  - generic [ref=e356]:
                    - generic [ref=e357]: Size unit
                    - combobox "Size unit" [ref=e358]:
                      - option "CM"
                      - option "IN" [selected]
                  - generic [ref=e359]:
                    - generic [ref=e360]: Graph height (IN)
                    - spinbutton "Graph height (IN)" [ref=e361]: "59.06"
                  - generic [ref=e362]:
                    - generic [ref=e363]: Image width (CM)
                    - spinbutton "Image width (CM)" [ref=e364]: "118"
                  - generic [ref=e365]:
                    - generic [ref=e366]: Image height (IN)
                    - spinbutton "Image height (IN)" [ref=e367]: "49.61"
                  - generic [ref=e368]:
                    - generic [ref=e369]: Graph lines layer
                    - combobox "Graph lines layer" [ref=e370]:
                      - option "Front"
                      - option "Back" [selected]
                  - generic [ref=e371]:
                    - checkbox "Show grid numbers" [checked] [ref=e372]
                    - generic [ref=e373]: Show grid numbers
                  - generic [ref=e374]:
                    - generic [ref=e375]: Grid number position
                    - combobox "Grid number position" [ref=e376]:
                      - option "Inside"
                      - option "Outside" [selected]
                  - generic [ref=e377]:
                    - checkbox "Show page breaks" [checked] [ref=e378]
                    - generic [ref=e379]: Show page breaks
                  - generic [ref=e380]:
                    - generic [ref=e381]: Print paper
                    - combobox "Print paper" [ref=e382]:
                      - option "A4" [selected]
                      - option "A3"
                      - option "Letter"
                      - option "Legal"
                      - option "Tabloid"
                  - generic [ref=e383]:
                    - generic [ref=e384]: Orientation
                    - combobox "Orientation" [ref=e385]:
                      - option "Auto" [selected]
                      - option "Portrait"
                      - option "Landscape"
                  - generic [ref=e386]:
                    - generic [ref=e387]: Horizontal align
                    - combobox "Horizontal align" [ref=e388]:
                      - option "Left"
                      - option "Center" [selected]
                      - option "Right"
                  - generic [ref=e389]:
                    - generic [ref=e390]: Vertical align
                    - combobox "Vertical align" [ref=e391]:
                      - option "Top"
                      - option "Center" [selected]
                      - option "Bottom"
                - paragraph [ref=e393]: Graph 150 x 150 cm / Print 150 x 150 cm / 1 cell 1 cm / artwork 118 x 126 cells / back grid / outside numbers / page breaks on / center center
            - button "Resize controls panel" [ref=e394] [cursor=pointer]:
              - img [ref=e397]
        - generic [ref=e400]:
          - generic [ref=e401]: Online save
          - generic [ref=e402]: Database sync ready
          - img [ref=e403]
  - button "Open Next.js Dev Tools" [ref=e410] [cursor=pointer]:
    - img [ref=e411]
  - alert [ref=e414]
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