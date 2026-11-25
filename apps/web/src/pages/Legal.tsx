import { Container } from '../components/Layout'
import { Notice, PageHeader } from '../components/ui'
import { useAuthCapabilities } from '../lib/auth'
import { isFreeLaunch } from '../lib/launch'

const DRAFT_NOTICE = 'مسودة — محتاجة مراجعة صاحب المشروع (ومستشار قانوني لو لزم) قبل الإطلاق العام.'
const OPERATOR_NAME = 'Ahmed Yousry'
const SUPPORT_EMAIL = 'ahmyousry2001@gmail.com'

function SupportEmail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="text-amber-2">
      {SUPPORT_EMAIL}
    </a>
  )
}

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
  const freeLaunch = isFreeLaunch()
  const { data: capabilities } = useAuthCapabilities()
  const socialOnly = capabilities?.passwordAuth === false
  return (
    <LegalPage title="سياسة الخصوصية">
      <h2>بنجمع إيه</h2>
      <ul>
        {socialOnly ? (
          <li>
            الإيميل والاسم من حساب Google أو GitHub اللي سجلت بيه. مفيش تسجيل بكلمة مرور، ومش بنطلب
            منك كلمة مرور خالص.
          </li>
        ) : (
          <li>الإيميل والاسم وكلمة المرور (متخزنة hashed بـ Argon2id، محدش يقدر يقراها).</li>
        )}
        <li>تقدمك في الدروس والـ checkpoints.</li>
        <li>إجابات الـ onboarding لو اخترت تجاوب (اختيارية).</li>
        <li>لينك GitHub لو اخترت تشاركه.</li>
        <li>بيانات الجلسة: نوع المتصفح (user agent) مختصر، وتاريخ الانتهاء.</li>
      </ul>
      <h2>{socialOnly ? 'الدخول بـ Google أو GitHub' : 'الدخول بـ Google أو GitHub (اختياري)'}</h2>
      <ul>
        <li>
          لو اخترت تكمّل بـ Google، بنطلب بس صلاحيات <bdi dir="ltr">openid email profile</bdi>{' '}
          وبناخد: معرّف حسابك في Google، وإيميلك (لازم يكون متأكد عند Google)، واسمك.
        </li>
        <li>
          لو اخترت تكمّل بـ GitHub، بنطلب بس <bdi dir="ltr">read:user user:email</bdi> وبناخد: معرّف
          حسابك واسم المستخدم والاسم، والإيميل الأساسي المتأكد. مش بنطلب أي صلاحية على الـ
          repositories بتاعتك.
        </li>
        <li>
          بنخزن عندنا: الإيميل والاسم، ونوع الحساب المربوط (Google أو GitHub) ومعرّفه، وتاريخ الربط
          وآخر دخول. مش بنخزن صورتك ولا أي توكن أو كلمة مرور من Google أو GitHub — التوكن بيتستخدم
          مرة واحدة وقت الدخول بس وبيتشال.
        </li>
        <li>
          مش بنربط حساب Google أو GitHub بحساب موجود تلقائيًا لمجرد إن الإيميل واحد. لو الإيميل مسجل
          عندنا قبل كده، هتحتاج تدخل بالطريقة الأصلية.
        </li>
        {socialOnly ? (
          <>
            <li>
              مش بنبعت أي إيميلات، ولا لينكات استرجاع أو إعادة تعيين. الوصول لحسابك عندنا معتمد على
              حسابك في Google أو GitHub؛ لو فقدت الوصول له، استرجعه من خلال Google أو GitHub نفسهم.
            </li>
            <li>
              مسح الحساب محتاج تأكيد جديد بنفس حساب Google أو GitHub المربوط من نفس الجلسة. بنخزن
              نسخة hashed بس من إثبات التأكيد ده، وبيكون صالح حوالي 5 دقايق ولمرة واحدة.
            </li>
          </>
        ) : (
          <li>
            الحسابات اللي اتعملت بـ Google أو GitHub مالهاش كلمة مرور معروفة. تقدر تمسح حسابك بتأكيد
            جديد بنفس حساب Google أو GitHub المربوط، أو تعمل كلمة مرور بـ "نسيت كلمة المرور" على نفس
            الإيميل.
          </li>
        )}
        <li>بيانات الربط بتظهر في نسخة بياناتك، وبتتمسح لما تمسح حسابك.</li>
      </ul>
      {socialOnly && (
        <>
          <h2>الاستضافة وتخزين البيانات</h2>
          <ul>
            <li>
              التطبيق شغال على <strong>Render</strong> (استضافة السيرفر)، وقاعدة البيانات على{' '}
              <strong>Neon</strong> (Postgres). الاتنين بيعالجوا بياناتك نيابة عننا عشان الخدمة
              تشتغل بس.
            </li>
            <li>منطقة التخزين: [تتحدد عند إعداد الحسابات على Render وNeon].</li>
          </ul>
        </>
      )}
      <h2>التحليلات (PostHog) — بموافقتك بس</h2>
      <p>
        Portfolab بيستخدم <strong>PostHog</strong> كأداة تحليلات منتج. مفيش أي حاجة بتتبعت لـ
        PostHog قبل ما توافق في بانر التحليلات، وتقدر تغير رأيك في أي وقت من "إعدادات التحليلات" تحت
        في الصفحة أو من صفحة حسابك.
      </p>
      <ul>
        <li>
          <strong>بنسجل:</strong> الصفحات اللي فتحتها، الأزرار والروابط المهمة اللي ضغطت عليها،
          وأحداث زي بدء مشروع أو إكمال درس أو نسخ prompt، ونوع الجهاز، ومعاملات حملة UTM لو جيت من
          لينك حملة.
        </li>
        <li>
          <strong>مش بنسجل أبدًا:</strong> إيميلك أو اسمك أو كلمة المرور أو أي توكن (ومنها توكنات
          Google وGitHub)
          {freeLaunch ? '' : ' أو بيانات دفع'} أو محتوى الحقول اللي بتكتبها. لما تسجل دخول، بنربط
          الأحداث بمعرّف داخلي عشوائي لحسابك بس، وبنفصل الربط ده لما تخرج.
        </li>
        <li>
          <strong>تسجيل الجلسات (session replay):</strong> مقفول افتراضيًا، وبيشتغل بس لو اخترته
          صراحة. كل الحقول والكود بيتخفوا، وصفحات الدخول والتسجيل والحساب
          {freeLaunch ? '' : ' والدفع'} مش بتتسجل خالص.
        </li>
        <li>
          بيانات PostHog بتتخزن على سيرفرات PostHog [الاتحاد الأوروبي — يتأكد عند الإعداد] لمدة
          [يحددها صاحب المشروع في إعدادات PostHog].
        </li>
      </ul>
      <p>
        بنحتفظ كمان بإحصائيات داخلية بسيطة على سيرفرنا (من غير IP) للأرقام المجمعة في لوحة الإدارة،
        وبتتمسح تلقائيًا بعد [395 يوم افتراضيًا].
      </p>
      {!freeLaunch && (
        <>
          <h2>الدفع (Paymob)</h2>
          <p>
            الدفع بيتم في صفحة Paymob الآمنة. إحنا مش بنشوف ولا بنخزن بيانات الكارت. بنبعت لـ Paymob
            اسمك وإيميلك ورقم موبايلك اللي بتكتبه في صفحة الدفع لأنهم مطلوبين لإتمام العملية، وبنخزن
            عندنا حالة الطلب والمبلغ ومعرّف العملية بس.
          </p>
        </>
      )}
      <h2>حقوقك</h2>
      <ul>
        <li>تنزيل نسخة من بياناتك من صفحة حسابك.</li>
        <li>
          مسح حسابك من صفحة حسابك.
          {freeLaunch
            ? ''
            : ' سجلات الدفع (لو حصل دفع مستقبلًا) ممكن نحتفظ بيها للالتزامات القانونية.'}
        </li>
      </ul>
      <h2>التواصل</h2>
      <p>
        Portfolab بيشغله {OPERATOR_NAME}. لأي سؤال عن الخصوصية أو طلب يخص بياناتك، ابعت على{' '}
        <SupportEmail />.
      </p>
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
        Portfolab بيشغله {OPERATOR_NAME}. للتواصل بخصوص الشروط: <SupportEmail />.
      </p>
      <p>
        [الهوية القانونية للنشاط، القانون الحاكم، وتفاصيل باقي الشروط — محتاجة يحددها صاحب المشروع]
      </p>
    </LegalPage>
  )
}

export function RefundPage() {
  return (
    <LegalPage title="سياسة الاسترجاع">
      <p>الدفع لسه مش مفتوح للعامة. لما يتفتح، الدفع هيبقى عن طريق Paymob بالجنيه المصري.</p>
      <p>لو اترد مبلغ، الوصول لـ Pro المرتبط بالطلب ده بيتلغى تلقائيًا.</p>
      <p>[شروط ومدة الاسترجاع لـ Portfolab Pro — محتاجة يحددها صاحب المشروع قبل فتح الدفع]</p>
    </LegalPage>
  )
}

export function ContactPage() {
  return (
    <LegalPage title="تواصل">
      <p>
        Portfolab بيشغله {OPERATOR_NAME}. إيميل الدعم: <SupportEmail />.
      </p>
      <p>
        للأسئلة عن المحتوى، الأفضل حاليًا التعليقات على الـ Reels بتاعة سلسلة Ahmed & Claude على
        Instagram.
      </p>
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
