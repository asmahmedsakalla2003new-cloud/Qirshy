import { validateCategory, type Category, type CategoryInput } from '../domain/categories'
import { db } from './db'
import { ValidationError } from './errors'

/** كل الفئات (بما فيها المؤرشفة) بترتيب العرض. */
export async function listCategories(): Promise<Category[]> {
  const all = await db.categories.toArray()
  return all.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
}

export function getCategory(id: string): Promise<Category | undefined> {
  return db.categories.get(id)
}

export function countCategoryUsage(id: string): Promise<number> {
  return db.transactions.where('categoryId').equals(id).count()
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray()
    const errors = validateCategory(input, all)
    if (errors.name) throw new ValidationError(errors)

    const now = new Date().toISOString()
    const sameKind = all.filter((c) => c.kind === input.kind)
    let order = sameKind.length ? Math.max(...sameKind.map((c) => c.order)) + 1 : 0
    // «أخرى» تبقى آخر القائمة: الفئة الجديدة تأخذ مكانها، وتنتقل «أخرى» بعدها.
    const other = sameKind.find((c) => c.name === 'أخرى' && c.order === order - 1)
    if (other) {
      await db.categories.update(other.id, { order })
      order = other.order
    }
    const category: Category = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      kind: input.kind,
      archived: false,
      order,
      createdAt: now,
      updatedAt: now,
    }
    await db.categories.add(category)
    return category
  })
}

/** يغيّر اسم الفئة فقط؛ نوعها ثابت لأن عملياتها من ذلك النوع. */
export async function renameCategory(id: string, name: string): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const all = await db.categories.toArray()
    const current = all.find((c) => c.id === id)
    if (!current) throw new Error('الفئة غير موجودة.')
    const errors = validateCategory({ name, kind: current.kind }, all.filter((c) => c.id !== id))
    if (errors.name) throw new ValidationError(errors)
    await db.categories.update(id, { name: name.trim(), updatedAt: new Date().toISOString() })
  })
}

/** الأرشفة تخفي الفئة من الاختيار، وتبقى في العمليات القديمة والتقارير. */
export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  const changed = await db.categories.update(id, { archived, updatedAt: new Date().toISOString() })
  if (!changed) throw new Error('الفئة غير موجودة.')
}

/** الحذف النهائي مسموح فقط لفئة لم تُستخدم في أي عملية. */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, db.budgets, async () => {
    if ((await countCategoryUsage(id)) > 0) {
      throw new ValidationError({ category: 'هذه الفئة مستخدمة في عمليات. يمكنك أرشفتها بدل حذفها.' })
    }
    if ((await db.budgets.where('categoryId').equals(id).count()) > 0) {
      throw new ValidationError({ category: 'لهذه الفئة ميزانية. احذف الميزانية أولاً أو أرشف الفئة.' })
    }
    await db.categories.delete(id)
  })
}
