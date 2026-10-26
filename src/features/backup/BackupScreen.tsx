import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { downloadText } from '../../core/download'
import { exportBackup, markBackedUp, readBackupText, restoreBackup } from '../../data/backupRepo'
import { getSettings } from '../../data/settingsRepo'
import { BackupError, backupFilename, summarizeBackup, type BackupFile } from '../../domain/backup'
import {
  accountForms,
  budgetForms,
  categoryForms,
  countLabel,
  debtForms,
  transactionForms,
  transferForms,
} from '../../domain/arabic'
import { formatDateTime } from '../../domain/dates'

const MIME = 'application/json'
/** حد أعلى لحجم ملف الاستعادة؛ النسخ الحقيقية أصغر بكثير، والملفات الضخمة قد تجمّد الهاتف. */
const MAX_BACKUP_BYTES = 50 * 1024 * 1024

/** هل يدعم المتصفح مشاركة الملفات (مثل الحفظ في Google Drive من الهاتف)؟ */
function canShareFiles(): boolean {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'test.json', { type: MIME })] })
  } catch {
    return false
  }
}

type RestoreState =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'ready'; file: BackupFile; name: string }
  | { step: 'restoring'; file: BackupFile; name: string }
  | { step: 'done' }
  | { step: 'error'; message: string }

