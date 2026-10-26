import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Icon } from '../../components/Icon'
import { listAccounts } from '../../data/accountsRepo'
import { listCategories } from '../../data/categoriesRepo'
import { readReceiptText, type OcrProgress } from '../../data/ocr'
import { getSettings } from '../../data/settingsRepo'
import { createTransaction } from '../../data/transactionsRepo'
import { canAutoSave, parseReceipt } from '../../domain/receipt'
import { receiptToInput } from './prefill'

type State =
  | { step: 'pick'; message?: string }
  | { step: 'preview'; file: File; url: string }
  | { step: 'reading'; file: File; url: string; progress: OcrProgress }
  | { step: 'failed'; file: File; url: string; message: string }

/** تصوير الفاتورة أو اختيارها ← معاينة ← قراءة على الجهاز ← مراجعة في نموذج المصروف. */
export function ScanScreen() {
  const navigate = useNavigate()
  const accounts = useLiveQuery(listAccounts)
  const categories = useLiveQuery(listCategories)
  const settings = useLiveQuery(getSettings)
  const [state, setState] = useState<State>({ step: 'pick' })

  // تحرير ذاكرة الصورة عند تغييرها أو مغادرة الشاشة؛ الصورة لا تُحفظ.
  const url = 'url' in state ? state.url : undefined
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setState({ step: 'pick', message: 'الملف المختار ليس صورة. اختر صورة الفاتورة (JPG أو PNG).' })
      return
    }
    setState({ step: 'preview', file, url: URL.createObjectURL(file) })
  }

  async function read() {
    if (state.step !== 'preview' && state.step !== 'failed') return
    const { file, url } = state
    setState({ step: 'reading', file, url, progress: { stage: 'loading', percent: 0 } })
    let text: string
    try {
      text = await readReceiptText(file, (progress) => setState({ step: 'reading', file, url, progress }))
    } catch {
      setState({
        step: 'failed',
        file,
        url,
        message: navigator.onLine
          ? 'تعذّرت قراءة الصورة. جرّب صورة أوضح أو أدخل المصروف يدوياً.'
          : 'أداة القراءة تحتاج اتصالاً بالإنترنت في أول استخدام فقط لتحميلها (حوالي 9 ميغابايت). اتصل ثم أعد المحاولة، أو أدخل المصروف يدوياً.',
      })
      return
    }

    const receipt = parseReceipt(text)
    if (receipt.totalMinor === null) {
      setState({ step: 'failed', file, url, message: 'لم نتمكن من قراءة المبلغ من هذه الصورة. أعد التصوير بإضاءة أفضل وبشكل مستقيم، أو أدخل المصروف يدوياً.' })
      return
    }

    // الحفظ التلقائي فقط إن فعّله المستخدم وكانت القراءة واضحة تماماً.
    if (settings?.autoSaveReceipts && canAutoSave(receipt) && accounts?.length && categories) {
      try {
        const saved = await createTransaction(receiptToInput(receipt, accounts, categories))
        navigate(`/transactions/${saved.id}`, { replace: true, state: { flash: 'حُفظ المصروف من الفاتورة تلقائياً. راجعه وعدّله إن لزم.' } })
        return
      } catch {
        // إن تعذّر الحفظ التلقائي تُعرض المراجعة كالمعتاد.
      }
    }
    navigate('/transactions/new?type=expense', { state: { receipt } })
  }

  const busy = state.step === 'reading'

  return (
    <div className="stack">
      <p>
        <Link to="/">→ الرئيسية</Link>
      </p>
      <h1 className="page-title">قراءة فاتورة</h1>

      {state.step === 'pick' && (
        <>
          {state.message && <Alert tone="danger">{state.message}</Alert>}
          <p className="muted">صوّر الفاتورة أو اختر صورتها، وسيقرأ قِرْش المبلغ والتاريخ واسم المحل لتراجعها قبل الحفظ.</p>
          <label className="btn btn--primary btn--lg btn--full file-btn">
            <Icon name="camera" />
            تصوير الفاتورة
            <input type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={choose} />
          </label>
          <label className="btn btn--secondary btn--md btn--full file-btn">
            <Icon name="image" />
            اختيار صورة من الجهاز
            <input type="file" accept="image/*" className="visually-hidden" onChange={choose} />
          </label>
          <p className="muted small">إن رفضت إذن الكاميرا يمكنك دائماً اختيار صورة من الجهاز.</p>
        </>
      )}

      {'url' in state && (
        <>
          <Card className="receipt-preview">
            <img src={state.url} alt="صورة الفاتورة المختارة" />
          </Card>

          {state.step === 'reading' && (
            <div className="reading" role="status" aria-live="polite">
              <p>{state.progress.stage === 'loading' ? 'جارٍ تجهيز أداة القراءة…' : 'جارٍ قراءة الفاتورة…'}</p>
              <progress max={100} value={state.progress.stage === 'reading' ? state.progress.percent : undefined} />
            </div>
          )}

          {state.step === 'failed' && (
            <Alert tone="danger" title="لم تكتمل القراءة">
              {state.message}
            </Alert>
          )}

          <Button size="lg" fullWidth disabled={busy} onClick={read}>
            {state.step === 'failed' ? 'إعادة المحاولة' : 'قراءة الفاتورة'}
          </Button>
          <div className="form-actions form-actions--even">
            <Button variant="secondary" disabled={busy} onClick={() => setState({ step: 'pick' })}>
              إعادة التصوير
            </Button>
            <Link to="/transactions/new?type=expense" className="btn btn--secondary btn--md">
              إدخال يدوي
            </Link>
          </div>
        </>
      )}

      <Card>
        <h2 className="section-title">الخصوصية</h2>
        <ul className="steps small">
          <li>القراءة تتم على جهازك فقط؛ الصورة لا تُرسل إلى أي خادم ولا تُحفظ في التطبيق.</li>
          <li>أول استخدام يحتاج إنترنت لتحميل أداة القراءة (حوالي 9 ميغابايت)، ثم تعمل دون اتصال.</li>
          <li>من الروشتة الطبية يُقرأ المبلغ والتاريخ فقط؛ لا يقدّم التطبيق أي تشخيص أو معلومات علاجية.</li>
        </ul>
      </Card>
    </div>
  )
}
