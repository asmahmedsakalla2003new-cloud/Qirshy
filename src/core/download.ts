/** ينزّل نصاً كملف على الجهاز، دون أي خادم. */
export function downloadText(filename: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // مهلة قصيرة قبل التحرير حتى يبدأ المتصفح التنزيل.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
