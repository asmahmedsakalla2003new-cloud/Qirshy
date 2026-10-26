/**
 * قراءة نص الفاتورة على الجهاز بمكتبة Tesseract (مفتوحة المصدر).
 * الصورة لا تُرسل إلى أي خادم ولا تُحفظ؛ تُقرأ في المتصفح ثم تُترك.
 * ملفات المحرّك والنماذج تُخدم من التطبيق نفسه (/ocr/) وتُحفظ بعد أول استخدام.
 */
import { createWorker, OEM } from 'tesseract.js'

export type OcrProgress = { stage: 'loading' | 'reading'; percent: number }

/** أقصى عرض للصورة قبل القراءة: يكفي للنص ويقلل الوقت والذاكرة على الهاتف. */
const MAX_SIDE = 1800

/** يصغّر الصورة ويحوّلها لتدرّج رمادي بتباين أعلى، مما يحسّن القراءة. */
async function prepareImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.filter = 'grayscale(1) contrast(1.4)'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

export async function readReceiptText(file: Blob, onProgress?: (p: OcrProgress) => void): Promise<string> {
  const image = await prepareImage(file)
  const worker = await createWorker(['ara', 'eng'], OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/',
    langPath: '/ocr',
    gzip: true,
    workerBlobURL: false,
    logger: (m) => {
      if (!onProgress) return
      const stage = m.status === 'recognizing text' ? 'reading' : 'loading'
      onProgress({ stage, percent: Math.round((m.progress ?? 0) * 100) })
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}
