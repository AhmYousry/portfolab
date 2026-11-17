import { Check, Lock } from 'lucide-react'
import { useEffect } from 'react'
import { Container } from '../components/Layout'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Loading,
  Notice,
  PageHeader,
} from '../components/ui'
import { analytics, trackEvent } from '../lib/analytics'
import { useMe } from '../lib/auth'
import { usePricing } from '../lib/queries'

const MINOR_PER_UNIT = 100

export function Pricing() {
  const { data: tiers, isLoading, isError, refetch } = usePricing()
  const { data: user } = useMe()

  useEffect(() => {
    trackEvent('pro_offer_view', '/pricing')
    analytics.capture('pro_page_viewed', { source: 'pricing' })
  }, [])

  return (
    <Container>
      <PageHeader eyebrow="الأسعار" title="ابدأ مجانًا. ادفع بس لما يبقى في حاجة تستاهل.">
        المشروع المجاني كامل بالقصد، ومش متقفل منه أي خطوة لازمة. Pro بيضيف مشاريع أعمق، مش بيفتح
        حاجات اتقفلت عليك.
      </PageHeader>

      {isLoading && <Loading />}
      {isError && <ErrorState message="مش قادرين نحمل الأسعار." onRetry={() => refetch()} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {tiers?.map((tier) => (
          <Card key={tier.id} className={tier.id === 'PRO' ? 'border-amber/30' : ''}>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold" dir="ltr">
                {tier.name}
              </h2>
              {tier.id === 'FREE' ? (
                <Badge tone="teal">متاح دلوقتي</Badge>
              ) : (
                !tier.available && <Badge>قريبًا</Badge>
              )}
            </div>
            <p className="mb-6">
              <span className="text-4xl font-bold">
                {tier.priceMinor === 0
                  ? '0'
                  : (tier.priceMinor / MINOR_PER_UNIT).toLocaleString('ar-EG')}
              </span>{' '}
              <span className="text-muted">
                جنيه {tier.id === 'PRO' ? '— مرة واحدة، مش اشتراك' : ''}
              </span>
            </p>
            {tier.isTestPrice && (
              <p className="mb-6 text-sm text-dim">سعر تجريبي مبدئي، ممكن يتغير قبل الإطلاق.</p>
            )}
            <ul className="mb-8 space-y-3">
              {tier.includes.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-7">
                  <Check className="mt-1 size-4 shrink-0 text-teal" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <h3 className="mb-3 text-sm font-semibold text-muted">المشاريع</h3>
            <ul className="mb-8 flex flex-wrap gap-2">
              {tier.projects.map((p) => (
                <li key={p.slug}>
                  <Badge tone={p.status === 'PUBLISHED' ? 'ok' : 'default'}>
                    {p.title} {p.status === 'PUBLISHED' ? '' : '· قريبًا'}
                  </Badge>
                </li>
              ))}
            </ul>
            {tier.id === 'FREE' ? (
              <ButtonLink
                to={user ? '/dashboard' : '/signup'}
                className="w-full"
                onClick={() => trackEvent('free_cta_click', '/pricing')}
                analyticsId="pricing-free-cta"
              >
                {user ? 'روح للوحتك' : 'ابدأ مجانًا'}
              </ButtonLink>
            ) : tier.checkoutEnabled ? (
              <ButtonLink
                to={user ? '/checkout' : `/signup?next=${encodeURIComponent('/checkout')}`}
                className="w-full"
                analyticsId="pricing-pro-cta"
              >
                اشترك في {tier.name}
              </ButtonLink>
            ) : (
              <>
                <Button className="w-full" disabled aria-describedby="checkout-note">
                  <Lock className="size-4" aria-hidden />
                  الدفع مش متاح لسه
                </Button>
                <p id="checkout-note" className="mt-3 text-center text-xs text-dim">
                  مش بناخد فلوس على محتوى لسه مخلصش. هنفتح الدفع لما أول مشروع Pro يبقى جاهز ومختبر.
                </p>
              </>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <Notice>
          <strong>ملاحظة:</strong> مفيش أي مشروع أو كورس بيضمن وظيفة. اللي بنقدمه إنك تبني مشاريع
          حقيقية وتفهمها وتعرف تشرحها.
        </Notice>
      </div>
    </Container>
  )
}
