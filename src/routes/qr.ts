import { Router } from "express";
import QRCode from "qrcode";
import { getQR, getBotStatus } from "../bot/index.js";

const router = Router();

router.get("/qr", async (req, res) => {
  const status = getBotStatus();

  if (status.connected) {
    res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI WA Bot — Terhubung</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #075E54, #128C7E); padding: 20px; }
    .card { background: white; padding: 40px 32px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 380px; width: 100%; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #128C7E; font-size: 24px; margin-bottom: 8px; }
    p { color: #666; line-height: 1.5; margin-bottom: 20px; }
    .badge { background: #25D366; color: white; padding: 10px 28px; border-radius: 30px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
    .dot { width: 8px; height: 8px; background: white; border-radius: 50%; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Bot Terhubung!</h1>
    <p>WhatsApp AI Bot sudah aktif dan siap digunakan. Coba kirim pesan ke bot atau gunakan /help.</p>
    <div class="badge"><div class="dot"></div>Online</div>
  </div>
</body>
</html>`);
    return;
  }

  const qr = getQR();

  if (!qr) {
    res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="5">
  <title>AI WA Bot — Memuat...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #075E54, #128C7E); padding: 20px; }
    .card { background: white; padding: 40px 32px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 380px; width: 100%; }
    .spinner { width: 56px; height: 56px; border: 5px solid #e8f5e9; border-top: 5px solid #128C7E; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { color: #128C7E; font-size: 22px; margin-bottom: 8px; }
    p { color: #888; font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Memuat QR Code...</h1>
    <p>Bot sedang mempersiapkan koneksi.<br>Halaman akan otomatis refresh dalam 5 detik.</p>
  </div>
</body>
</html>`);
    return;
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(qr, {
      width: 280,
      margin: 2,
      color: { dark: "#075E54", light: "#ffffff" },
    });

    res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>AI WA Bot — Scan QR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #075E54, #128C7E); padding: 20px; }
    .card { background: white; padding: 32px 28px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; width: 100%; }
    .header { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 6px; }
    .logo { font-size: 32px; }
    h1 { color: #128C7E; font-size: 22px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 22px; }
    .qr-wrap { background: #f5faf9; border: 2px solid #e8f5e9; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 22px; }
    .qr-wrap img { display: block; border-radius: 10px; }
    .steps { background: #f0faf6; border-radius: 12px; padding: 16px 20px; text-align: left; margin-bottom: 16px; }
    .steps h3 { color: #075E54; font-size: 13px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .step { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
    .step:last-child { margin-bottom: 0; }
    .num { background: #128C7E; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .step p { color: #555; font-size: 13px; line-height: 1.5; }
    .timer { color: #aaa; font-size: 12px; }
    .timer span { color: #128C7E; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">🤖</div>
      <h1>AI WhatsApp Bot</h1>
    </div>
    <p class="subtitle">Scan QR code untuk menghubungkan bot ke WhatsApp kamu</p>
    <div class="qr-wrap">
      <img src="${qrDataUrl}" alt="QR Code WhatsApp" width="280" height="280">
    </div>
    <div class="steps">
      <h3>📱 Cara menghubungkan:</h3>
      <div class="step"><div class="num">1</div><p>Buka <strong>WhatsApp</strong> di HP kamu</p></div>
      <div class="step"><div class="num">2</div><p>Tap ⋮ (menu) → <strong>Perangkat Tertaut</strong></p></div>
      <div class="step"><div class="num">3</div><p>Tap <strong>"Tautkan Perangkat"</strong></p></div>
      <div class="step"><div class="num">4</div><p>Arahkan kamera ke QR code di atas</p></div>
    </div>
    <p class="timer">⏱ QR akan otomatis refresh setiap <span>30 detik</span></p>
  </div>
</body>
</html>`);
  } catch (err) {
    res.status(500).send("Error generating QR code");
  }
});

export default router;
