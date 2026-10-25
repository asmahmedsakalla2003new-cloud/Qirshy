import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { useFlash } from '../../app/useFlash'
import { Alert } from '../../components/Alert'
import { ChoiceGroup } from '../../components/ChoiceGroup'
import { Icon } from '../../components/Icon'
import { listCategories } from '../../data/categoriesRepo'
import { TRANSACTION_TYPES, type TransactionType } from '../../domain/transactions'
import type { Category } from '../../domain/categories'

const kindOptions = TRANSACTION_TYPES.map((value) => ({
  value,
  label: value === 'expense' ? 'فئات المصروف' : 'فئات الدخل',
}))

function CategoryList({ items, label }: { items: Category[]; label: string }) {
  return (
    <ul className="list" aria-label={label}>
      {items.map((c) => (
        <li key={c.id}>
          <Link to={`/settings/categories/${c.id}`} className="list-item list-item--compact">
            <span className="list-item__main">
              <span className="list-item__title">{c.name}</span>
            </span>
            <Icon name="chevron" size={18} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function CategoriesScreen() {
  const flash = useFlash()
  const categories = useLiveQuery(listCategories)
  const [params, setParams] = useSearchParams()
  const kind: TransactionType = params.get('kind') === 'income' ? 'income' : 'expense'

  if (!categories) return null
  const ofKind = categories.filter((c) => c.kind === kind)
  const active = ofKind.filter((c) => !c.archived)
  const archived = ofKind.filter((c) => c.archived)

  return (
    <div className="stack">
      <p>
        <Link to="/settings">→ الإعدادات</Link>
      </p>
      <h1 className="page-title">الفئات</h1>

      {flash && <Alert tone="success">{flash}</Alert>}

      <ChoiceGroup
        legend="النوع"
        options={kindOptions}
        value={kind}
        onChange={(v) => setParams({ kind: v }, { replace: true })}
      />

      {active.length > 0 ? (
        <CategoryList items={active} label="الفئات" />
      ) : (
        <p className="muted">لا توجد فئات نشطة. أضف فئة جديدة.</p>
      )}

      <Link to={`/settings/categories/new?kind=${kind}`} className="btn btn--primary btn--md btn--full">
        <Icon name="plus" size={20} />
        {kind === 'expense' ? 'إضافة فئة مصروف' : 'إضافة فئة دخل'}
      </Link>

      {archived.length > 0 && (
        <section className="stack stack--tight">
          <h2 className="section-title">مؤرشفة</h2>
          <p className="muted small">لا تظهر عند تسجيل عملية جديدة، وتبقى في العمليات القديمة والتقارير.</p>
          <CategoryList items={archived} label="الفئات المؤرشفة" />
        </section>
      )}
    </div>
  )
}
