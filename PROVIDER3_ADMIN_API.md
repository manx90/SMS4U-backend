# توثيق API — إدارة المزوّد الثالث (Provider 3) للأدمن

**البادئة:** `https://<HOST>/api/v1`  
**المصادقة:** تمرير `Authorization: Bearer <access_token>` للأدمن.  
معظم مسارات الإدارة تستخدم **GET** مع معاملات الاستعلام (نفس أسلوب المشروع).

---

## 1) إعداد السعر والربط (جدول `provider3_country_service_config`)

| الطلب | الوصف |
|--------|--------|
| `GET /provider3/config` | قائمة كل الصفوف (دولة، خدمة، سعر، أكواد المزوّد). |
| `GET /provider3/config/create` | **إلزامي:** `countryId`, `serviceId`, `price`, `upstreamCountryCode`, `upstreamServiceName` |
| `GET /provider3/config/update` | **إلزامي:** `id`. **اختياري:** `price`, `upstreamCountryCode`, `upstreamServiceName` |
| `GET /provider3/config/remove` | **إلزامي:** `id` |

**مثال إنشاء:**

```http
GET /api/v1/provider3/config/create?countryId=1&serviceId=2&price=1.5&upstreamCountryCode=IT&upstreamServiceName=facebook
```

---

## 2) إنشاء دولة / خدمة بمسار P3 فقط (بدون حقول المزوّد 1 و 2)

يُنشئان سجلات في جداول `countries` و `service` لكن **بدون** تعبئة `provider1` / `provider2` — مناسب لمسار المزوّد الثالث وحده.

| الطلب | المعاملات |
|--------|-----------|
| `GET /provider3/admin/country-create` | **إلزامي:** `country` (الاسم)، `code_country` (مثل IT) |
| `GET /provider3/admin/service-create` | **إلزامي:** `servicename`, `code` (كود فريد للخدمة) |

بعدها أضف صف إعداد عبر `config/create` لربط الدولة والخدمة بالسعر وأسماء المزوّد.

---

## 3) مزامنة accessinfo (لقطات المشغّلين)

| الطلب | المعاملات |
|--------|-----------|
| `GET /provider3/access-sync` | **إلزامي:** `serviceCode`. **اختياري:** `interval` (مثل `30min`)، `serviceName` |
| `GET /provider3/access-sync-all` | مزامنة كل الخدمات المعرّفة في الإعداد |

---

## 4) كتالوج للمستخدم (قراءة فقط — مستخدم مسجّل)

يُستخدَم لعرض **دول وخدمات لها إعداد P3 فقط** (وليس كل الدول في النظام).

| الطلب | المعاملات |
|--------|-----------|
| `GET /provider3/catalog/countries` | — يعيد دولاً مميزة تظهر في `provider3_country_service_config` |
| `GET /provider3/catalog/services` | **إلزامي:** `countryId` — خدمات وأسعار P3 لهذه الدولة |

---

## 5) بقية مسارات المزوّد 3 (مرجع سريع)

راجع أيضاً `PROVIDER3_API_REQUESTS.md` لـ: `get-number`, `get-message`, `operators`, `countries-by-service`, إلخ.

---

## 6) ملاحظات

- الطلبات الناجحة غالباً `{ state: "200", data: ... }` أو `201` عند الإنشاء.  
- الأخطاء: `{ state: "400"|"500", error: "..." }`.  
- متغيرات البيئة للمزوّد الخارجي: `third_NUMBER_API_URL`, `third_NUMBER_API_KEY`.
