# HR-Monitor — Loyihani To'liq Arxitekturasi

Bu hujjat loyihaning har bir qismini, ular o'rtasidagi bog'lanishni va ma'lumot oqimini to'liq tushuntiradi.

---

## Umumiy Ko'rinish

HR-Monitor — xodimlarning **davomatini (kelish-ketishini) kuzatadigan** tizim. Uchta asosiy qism ishlaydi:

```
┌─────────────────┐     HTTP (REST API)     ┌──────────────────────┐
│  Telegram Bot   │ ──────────────────────► │                      │
│  (bot/)         │ ◄────────────────────── │     Backend          │
└─────────────────┘                         │  (backend/src/)      │
                                            │                      │
┌─────────────────┐     HTTP (REST API)     │   SQLite bazasi      │
│   Frontend      │ ──────────────────────► │  (data/hr_monitor    │
│  (frontend/)    │ ◄────────────────────── │        .sqlite)      │
└─────────────────┘                         │                      │
                                            │                      │
┌─────────────────┐     HTTP (POST)         │                      │
│  HikVision      │ ──────────────────────► │                      │
│  Kameralar      │                         └──────────────────────┘
└─────────────────┘
```

Barcha ma'lumotlar **bitta backend serveri** orqali o'tadi. Bot ham, Frontend ham bevosita bazaga emas, balki **HTTP API** orqali backendga murojaat qiladi.

---

## 1. Backend — Barcha Tizimning Markaziy Qismi

**Papka:** `backend/`  
**Texnologiya:** Node.js, TypeScript, Express.js, Sequelize ORM  
**Baza:** SQLite (`data/hr_monitor.sqlite`)  
**Port:** `4000`

### Backend Nima Qiladi?

Backend — bu loyihaning "miyasi". U barcha ma'lumotlarni saqlaydi va boshqa qismlarga API orqali beradi. Hech qanday interfeysi yo'q — faqat API endpointlari.

### Ma'lumotlar bazasidagi jadvallar

Backend ishga tushganda SQLite bazasini avtomatik yaratadi va test ma'lumotlar (50+ xodim, 4 filial, 7 kunlik davomat) bilan to'ldiradi.

