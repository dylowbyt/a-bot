import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_KEY = process.env.OPENAI_API_KEY;

async function chatAI(pesan) {
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: pesan }]
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
    });
    return res.data.choices[0].message.content;
  } catch (e) {
    return 'Maaf, AI error.';
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: { level: 'silent' }
  });

  sock.ev.on('connection.update', (update) => {
    if (update.qr) {
      console.log('📱 SCAN QR CODE INI:');
      qrcode.generate(update.qr, { small: true });
    }
    if (update.connection === 'open') console.log('✅ BOT AKTIF!');
    if (update.connection === 'close') startBot();
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;
    const chat = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    
    if (text === '/help') {
      await sock.sendMessage(chat, { text: 'Perintah: /stiker (balas gambar), chat biasa AI' });
    }
    else if (text === '/stiker') {
      const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted?.imageMessage) {
        const media = await sock.downloadMediaMessage(m);
        await sock.sendMessage(chat, { sticker: media });
        await sock.sendMessage(chat, { text: '✅ Stiker jadi' });
      } else {
        await sock.sendMessage(chat, { text: '❌ Balas gambar dulu dengan /stiker' });
      }
    }
    else if (text.trim() && !text.startsWith('/')) {
      const balasan = await chatAI(text);
      await sock.sendMessage(chat, { text: balasan });
    }
  });
}

startBot();
app.get('/', (req, res) => res.send('Bot running'));
app.listen(PORT, () => console.log(`Web server port ${PORT}`));
