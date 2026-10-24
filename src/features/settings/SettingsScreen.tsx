import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { Card } from '../../components/Card'
import { Icon } from '../../components/Icon'
import { listAccounts } from '../../data/accountsRepo'
import { getSettings } from '../../data/settingsRepo'
import { getStorageStatus, type StorageStatus } from '../../data/storage'

const dateFormat = new Intl.DateTimeFormat('ar-u-nu-latn', { dateStyle: 'long', timeStyle: 'short' })

/** صيغة العدد العربية: حساب واحد، حسابان، 3 حسابات، 11 حساباً. */
function countAccounts(n: number): string {
  if (n === 1) return 'حساب واحد'
  if (n === 2) return 'حسابان'
  if (n >= 3 && n <= 10) return `${n} حسابات`
  return `${n} حساباً`
}

function persistedLabel(status: StorageStatus | undefined): string {
  if (!status) return '…'
  if (status.persisted === null) return 'غير مدعومة في هذا المتصفح'
  return status.persisted ? 'مفعّلة' : 'غير مفعّلة بعد'
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
              {accountCount === undefined ? '…' : countAccounts(accountCount)} — نقد، بنك، جوال باي، بال باي
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </Link>
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
                <bdi>{dateFormat.format(new Date(settings.lastBackupAt))}</bdi>
              ) : (
                'لم تُنشأ نسخة احتياطية بعد'
              )}
            </dd>
          </div>
        </dl>
        {storage?.persisted === false && (
          <p className="muted small">لزيادة الحماية، ثبّت قِرْش على الشاشة الرئيسية من قائمة المتصفح.</p>
        )}
        <Alert tone="info">إنشاء نسخة احتياطية واستعادتها سيتوفران في تحديث قادم.</Alert>
      </Card>

      <p className="dev-link">
        <Link to="/design">معاينة نظام التصميم</Link>
      </p>
    </div>
  )
}
