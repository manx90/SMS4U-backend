# Provider 3 — API

البادئة الأساسية: **`/api/v1`**. مسارات المزوّد الثالث تحت **`/api/v1/provider3/*`**.

## متغيرات البيئة

```env
third_NUMBER_API_URL=http://YOUR_HOST:9191/api
third_NUMBER_API_KEY=your_token_here
```

مزامنة access (اختياري): `PROVIDER3_ACCESS_SYNC_ENABLED`, `PROVIDER3_ACCESS_SYNC_CRON`, `PROVIDER3_ACCESS_INFO_INTERVAL`, `PROVIDER3_ACCESS_SYNC_TZ`.

## إعداد البيانات (أدمن)

- **جدول `provider3_country_service_config`**: لكل زوج (دولة + خدمة): السعر، `upstreamCountryCode`، `upstreamServiceName`.
- مسارات الإدارة:
  - `GET /api/v1/provider3/config` — قائمة كاملة (أدمن)
  - `GET /api/v1/provider3/config/create?countryId=&serviceId=&price=&upstreamCountryCode=&upstreamServiceName=`
  - `GET /api/v1/provider3/config/update?id=&price=&...`
  - `GET /api/v1/provider3/config/remove?id=`

## المستخدمون

### المشغّلون (من آخر access sync)

`GET /api/v1/provider3/operators?serviceCode=wa&country=IT&interval=30min`

### طلب رقم

`GET /api/v1/provider3/get-number?apiKey=&country=&serviceCode=&server=1`  
(المستخدمون: `server` مطلوب — نفس الفهرس من operators. الأدمن يمكنه `operator` الخام.)

### الرسائل

نفس مسار الطلبات العام: `GET /api/v1/order/get-message?apiKey=&orderId=` (عند `provider=3` في الطلب).

## مزامنة accessinfo (أدمن)

- `GET /api/v1/provider3/access-sync?serviceCode=wa&interval=30min&serviceName=` (اختياري)
- `GET /api/v1/provider3/access-sync-all`

## تسعير حسب الدولة (واجهة مستخدم)

`GET /api/v1/provider3/pricing-by-country?countryId=`

---

ترحيل من المخطط القديم: عند التشغيل يُنفَّذ `preTypeormMigrateProvider3` قبل TypeORM لمزامنة الأعمدة القديمة ثم إنشاء الجدول الجديد.
