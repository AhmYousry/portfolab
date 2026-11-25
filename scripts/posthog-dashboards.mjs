// Creates the 7 Portfolab dashboards in PostHog. Idempotent: dashboards and insights are
// matched by name and skipped if they already exist.
// Needs .env.posthog.local (gitignored): POSTHOG_PERSONAL_API_KEY, POSTHOG_APP_HOST, POSTHOG_PROJECT_ID.
// Usage: node scripts/posthog-dashboards.mjs [--dry-run]
import { existsSync } from 'node:fs'

const ENV_FILE = '.env.posthog.local'
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)

const KEY = process.env.POSTHOG_PERSONAL_API_KEY?.trim()
const HOST = process.env.POSTHOG_APP_HOST?.trim().replace(/\/$/, '')
const PROJECT = process.env.POSTHOG_PROJECT_ID?.trim()
const DRY_RUN = process.argv.includes('--dry-run')

const DATE_30D = { date_from: '-30d' }
const DATE_60D = { date_from: '-60d' }
const DATE_90D = { date_from: '-90d' }

const ev = (event, extra = {}) => ({
  kind: 'EventsNode',
  event,
  name: event,
  math: 'total',
  ...extra,
})
const uniqueUsers = (event, extra = {}) => ev(event, { math: 'dau', ...extra })
const prop = (key, value, operator = 'exact') => ({ type: 'event', key, operator, value })
const breakdown = (key, limit = 25) => ({
  breakdown: key,
  breakdown_type: 'event',
  breakdown_limit: limit,
})

const trends = (series, opts = {}) => ({
  kind: 'TrendsQuery',
  series,
  interval: opts.interval ?? 'day',
  dateRange: opts.dateRange ?? DATE_30D,
  ...(opts.breakdown ? { breakdownFilter: opts.breakdown } : {}),
  trendsFilter: {
    display: opts.display ?? 'ActionsLineGraph',
    ...(opts.formula ? { formula: opts.formula } : {}),
  },
  filterTestAccounts: true,
})

const funnel = (series, windowDays, dateRange = DATE_30D) => ({
  kind: 'FunnelsQuery',
  series,
  dateRange,
  funnelsFilter: {
    funnelWindowInterval: windowDays,
    funnelWindowIntervalUnit: 'day',
    funnelOrderType: 'ordered',
  },
  filterTestAccounts: true,
})

const KEY_CTAS = [
  'hero-free-cta',
  'pricing-free-cta',
  'pricing-pro-cta',
  'project-start',
  'dashboard-continue',
  'checkout-pay',
]

