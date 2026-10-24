import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { db } from '../data/db'

afterEach(async () => {
  cleanup()
  localStorage.clear()
  // قاعدة بيانات نظيفة لكل اختبار؛ تُفتح تلقائياً عند أول استخدام.
  await db.delete({ disableAutoOpen: false })
})
