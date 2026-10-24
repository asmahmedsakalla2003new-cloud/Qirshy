/**
 * التخزين الدائم: يطلب من المتصفح عدم حذف بيانات التطبيق تلقائياً عند امتلاء المساحة.
 * القرار للمتصفح؛ قد يُرفض الطلب، وعندها تبقى النسخة الاحتياطية هي الحماية الأساسية.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export type StorageStatus = {
  /** true: محمي من الحذف التلقائي. null: المتصفح لا يدعم هذه الميزة. */
  persisted: boolean | null
}

export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    if (!navigator.storage?.persisted) return { persisted: null }
    return { persisted: await navigator.storage.persisted() }
  } catch {
    return { persisted: null }
  }
}
