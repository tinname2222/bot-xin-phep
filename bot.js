const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GAS_URL = process.env.GAS_URL;

// Danh sách admin (Telegram user_id)
const ADMINS = new Set((process.env.ADMINS || "").split(",").map(s => Number(s.trim())).filter(Boolean));

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function isAdmin(id) {
  return ADMINS.has(Number(id));
}

async function gas(payload) {
  const res = await axios.post(GAS_URL, payload, { timeout: 15000 });
  return res.data;
}

// Nhân viên gửi xin phép
bot.onText(/^\/xinphep(?:\s+([\s\S]+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const text = (match && match[1] ? match[1] : "").trim();
  if (!text) return bot.sendMessage(chatId, "❌ Dùng: /xinphep <nội dung>");

  const name = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");
  const username = msg.from.username ? "@" + msg.from.username : "";

  try {
    await gas({
      action: "add",
      name, username,
      message: text
    });

    await bot.sendMessage(chatId, "✅ Đã gửi xin phép. Chờ trưởng nhóm duyệt.");

    // Gửi cho admin
    const adminMsg =
`📌 Xin phép mới
👤 ${name} ${username}
📝 ${text}

👉 Duyệt: /ok <ID>
👉 Từ chối: /no <ID>`;

    for (const id of ADMINS) {
      bot.sendMessage(id, adminMsg).catch(()=>{});
    }
  } catch (e) {
    bot.sendMessage(chatId, "❌ Lỗi gửi: " + e.message);
  }
});

// Admin duyệt
bot.onText(/^\/ok\s+(\d+)/i, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Bạn không phải admin.");
  const id = match[1];
  const admin = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");
  try {
    await gas({ action: "approve", id, admin });
    bot.sendMessage(msg.chat.id, "✅ Đã duyệt yêu cầu #" + id);
  } catch (e) {
    bot.sendMessage(msg.chat.id, "❌ Lỗi: " + e.message);
  }
});

bot.onText(/^\/no\s+(\d+)/i, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Bạn không phải admin.");
  const id = match[1];
  const admin = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");
  try {
    await gas({ action: "reject", id, admin });
    bot.sendMessage(msg.chat.id, "❌ Đã từ chối yêu cầu #" + id);
  } catch (e) {
    bot.sendMessage(msg.chat.id, "❌ Lỗi: " + e.message);
  }
});

console.log("Bot running...");
