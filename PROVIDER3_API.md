# Provider 3 — دليل الاستخدام وواجهات API

جميع المسارات أدناه تفترض البادئة الأساسية: **`/api/v1`**.  
مثال: إذا كان السيرفر على `http://localhost:3000` فالمسار الكامل يكون  
`http://localhost:3000/api/v1/...`

---

## 1. متغيرات البيئة (`.env`)

```env
# مطلوبان لاستدعاء مزوّد الأرقام الثالث
third_NUMBER_API_URL=http://YOUR_HOST:9191/api
third_NUMBER_API_KEY=your_token_here
```

**اختياري — مزامنة accessinfo تلقائياً (Cron):**

```env
# تعطيل المزامنة التلقائية: false
PROVIDER3_ACCESS_SYNC_ENABLED=true

# تعبير Cron (افتراضي: كل 30 دقيقة)
PROVIDER3_ACCESS_SYNC_CRON=*/30 * * * *

# قيمة interval في طلب accessinfo لدى المزوّد (مثل 30min)
PROVIDER3_ACCESS_INFO_INTERVAL=30min

# منطقة زمنية لـ node-cron (افتراضي UTC)
PROVIDER3_ACCESS_SYNC_TZ=UTC
```

---

## 2. المصادقة (Auth)

معظم المسارات تدعم أحد الخيارين:

- **JWT:** ترويسة `Authorization: Bearer <token>`
- **مفتاح API:** باراميتر الاستعلام `apiKey=...`

الأدمن فقط: مسارات تستخدم `requireAdmin()` (مثل `access-sync`).

---

## 3. إعداد البيانات (Admin) قبل البيع

### 3.1 دولة — كود الدولة لدى المزوّد الثالث

يُخزَّن في **`countries.provider3`** (مثل `IT` لطلب `get_numbers`).

```http
GET /api/v1/country/create?country=Italy&code_country=IT&provider1=...&provider2=...&provider3=IT
```

- يتطلب **أدمن** + باراميترات الدولة حسب مسارك الحالي (راجع `country.route.js`).
- `provider3` اختياري إن لم تستخدم المزوّد 3 لهذه الدولة.

### 3.2 خدمة — اسم الخدمة لـ accessinfo

يُخزَّن في **`service.provider3`** (مثل `WhatsApp` كما يتوقعه المزوّد في `service=` و`/accessinfo`).

```http
GET /api/v1/service/create?servicename=WhatsApp&code=wa&provider1=...&provider2=...&provider3=WhatsApp
```

**مهم:** لا تكرر نفس اسم الباراميتر مرتين (مثل `provider2` مرتين)؛ استخدم `provider3` للقيمة الثانية.

### 3.3 تسعير — سعر المزوّد الثالث

يُخزَّن في **`country_service_pricing.provider3`**.

```http
GET /api/v1/pricing/create?countryId=1&serviceId=1&priceProvider1=1.5&priceProvider2=2&priceProvider3=2.5
```

- `priceProvider3` اختياري عند الإنشاء؛ إن لم يُرسل يُخزَّن **`null`** حتى تعدّل السعر لاحقاً من **`/pricing/update`** (أو مرّر `priceProvider3=` فارغاً أو `priceProvider3=null` للمسح).

**تحديث سعر المزوّد 3 فقط:**

```http
GET /api/v1/pricing/update?id=5&priceProvider3=3.0
```

(يمكن تمرير `priceProvider1` / `priceProvider2` أيضاً لتحديث أي منها.)

---

## 4. مزامنة accessinfo (قائمة الدول والمشغّلين)

### 4.1 يدوياً (Admin)

يملأ/يستبدل جدول **`provider3_access_snapshots`** من استجابة المزوّد.

```http
GET /api/v1/service/provider3/access-sync?serviceCode=wa&interval=30min&serviceName=WhatsApp
```

| Query | وصف |
|--------|-----|
| `serviceCode` | **مطلوب** — `service.code` الداخلي (مثل `wa`) |
| `interval` | اختياري — افتراضي `30min` |
| `serviceName` | اختياري — يتجاوز اسم الخدمة؛ إن لم يُمرَّر يُستخدم `service.provider3` ثم `service.name` |

**مثال cURL:**

