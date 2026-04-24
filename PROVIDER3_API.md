# Provider 3 — API

البادئة الأساسية: **`/api/v1`**. مسارات المزوّد الثالث تحت **`/api/v1/provider3/*`**.

## متغيرات البيئة

```env
third_NUMBER_API_URL=http://YOUR_HOST:9191/api
third_NUMBER_API_KEY=your_token_here
```

مزامنة access (اختياري): `PROVIDER3_ACCESS_SYNC_ENABLED`, `PROVIDER3_ACCESS_SYNC_CRON`, `PROVIDER3_ACCESS_INFO_INTERVAL`, `PROVIDER3_ACCESS_SYNC_TZ`.

## نموذج البيانات (عزل P3)

- الدول والخدمات الخاصة بالمزوّد الثالث في جداول **`p3_countries`** و**`p3_services`** (وليس `countries` / `service`).
- **`provider3_country_service_config`**: يربط `p3CountryId` + `p3ServiceId` مع السعر و`upstreamCountryCode` و`upstreamServiceName`.
- في واجهة الـ API تُستخدم أسماء المعاملات `countryId` و`serviceId` في مسارات مثل `config/create`، لكن قيمها هي **معرّفات جداول P3** أعلاه.
- طلبات الرقم ذات **`provider = 3`** تُخزَّن مع **`p3CountryId` / `p3ServiceId`**؛ التفاصيل في `PROVIDER3_ADMIN_API.md` (قسم الترحيل).

## إعداد البيانات (أدمن)

- مسارات الإدارة:
  - `GET /api/v1/provider3/config` — قائمة كاملة (أدمن)، مع `p3Country` / `p3Service` (و`country` / `service` كأسماء مستعارة للتوافق).
  - `GET /api/v1/provider3/config/create?countryId=&serviceId=&price=&upstreamCountryCode=&upstreamServiceName=` — `countryId` و`serviceId` من P3.
  - `GET /api/v1/provider3/config/update?id=&price=&...`
  - `GET /api/v1/provider3/config/remove?id=`
  - `GET /api/v1/provider3/admin/p3-catalog-countries` — كل دول P3 (أدمن).
  - `GET /api/v1/provider3/admin/p3-catalog-services` — كل خدمات P3 (أدمن).
  - `GET /api/v1/provider3/admin/country-create` — إنشاء في `p3_countries`.
  - `GET /api/v1/provider3/admin/service-create` — إنشاء في `p3_services`.

## المستخدمون

### فهرس الخادم (بدون كشف أسماء المشغّلين)

استخدم `GET /api/v1/provider3/pricing-by-country?countryId=` — لكل خدمة الحقل **`operatorCount`** (عدد الفتحات). **`server=1`** يعني أول مشغّل مسموح، وهكذا.

### طلب رقم

`GET /api/v1/provider3/get-number?apiKey=&country=&serviceCode=&server=1`  
(`server` مطلوب — فهرس 1…N من `operatorCount`؛ **لا** يُقبل معرّف المشغّل الخام.)

### الرسائل

نفس مسار الطلبات العام: `GET /api/v1/order/get-message?apiKey=&orderId=` (عند `provider=3` في الطلب).

## مزامنة accessinfo (أدمن)

- `GET /api/v1/provider3/access-sync?serviceCode=wa&interval=30min&serviceName=` (اختياري) — `serviceCode` يجب أن يطابق كوداً في `p3_services`.
- `GET /api/v1/provider3/access-sync-all`

## تسعير حسب الدولة (واجهة مستخدم)

`GET /api/v1/provider3/pricing-by-country?countryId=` — **`countryId`** = `p3_countries.id`.

## accessinfo حسب الخدمة (عام)

`GET /api/v1/provider3/accessinfo?serviceCode=` — **بدون JWT / apiKey** (مثل الكتالوج العام).

- **إلزامي:** `serviceCode` (كود من `p3_services`).
- الدول المعادة: **فقط** ما هو مفعّل في إعداد التسعير/الربط لتلك الخدمة، و**فقط** إن وُجدت فتحة واحدة على الأقل لطلب الرقم (`server` 1…N بنفس منطق `get-number`).
- لكل دولة: `countryName`, `code_country`, **`serverCount`**. **لا** يُعاد `countryId` ولا أي معاملات تقنية إضافية في الاستجابة.

مثال:

```json
{
  "state": "200",
  "data": {
    "serviceCode": "whatsapp",
    "countries": [
      { "countryName": "Pakistan", "code_country": "PK", "serverCount": 3 }
    ]
  }
}
```

---

## ترحيل قاعدة البيانات

قبل `AppDataSource.initialize()` يُنفَّذ بالترتيب:

1. **`preTypeormMigrateProvider3`** — نقل الأعمدة القديمة `provider3` من الجداول المشتركة وإنشاء `provider3_country_service_config` عند الحاجة (`src/script/preTypeormMigrateProvider3.js`).
2. **`preTypeormMigrateP3Isolation`** — عزل بيانات P3 إلى `p3_countries` / `p3_services` وتحديث الإعداد والطلبات (`src/script/preTypeormMigrateP3Isolation.js`).

بعدها يعمل TypeORM (مثل `synchronize`) على مواءمة المخطط مع الكيانات.
