import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/Card'
import { Icon } from '../../components/Icon'
import { listAccounts } from '../../data/accountsRepo'
import { getSettings, setAutoSaveReceipts } from '../../data/settingsRepo'
import { getStorageStatus, type StorageStatus } from '../../data/storage'
import { accountForms, countLabel } from '../../domain/arabic'
import { formatDateTime } from '../../domain/dates'

function persistedLabel(status: StorageStatus | undefined): string {
  if (!status) return '…'
  if (status.persisted === null) return 'غير مدعومة في هذا المتصفح'
  return status.persisted ? 'مفعّلة' : 'غير مفعّلة بعد'
}

/** يستجيب فوراً للنقر ثم يحفظ (القراءة من قاعدة البيانات غير متزامنة فترتد الخانة لحظة). */
function AutoSaveToggle({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial)
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked)
          void setAutoSaveReceipts(e.target.checked)
        }}
      />
      <span>
        <span className="toggle__title">حفظ تلقائي عند وضوح القراءة</span>
        <span className="toggle__hint">
          يُحفظ المصروف دون شاشة المراجعة فقط إذا قُرئ المبلغ بجانب «الإجمالي» والتاريخ كاملاً دون أي تحذير. غير ذلك
          تظهر المراجعة دائماً.
        </span>
      </span>
    </label>
  )
}

export function SettingsScreen() {
  const settings = useLiveQuery(getSettings)
  const accountCount = useLiveQuery(async () => (await listAccounts()).length)
  const [storage, setStorage] = useState<StorageStatus>()

  useEffect(() => {
    getStorageStatus().then(setStorage)
  }, [])

  return (
    <div className="stack">
      <h1 className="page-title">الإعدادات</h1>

      <Card>
        <h2 className="section-title">الحسابات والمحافظ</h2>
        <Link to="/settings/accounts" className="list-item list-item--plain">
          <span className="list-item__icon">
            <Icon name="wallet" />
          </span>
          <span className="list-item__main">
            <span className="list-item__title">إدارة الحسابات</span>
            <span className="list-item__meta">
              {accountCount === undefined ? '…' : countLabel(accountCount, accountForms)} — نقد، بنك، جوال باي، بال باي
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      </Card>

      <Card>
        <h2 className="section-title">الفئات</h2>
        <Link to="/settings/categories" className="list-item list-item--plain">
          <span className="list-item__icon">
            <Icon name="list" />
          </span>
          <span className="list-item__main">
            <span className="list-item__title">إدارة الفئات</span>
            <span className="list-item__meta">فئات المصروف والدخل، وإضافة فئاتك الخاصة</span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
      </Card>

      <Card>
        <h2 className="section-title">قراءة الفواتير</h2>
        <Link to="/scan" className="list-item list-item--plain">
          <span className="list-item__icon">
            <Icon name="camera" />
          </span>
          <span className="list-item__main">
            <span className="list-item__title">تصوير فاتورة</span>
            <span className="list-item__meta">تُقرأ على جهازك فقط، والصورة لا تُرسل ولا تُحفظ</span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
        {settings && <AutoSaveToggle initial={!!settings.autoSaveReceipts} />}
      </Card>

      <Card>
        <h2 className="section-title">البيانات والنسخ الاحتياطي</h2>
        <dl className="details">
          <div>
            <dt>مكان حفظ البيانات</dt>
            <dd>على هذا الجهاز فقط، داخل المتصفح</dd>
          </div>
          <div>
            <dt>الحماية من الحذف التلقائي</dt>
            <dd>{persistedLabel(storage)}</dd>
          </div>
          <div>
            <dt>آخر نسخة احتياطية</dt>
            <dd>
              {settings?.lastBackupAt ? (
                <bdi>{formatDateTime(settings.lastBackupAt)}</bdi>
              ) : (
                'لم تُنشأ نسخة احتياطية بعد'
              )}
            </dd>
          </div>
        </dl>
        {storage?.persisted === false && (
          <p className="muted small">لزيادة الحماية، ثبّت قِرْش على الشاشة الرئيسية من قائمة المتصفح.</p>
        )}
        <Link to="/settings/backup" className="btn btn--primary btn--md btn--full">
          النسخ الاحتياطي والاستعادة
        </Link>
      </Card>

      {/* للمطوّر فقط؛ الصفحة نفسها تبقى متاحة على /design. */}
      {import.meta.env.DEV && (
        <p className="dev-link">
          <Link to="/design">معاينة نظام التصميم</Link>
        </p>
      )}
    </div>
  )
}
