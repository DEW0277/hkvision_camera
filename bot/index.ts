import * as dotenv from 'dotenv';
dotenv.config();

import { Bot, InlineKeyboard, Keyboard, Context } from 'grammy';
import type { NextFunction } from 'grammy';
import axios from 'axios';
import cron from 'node-cron';

const BOT_TOKEN = process.env.BOT_TOKEN;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const WEBAPP_URL = process.env.WEBAPP_URL || "http://localhost:3000";
const MANAGERS_CHAT_ID = process.env.MANAGERS_CHAT_ID;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set in environment");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

const translations: Record<string, any> = {
  uz: {
    choose_language: "Tilni tanlang:",
    request_contact: "Iltimos, bot sizni tanishi uchun kontaktni yuboring.\nTelefon raqamingiz va ism-familiyangiz olinadi.",
    contact_button: "📱 Kontaktni yuborish",
    welcome: "HR-Monitor botiga xush kelibsiz.",
    for_employees: "Xodimlar uchun:",
    for_managers: "Rahbarlar uchun:",
    cmd_today: "• /today — bugungi hisobotni olish.",
    cmd_dashboard: "• /dashboard — veb-dashbordni ochish.",
    btn_late: "Kechikyapman",
    btn_sick: "Kasalman",
    btn_dayoff: "Javob so'rash",
    late_how_much: "Necha daqiqaga kechikyapsiz?",
    write_reason: "Sababini bitta xabarda yozing.",
    status_saved: "Rahmat, ma'lumot saqlandi.",
    error: "Xatolik yuz berdi. Qayta urinib ko'ring.",
    thanks_contact: "✅ Rahmat! Ma'lumotlaringiz saqlandi.",
    dashboard_btn: "🌐 Detalniy Dashbordni ochish",
  },
  ru: {
    choose_language: "Выберите язык:",
    request_contact: "Пожалуйста, отправьте контакт, чтобы бот мог вас узнать.\nВаш номер телефона и имя будут получены.",
    contact_button: "📱 Отправить контакт",
    welcome: "Добро пожаловать в HR-Monitor бот.",
    for_employees: "Для сотрудников:",
    for_managers: "Для руководителей:",
    cmd_today: "• Команда /today — получить отчёт за сегодня.",
    cmd_dashboard: "• Команда /dashboard — открыть веб-дашборд.",
    btn_late: "Опаздываю",
    btn_sick: "Болею",
    btn_dayoff: "Отгул",
    late_how_much: "На сколько минут вы опаздываете?",
    write_reason: "Напишите коротко причину одним сообщением.",
    status_saved: "Спасибо, данные сохранены.",
    error: "Произошла ошибка. Попробуйте позже.",
    thanks_contact: "✅ Спасибо! Ваши данные сохранены.",
    dashboard_btn: "🌐 Открыть детальный Дашборд",
  }
};

type PendingStateType = "late" | "sick" | "dayoff";

interface PendingState {
  type: PendingStateType;
  minutes?: number;
  lang?: string;
}

const pendingStates = new Map<number, PendingState>();

function getEmployeeKeyboard(lang: string) {
  const t = translations[lang] || translations.ru;
  return new Keyboard()
    .text(t.btn_late)
    .row()
    .text(t.btn_sick)
    .text(t.btn_dayoff)
    .resized();
}

function getContactRequestKeyboard(lang: string) {
  const t = translations[lang] || translations.ru;
  return new Keyboard()
    .requestContact(t.contact_button)
    .oneTime()
    .resized();
}

function getLanguageKeyboard() {
  return new InlineKeyboard()
    .text("O'zbekcha 🇺🇿", "set_lang_uz")
    .text("Русский 🇷🇺", "set_lang_ru");
}

function buildDashboardKeyboard(lang: string, chatId?: string | number) {
  if (!WEBAPP_URL || !WEBAPP_URL.startsWith("https://")) return undefined;
  const t = translations[lang] || translations.ru;
  const kb = new InlineKeyboard();
  if (chatId && Number(chatId) < 0) {
    kb.url(t.dashboard_btn, WEBAPP_URL);
  } else {
    kb.webApp(t.dashboard_btn, WEBAPP_URL);
  }
  return kb;
}

async function getLanguageForUser(telegramUserId: number): Promise<string> {
  try {
    const res = await axios.get(`${BACKEND_BASE_URL}/employee/me`, {
      params: { telegramUserId },
    });
    return res.data.language || "ru";
  } catch (err) {
    return "ru";
  }
}

async function sendDailyReportToChat(chatId: string | number, date?: string) {
  try {
    const lang = await getLanguageForUser(Number(chatId));
    const dateStr = date || new Date().toISOString().slice(0, 10);
    const res = await axios.get(`${BACKEND_BASE_URL}/reports/daily-text`, { params: { date: dateStr } });
    const text = res.data;
    const replyMarkup = buildDashboardKeyboard(lang, chatId);
    await bot.api.sendMessage(chatId, text, { ...(replyMarkup && { reply_markup: replyMarkup }) });
  } catch (err: any) {
    console.error("Failed to send daily report", err.message);
  }
}

async function sendMainMenu(ctx: Context, isManager: boolean | string | undefined, lang: string) {
  const t = translations[lang] || translations.ru;
  const lines: string[] = [
    `👋 ${t.welcome}`,
    "",
    t.for_employees,
    `• ${t.btn_late}, ${t.btn_sick}, ${t.btn_dayoff}`,
    ""
  ];
  if (isManager) {
    lines.push(t.for_managers, t.cmd_today, t.cmd_dashboard);
  }
  await ctx.reply(lines.join("\n"), { reply_markup: getEmployeeKeyboard(lang) });
}

