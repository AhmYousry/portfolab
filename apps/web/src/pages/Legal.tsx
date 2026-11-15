import { Container } from '../components/Layout'
import { Notice, PageHeader } from '../components/ui'

const DRAFT_NOTICE = 'مسودة — محتاجة مراجعة صاحب المشروع (ومستشار قانوني لو لزم) قبل الإطلاق العام.'

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="max-w-3xl">
      <PageHeader title={title} />
      <div className="mb-8">
        <Notice>{DRAFT_NOTICE}</Notice>
      </div>
      <div className="prose-lesson">{children}</div>
    </Container>
  )
}

export function PrivacyPage() {
  return (
    <LegalPage title="سياسة الخصوصية">
      <h2>بنجمع إيه</h2>
      <ul>
        <li>الإيميل والاسم وكلمة المرور (متخزنة hashed بـ Argon2id، محدش يقدر يقراها).</li>
        <li>تقدمك في الدروس والـ checkpoints.</li>
        <li>إجابات الـ onboarding لو اخترت تجاوب (اختيارية).</li>
        <li>لينك GitHub لو اخترت تشاركه.</li>
        <li>بيانات الجلسة: نوع المتصفح (user agent) مختصر، وتاريخ الانتهاء.</li>
      </ul>
      <h2>التحليلات</h2>
      <p>
        لو وافقت على البانر، بنسجل أحداث مجهولة زي "حد فتح الصفحة الرئيسية" مع معرّف عشوائي بيتمسح
        لما تقفل التاب، ومعاملات UTM لو جيت من لينك حملة.{' '}
        <strong>مش بنخزن IP، ومفيش cookies تتبع، ومفيش أدوات تحليلات من طرف تالت.</strong>
      </p>
      <p>
        لما تعمل حساب، بنسجل أحداث أساسية مربوطة بحسابك (التسجيل، بدء مشروع، إكمال checkpoint) عشان
        نقيس هل المحتوى بيفيد، ونقدر نعرضها كأرقام مجمعة بس.
      </p>
      <h2>حقوقك</h2>
      <ul>
        <li>تنزيل نسخة من بياناتك من صفحة حسابك.</li>
        <li>
          مسح حسابك من صفحة حسابك. سجلات الدفع (لو حصل دفع مستقبلًا) ممكن نحتفظ بيها للالتزامات
          القانونية.
        </li>
      </ul>
      <h2>التواصل</h2>
      <p>[بيانات التواصل — محتاجة يحددها صاحب المشروع]</p>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="الشروط">
      <p>المحتوى تعليمي. مفيش أي ضمان لوظيفة أو نتيجة معينة.</p>
      <p>
        الكود في المشاريع التعليمية متاح ليك تستخدمه في البورتفوليو بتاعك، مع ذكر إنك بنيته من خلال
        المنهج ده.
      </p>
      <p>ممنوع إعادة نشر محتوى الدروس أو بيعه.</p>
      <p>
        [الهوية القانونية للنشاط، القانون الحاكم، وتفاصيل باقي الشروط — محتاجة يحددها صاحب المشروع]
      </p>
    </LegalPage>
  )
}

export function RefundPage() {
  return (
    <LegalPage title="سياسة الاسترجاع">
      <p>الدفع مش متاح حاليًا، فمفيش أي مبالغ بتتحصل.</p>
      <p>[سياسة الاسترجاع لـ Pro — هتتحدد قبل فتح الدفع، ومحتاجة موافقة صاحب المشروع]</p>
    </LegalPage>
  )
}

export function ContactPage() {
  return (
    <LegalPage title="تواصل">
      <p>[إيميل الدعم وقناة التواصل الرسمية — محتاجة يحددها صاحب المشروع]</p>
      <p>للأسئلة عن المحتوى، الأفضل حاليًا التعليقات على الـ Reels بتاعة Ahmed & Claude.</p>
    </LegalPage>
  )
}

export function NotFound() {
  return (
    <Container className="max-w-xl text-center">
      <p className="display mb-4 text-amber">404</p>
      <h1 className="mb-4 text-2xl font-bold">الصفحة دي مش موجودة</h1>
      <a href="/" className="text-amber-2">
        ارجع للرئيسية
      </a>
    </Container>
  )
}
