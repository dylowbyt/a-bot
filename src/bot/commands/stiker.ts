import sharp from "sharp";
import {
  downloadMediaMessage,
  type WAMessage,
  type proto,
} from "@whiskeysockets/baileys";
import type { CommandContext } from "./index.js";
import { logger } from "../../lib/logger.js";

export async function stikerCommand({
  sock,
  msg,
  jid,
}: CommandContext): Promise<void> {
  const imageInMsg = msg.message?.imageMessage;
  const quotedMsg =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const imageInQuoted = quotedMsg?.imageMessage;

  if (!imageInMsg && !imageInQuoted) {
    await sock.sendMessage(jid, {
      text: "📸 Kirim gambar dengan caption /stiker, atau reply gambar dengan /stiker untuk membuat stiker!",
    });
    return;
  }

  await sock.sendMessage(jid, { text: "⏳ Sedang membuat stiker..." });

  let targetMsg: WAMessage;

  if (imageInMsg) {
    targetMsg = msg as WAMessage;
  } else {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const reconstructed: proto.IWebMessageInfo = {
      key: {
        remoteJid: jid,
        id: contextInfo?.stanzaId ?? "",
        fromMe: false,
        participant: contextInfo?.participant,
      },
      message: quotedMsg!,
    };
    targetMsg = reconstructed as WAMessage;
  }

  try {
    const buffer = await downloadMediaMessage(targetMsg, "buffer", {});

    if (!buffer || !(buffer instanceof Buffer)) {
      await sock.sendMessage(jid, {
        text: "❌ Gagal mengunduh gambar. Coba lagi!",
      });
      return;
    }

    const stickerBuffer = await sharp(buffer)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toBuffer();

    await sock.sendMessage(jid, { sticker: stickerBuffer });
    logger.info({ jid }, "Sticker sent successfully");
  } catch (err) {
    logger.error({ err, jid }, "Sticker creation failed");
    await sock.sendMessage(jid, {
      text: "❌ Gagal membuat stiker. Pastikan gambar valid dan coba lagi!",
    });
  }
}