bot.command("start", async (ctx) => {
  await ctx.reply("Tilni tanlang / Выберите язык:", { reply_markup: getLanguageKeyboard() });
});

bot.callbackQuery(/set_lang_(uz|ru)/, async (ctx) => {
  if (!ctx.from) return;
  const lang = ctx.match![1];
  try {
    await axios.post(`${BACKEND_BASE_URL}/employee/language`, { telegramUserId: ctx.from.id, language: lang });
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(lang === 'uz' ? "Til tanlandi: O'zbekcha" : "Язык выбран: Русский");

    const res = await axios.get(`${BACKEND_BASE_URL}/employee/me`, { params: { telegramUserId: ctx.from.id } });
    const isManager = MANAGERS_CHAT_ID && String(ctx.chat?.id) === String(MANAGERS_CHAT_ID);

    if (res.data.hasContact) {
      await sendMainMenu(ctx, isManager, lang);
    } else {
      await ctx.reply(translations[lang].request_contact, { reply_markup: getContactRequestKeyboard(lang) });
    }
  } catch (e) {
    console.error(e);
  }
});

bot.on("message:contact", async (ctx) => {
  if (!ctx.message.contact || !ctx.from) return;
  const lang = await getLanguageForUser(ctx.from.id);
  try {
    await axios.post(`${BACKEND_BASE_URL}/employee/contact`, {
      telegramUserId: String(ctx.from.id),
      phone_number: ctx.message.contact.phone_number,
      first_name: ctx.message.contact.first_name,
      last_name: ctx.message.contact.last_name,
    });
    await ctx.reply(translations[lang].thanks_contact, { reply_markup: { remove_keyboard: true } });
    const isManager = MANAGERS_CHAT_ID && String(ctx.chat?.id) === String(MANAGERS_CHAT_ID);
    await sendMainMenu(ctx, isManager, lang);
  } catch (e: any) {
    if (e.response && e.response.status === 404) {
      await ctx.reply(lang === 'uz' ? "Siz xodimlar bazasida topilmadingiz. Iltimos rahbaringizga murojaat qiling." : "Вы не найдены в базе сотрудников. Пожалуйста, обратитесь к руководителю.");
    } else {
      await ctx.reply(translations[lang].error);
    }
  }
});

bot.hears(["Опаздываю", "Kechikyapman"], async (ctx) => {
  if (!ctx.from) return;
  const lang = await getLanguageForUser(ctx.from.id);
  const kb = new InlineKeyboard()
    .text(lang === 'uz' ? "15 daqiqa" : "15 мин", "late_15")
    .text(lang === 'uz' ? "30 daqiqa" : "30 мин", "late_30")
    .text(lang === 'uz' ? "60 daqiqa" : "60 мин", "late_60");
  await ctx.reply(translations[lang].late_how_much, { reply_markup: kb });
});

bot.hears(["Болею", "Kasalman", "Отгул", "Javob so'rash"], async (ctx) => {
  if (!ctx.from) return;
  const lang = await getLanguageForUser(ctx.from.id);
  const type = (ctx.message!.text!.includes("Болею") || ctx.message!.text!.includes("Kasalman")) ? "sick" : "dayoff";
  pendingStates.set(ctx.from.id, { type, lang });
  await ctx.reply(translations[lang].write_reason);
});

bot.callbackQuery(/late_(\d+)/, async (ctx) => {
  if (!ctx.from) return;
  const lang = await getLanguageForUser(ctx.from.id);
  const minutes = Number(ctx.match![1]);
  pendingStates.set(ctx.from.id, { type: "late", minutes, lang });
  await ctx.answerCallbackQuery();
  await ctx.reply(lang === 'uz' ? `~${minutes} daqiqa kechikish. Sababini yozing.` : `Опоздание на ~${minutes} минут. Укажите причину.`);
});

bot.on("message:text", async (ctx, next) => {
  if (!ctx.from || !pendingStates.has(ctx.from.id)) return next();
  const state = pendingStates.get(ctx.from.id)!;
  const t = translations[state.lang || 'ru'];
  try {
    await axios.post(`${BACKEND_BASE_URL}/employee/status/${state.type}`, {
      telegramUserId: String(ctx.from.id),
      fullName: `${ctx.from.first_name} ${ctx.from.last_name || ""}`.trim(),
      minutes: state.minutes,
      reason: ctx.message.text,
    });
    await ctx.reply(t.status_saved);
  } catch (e) {
    await ctx.reply(t.error);
  } finally {
    pendingStates.delete(ctx.from.id);
  }
});

bot.command("today", async (ctx) => { if (ctx.chat) await sendDailyReportToChat(ctx.chat.id); });
bot.command("dashboard", async (ctx) => {
  if (!ctx.from) return;
  const lang = await getLanguageForUser(ctx.from.id);
  const kb = buildDashboardKeyboard(lang, ctx.chat?.id);
  await ctx.reply(translations[lang].dashboard_btn + ":", { reply_markup: kb });
});

cron.schedule("0 10 * * *", async () => { if (MANAGERS_CHAT_ID) await sendDailyReportToChat(MANAGERS_CHAT_ID); }, { timezone: "Asia/Tashkent" });

bot.catch((err) => console.error("Bot error:", err));
bot.start();
console.log("HR-Monitor Telegram bot started");
