import { useState } from 'react'
import { Link } from 'react-router'
import { type Consent, getConsent, setConsent, trackEvent } from '../lib/analytics'
import { Button } from './ui'

export function ConsentBanner() {
  const [consent, setLocal] = useState<Consent>(() => getConsent())
  if (consent) return null

  function choose(value: 'granted' | 'denied') {
    setConsent(value)
    setLocal(value)
    if (value === 'granted' && window.location.pathname === '/') trackEvent('landing_view')
  }

  return (
    <div
      role="region"
      aria-label="إعدادات التحليلات"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl rounded-2xl border border-line-2 bg-ink-2/95 p-5 shadow-2xl backdrop-blur"
    >
      <p className="mb-4 text-sm leading-7 text-paper/90">
        بنستخدم تحليلات مجهولة الهوية (من غير cookies تتبع، ومن غير IP) عشان نعرف الصفحات اللي
        بتفيد. تقدر ترفض والموقع هيشتغل عادي. التفاصيل في{' '}
        <Link to="/privacy" className="text-amber-2 underline">
          سياسة الخصوصية
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => choose('granted')} className="px-4 py-2">
          موافق
        </Button>
        <Button variant="ghost" onClick={() => choose('denied')} className="px-4 py-2">
          لأ، شكرًا
        </Button>
      </div>
    </div>
  )
}
