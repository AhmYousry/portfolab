import { useMutation } from '@tanstack/react-query'
import type { PublicUser } from '@pb/shared'
import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { safeNext } from '../components/Guards'
import { Container } from '../components/Layout'
import { Button, Card, Select } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { analytics } from '../lib/analytics'
import { useAuthActions } from '../lib/auth'

const EXPERIENCE = [
  { value: '', label: 'تفضل متقولش' },
  { value: 'NEW', label: 'لسه بادئ (بعرف أساسيات JS)' },
  { value: 'SOME', label: 'عملت مشاريع صغيرة' },
  { value: 'JUNIOR', label: 'Junior بشتغل أو بدور على شغل' },
]
const HOURS = [
  { value: '', label: 'تفضل متقولش' },
  { value: '3', label: 'حوالي 3 ساعات' },
  { value: '6', label: 'حوالي 6 ساعات' },
  { value: '10', label: '10 ساعات أو أكتر' },
]
const GOALS = [
  { value: '', label: 'تفضل متقولش' },
  { value: 'PORTFOLIO', label: 'بورتفوليو أقوى' },
  { value: 'LEARNING', label: 'أتعلم full stack' },
  { value: 'JOB', label: 'أقدم على شغل' },
]

export function Onboarding() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const { setUser } = useAuthActions()
  const [values, setValues] = useState({ experienceLevel: '', weeklyHours: '', goal: '' })

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ user: PublicUser }>('/api/me/profile', {
        experienceLevel: values.experienceLevel || null,
        weeklyHours: values.weeklyHours ? Number(values.weeklyHours) : null,
        goal: values.goal || null,
      }),
    onSuccess: ({ user }) => {
      analytics.capture('feature_used', {
        feature_name: 'onboarding_completed',
        source: 'onboarding',
      })
      setUser(user)
      navigate(next, { replace: true })
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const update = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  function skip() {
    analytics.capture('feature_used', {
      feature_name: 'onboarding_skipped',
      source: 'onboarding',
    })
    navigate(next, { replace: true })
  }

  return (
    <Container className="max-w-lg">
      <h1 className="mb-2 text-3xl font-bold">3 أسئلة سريعة (اختيارية)</h1>
      <p className="mb-8 text-muted">بتساعدنا نحسن المحتوى. تقدر تتخطاها خالص.</p>
      <Card>
        <form onSubmit={submit} className="space-y-5">
          <Select
            label="خبرتك"
            options={EXPERIENCE}
            value={values.experienceLevel}
            onChange={update('experienceLevel')}
          />
          <Select
            label="وقتك في الأسبوع"
            options={HOURS}
            value={values.weeklyHours}
            onChange={update('weeklyHours')}
          />
          <Select label="هدفك" options={GOALS} value={values.goal} onChange={update('goal')} />
          {save.isError && (
            <p role="alert" className="text-sm text-rose">
              {errorMessage(save.error)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={save.isPending}>
              احفظ وكمّل
            </Button>
            <Button type="button" variant="ghost" onClick={skip}>
              تخطى
            </Button>
          </div>
        </form>
      </Card>
    </Container>
  )
}
