"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const grammy_1 = require("grammy");
const axios_1 = __importDefault(require("axios"));
const node_cron_1 = __importDefault(require("node-cron"));
const BOT_TOKEN = process.env.BOT_TOKEN;
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const WEBAPP_URL = process.env.WEBAPP_URL || "http://localhost:3000";
const MANAGERS_CHAT_ID = process.env.MANAGERS_CHAT_ID;
if (!BOT_TOKEN) {
    // eslint-disable-next-line no-console
    console.error("BOT_TOKEN is not set in environment");
    process.exit(1);
}
const bot = new grammy_1.Bot(BOT_TOKEN);
// In-memory state for simple conversations
// key: chatId, value: { type: 'late' | 'sick' | 'dayoff', minutes?: number }
const pendingStates = new Map();
const employeeKeyboard = new grammy_1.Keyboard()
    .text("Опаздываю")
    .row()
    .text("Болею")
    .text("Отгул")
    .resized();
function getContactRequestKeyboard() {
    return new grammy_1.Keyboard()
        .requestContact("📱 Kontaktni yuborish")
        .oneTime()
        .resized();
}
function buildDashboardKeyboard() {
    if (!WEBAPP_URL || !WEBAPP_URL.startsWith("https://")) {
        return undefined;
    }
    const kb = new grammy_1.InlineKeyboard();
    kb.webApp("🌐 Открыть детальный Дашборд", WEBAPP_URL);
    return kb;
}
async function sendDailyReportToChat(chatId, date) {
    try {
        const dateStr = date || new Date().toISOString().slice(0, 10);
        const res = await axios_1.default.get(`${BACKEND_BASE_URL}/reports/daily-text`, {
            params: { date: dateStr },
        });
        const text = res.data;
        const replyMarkup = buildDashboardKeyboard();
        await bot.api.sendMessage(chatId, text, {
            ...(replyMarkup && { reply_markup: replyMarkup }),
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to send daily report", err.message);
    }
}
async function sendMainMenu(ctx, isManager) {
    const lines = [];
    lines.push("👋 HR-Monitor ботга хуш келибсиз / Добро пожаловать в HR-Monitor.");
    lines.push("");
    lines.push("Для сотрудников:");
    lines.push("• Используйте кнопки «Опаздываю», «Болею», «Отгул».");
    lines.push("");
    if (isManager) {
        lines.push("Для руководителей:");
        lines.push("• Команда /today — получить отчёт за сегодня.");
        lines.push("• Команда /dashboard — открыть веб-дашборд.");
    }
    await ctx.reply(lines.join("\n"), {
        reply_markup: employeeKeyboard,
    });
}
bot.command("start", async (ctx) => {
    if (!ctx.chat || !ctx.from)
        return;
    const isManager = MANAGERS_CHAT_ID && String(ctx.chat.id) === String(MANAGERS_CHAT_ID);
    try {
        const res = await axios_1.default.get(`${BACKEND_BASE_URL}/employee/me`, {
            params: { telegramUserId: ctx.from.id },
        });
        const data = res.data || {};
        if (data.hasContact) {
            await sendMainMenu(ctx, isManager);
            return;
        }
    }
    catch (err) {
        // Backend ulanishi bo‘lmasa ham kontakt so‘raymiz
    }
    await ctx.reply("Илтимос, бот сизни таниши учун контактни юборинг.\n" +
        "Телефон рақамингиз ва исм-фамилиянгиз олинади.", {
        reply_markup: getContactRequestKeyboard(),
    });
});
bot.on("message:contact", async (ctx) => {
    const contact = ctx.message?.contact;
    if (!contact)
        return;
    const phone = contact.phone_number;
    const firstName = contact.first_name || "";
    const lastName = contact.last_name || "";
    const fullNameFromContact = [firstName, lastName].filter(Boolean).join(" ").trim();
    const fullName = fullNameFromContact ||
        `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim() ||
        "Xodim";
    try {
        await axios_1.default.post(`${BACKEND_BASE_URL}/employee/contact`, {
            telegramUserId: String(ctx.from?.id),
            phone_number: phone,
            first_name: firstName || ctx.from?.first_name,
            last_name: lastName || ctx.from?.last_name,
        });
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to save contact", err.message);
        await ctx.reply("Контактни сақлашда хатолик. Илтимос, қайта уриниб кўринг.");
        return;
    }
    await ctx.reply("✅ Раҳмат! Маълумотларингиз сақланди.", {
        reply_markup: { remove_keyboard: true },
    });
    const isManager = MANAGERS_CHAT_ID && ctx.chat && String(ctx.chat.id) === String(MANAGERS_CHAT_ID);
    await sendMainMenu(ctx, isManager);
});
// Employee self-service flows
bot.hears("Опаздываю", async (ctx) => {
    const kb = new grammy_1.InlineKeyboard()
        .text("15 мин", "late_15")
        .text("30 мин", "late_30")
        .text("60 мин", "late_60");
    await ctx.reply("На сколько минут вы опаздываете?", {
        reply_markup: kb,
    });
});
bot.hears("Болею", async (ctx) => {
    if (!ctx.chat)
        return;
    pendingStates.set(ctx.chat.id, { type: "sick" });
    await ctx.reply("Понимаю. Напишите коротко причину / комментарий одним сообщением.");
});
bot.hears("Отгул", async (ctx) => {
    if (!ctx.chat)
        return;
    pendingStates.set(ctx.chat.id, { type: "dayoff" });
    await ctx.reply("Принято. Напишите коротко причину / комментарий одним сообщением.");
});
bot.callbackQuery(/late_(\d+)/, async (ctx) => {
    if (!ctx.chat || !ctx.match)
        return;
    const minutes = Number(ctx.match[1]);
    pendingStates.set(ctx.chat.id, { type: "late", minutes });
    await ctx.answerCallbackQuery();
    try {
        await ctx.editMessageReplyMarkup();
    }
    catch (e) {
        // ignore if cannot edit
    }
    await ctx.reply(`Опоздание на ~${minutes} минут. Укажите, пожалуйста, причину одним сообщением.`);
});
bot.on("message:text", async (ctx, next) => {
    if (!ctx.chat || !ctx.message || !ctx.from)
        return next();
    const state = pendingStates.get(ctx.chat.id);
    if (!state) {
        return next();
    }
    const reason = ctx.message.text;
    const fullName = `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim();
    try {
        if (state.type === "late") {
            await axios_1.default.post(`${BACKEND_BASE_URL}/employee/status/late`, {
                telegramUserId: String(ctx.from.id),
                fullName,
                minutes: state.minutes,
                reason,
            });
            await ctx.reply("Спасибо, ваше опоздание зафиксировано и учтено в отчёте.");
        }
        else if (state.type === "sick") {
            await axios_1.default.post(`${BACKEND_BASE_URL}/employee/status/sick`, {
                telegramUserId: String(ctx.from.id),
                fullName,
                reason,
            });
            await ctx.reply("Спасибо, отметка «Болею» сохранена и учтена в отчёте.");
        }
        else if (state.type === "dayoff") {
            await axios_1.default.post(`${BACKEND_BASE_URL}/employee/status/dayoff`, {
                telegramUserId: String(ctx.from.id),
                fullName,
                reason,
            });
            await ctx.reply("Спасибо, ваш отгул зафиксирован и учтён в отчёте.");
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to send status to backend", err.message);
        await ctx.reply("Не удалось сохранить данные. Попробуйте позже.");
    }
    finally {
        pendingStates.delete(ctx.chat.id);
    }
    return undefined;
});
// Manager commands
bot.command("today", async (ctx) => {
    if (ctx.chat)
        await sendDailyReportToChat(ctx.chat.id);
});
bot.command("dashboard", async (ctx) => {
    const replyMarkup = buildDashboardKeyboard();
    if (replyMarkup) {
        await ctx.reply("Открыть детальный дашборд:", {
            reply_markup: replyMarkup,
        });
    }
    else {
        await ctx.reply("Дашборд в Telegram открывается только по HTTPS. Локально откройте в браузере: " +
            (WEBAPP_URL || "http://localhost:3000"));
    }
});
// Scheduled daily report at 10:00 (Asia/Tashkent by default)
node_cron_1.default.schedule("* * * * *", async () => {
    if (!MANAGERS_CHAT_ID)
        return;
    await sendDailyReportToChat(MANAGERS_CHAT_ID);
}, {
    timezone: process.env.CRON_TZ || "Asia/Tashkent",
});
bot.catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Bot error:", err.error || err);
});
bot.start();
// eslint-disable-next-line no-console
console.log("HR-Monitor Telegram bot started");
//# sourceMappingURL=index.js.map