```bash
curl -s "http://localhost:3000/api/v1/service/provider3/access-sync?serviceCode=wa&interval=30min" ^
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

أو بمفتاح أدمن في الاستعلام إن كان مسموحاً لديك:

```bash
curl -s "http://localhost:3000/api/v1/service/provider3/access-sync?apiKey=ADMIN_API_KEY&serviceCode=wa"
```

### 4.2 تلقائياً (Cron)

عند تشغيل السيرفر، إن وُجدت **`third_NUMBER_*`** ولم تُعطّل المزامنة، يعمل Cron (افتراضياً كل 30 دقيقة) ويُحدّث اللقطات لكل خدمة لديها **`service.provider3`** غير فارغ.

---

## 5. عرض المشغّلين للمستخدم (اختيار operator)

يقرأ من **آخر مزامنة ناجحة** (يدوية أو Cron).

```http
GET /api/v1/service/provider3/operators?serviceCode=wa&country=IT&interval=30min
```

| Query | وصف |
|--------|-----|
| `serviceCode` | **مطلوب** |
| `country` | **مطلوب** — إما كود الدولة ISO (مثل `IT`) أو جزء من اسم الدولة |
| `interval` | اختياري — يجب أن يطابق ما استُخدم في المزامنة (افتراضي `30min`) |

**مثال:**

```bash
curl -s "http://localhost:3000/api/v1/service/provider3/operators?apiKey=USER_API_KEY&serviceCode=wa&country=IT"
```

**استجابة نموذجية:** مصفوفة صفوف تحتوي `ccode`, `operator`, `accessCount`, `countryName`, إلخ.

---

## 6. طلب رقم (Provider 3)

```http
GET /api/v1/order/get-number?apiKey=...&country=IT&serviceCode=wa&provider=3&operator=op3410
```

| Query | وصف |
|--------|-----|
| `apiKey` | مطلوب (أو JWT) |
| `country` | كود الدولة أو الاسم أو الـ id حسب منطقك الحالي |
| `serviceCode` | كود الخدمة الداخلي |
| `provider` | **`3`** للمزوّد الثالث |
| `operator` | **مطلوب** عند `provider=3` — مثل `op3410` من خطوة المشغّلين أعلاه |

**مثال:**

```bash
curl -s "http://localhost:3000/api/v1/order/get-number?apiKey=YOUR_KEY&country=IT&serviceCode=wa&provider=3&operator=op3410"
```

**نجاح نموذجي:**

```json
{
  "state": "200",
  "msg": "success",
  "data": {
    "number": "393922179284",
    "orderId": "ABCDEFGH12345678"
  }
}
```

---

## 7. جلب الرسالة (نفس الطلب لجميع المزوّدين)

بعد شراء الرقم، استخدم **`orderId`** (أي `publicId`) كما في المزوّدين 1 و 2.

```http
GET /api/v1/order/get-message?apiKey=...&orderId=ABCDEFGH12345678
```

```bash
curl -s "http://localhost:3000/api/v1/order/get-message?apiKey=YOUR_KEY&orderId=ABCDEFGH12345678"
```

عند وصول الرسمة، يُحدَّث الطلب ويُعاد نص الرسالة حسب منطق المسار.

---

## 8. تدفق مقترح للواجهة الأمامية

1. (مرة/دورياً) تشغيل **access-sync** أو الاعتماد على **Cron**.
2. المستخدم يختار **الخدمة** و**الدولة** → استدعاء **`provider3/operators`**.
3. المستخدم يختار **`operator`** من القائمة.
4. استدعاء **`get-number`** بـ `provider=3` ونفس **`operator`**.
5. استدعاء **`get-message`** حتى يصل الكود أو ينتهي الوقت.

---

## 9. أخطاء شائعة

| المشكلة | الحل |
|---------|------|
| قائمة `operators` فارغة | شغّل **access-sync** أو انتظر **Cron**؛ تأكد أن **`service.provider3`** مضبوط. |
| `Country is not configured for provider 3` | عيّن **`countries.provider3`** (مثل `IT`). |
| سعر 0 أو رصيد غير كافٍ | عيّن **`priceProvider3`** في التسعير. |
| خطأ SQL عند إنشاء خدمة | لا تكرر `provider2=` مرتين؛ استخدم **`provider3`** للقيمة الثانية. |

---

## 10. ملخص المسارات

| المسار | من يصل | الغرض |
|--------|--------|--------|
| `GET /api/v1/service/provider3/access-sync` | Admin | جلب accessinfo وحفظه في DB |
| `GET /api/v1/service/provider3/operators` | User / Admin | عرض المشغّلين حسب الدولة |
| `GET /api/v1/order/get-number` | User / Admin | شراء رقم (`provider=3` + `operator`) |
| `GET /api/v1/order/get-message` | User / Admin | جلب الرسالة للطلب |

إعداد الدول/الخدمات/التسعير يتم عبر مسارات **`/country`**, **`/service`**, **`/pricing`** كما في الأقسام 3.1–3.3.