| Jadval       | Vazifasi                                                    |
|--------------|-------------------------------------------------------------|
| `employees`  | Xodimlar ro'yxati (ism, telefon, filial, Telegram ID, til)  |
| `branches`   | Filiallar ro'yxati (kod, nomi)                              |
| `attendances`| Kirib-chiqish vaqtlari (kim, qachon, kechmi yo'qmi)        |
| `excuses`    | Xodim botimizdagi sabab-bahonalari (kech qolish/kasal/bayram)|

### API Endpointlar (Marshrut yo'llari)

#### 📷 `/camera` — Hikvision Kameradan Hodisalar

```
POST /camera/event
```
Bu eng muhim marshrut. Hikvision kamerasi yuzni tanib, shu endpointga avtomatik POST so'rov yuboradi. Backend:
1. Kameraning MAC manzilidan **filialni** topadi yoki yaratadi
2. Xodimning telefon raqamidan (oxirgi 9 raqam) **xodimni** topadi yoki yaratadi
3. Birinchi signal → `checkIn` (keldi), ikkinchi signal → `checkOut` (ketdi) sifatida `attendances` jadvaliga yozadi
4. Soat 08:00 dan keyin kelgan bo'lsa `isLate = true` belgilaydi

#### 👤 `/employee` — Xodim Ma'lumotlari (Bot tomonidan ishlatiladi)

| Method | Yo'l                   | Vazifasi                                              |
|--------|------------------------|-------------------------------------------------------|
| GET    | `/employee/me`         | Telegram ID orqali xodimni topadi (bor/yo'q, tili)   |
| POST   | `/employee/language`   | Xodimning tilini saqlaydi (uz yoki ru)                |
| POST   | `/employee/contact`    | Xodimning telefon raqamini Telegram akkauntiga bog'laydi|
| POST   | `/employee/status/late`  | Kech qolish sababini yozadi (`excuses` jadvalidagi)  |
| POST   | `/employee/status/sick`  | Kasallik sababini yozadi                             |
| POST   | `/employee/status/dayoff`| Bayram/javob so'rash sababini yozadi                |
| POST   | `/employee/add`          | Yangi xodim qo'shadi (admin funksiyasi)              |

#### 📊 `/reports` — Hisobotlar (Bot va Frontend tomonidan ishlatiladi)

| Method | Yo'l                    | Vazifasi                                             |
|--------|-------------------------|------------------------------------------------------|
| GET    | `/reports/daily`        | Bugungi davomat hisobotini **JSON** formatda qaytaradi|
| GET    | `/reports/daily-text`   | Telegram uchun tayyor **matnli** hisobot qaytaradi   |
| GET    | `/reports/stats`        | 7 yoki 30 kunlik statistika (grafiklar uchun)        |

#### 🖥️ `/dashboard` — Dashboard Sahifasi Uchun Ma'lumot

| Method | Yo'l                          | Vazifasi                                            |
|--------|-------------------------------|-----------------------------------------------------|
| GET    | `/dashboard/attendance`       | Filtr (sana, filial, qidiruv) bo'yicha davomat jadvali|
| GET    | `/dashboard/employee-stats/:id`| Bitta xodimning 30 kunlik statistikasi            |

---

## 2. Telegram Bot — Xodimlar Interfeysi

**Papka:** `bot/`  
**Texnologiya:** Node.js, TypeScript, Grammy.js (Telegram Bot Framework)  
**Asosiy fayl:** `bot/index.ts`

### Bot Nima Qiladi?

Bot xodimlar uchun **mobil interfeys** vazifasini bajaradi. Xodim brauzer ochmaydi — faqat Telegram orqali botga yozadi.

### Bot Qanday Ishlaydi — Qadamlar

**1-qadam: Til tanlash**
```
Xodim: /start
Bot: "O'zbekcha 🇺🇿" | "Русский 🇷🇺" (inline tugmalar)
```

**2-qadam: Tilni saqlash**
```
Xodim: [O'zbekcha tugmasini bosadi]  
Bot → Backend: POST /employee/language  { telegramUserId, language: "uz" }  
Bot → Backend: GET /employee/me  { telegramUserId }  (xodim ro'yxatdami?)
```

**3-qadam: Telefon so'rash (agar birinchi marta bo'lsa)**
```
Bot: "📱 Kontaktni yuborish" tugmali keyboard
Xodim: [Kontaktni Share qiladi]
Bot → Backend: POST /employee/contact  { telegramUserId, phone_number, first_name }
```
Bu qadam **muhim**: telefon raqami orqali bot Telegramni kameradagi xodim ro'yxati bilan bog'laydi.

**4-qadam: Asosiy menyu**
```
[ Kechikyapman ]
[ Kasalman ]  [ Javob so'rash ]
```

**Kechikish oqimi:**
```
Xodim: "Kechikyapman"
Bot:   [15 daqiqa] [30 daqiqa] [60 daqiqa]
Xodim: [30 daqiqa]
Bot:   "Sababini yozing"
Xodim: "Trafik tiqilib qoldi"
Bot  → Backend: POST /employee/status/late  { telegramUserId, minutes:30, reason }
Bot:   "Rahmat, ma'lumot saqlandi."
```

**Kasallik/Bayram oqimi:**
```
Xodim: "Kasalman"
Bot:   "Sababini yozing"
Xodim: "Gripp bor"
Bot  → Backend: POST /employee/status/sick  { telegramUserId, reason }
```

### Menejer Buyruqlari

```
/today    → Bot → Backend: GET /reports/daily-text  → Tayyor matnni yuboradi
/dashboard → Dashboard Web App sahifasiga inline tugma yuboradi
```

### Avtomatik Kundalik Hisobot (Cron)

`bot/index.ts` ichida cron job sozlangan:
```typescript
cron.schedule("* * * * *", async () => {
  if (MANAGERS_CHAT_ID) await sendDailyReportToChat(MANAGERS_CHAT_ID);
}, { timezone: "Asia/Tashkent" });
```

Hozirda har daqiqada ishlaydi (sinov uchun). Production uchun `0 10 * * *` (har kuni soat 10:00) ga o'zgartirish kerak.

Bot hisobotni shu yo'l orqali oladi:
```
Bot → Backend: GET /reports/daily-text → Matnni Menedjerlar guruhiga yuboradi
```

### Bot Environment Variables (`.env`)

```env
BOT_TOKEN=...           # BotFather beradigan token
BACKEND_BASE_URL=http://localhost:4000  # Backend manzili
WEBAPP_URL=https://...  # Frontend manzili (WebApp uchun, HTTPS bo'lishi shart)
MANAGERS_CHAT_ID=-100...  # Menedjerlar Telegram guruhining ID si
```

---

## 3. Frontend — Vizual Dashboard

**Papka:** `frontend/`  
**Texnologiya:** Next.js (React), TypeScript  
**Port:** `3000`

### Frontend Nima Qiladi?

Frontend — menejerlar uchun **vizual veb-interfeys**. Brauzerda yoki Telegram WebApp ichida ochiladi. Xodimlar foydalanmaydi — faqat rahbarlar.

### Frontend Qanday Ishlaydi

Frontend statik sahifa emas. Har bir filtr o'zgarganda backend API ga so'rov yuboradi:

**Davomat jadvali:**
```
Frontend → Backend: GET /dashboard/attendance?date=2026-03-17&branch=&search=
Backend   → Frontend: [ { fullName, checkIn, checkOut, isLate, branch, excuses }, ... ]
Frontend: Jadval ko'rsatadi
```

**Statistika grafigi:**
```
Frontend → Backend: GET /reports/stats?days=7
Backend  → Frontend: [ { date, present, late, absent }, ... ]
Frontend: Chiziqli grafik (7 kun yoki 30 kun)
```

**Xodim batafsil statistikasi:**
```
Frontend → Backend: GET /dashboard/employee-stats/:id?days=30
Backend  → Frontend: { totalDays, presentDays, lateDays, excuses }
Frontend: Modal oyna ko'rsatadi
```

### Frontend Environment Variables (`.env`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

---

## 4. Qismlar O'rtasidagi To'liq Bog'lanish Sxemasi

```
HikVision Kamera
      │  POST /camera/event (yuz tanilganda)
      ▼
┌─────────────────────────────────────────┐
│            BACKEND (port 4000)          │
│                                         │
│  SQLite bazasi:                         │
│  ┌───────────┐  ┌──────────────┐        │
│  │ employees │  │ attendances  │        │
│  │ branches  │  │ excuses      │        │
│  └───────────┘  └──────────────┘        │
│                                         │
│  API marshruti:                         │
│  /camera/event   ← kameradan            │
│  /employee/*     ← botdan               │
│  /reports/*      ← botdan va frontdan   │
│  /dashboard/*    ← frontdan             │
└────────────┬────────────────────────────┘
             │                    │
    GET/POST HTTP            GET HTTP
             │                    │
   ┌─────────▼──────┐    ┌────────▼────────┐
   │  Telegram Bot  │    │    Frontend     │
   │  (port yo'q)   │    │   (port 3000)   │
   │                │    │                 │
   │  Xodimlar      │    │  Rahbarlar      │
   │  Telegram orq  │    │  Brauzer orq.   │
   └────────────────┘    └─────────────────┘
```

### Ma'lumot Oqimi — Xodim Kelganda

```
1. Kamera → yuzni tanidi
2. Kamera → POST /camera/event  (telefon raqami, vaqt, kamera MAC)
3. Backend → Filialni topadi (MAC orqali)
4. Backend → Xodimni topadi (telefon oxirgi 9 raqam orqali)
5. Backend → attendances jadvaliga checkIn yozadi
6. Frontend → /dashboard/attendance ni yangilasa — yangi ma'lumot chiqadi
```

### Ma'lumot Oqimi — Xodim Kech Qolsa

```
1. Xodim → Botga "Kechikyapman" yozadi
2. Bot → Necha daqiqa? so'raydi
3. Xodim → 30 daqiqa tanlaydi
4. Bot → Sabab so'raydi
5. Xodim → Sabab yozadi
6. Bot → POST /employee/status/late  { reason, minutes: 30 }
7. Backend → excuses jadvaliga yozadi
8. Frontend → hisobotda "Kech qoldi: 30 min, sabab: ..." ko'rinadi
```

### Xodimni Kamera va Telegram Orasida Bog'lash

Bu eng muhim nuqta. Xodim botga `/start` bosib, telefon raqamini Share qilganda:

```
Bot → POST /employee/contact  { telegramUserId: "123456", phone: "998901234567" }

Backend:
  - Telefon orqali employees jadvalida xodimni qidiradi
  - Topilsa → telegramUserId ni yangilaydi
  - Topilmasa → yangi xodim yaratadi

Natija: Kamera `123456789` tel. bilan yozgan attendance ←→ Telegram `123456` bilan keladigan bahona bir xodimga bog'lanadi
```

---

## 5. Loyihani Ishga Tushirish Tartibi

Har uchta terminal **bir vaqtda** ishlashi kerak:

```bash
# Terminal 1 — Backend
cd backend && npm install && npm run dev
# ✓ http://localhost:4000/health → {"ok":true}

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
# ✓ http://localhost:3000

# Terminal 3 — Bot
cd bot && npm install && npm run dev
# ✓ Telegram botga /start yozing
```

### Muhit o'zgaruvchilari (Environment Variables)

| Qism     | Fayl               | Muhim o'garuvchilar                          |
|----------|--------------------|----------------------------------------------|
| Backend  | `backend/.env`     | `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`  |
| Frontend | `frontend/.env`    | `NEXT_PUBLIC_BACKEND_URL`                    |
| Bot      | `bot/.env`         | `BOT_TOKEN`, `BACKEND_BASE_URL`, `MANAGERS_CHAT_ID` |

---

## 6. Xulosa — Har Bir Qismning Roli

| Qism       | Asosiy Rol               | Kimga Xizmat Qiladi  | Backend bilan qanday gaplashadi |
|------------|--------------------------|----------------------|---------------------------------|
| **Backend**    | Barcha ma'lumotlarni saqlash va API berish | Hammaga      | — (o'zi)       |
| **Kamera**     | Yuzni tanib, kirish/chiqishni avtomatik yozish | Backend      | `POST /camera/event` |
| **Telegram Bot** | Xodim bahonalarini qabul qilish, hisobot yuborish | Xodimlar, Menejerlar | `GET/POST /employee/*`, `/reports/*` |
| **Frontend**   | Vizual jadvalar, grafiklar, filtrlar | Rahbarlar, Menejerlar | `GET /dashboard/*`, `/reports/stats` |
