# HR-Monitor — Loyihani to'liq ishlatib ko'rish

Quyida barcha qismlarni ketma-ket ishga tushirish va tekshirish bo‘yicha qisqa qo‘llanma.

---

## 1. Tayyorgarlik

### 1.1. Node.js
- Kompyuteringizda **Node.js 18+** o‘rnatilgan bo‘lishi kerak.
- Tekshirish: terminalda `node -v` va `npm -v`.

### 1.2. Telegram Bot
- [@BotFather](https://t.me/BotFather) da yangi bot yarating: `/newbot`.
- Berilgan **BOT_TOKEN** ni saqlab qoling (masalan: `7123456789:AAH...`).

### 1.3. Menedjerlar guruhi (ixtiyoriy, lekin tavsiya etiladi)
- Telegram’da **yopiq guruh** yarating va botni guruhga **admin** qilib qo‘shing.
- Guruh ID sini olish:
  - [@userinfobot](https://t.me/userinfobot) yoki [@getidsbot](https://t.me/getidsbot) ni guruhga qo‘shing.
  - Bot guruhda xabar yuborsa, keyin `getUpdates` orqali yoki boshqa usul bilan **chat_id** ni ko‘rasiz (odatda manfiy son, masalan `-1001234567890`).
- Bu **MANAGERS_CHAT_ID** — kundalik hisobot shu guruhga ketadi.

---

## 2. Backendni ishga tushirish

```bash
cd monitor/backend
cp .env.example .env
# Kerak bo‘lsa .env da PORT yoki CORS_ORIGIN ni o‘zgartiring
npm install
npm run dev
```

- Konsolda `HR-Monitor backend listening on port 4000` va `Mock data initialized` chiqishi kerak.
- Brauzerda: **http://localhost:4000/health** — javobda `{"ok":true}` bo‘lishi kerak.
- Birinchi ishga tushganda SQLite bazasi va 50+ xodim, 4 filial, oxirgi 7 kunlik mock attendance avtomatik yaratiladi.

---

## 3. Frontend (Dashboard / Web App) ni ishga tushirish

Yangi terminalda:

```bash
cd monitor/frontend
npm install
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:4000' > .env.local
npm run dev
```

- Brauzerda **http://localhost:3000** oching.
- Sana, filial va qidiruv bo‘yicha filtrlash, jadval va grafik (7/30 kun) ishlashi kerak.

---

## 4. Telegram botni ishga tushirish

Yangi terminalda:

```bash
cd monitor/bot
cp .env.example .env
```

`.env` faylini ochib quyidagilarni to‘ldiring:

```env
BOT_TOKEN=7123456789:AAH...          # BotFather bergan token
BACKEND_BASE_URL=http://localhost:4000
WEBAPP_URL=http://localhost:3000
MANAGERS_CHAT_ID=-1001234567890       # Menedjerlar guruhining chat_id (ixtiyoriy)
CRON_TZ=Asia/Tashkent
```

Keyin:

```bash
npm install
npm run dev
```

- Konsolda `HR-Monitor Telegram bot started` chiqishi kerak.
- **MANAGERS_CHAT_ID** bo‘lmasa ham bot ishlaydi, faqat kundalik hisobot avtomatik yuborilmaydi.

---

## 5. To‘liq tekshirish ketma-ketligi

### 5.1. Xodim (Self-Service)
- Telegram’da botga **Start** bosing.
- **«Опаздываю»** — 15/30/60 daqiqa tanlang, keyin sabab yozing → "Спасибо, ваше опоздание зафиксировано..." chiqishi kerak.
- **«Болею»** — sabab yozing → "отметка «Болею» сохранена..." chiqishi kerak.
- **«Отгул»** — sabab yozing → "ваш отгул зафиксирован..." chiqishi kerak.

### 5.2. Backend va ma’lumotlar
- **http://localhost:4000/reports/daily** — JSON hisobot (bugungi sana).
- **http://localhost:4000/reports/daily-text** — matnli hisobot (botdagi format).

### 5.3. Menedjer hisoboti
- Botda **/today** yozing (shaxsiy chatda yoki menedjerlar guruhida) — bugungi kundalik hisobot matni va **«Открыть детальный Дашборд»** tugmasi chiqishi kerak.
- **/dashboard** — faqat Web App tugmasi.

### 5.4. Kundalik hisobot soat 10:00 da
- **MANAGERS_CHAT_ID** to‘g‘ri bo‘lsa, har kuni soat 10:00 (Toshkent vaqti) da hisobot avtomatik shu guruhga yuboriladi.
- Tez tekshirish uchun `bot/index.js` da cron ni vaqtincha o‘zgartirish mumkin (masalan har minut: `* * * * *`), keyin qayta qaytaring.

### 5.5. Dashboard (Web App)
- Brauzerda **http://localhost:3000** — sana/filial/qidiruv, jadval, 7 kun / 30 kun grafigi.
- Telegram’da **«Открыть детальный Дашборд»** tugmasini bosing — Web App Telegram ichida ochiladi (WEBAPP_URL localhost bo‘lsa, faqat kompyuterdan; mobil/prodda https URL kerak).

---

## 6. Qisqa xulosa

| Qadam | Qayerda        | Buyruq / harakat                    |
|-------|----------------|-------------------------------------|
| 1     | backend        | `npm run dev`                       |
| 2     | frontend       | `npm run dev`                       |
| 3     | bot            | `.env` to‘ldirish, `npm run dev`    |
| 4     | brauzer        | http://localhost:3000, /4000/health |
| 5     | Telegram       | Botga /start, Опаздываю/Болею/Отгул, /today, /dashboard |

Barcha uchta jarayon (backend, frontend, bot) bir vaqtning o‘zida ishlashi kerak. Loyihani to‘liq ishlatib ko‘rish uchun 1–5 qadamlarni ketma-ket bajarish kifoya.
