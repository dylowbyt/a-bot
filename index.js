const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode');
const axios = require('axios');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Readable } = require('stream');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || "gpt-3.5-turbo";

let latestQR = null;
let latestQRImage = null;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

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
        console.error('OpenAI Error:', error.response?.data || error.message);
        return "Maaf, sedang terjadi gangguan. Coba lagi nanti ya.";
    }
}

// Fungsi membuat stiker dari buffer gambar menggunakan sharp + ffmpeg
async function createStickerFromBuffer(imageBuffer) {
    return new Promise(async (resolve, reject) => {
        try {
            // Resize gambar ke 512x512 (ukuran stiker umum)
            const resizedBuffer = await sharp(imageBuffer)
                .resize(512, 512, { fit: 'cover' })
                .toBuffer();

            // Konversi ke WebP dengan ffmpeg
            const inputStream = Readable.from(resizedBuffer);
            const outputBuffers = [];
            const command = ffmpeg(inputStream)
                .inputFormat('image2')
                .outputFormat('webp')
                .videoCodec('libwebp')
                .addOptions([
                    '-loop 0',
                    '-q:v 80',
                    '-vf scale=512:512:force_original_aspect_ratio=increase,crop=512:512',
                    '-lossless 0',
                    '-preset default'
                ]);

            command.on('end', () => {
                const stickerBuffer = Buffer.concat(outputBuffers);
                resolve(stickerBuffer);
            });
            command.on('error', (err) => {
                console.error('FFmpeg error:', err);
                reject(err);
            });

            const writeStream = command.pipe();
            writeStream.on('data', (chunk) => outputBuffers.push(chunk));
        } catch (err) {
            reject(err);
        }
    });
}

const commands = {
    stiker: async (message, args) => {
        if (message.hasQuotedMsg) {
            const quotedMsg = await message.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                const media = await quotedMsg.downloadMedia();
                if (media.mimetype.startsWith('image/')) {
                    try {
                        const imageBuffer = Buffer.from(media.data, 'base64');
                        const stickerBuffer = await createStickerFromBuffer(imageBuffer);
                        await client.sendMessage(message.from, stickerBuffer, { sendMediaAsSticker: true });
                        await message.reply('✅ Stiker berhasil dibuat!');
                    } catch (err) {
                        console.error('Sticker creation error:', err);
                        await message.reply('❌ Gagal membuat stiker. Pastikan gambar valid.');
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
    help: async (message, args) => {
        await message.reply(
            `🤖 *Daftar Perintah Bot*\n\n` +
            `/stiker - Buat stiker dari gambar (balas gambar)\n` +
            `/help - Bantuan ini\n` +
            `/ping - Cek status bot\n\n` +
            `💬 Chat biasa: Kirim pesan apapun, AI akan menjawab.`
        );
    },
    ping: async (message, args) => {
        await message.reply('🏓 Pong! Bot aktif.');
    }
};

async function handleCommand(message) {
    const body = message.body;
    if (!body.startsWith('/')) return false;
    const [cmdName, ...args] = body.slice(1).trim().split(/\s+/);
    const command = commands[cmdName.toLowerCase()];
    if (command) {
        try {
            await command(message, args);
        } catch (err) {
            console.error(`Error command ${cmdName}:`, err);
            await message.reply('❌ Terjadi kesalahan.');
        }
        return true;
    }
    return false;
}

async function handleAIChat(message) {
    if (message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            if (media.mimetype.startsWith('image/')) {
                await message.reply("📸 Gambar diterima! Gunakan perintah `/stiker` (balas gambar ini) untuk buat stiker.");
                return;
            }
        } catch(e) {}
    }
    const reply = await chatWithAI(message.body);
    await message.reply(reply);
}

client.on('message', async (message) => {
    if (message.from === 'status@broadcast') return;
    const isCommand = await handleCommand(message);
    if (!isCommand) await handleAIChat(message);
});

client.on('qr', async (qr) => {
    console.log('QR received');
    latestQR = qr;
    try {
        latestQRImage = await qrcode.toDataURL(qr);
    } catch (err) {}
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp Aktif!');
    latestQR = null;
});

app.get('/', (req, res) => {
    res.send(`
        <html>
        <body style="text-align:center;">
            <h2>WhatsApp AI Bot</h2>
            ${latestQRImage ? `<img src="${latestQRImage}" style="width:300px;" />` : '<p>Belum ada QR. Refresh.</p>'}
            <p>Status: ${client.info ? '✅ Online' : '⏳ Menunggu login'}</p>
        </body>
        </html>
    `);
});

app.get('/qr', (req, res) => {
    if (latestQRImage) {
        res.send(`<html><body><img src="${latestQRImage}" /></body></html>`);
    } else if (latestQR) {
        qrcode.toDataURL(latestQR, (err, url) => {
            if (err) return res.send('Error QR');
            latestQRImage = url;
            res.send(`<html><body><img src="${url}" /></body></html>`);
        });
    } else {
        res.send('Belum ada QR');
    }
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
client.initialize();