export function BackupScreen() {
  const settings = useLiveQuery(getSettings)
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: ReactNode }>()
  const [busy, setBusy] = useState(false)
  const [restore, setRestore] = useState<RestoreState>({ step: 'idle' })
  const [confirming, setConfirming] = useState(false)
  const shareSupported = canShareFiles()

  async function createBackup(mode: 'download' | 'share') {
    setBusy(true)
    setNotice(undefined)
    try {
      const file = await exportBackup()
      const text = JSON.stringify(file, null, 2)
      const name = backupFilename('qirsh-backup')
      if (mode === 'share') {
        await navigator.share({ files: [new File([text], name, { type: MIME })], title: 'نسخة احتياطية من قِرْش' })
      } else {
        downloadText(name, text, MIME)
      }
      await markBackedUp(file.createdAt)
      setNotice({
        tone: 'success',
        text: (
          <>
            أُنشئت النسخة الاحتياطية{' '}
            <bdi dir="ltr" className="filename">
              {name}
            </bdi>
            . احفظها في مكان آمن خارج هذا الجهاز.
          </>
        ),
      })
    } catch (err) {
      // إلغاء نافذة المشاركة من المستخدم ليس خطأ.
      if (err instanceof DOMException && err.name === 'AbortError') return
      setNotice({ tone: 'danger', text: 'تعذّر إنشاء النسخة الاحتياطية. حاول مرة أخرى.' })
    } finally {
      setBusy(false)
    }
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    e.target.value = '' // للسماح باختيار الملف نفسه مرة أخرى.
    if (!selected) return
    if (selected.size > MAX_BACKUP_BYTES) {
      setRestore({ step: 'error', message: 'الملف كبير جداً ولا يبدو نسخة احتياطية من قِرْش.' })
      return
    }
    setRestore({ step: 'checking' })
    try {
      const file = await readBackupText(await selected.text())
      setRestore({ step: 'ready', file, name: selected.name })
    } catch (err) {
      setRestore({
        step: 'error',
        message: err instanceof BackupError ? err.message : 'تعذّرت قراءة الملف. تأكد أنه ملف نسخة احتياطية من قِرْش.',
      })
    }
  }

  async function confirmRestore() {
    if (restore.step !== 'ready') return
    setConfirming(false)
    setRestore({ ...restore, step: 'restoring' })
    try {
      // نسخة من البيانات الحالية قبل استبدالها، حتى لا يضيع شيء لو كان الملف خاطئاً.
      const current = await exportBackup()
      downloadText(backupFilename('qirsh-before-restore'), JSON.stringify(current, null, 2), MIME)
      await restoreBackup(restore.file)
      setRestore({ step: 'done' })
    } catch {
      setRestore({
        step: 'error',
        message: 'تعذّرت الاستعادة، ولم يتغيّر شيء في بياناتك الحالية. حاول مرة أخرى.',
      })
    }
  }

  const selected = restore.step === 'ready' || restore.step === 'restoring' ? restore : null
  const summary = selected ? summarizeBackup(selected.file) : null

  return (
    <div className="stack">
      <p>
        <Link to="/settings">→ الإعدادات</Link>
      </p>
      <h1 className="page-title">النسخ الاحتياطي والاستعادة</h1>

      <Card>
        <h2 className="section-title">ماذا يحفظ الملف؟</h2>
        <p className="small">
          ملف واحد فيه كل بياناتك: الحسابات وأرصدتها الافتتاحية، والعمليات، والتحويلات، والفئات، والميزانيات، والديون
          ودفعاتها، والإعدادات. لا يحتاج إنترنت ولا حساباً، ولا يُرسل إلى أي خادم.
        </p>
        <p className="muted small">
          الملف غير مشفّر، فاحفظه في مكان خاص بك (مثل Google Drive أو بريدك أو ذاكرة خارجية) ولا تشاركه مع غيرك.
        </p>
      </Card>

      <section className="stack stack--tight" aria-labelledby="create-title">
        <h2 id="create-title" className="section-title section-title--flush">
          إنشاء نسخة احتياطية
        </h2>
        <p className="muted small">
          آخر نسخة احتياطية:{' '}
          {settings?.lastBackupAt ? <bdi>{formatDateTime(settings.lastBackupAt)}</bdi> : 'لم تُنشأ بعد'}
        </p>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Button size="lg" fullWidth disabled={busy} onClick={() => createBackup('download')}>
          إنشاء نسخة احتياطية
        </Button>
        {shareSupported && (
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => createBackup('share')}>
            مشاركة النسخة (مثل الحفظ في Google Drive)
          </Button>
        )}
      </section>

      <section className="stack stack--tight" aria-labelledby="restore-title">
        <h2 id="restore-title" className="section-title section-title--flush">
          استعادة نسخة احتياطية
        </h2>
        <p className="muted small">
          الاستعادة <strong>تستبدل كل بياناتك الحالية</strong> ببيانات الملف. قبل الاستبدال يُنزَّل تلقائياً ملف ببياناتك
          الحالية احتياطاً.
        </p>

        {restore.step === 'error' && <Alert tone="danger" title="لم تتم الاستعادة">{restore.message}</Alert>}
        {restore.step === 'done' && (
          <Alert tone="success" title="اكتملت الاستعادة">
            <p>
              بياناتك الآن من النسخة الاحتياطية. <Link to="/">الذهاب إلى الرئيسية</Link>
            </p>
          </Alert>
        )}

        {summary && (
          <Card className="backup-summary" aria-label="محتوى النسخة الاحتياطية">
            <h3 className="section-title section-title--flush">
              <bdi dir="ltr" className="filename">{selected?.name}</bdi>
            </h3>
            <dl className="details">
              <div>
                <dt>أُنشئت في</dt>
                <dd>
                  <bdi>{formatDateTime(summary.createdAt)}</bdi>
                </dd>
              </div>
              <div>
                <dt>المحتوى</dt>
                <dd>
                  {(
                    [
                      [summary.counts.accounts, accountForms],
                      [summary.counts.transactions, transactionForms],
                      [summary.counts.transfers, transferForms],
                      [summary.counts.categories, categoryForms],
                      [summary.counts.budgets, budgetForms],
                      [summary.counts.debts, debtForms],
                    ] as const
                  )
                    .filter(([n]) => n > 0)
                    .map(([n, forms]) => countLabel(n, forms))
                    .join('، ')}
                </dd>
              </div>
            </dl>
            <Alert tone="info">الملف سليم، وجاهز للاستعادة.</Alert>
            <div className="form-actions form-actions--even">
              <Button variant="danger" disabled={restore.step === 'restoring'} onClick={() => setConfirming(true)}>
                {restore.step === 'restoring' ? 'جارٍ الاستعادة…' : 'استعادة'}
              </Button>
              <Button variant="secondary" disabled={restore.step === 'restoring'} onClick={() => setRestore({ step: 'idle' })}>
                إلغاء
              </Button>
            </div>
          </Card>
        )}

        {!summary && (
          <label className="btn btn--secondary btn--md btn--full file-btn">
            {restore.step === 'checking' ? 'جارٍ فحص الملف…' : 'اختيار ملف النسخة الاحتياطية'}
            <input type="file" accept=".json,application/json" className="visually-hidden" onChange={chooseFile} />
          </label>
        )}
      </section>

      <Card>
        <h2 className="section-title">نقل بياناتك إلى جهاز آخر</h2>
        <ol className="steps small">
          <li>على هذا الجهاز: «إنشاء نسخة احتياطية» واحفظ الملف (أو شاركه إلى Google Drive أو البريد).</li>
          <li>انقل الملف إلى الجهاز الآخر.</li>
          <li>على الجهاز الآخر: افتح قِرْش ← الإعدادات ← النسخ الاحتياطي ← «اختيار ملف النسخة الاحتياطية».</li>
        </ol>
        <p className="muted small">هذا نقل يدوي وليس مزامنة: التغييرات اللاحقة على أحد الجهازين لا تظهر على الآخر.</p>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="استبدال كل بياناتك الحالية؟"
        confirmLabel="استبدال البيانات"
        onConfirm={confirmRestore}
        onCancel={() => setConfirming(false)}
      >
        ستُحذف بياناتك الحالية وتحل محلها بيانات النسخة الاحتياطية. سيُنزَّل أولاً ملف ببياناتك الحالية احتياطاً.
      </ConfirmDialog>
    </div>
  )
}
