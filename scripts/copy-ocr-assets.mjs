// ينسخ ملفات قراءة الفواتير (Tesseract) من node_modules إلى public/ocr ليخدمها التطبيق نفسه،
// بلا أي خدمة خارجية. يعمل تلقائياً قبل البناء والتطوير (prebuild / predev).
// الملفات لا تُحفظ في المستودع لكبر حجمها؛ مصدرها الحزم المثبّتة.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(join(root, 'package.json'))
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })

const tesseractDir = dirname(require.resolve('tesseract.js/package.json'))
const coreDir = dirname(createRequire(join(tesseractDir, 'package.json')).resolve('tesseract.js-core/package.json'))

const files = [
  [join(tesseractDir, 'dist', 'worker.min.js'), 'worker.min.js'],
  // يختار Tesseract النسخة المناسبة للمتصفح (عادية أو SIMD) من هذا المجلد.
  [join(coreDir, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(coreDir, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(coreDir, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  // نماذج اللغة: العربية والإنجليزية (نسخة best_int: دقة جيدة بحجم معقول).
  [join(dirname(require.resolve('@tesseract.js-data/ara/package.json')), '4.0.0_best_int', 'ara.traineddata.gz'), 'ara.traineddata.gz'],
  [join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
]

for (const [from, name] of files) copyFileSync(from, join(out, name))
console.log(`✓ نُسخت ملفات قراءة الفواتير (${files.length}) إلى public/ocr`)
