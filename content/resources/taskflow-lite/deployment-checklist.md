# Deployment & security checklist

علم على كل بند، أو اكتب ليه مش منطبق.

## Secrets
- [ ] `.env` في `.gitignore`، ومش موجود في أي commit قديم (`git log --all -p`)
- [ ] `.env.example` فيه أسماء المتغيرات بس، من غير قيم حقيقية
- [ ] الـ env vars متحطوطة في إعدادات الـ hosting provider، مش في الكود
- [ ] لو أي secret اتسرب قبل كده: اتغير (مش بس اتمسح)

## Database
- [ ] داتابيز الإنتاج منفصلة عن التطوير والـ tests
- [ ] Release step بيشغل `prisma migrate deploy` (مش `migrate dev` ولا `db push`)
- [ ] فولدر `prisma/migrations` في Git

## API
- [ ] كل input عليه validation في الـ server
- [ ] الـ 500 errors بترجع رسالة عامة، والتفاصيل في الـ logs بس
- [ ] `CLIENT_ORIGIN` مظبوط على دومين الـ frontend بس
- [ ] حجم الـ JSON body محدود
- [ ] `/api/health` بيرجع JSON وبيشيك على الداتابيز فعلًا

## Frontend
- [ ] `VITE_API_URL` بيشاور على الـ API الصح
- [ ] مفيش secrets في متغيرات `VITE_*` (أي حاجة فيها بتوصل للمتصفح)
- [ ] الصفحة شغالة على 360px

## تكلفة
- [ ] قريت الـ pricing والـ free tier limits بتاعة الـ provider
- [ ] عملت budget alert لو متاح
- [ ] عارف إزاي أوقف/أمسح الـ service لو مش محتاجه

## توثيق
- [ ] الـ README فيه خطوات التشغيل من الصفر (جربتها من clone جديد)
- [ ] "Known limitations" مكتوبة بصراحة (مثلًا: مفيش auth)
