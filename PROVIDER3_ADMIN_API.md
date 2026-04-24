# توثيق API — إدارة المزوّد الثالث (Provider 3) للأدمن

**البادئة:** `https://<HOST>/api/v1`  
**المصادقة:** تمرير `Authorization: Bearer <access_token>` للأدمن.  
معظم مسارات الإدارة تستخدم **GET** مع معاملات الاستعلام (نفس أسلوب المشروع).

---

## 0) نموذج البيانات — عزل P3 عن المزوّدين 1 و 2

المزوّد الثالث **لا** يعتمد على جداول `countries` و`service` المشتركة.

| الجدول | الوصف |
|--------|--------|
| `p3_countries` | دول خاصة بـ P3: `id`, `name`, `code_country` (فريد). |
| `p3_services` | خدمات خاصة بـ P3: `id`, `name`, `code` (فريد). |
| `provider3_country_service_config` | ربط دولة P3 + خدمة P3: السعر، `upstreamCountryCode`, `upstreamServiceName` (أعمدة FK: `p3CountryId`, `p3ServiceId`). |
| `orders` (عند `provider = 3`) | يُفضَّل ربط الطلب بـ `p3CountryId` و`p3ServiceId`؛ حقول `countryId` و`serviceId` تكون `NULL` لطلبات P3. |

**ترحيل قاعدة البيانات:** قبل تهيئة TypeORM يُنفَّذ بالترتيب:

1. `preTypeormMigrateProvider3` — نقل أعمدة `provider3` القديمة من الجداول المشتركة وإنشاء `provider3_country_service_config` إن لزم.
2. `preTypeormMigrateP3Isolation` — إنشاء `p3_countries` / `p3_services`، نقل بيانات الإعداد من الربط القديم (`countryId`/`serviceId` على الجداول المشتركة) إلى أعمدة P3، وتحديث طلبات `provider = 3` لتعبئة `p3CountryId`/`p3ServiceId` وإفراغ `countryId`/`serviceId` عند الحاجة.

السكربت: `src/script/preTypeormMigrateP3Isolation.js`.

**مهم في المعاملات:** في `config/create` و`catalog/services` و`pricing-by-country`، **`countryId` و`serviceId` هما معرّفان من جداول P3** (`p3_countries.id` و`p3_services.id`)، وليسا معرّفات `countries` / `service`.

**استجابة `GET /provider3/config`:** لكل صف يُعاد `p3Country` و`p3Service`؛ وللتوافق مع الواجهات يُعاد أيضاً **`country`** و**`service`** كنسخة من نفس كائنات P3 (ليس من الجداول المشتركة).

---

## 1) إعداد السعر والربط (جدول `provider3_country_service_config`)

| الطلب | الوصف |
|--------|--------|
| `GET /provider3/config` | قائمة كل الصفوف (دولة P3، خدمة P3، سعر، أكواد المزوّد الخارجي). |
| `GET /provider3/config/create` | **إلزامي:** `countryId`, `serviceId`, `price`, `upstreamCountryCode`, `upstreamServiceName` — حيث `countryId` = `p3_countries.id` و`serviceId` = `p3_services.id`. |
| `GET /provider3/config/update` | **إلزامي:** `id`. **اختياري:** `price`, `upstreamCountryCode`, `upstreamServiceName` |
| `GET /provider3/config/remove` | **إلزامي:** `id` |

**مثال إنشاء:**

```http
GET /api/v1/provider3/config/create?countryId=1&serviceId=2&price=1.5&upstreamCountryCode=IT&upstreamServiceName=facebook
```

(القيم `1` و`2` هنا معرّفات من `p3_countries` و`p3_services`.)

---

## 2) إنشاء دولة / خدمة خاصة بـ P3 فقط

يُنشئان سجلات في **`p3_countries`** و**`p3_services`** — منفصلة تماماً عن جداول المزوّدين 1 و 2.

| الطلب | المعاملات |
|--------|-----------|
| `GET /provider3/admin/country-create` | **إلزامي:** `country` (اسم الدولة)، `code_country` (مثل IT) |
| `GET /provider3/admin/service-create` | **إلزامي:** `servicename`, `code` (كود فريد للخدمة ضمن P3) |

بعدها أضف صف إعداد عبر `config/create` لربط **معرّف الدولة P3** و**معرّف الخدمة P3** بالسعر وأسماء المزوّد الخارجي.

---

## 3) قوائم كاملة للأدمن (كتالوج P3 — لاختيار الدولة/الخدمة في النماذج)

تعيد **كل** سجلات P3 (وليس فقط ما له إعداد تسعير)، مناسبة لقوائم الإنشاء في لوحة الإدارة.

| الطلب | الوصف |
|--------|--------|
| `GET /provider3/admin/p3-catalog-countries` | جميع الصفوف من `p3_countries`. |
| `GET /provider3/admin/p3-catalog-services` | جميع الصفوف من `p3_services`. |

---

## 4) مزامنة accessinfo (لقطات المشغّلين)

| الطلب | المعاملات |
|--------|-----------|
| `GET /provider3/access-sync` | **إلزامي:** `serviceCode` (كود خدمة من `p3_services`). **اختياري:** `interval` (مثل `30min`)، `serviceName` |
| `GET /provider3/access-sync-all` | مزامنة كل الخدمات المعرّفة في إعداد P3 |

---

## 5) كتالوج (قراءة عامة — بدون JWT أو apiKey)

مسارات القراءة التالية **عامة** لتسهيل الاختبار من curl/Postman؛ لا تتطلب `Authorization` ولا مفتاح API.

يُستخدَم لعرض **دول وخدمات لها إعداد P3 فقط** في مساري `catalog/*` (وليس كل سجلات P3 في النظام).

| الطلب | المعاملات |
|--------|-----------|
| `GET /provider3/catalog/countries` | — يعيد دولاً مميزة تظهر في `provider3_country_service_config` (من `p3_countries`). |
| `GET /provider3/catalog/services` | **اختياري:** `countryId`. بدون معامل: كل خدمة مع مصفوفة `countries` (الدول المسموحة لها). مع `countryId`: قائمة مسطّحة لخدمات تلك الدولة فقط (كالسلوك السابق). |
| `GET /provider3/pricing-by-country` | **إلزامي:** `countryId` — معرّف دولة P3؛ قائمة أسعار مبسّطة لخدمات تلك الدولة. |
| `GET /provider3/accessinfo` | **إلزامي:** `serviceCode` — دول مفعّلة في الإعداد ولديها `serverCount` ≥ 1؛ التفاصيل في `PROVIDER3_API.md` (قسم accessinfo حسب الخدمة). |

---

## 6) بقية مسارات المزوّد 3 (مرجع سريع)

راجع أيضاً `PROVIDER3_API_REQUESTS.md` لـ: `get-number`, `get-message`, `accessinfo`, إلخ.

---

## 7) ملاحظات

- الطلبات الناجحة غالباً `{ state: "200", data: ... }` أو `201` عند الإنشاء.  
- الأخطاء: `{ state: "400"|"500", error: "..." }`.  
- متغيرات البيئة للمزوّد الخارجي: `third_NUMBER_API_URL`, `third_NUMBER_API_KEY`.
