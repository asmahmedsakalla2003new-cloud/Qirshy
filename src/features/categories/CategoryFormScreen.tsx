import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { TextField } from '../../components/TextField'
import {
  countCategoryUsage,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  renameCategory,
  setCategoryArchived,
} from '../../data/categoriesRepo'
import { ValidationError } from '../../data/errors'
import { countLabel, transactionForms } from '../../domain/arabic'
import { CATEGORY_NAME_MAX, validateCategory, type Category } from '../../domain/categories'
import type { TransactionType } from '../../domain/transactions'

/** /settings/categories/new?kind=expense لإضافة فئة، و /settings/categories/:id لتعديلها. */
export function CategoryFormScreen() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const data = useLiveQuery(async () => {
    if (!id) return null
    const category = await getCategory(id)
    return category ? { category, usage: await countCategoryUsage(id) } : null
  }, [id])

  if (id && data === undefined) return null
  if (id && data === null) {
    return (
      <EmptyState
        title="الفئة غير موجودة"
        description="ربما حُذفت هذه الفئة."
        action={<Link to="/settings/categories">العودة إلى الفئات</Link>}
      />
    )
  }
  const kind: TransactionType = data?.category.kind ?? (params.get('kind') === 'income' ? 'income' : 'expense')
  return <CategoryForm key={data?.category.id ?? 'new'} kind={kind} category={data?.category} usage={data?.usage ?? 0} />
}

function CategoryForm({ kind, category, usage }: { kind: TransactionType; category?: Category; usage: number }) {
  const navigate = useNavigate()
  const [name, setName] = useState(category?.name ?? '')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const back = `/settings/categories?kind=${kind}`
  const kindLabel = kind === 'expense' ? 'مصروف' : 'دخل'

  async function checkName() {
    const others = (await listCategories()).filter((c) => c.id !== category?.id)
    return validateCategory({ name, kind }, others).name
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setFormError(undefined)
    const nameError = await checkName()
    setError(nameError)
    if (nameError) return

    setSaving(true)
    try {
      if (category) await renameCategory(category.id, name)
      else await createCategory({ name, kind })
      navigate(back, { replace: true, state: { flash: category ? 'حُفظت الفئة.' : 'أُضيفت الفئة.' } })
    } catch (err) {
      if (err instanceof ValidationError) setError(err.message)
      else setFormError('تعذّر حفظ الفئة. حاول مرة أخرى.')
      setSaving(false)
    }
  }

  async function toggleArchive() {
    if (!category) return
    try {
      await setCategoryArchived(category.id, !category.archived)
      navigate(back, {
        replace: true,
        state: { flash: category.archived ? `أُعيدت فئة «${category.name}».` : `أُرشفت فئة «${category.name}».` },
      })
    } catch {
      setFormError('تعذّر تحديث الفئة. حاول مرة أخرى.')
    }
  }

  async function remove() {
    if (!category) return
    setConfirmingDelete(false)
    try {
      await deleteCategory(category.id)
      navigate(back, { replace: true, state: { flash: `حُذفت فئة «${category.name}».` } })
    } catch (err) {
      setFormError(err instanceof ValidationError ? err.message : 'تعذّر حذف الفئة. حاول مرة أخرى.')
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p>
        <Link to={back}>→ الفئات</Link>
      </p>
      <h1 className="page-title">{category ? 'تعديل الفئة' : `إضافة فئة ${kindLabel}`}</h1>

      {formError && <Alert tone="danger">{formError}</Alert>}
      {category?.archived && <Alert tone="info">هذه الفئة مؤرشفة ولا تظهر عند تسجيل عملية جديدة.</Alert>}

      <TextField
        label="اسم الفئة"
        value={name}
        maxLength={CATEGORY_NAME_MAX}
        autoComplete="off"
        autoFocus={!category}
        hint={category ? `فئة ${kindLabel} · مستخدمة في ${countLabel(usage, transactionForms)}` : `فئة ${kindLabel}`}
        error={error}
        onChange={(e) => {
          setName(e.target.value)
          if (error) setError(undefined)
        }}
        onBlur={async () => name !== '' && setError(await checkName())}
      />

      <div className="form-actions">
        <Button type="submit" size="lg" disabled={saving}>
          {category ? 'حفظ' : 'إضافة الفئة'}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate(back)}>
          إلغاء
        </Button>
      </div>

      {category && (
        <>
          <Button variant="secondary" onClick={toggleArchive}>
            {category.archived ? 'إعادة الفئة' : 'أرشفة الفئة'}
          </Button>
          {usage === 0 && (
            <Button variant="ghost" className="btn--danger-text" onClick={() => setConfirmingDelete(true)}>
              حذف الفئة
            </Button>
          )}
          <ConfirmDialog
            open={confirmingDelete}
            title={`حذف فئة «${category.name}»؟`}
            confirmLabel="حذف الفئة"
            onConfirm={remove}
            onCancel={() => setConfirmingDelete(false)}
          >
            ستُحذف الفئة نهائياً. لا توجد عمليات مسجّلة فيها.
          </ConfirmDialog>
        </>
      )}
    </form>
  )
}
