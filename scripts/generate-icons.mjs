// يولّد أيقونات PWA بصيغة PNG من شعار SVG باستخدام متصفح Playwright المثبّت.
// التشغيل: npm run icons — ثم تُحفظ الملفات الناتجة في المستودع (لا تُولَّد أثناء البناء).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const font = readFileSync(
  `${root}node_modules/@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2`,
).toString('base64')

// padding: نسبة الهامش الداخلي. الأيقونة القابلة للقص (maskable) تحتاج منطقة آمنة أوسع.
function svg({ rounded, padding }) {
  const r = 20 * (1 - padding)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rounded ? 16 : 0}" fill="#312e81"/>
  <circle cx="32" cy="32" r="${r}" fill="#059669"/>
  <circle cx="32" cy="32" r="${r * 0.8}" fill="none" stroke="#d1fae5" stroke-width="1.5" opacity="0.6"/>
  <text x="32" y="30" text-anchor="middle" dominant-baseline="central"
    font-family="Cairo" font-weight="700" font-size="${22 * (1 - padding)}" fill="#ffffff">ق</text>
</svg>`
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, rounded: true, padding: 0 },
  { file: 'public/icons/icon-512.png', size: 512, rounded: true, padding: 0 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, rounded: false, padding: 0.2 },
  { file: 'public/apple-touch-icon.png', size: 180, rounded: false, padding: 0.1 },
]

mkdirSync(`${root}public/icons`, { recursive: true })
writeFileSync(`${root}public/favicon.svg`, svg({ rounded: true, padding: 0 }))

const browser = await chromium.launch()
const page = await browser.newPage()
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Cairo; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 200 1000; }
    html, body { margin: 0; background: transparent; }
    svg { display: block; width: ${t.size}px; height: ${t.size}px; }
  </style></head><body>${svg(t)}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${root}${t.file}`, omitBackground: true })
  console.log('✓', t.file)
}
await browser.close()
