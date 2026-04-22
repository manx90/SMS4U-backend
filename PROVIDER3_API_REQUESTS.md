# المزوّد الثالث (Provider 3) — مرجع طلبات الـ API

البادئة العامة للخادم: **`/api/v1`**. مسارات المزوّد الثالث: **`/api/v1/provider3/*`**.

**الكود:** وحدة معزولة تحت `src/modules/provider3/` (مسارات، `upstream.service.js`، `orderMessage.service.js`). الملف `src/api/third-Number.service.js` يعيد التصدير للتوافق مع الاستيرادات القديمة.

**عزل البيانات:** الدول والخدمات الخاصة بـ P3 في جداول **`p3_countries`** و**`p3_services`**. في المعاملات المسماة `countryId` / `serviceId` (مثل `config/create` و`catalog/services`) القيم هي **معرّفات هذه الجداول**، وليست `countries.id` / `service.id`. التفاصيل والترحيل: `PROVIDER3_ADMIN_API.md`.

---

## 1) واجهة المزوّد الخارجي (Upstream — `modules/provider3/services/upstream.service.js`، alias: `third-Number.service.js`)

المتغيرات: `third_NUMBER_API_URL` (مثال: `http://HOST:9191/api`)، `third_NUMBER_API_KEY` (يُمرَّر كـ `token`).

| الطلب | الطريقة | المسار النهائي | المعاملات (Query) |
|--------|---------|----------------|-------------------|
| أرقام | GET | `{third_NUMBER_API_URL}/get_numbers` | `country` (كود ISO مثل IT)، `operator`، `count` (افتراضي 1)، `token` |
| رسائل | GET | `{third_NUMBER_API_URL}/get_messages` | `number` (بدون +)، `token` |
| accessinfo | GET | `{base بدون /api}/accessinfo` | `interval` (مثل `30min`)، `service` (اسم الخدمة عند المزوّد)، `token` |

`base` يُشتق من `third_NUMBER_API_URL`: إذا انتهى بـ `/api` يُزال هذا الجزء لاستدعاء `/accessinfo`.

---

## 2) واجهة خادم SMS4U — جميع مسارات `/api/v1/provider3`

| المسار | الطريقة | الصلاحية | المعاملات (Query) |
|--------|---------|----------|-------------------|
| `/provider3/get-message` | GET | مستخدم | **إلزامي:** `apiKey`, `orderId` — للطلبات التي `provider === 3` فقط (بديل مخصص عن `/order/get-message`). |
| `/provider3/get-number` | GET | مستخدم (`requireUser`) + JWT / `apiKey` | **إلزامي:** `apiKey`, `country`, `serviceCode`, **`server`** (أو `operatorIndex`) — فهرس 1…N حيث N = عدد المشغّلين من `pricing-by-country` (`operatorCount`). **لا** يُقبل `operator` الخام. |
| `/provider3/countries-by-service` | GET | مستخدم | **إلزامي:** `serviceCode`. **اختياري:** `interval` — قائمة الدول من آخر snapshot (بعد `access-sync`)، **بدون** كشف هوية المشغّل الخام. |
| `/provider3/pricing-by-country` | GET | عام | **إلزامي:** `countryId` — معرّف **دولة P3** (`p3_countries.id`). يُرجع لكل خدمة **`operatorCount`** لبناء فهرس `server` 1…N |
| `/provider3/access-sync` | GET | أدمن | **إلزامي:** `serviceCode` (كود من `p3_services`). **اختياري:** `interval`, `serviceName` |
| `/provider3/access-sync-all` | GET | أدمن | — |
| `/provider3/config` | GET | أدمن | — |
| `/provider3/config/create` | GET | أدمن | **إلزامي:** `countryId`, `serviceId`, `price`, `upstreamCountryCode`, `upstreamServiceName` — `countryId`/`serviceId` من **`p3_countries` / `p3_services`** |
| `/provider3/config/update` | GET | أدمن | **إلزامي:** `id`. **اختياري:** `price`, `upstreamCountryCode`, `upstreamServiceName` (واحد على الأقل للتحديث) |
| `/provider3/config/remove` | GET | أدمن | **إلزامي:** `id` |
| `/provider3/catalog/countries` | GET | عام (بدون JWT/apiKey) | — دول P3 تظهر في إعداد P3 فقط |
| `/provider3/catalog/services` | GET | عام | **اختياري:** `countryId` — بدونه: كل خدمة + `countries[]`؛ معه: خدمات دولة واحدة (قائمة مسطّحة) |
| `/provider3/admin/country-create` | GET | أدمن | **إلزامي:** `country`, `code_country` — إنشاء في **`p3_countries`** |
| `/provider3/admin/service-create` | GET | أدمن | **إلزامي:** `servicename`, `code` — إنشاء في **`p3_services`** |
| `/provider3/admin/p3-catalog-countries` | GET | أدمن | — كل صفوف `p3_countries` (لقوائم الإدارة) |
| `/provider3/admin/p3-catalog-services` | GET | أدمن | — كل صفوف `p3_services` (لقوائم الإدارة) |

**ملاحظة:** طلب الرقم لمزوّد 3 **لا** يمر عبر `GET /api/v1/order/get-number` مع `provider=3` — يُرجَع خطأ يوجّه إلى `/provider3/get-number`.

**توثيق الأدمن الكامل:** `PROVIDER3_ADMIN_API.md`.

---

## 3) مسار مشترك للرسائل (بعد إنشاء الطلب)

| المسار | الطريقة | الصلاحية | المعاملات |
|--------|---------|----------|-----------|
| `/order/get-message` | GET | حسب `order.route` | `apiKey`, `orderId` — إذا `provider === 3` يستخدم نفس منطق الوحدة (`getSmsMessageForNumber`). |
| `/provider3/get-message` | GET | مستخدم | مخصص المزوّد 3 فقط؛ يُرفض إن لم يكن الطلب للمزوّد 3. |

---

## 4) الواجهة الأمامية (`api.sms4u-frontEnd` — `provider3Api` في `src/services/api.js`)

الـ `baseURL` الافتراضي: `VITE_API_BASE_URL` أو `https://api.sms4u.pro/api/v1`. الطلبات تضيف تلقائياً `Authorization: Bearer` و`apiKey` من `localStorage` عند الحاجة.

| الدالة | مسار axios |
|--------|------------|
| `getPricingByCountry` | GET `/provider3/pricing-by-country` (يُرجع `operatorCount` لكل خدمة) |
| `provider3AccessSync` | GET `/provider3/access-sync` |
| `provider3AccessSyncAll` | GET `/provider3/access-sync-all` (timeout 120s) |
| `getProvider3Number` | GET `/provider3/get-number` |
| `getProvider3Message` | GET `/provider3/get-message` |
| `countriesByService` | GET `/provider3/countries-by-service` |
| `configList` | GET `/provider3/config` |
| `configCreate` | GET `/provider3/config/create` |
| `configUpdate` | GET `/provider3/config/update` |
| `configRemove` | GET `/provider3/config/remove` |
| `adminP3CatalogCountries` | GET `/provider3/admin/p3-catalog-countries` |
| `adminP3CatalogServices` | GET `/provider3/admin/p3-catalog-services` |

---

## 5) متغيرات بيئة إضافية (مزامنة access)

اختياري: `PROVIDER3_ACCESS_SYNC_ENABLED`, `PROVIDER3_ACCESS_SYNC_CRON`, `PROVIDER3_ACCESS_INFO_INTERVAL`, `PROVIDER3_ACCESS_SYNC_TZ`.
