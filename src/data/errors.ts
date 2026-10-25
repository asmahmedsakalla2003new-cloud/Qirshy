/** خطأ تحقق برسائل عربية جاهزة للعرض، مفهرسة باسم الحقل. */
export class ValidationError extends Error {
  readonly errors: Record<string, string>

  constructor(errors: Record<string, string>) {
    super(Object.values(errors).join(' '))
    this.errors = errors
  }
}
