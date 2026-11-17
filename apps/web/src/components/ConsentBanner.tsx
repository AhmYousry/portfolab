import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getConsent, setConsent, trackEvent } from '../lib/analytics'
import { syncConsentToServer, useMe } from '../lib/auth'
import { type ConsentState, onConsentChange } from '../lib/consent'
import { Button } from './ui'

const OPEN_EVENT = 'pb:open-consent'

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function ConsentBanner() {
  const { data: user } = useMe()
  const [consent, setLocal] = useState<ConsentState | null>(() => getConsent())
  const [forcedOpen, setForcedOpen] = useState(false)
  const [replay, setReplay] = useState(() => getConsent()?.replay ?? false)

  useEffect(() => onConsentChange(setLocal), [])
  useEffect(() => {
    const open = () => {
      setReplay(getConsent()?.replay ?? false)
      setForcedOpen(true)
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [])

  if (consent && !forcedOpen) return null

  function choose(analytics: boolean) {
    const wasGranted = getConsent()?.analytics === true
    setConsent({ analytics, replay: analytics && replay })
    setForcedOpen(false)
    if (user) void syncConsentToServer()
    if (analytics && !wasGranted && window.location.pathname === '/') trackEvent('landing_view')
  }

  return (
    <div
      role="region"
      aria-label="إعدادات التحليلات"
      data-testid="consent-banner"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl rounded-2xl border border-line-2 bg-ink-2/95 p-5 shadow-2xl backdrop-blur"
    >
      <p className="mb-3 text-sm leading-7 text-paper/90">
        بنستخدم PostHog عشان نعرف الصفحات والأزرار اللي بتتستخدم ونحسن Portfolab. لو مسجل دخول،
        بنربط الأحداث بمعرّف داخلي لحسابك (مش إيميلك ولا اسمك). مش بنبعت كلمة المرور ولا أي بيانات
        دفع ولا اللي بتكتبه في الحقول. تقدر ترفض والموقع هيشتغل عادي. التفاصيل في{' '}
        <Link to="/privacy" className="text-amber-2 underline">
          سياسة الخصوصية
        </Link>
        .
      </p>
      <label className="mb-4 flex gap-3 text-sm leading-7 text-muted">
        <input
          type="checkbox"
          className="mt-1.5 size-4 accent-[var(--color-amber)]"
          checked={replay}
          onChange={(e) => setReplay(e.target.checked)}
        />
        <span>
          اسمح كمان بتسجيل جلسات الاستخدام (session replay) لتحسين التجربة. كل الحقول والكود
          بيتخفوا، وصفحات الدخول والحساب والدفع مش بتتسجل خالص.
        </span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => choose(true)}
          className="px-4 py-2"
          data-analytics-id="consent-accept"
        >
          موافق
        </Button>
        <Button
          variant="ghost"
          onClick={() => choose(false)}
          className="px-4 py-2"
          data-analytics-id="consent-decline"
        >
          لأ، شكرًا
        </Button>
      </div>
    </div>
  )
}
