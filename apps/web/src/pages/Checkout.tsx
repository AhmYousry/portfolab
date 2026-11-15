import { useMutation, useQuery } from '@tanstack/react-query'
import { BRAND } from '@pb/shared'
import { CheckCircle2, Clock, Lock, XCircle } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Container } from '../components/Layout'
import {
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageHeader,
} from '../components/ui'
import { ApiRequestError, api, errorMessage, fieldErrors } from '../lib/api'
import { analytics } from '../lib/analytics'
import { useMe } from '../lib/auth'
import { usePricing } from '../lib/queries'

const MINOR_PER_UNIT = 100
const POLL_INTERVAL_MS = 3000
const POLLS_BEFORE_RECONCILE = 5
const MAX_POLLS = 20
const SERVER_REPORTED_STATUS = 502

export function Checkout() {
  const { data: user } = useMe()
  const { data: tiers, isLoading } = usePricing()
  const pro = tiers?.find((t) => t.id === 'PRO')
  const [form, setForm] = useState({ firstName: '', lastName: '', phoneNumber: '' })

  useEffect(() => {
    analytics.capture('pro_page_viewed', { source: 'checkout' })
  }, [])

  const start = useMutation({
    mutationFn: () =>
      api.post<{ purchaseId: string; checkoutUrl: string }>('/api/checkout/session', {
        ...form,
        source: 'checkout_page',
      }),
    onSuccess: ({ checkoutUrl }) => {
      window.location.assign(checkoutUrl)
    },
    onError: (error) => {
      const serverReported =
        error instanceof ApiRequestError && error.status === SERVER_REPORTED_STATUS
      if (serverReported) return
      analytics.capture('checkout_failed', {
        plan: 'pro',
        source: 'checkout_page',
        reason: error instanceof ApiRequestError ? error.code : 'unknown',
      })
    },
  })

  if (isLoading) return <Loading />
  if (user?.hasPro) {
    return (
      <Container className="max-w-xl">
        <Notice tone="teal">عندك {BRAND.proTier} بالفعل.</Notice>
      </Container>
    )
  }
  if (!pro?.checkoutEnabled) {
    return (
      <Container className="max-w-xl text-center">
        <Lock className="mx-auto mb-4 size-8 text-amber" aria-hidden />
        <h1 className="mb-3 text-2xl font-bold">الدفع مش متاح لسه</h1>
        <p className="mb-8 text-muted">
          مش بناخد فلوس على محتوى لسه مخلصش. هنفتح الدفع لما أول مشروع Pro يبقى جاهز ومختبر.
        </p>
        <ButtonLink to="/pricing" variant="ghost">
          ارجع للأسعار
        </ButtonLink>
      </Container>
    )
  }

  const errors = fieldErrors(start.error)
  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e: FormEvent) {
    e.preventDefault()
    start.mutate()
  }

  return (
    <Container className="max-w-xl">
      <PageHeader eyebrow="الدفع" title={`اشترك في ${BRAND.proTier}`}>
        {(pro.priceMinor / MINOR_PER_UNIT).toLocaleString('ar-EG')} جنيه — مرة واحدة. الدفع بيتم في
        صفحة Paymob الآمنة؛ إحنا مش بنشوف ولا بنخزن بيانات الكارت.
      </PageHeader>
      <Card>
        <form onSubmit={submit} className="space-y-5 ph-no-capture" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="الاسم الأول"
              autoComplete="given-name"
              value={form.firstName}
              onChange={update('firstName')}
              error={errors.firstName}
            />
            <Field
              label="اسم العيلة"
              autoComplete="family-name"
              value={form.lastName}
              onChange={update('lastName')}
              error={errors.lastName}
            />
          </div>
          <Field
            label="رقم الموبايل"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="+2010xxxxxxxx"
            value={form.phoneNumber}
            onChange={update('phoneNumber')}
            error={errors.phoneNumber}
            hint="Paymob بتطلبه لإتمام الدفع. بيتبعت لـ Paymob بس ومش بنخزنه."
          />
          {start.isError && !Object.keys(errors).length && (
            <p role="alert" className="text-sm text-rose">
              {errorMessage(start.error)}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            loading={start.isPending}
            data-attr="checkout-pay"
          >
            كمّل للدفع بـ Paymob
          </Button>
          <p className="text-xs leading-6 text-dim">
            بالضغط بتوافق على{' '}
            <Link to="/terms" className="underline">
              الشروط
            </Link>{' '}
            و
            <Link to="/refund-policy" className="underline">
              سياسة الاسترجاع
            </Link>
            . الوصول لـ Pro بيتفعل بعد ما Paymob تأكد الدفع لسيرفرنا، مش من الصفحة دي.
          </p>
        </form>
      </Card>
    </Container>
  )
}

interface PurchaseStatus {
  id: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  amountMinor: number
  currency: string
}

export function CheckoutStatus() {
  const [params] = useSearchParams()
  const purchaseId = params.get('purchase') ?? ''
  const [polls, setPolls] = useState(0)
  const valid = /^[a-z0-9]{10,40}$/i.test(purchaseId)

  const { data, isError, refetch } = useQuery({
    queryKey: ['checkout-status', purchaseId, polls >= POLLS_BEFORE_RECONCILE],
    queryFn: () =>
      api
        .get<{
          purchase: PurchaseStatus
        }>(
          `/api/checkout/status/${purchaseId}${polls >= POLLS_BEFORE_RECONCILE ? '?refresh=1' : ''}`,
        )
        .then((d) => d.purchase),
    enabled: valid,
    refetchInterval: (q) =>
      q.state.data?.status === 'PENDING' && polls < MAX_POLLS ? POLL_INTERVAL_MS : false,
  })

  useEffect(() => {
    if (data?.status === 'PENDING') setPolls((p) => p + 1)
  }, [data])

  if (!valid) {
    return (
      <Container className="max-w-xl">
        <ErrorState message="رقم الطلب مش صحيح." />
      </Container>
    )
  }
  if (isError) return <ErrorState message="مش قادرين نجيب حالة الدفع." onRetry={() => refetch()} />
  if (!data) return <Loading label="بنتأكد من الدفع…" />

  const views = {
    PAID: {
      icon: <CheckCircle2 className="mx-auto mb-4 size-10 text-ok" aria-hidden />,
      title: 'الدفع اتأكد. أهلًا بيك في Pro!',
      body: 'الوصول اتفعل على حسابك.',
    },
    PENDING: {
      icon: <Clock className="mx-auto mb-4 size-10 text-amber" aria-hidden />,
      title: 'بنستنى تأكيد Paymob…',
      body:
        polls >= MAX_POLLS
          ? 'التأكيد متأخر. هنكمل نراجع تلقائيًا، وتقدر ترجع للصفحة دي بعد شوية.'
          : 'الصفحة هتتحدث لوحدها. متدفعش تاني.',
    },
    FAILED: {
      icon: <XCircle className="mx-auto mb-4 size-10 text-rose" aria-hidden />,
      title: 'الدفع ماتمش',
      body: 'مفيش فلوس اتخصمت على حسب Paymob. تقدر تجرب تاني.',
    },
    REFUNDED: {
      icon: <XCircle className="mx-auto mb-4 size-10 text-muted" aria-hidden />,
      title: 'الطلب ده اترد',
      body: 'الوصول لـ Pro اتلغى للطلب ده.',
    },
  } as const
  const view = views[data.status]

  return (
    <Container className="max-w-xl text-center">
      <div role="status" aria-live="polite">
        {view.icon}
        <h1 className="mb-3 text-2xl font-bold">{view.title}</h1>
        <p className="mb-8 text-muted">{view.body}</p>
      </div>
      {data.status === 'PAID' && <ButtonLink to="/dashboard">روح للوحتك</ButtonLink>}
      {data.status === 'FAILED' && (
        <ButtonLink to="/checkout" data-attr="checkout-retry">
          جرب تاني
        </ButtonLink>
      )}
    </Container>
  )
}
