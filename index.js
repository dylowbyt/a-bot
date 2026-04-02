// index.js - Modular: Command terpisah dari AI Chat
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Konfigurasi OpenAI ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "gpt-3.5-turbo";

// ---------- State untuk QR ----------
let latestQR = null;
let latestQRImage = null;

// ---------- Inisialisasi WhatsApp Client ----------
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// ---------- Fungsi AI (bisa dipisah ke file terpisah) ----------
async function chatWithAI(userMessage) {
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: AI_MODEL,
            messages: [{ role: 'user', content: userMessage }],
            max_tokens: 300,
            temperature: 0.7
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
        });
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('❌ OpenAI Error:', error.response?.data || error.message);
        return "Maaf, sedang terjadi gangguan. Coba lagi nanti ya.";
    }
}

// ---------- Fungsi Sticker (utility) ----------
async function createSticker(mediaData) {
    try {
        const sticker = new Sticker(mediaData, {
            pack: 'AI Bot Sticker',
            author: 'WhatsApp Bot',
            type: StickerTypes.FULL,
            quality: 80
        });
        return await sticker.toBuffer();
    } catch (error) {
        console.error('❌ Sticker Error:', error);
        return null;
    }
}

// ========== COMMAND HANDLER (Pisah dari AI) ==========
// Daftar command: objek dengan key = nama command (tanpa /), value = fungsi handler
const commands = {
    // Command /stiker
    stiker: async (message, args) => {
        // args tidak dipakai untuk stiker
        if (message.hasQuotedMsg) {
            const quotedMsg = await message.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const media = await quotedMsg.downloadMedia();
                if (media.mimetype.startsWith('image/')) {
                    const stickerBuffer = await createSticker(media.data);
                    if (stickerBuffer) {
                        await client.sendMessage(message.from, stickerBuffer, { sendMediaAsSticker: true });
                        await message.reply('✅ Stiker berhasil dibuat!');
                    } else {
                        await message.reply('❌ Gagal membuat stiker.');
                    }
                } else {
                    await message.reply('❌ Balas ke GAMBAR, bukan media lain!');
                }
            } else {
                await message.reply('❌ Tidak ada media yang dibalas.');
            }
        } else {
            await message.reply('❌ Gunakan: balas gambar lalu ketik `/stiker`');
        }
    },

    // Command /help
    help: async (message, args) => {
        const commandList = Object.keys(commands).map(cmd => `/${cmd}`).join(', ');
        await message.reply(
            `🤖 *Daftar Perintah Bot*\n\n` +
            `📌 *Command tersedia:* ${commandList}\n` +
            `💬 *Chat biasa:* Kirim pesan apapun, AI akan menjawab.\n\n` +
            `🔧 *Contoh:*\n` +
            `- /stiker (balas gambar)\n` +
            `- /help\n` +
            `- /ping\n\n` +
            `✨ Mudah menambah fitur baru dengan menambahkan entri di objek 'commands'`
        );
    },

    // Command /ping (contoh fitur baru yang mudah ditambahkan)
    ping: async (message, args) => {
        await message.reply('🏓 Pong! Bot aktif.');
    },

    // Command /ai (opsional: memaksa AI meskipun pesan diawali command?)
    // Bisa ditambahkan sesuai kebutuhan
};

// Fungsi untuk mengeksekusi command jika pesan diawali "/"
async function handleCommand(message) {
    const body = message.body;
    if (!body.startsWith('/')) return false; // bukan command

    const [cmdName, ...args] = body.slice(1).trim().split(/\s+/);
    const command = commands[cmdName.toLowerCase()];
    if (command) {
        try {
            await command(message, args);
        } catch (err) {
            console.error(`Error executing command ${cmdName}:`, err);
            await message.reply('❌ Terjadi kesalahan saat menjalankan perintah.');
        }
        return true; // sudah ditangani command
    }
    return false; // tidak dikenali sebagai command, bisa lanjut ke AI
}

// ========== AI CHAT HANDLER (terpisah) ==========
async function handleAIChat(message) {
    // Hindari memproses pesan yang mengandung media gambar (karena akan diarahkan ke stiker)
    // Tapi tetap boleh chat biasa jika teks saja.
    if (message.hasMedia) {
        // Cek apakah media gambar? Jika iya, beri petunjuk ke /stiker
        try {
            const media = await message.downloadMedia();
            if (media.mimetype.startsWith('image/')) {
                await message.reply("📸 Gambar diterima! Gunakan perintah `/stiker` (balas gambar ini) untuk buat stiker.");
                return;
            }
        } catch(e) {}
        // Untuk media non-gambar, chat biasa mungkin tidak relevan, tapi tetap lanjut AI?
    }
    const reply = await chatWithAI(message.body);
    await message.reply(reply);
}

// ---------- Event: Pesan Masuk (Router) ----------
client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return;

    // Cek apakah pesan adalah command (diawali /)
    const isCommand = await handleCommand(message);
    if (isCommand) return; // command sudah diproses, selesai.

    // Bukan command => chat dengan AI
    await handleAIChat(message);
});

// ---------- Event QR dan Ready (sama seperti sebelumnya) ----------
client.on('qr', async (qr) => {
    console.log('QR received, generating...');
    latestQR = qr;
    try {
        latestQRImage = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error('QR image error:', err);
    }
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp Aktif!');
    latestQR = null;
});

// ---------- Web Server untuk QR ----------
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>WhatsApp AI Bot</title></head>
        <body style="text-align:center;font-family:Arial;padding:20px;">
            <h2>🤖 WhatsApp AI Bot (Modular)</h2>
            <p>Scan QR code di bawah menggunakan WhatsApp:</p>
            ${latestQRImage ? `<img src="${latestQRImage}" style="width:300px;height:300px;" />` : '<p>Belum ada QR. Tunggu sebentar...</p>'}
            <p>Jika QR tidak muncul, refresh halaman ini.</p>
            <hr />
            <p>Status: ${client.info ? '✅ Online' : '⏳ Menunggu login...'}</p>
            <p>Command: /help, /stiker, /ping, dll.</p>
        </body>
        </html>
    `);
});

app.get('/qr', (req, res) => {
    if (latestQRImage) {
        res.send(`<html><body style="text-align:center;"><img src="${latestQRImage}" /><p>Scan QR ini dengan WhatsApp</p></body></html>`);
    } else if (latestQR) {
        qrcode.toDataURL(latestQR, (err, url) => {
            if (err) return res.send('Gagal generate QR');
            latestQRImage = url;
            res.send(`<html><body style="text-align:center;"><img src="${url}" /></body></html>`);
        });
    } else {
        res.send('Belum ada QR. Pastikan bot sudah jalan dan belum login.');
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
    console.log(`📱 Buka di HP: https://your-app.railway.app/qr untuk scan QR`);
});

client.initialize();