const DASHBOARDS = [
  {
    name: 'Portfolab · 1. Traffic & Acquisition',
    insights: [
      [
        'Pageviews by utm_source',
        trends([ev('$pageview')], { breakdown: breakdown('utm_source') }),
      ],
      [
        'Unique visitors by utm_campaign',
        trends([uniqueUsers('$pageview')], { breakdown: breakdown('utm_campaign') }),
      ],
      [
        'Pageviews by device_type',
        trends([ev('$pageview')], { breakdown: breakdown('device_type'), display: 'ActionsPie' }),
      ],
      [
        'Pageviews by referring domain',
        trends([ev('$pageview')], {
          breakdown: breakdown('$referring_domain'),
          display: 'ActionsTable',
        }),
      ],
      [
        'Signups by utm_campaign',
        trends([ev('signup_completed')], {
          breakdown: breakdown('utm_campaign'),
          display: 'ActionsBarValue',
        }),
      ],
    ],
  },
  {
    name: 'Portfolab · 2. Most Clicked Buttons',
    description:
      'button_clicked by analytics_id only. $autocapture is deliberately excluded (it fires for the same clicks).',
    insights: [
      [
        'Most clicked buttons (top 30)',
        trends([ev('button_clicked')], {
          breakdown: breakdown('analytics_id', 30),
          display: 'ActionsBarValue',
        }),
      ],
      [
        'Key CTAs over time',
        trends([ev('button_clicked', { properties: [prop('analytics_id', KEY_CTAS)] })], {
          breakdown: breakdown('analytics_id'),
        }),
      ],
      [
        'Unique users per button',
        trends([uniqueUsers('button_clicked')], {
          breakdown: breakdown('analytics_id', 30),
          display: 'ActionsBarValue',
        }),
      ],
    ],
  },
  {
    name: 'Portfolab · 3. Learning Engagement',
    insights: [
      [
        'Lifecycle (weekly pageviews)',
        {
          kind: 'LifecycleQuery',
          series: [ev('$pageview')],
          interval: 'week',
          dateRange: DATE_90D,
          filterTestAccounts: true,
        },
      ],
      [
        'Retention: signup → lesson_started (weekly)',
        {
          kind: 'RetentionQuery',
          dateRange: DATE_90D,
          retentionFilter: {
            targetEntity: { id: 'signup_completed', name: 'signup_completed', type: 'events' },
            returningEntity: { id: 'lesson_started', name: 'lesson_started', type: 'events' },
            period: 'Week',
            totalIntervals: 8,
            retentionType: 'retention_first_time',
          },
          filterTestAccounts: true,
        },
      ],
      [
        'Stickiness: lesson_completed',
        {
          kind: 'StickinessQuery',
          series: [ev('lesson_completed')],
          dateRange: DATE_30D,
          filterTestAccounts: true,
        },
      ],
      [
        'Active learners (daily unique)',
        trends([uniqueUsers('$pageview'), uniqueUsers('lesson_started')]),
      ],
      [
        'Prompts copied by prompt_id',
        trends([ev('prompt_copied')], {
          breakdown: breakdown('prompt_id'),
          display: 'ActionsBarValue',
        }),
      ],
      [
        'Features used',
        trends([ev('feature_used')], {
          breakdown: breakdown('feature_name'),
          display: 'ActionsBarValue',
        }),
      ],
    ],
  },
  {
    name: 'Portfolab · 4. Project Completion',
    insights: [
      [
        'TaskFlow Lite funnel',
        funnel(
          [
            ev('free_project_started', { properties: [prop('project_id', ['taskflow-lite'])] }),
            ev('lesson_completed', { properties: [prop('project_id', ['taskflow-lite'])] }),
            ev('project_completed', { properties: [prop('project_id', ['taskflow-lite'])] }),
          ],
          30,
        ),
      ],
      [
        'Lessons completed by lesson_id',
        trends([ev('lesson_completed')], {
          breakdown: breakdown('lesson_id', 50),
          display: 'ActionsBarValue',
        }),
      ],
      [
        'Lesson completion ratio (completed / started)',
        trends([ev('lesson_started'), ev('lesson_completed')], {
          breakdown: breakdown('lesson_id', 50),
          display: 'ActionsTable',
          formula: 'B / A',
        }),
      ],
      [
        'Checkpoints completed',
        trends([ev('checkpoint_completed')], {
          breakdown: breakdown('checkpoint_id', 50),
          display: 'ActionsBarValue',
        }),
      ],
    ],
  },
  {
    name: 'Portfolab · 5. Free-to-Pro Conversion',
    description: 'Behavioral only. Revenue truth lives in the database (admin overview).',
    insights: [
      [
        'Free → Pro funnel',
        funnel(
          [
            ev('signup_completed'),
            ev('project_completed', { properties: [prop('plan', ['free'])] }),
            ev('pro_page_viewed'),
            ev('checkout_started'),
            ev('purchase_completed'),
          ],
          60,
          DATE_60D,
        ),
      ],
      [
        'Pro page views by source',
        trends([ev('pro_page_viewed')], {
          breakdown: breakdown('source'),
          display: 'ActionsBarValue',
        }),
      ],
    ],
  },
  {
    name: 'Portfolab · 6. Checkout Funnel',
    insights: [
      [
        'Checkout funnel',
        funnel(
          [
            ev('pro_page_viewed', { properties: [prop('source', ['checkout'])] }),
            ev('checkout_started'),
            ev('purchase_completed'),
          ],
          1,
        ),
      ],
      [
        'Checkout failures by reason',
        trends([ev('checkout_failed')], {
          breakdown: breakdown('reason'),
          display: 'ActionsBarValue',
        }),
      ],
      [
        'Purchases and revenue (EGP)',
        trends(
          [
            ev('purchase_completed'),
            ev('purchase_completed', { math: 'sum', math_property: 'amount_egp' }),
          ],
          { display: 'BoldNumber' },
        ),
      ],
      ['Refunds', trends([ev('purchase_refunded')])],
    ],
  },
  {
    name: 'Portfolab · 7. Errors & Friction',
    insights: [
      [
        'Client errors by reason',
        trends([ev('client_error')], { breakdown: breakdown('reason'), display: 'ActionsTable' }),
      ],
      [
        'Checkout failures by reason',
        trends([ev('checkout_failed')], { breakdown: breakdown('reason') }),
      ],
      [
        'Rage clicks by page',
        trends([ev('$rageclick')], {
          breakdown: breakdown('$current_url'),
          display: 'ActionsTable',
        }),
      ],
      [
        'Auth failures by reason',
        trends([ev('signup_failed'), ev('login_failed')], { breakdown: breakdown('reason') }),
      ],
      [
        'Login page views vs logins',
        trends([
          ev('$pageview', { properties: [prop('path', '/login', 'icontains')] }),
          ev('login_completed'),
        ]),
      ],
    ],
  },
]

async function api(path, init = {}) {
  const res = await fetch(`${HOST}/api/projects/${PROJECT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok)
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${res.status} ${(await res.text()).slice(0, 300)}`,
    )
  return res.json()
}

async function listAll(path) {
  const out = []
  let next = path
  while (next) {
    const page = await api(next)
    out.push(...page.results)
    next = page.next
      ? page.next.slice(
          page.next.indexOf(`/api/projects/${PROJECT}`) + `/api/projects/${PROJECT}`.length,
        )
      : null
  }
  return out
}

async function main() {
  if (DRY_RUN) {
    for (const d of DASHBOARDS) console.log(`${d.name}: ${d.insights.map(([n]) => n).join(' | ')}`)
    return
  }
  if (!KEY?.startsWith('phx_') || !HOST || !PROJECT) {
    console.error(
      `Set POSTHOG_PERSONAL_API_KEY (phx_…), POSTHOG_APP_HOST and POSTHOG_PROJECT_ID in ${ENV_FILE}`,
    )
    process.exit(1)
  }
  const dashboards = await listAll('/dashboards/?limit=200')
  const insights = await listAll('/insights/?limit=200&saved=true')

  for (const spec of DASHBOARDS) {
    let dashboard = dashboards.find((d) => d.name === spec.name && !d.deleted)
    if (dashboard) console.log(`= dashboard exists: ${spec.name} (#${dashboard.id})`)
    else {
      dashboard = await api('/dashboards/', {
        method: 'POST',
        body: JSON.stringify({
          name: spec.name,
          description: spec.description ?? '',
          tags: ['portfolab'],
        }),
      })
      console.log(`+ dashboard created: ${spec.name} (#${dashboard.id})`)
    }
    for (const [name, source] of spec.insights) {
      const existing = insights.find(
        (i) => i.name === name && !i.deleted && i.dashboards?.includes(dashboard.id),
      )
      if (existing) {
        console.log(`  = insight exists: ${name}`)
        continue
      }
      await api('/insights/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          query: { kind: 'InsightVizNode', source },
          dashboards: [dashboard.id],
          saved: true,
        }),
      })
      console.log(`  + insight created: ${name}`)
    }
  }
  console.log(`Done. ${HOST}/project/${PROJECT}/dashboard`)
}

main().catch((error) => {
  console.error(String(error.message ?? error))
  process.exit(1)
})
