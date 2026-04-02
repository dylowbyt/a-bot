import type { WASocket, WAMessage, proto } from "@whiskeysockets/baileys";
import { handleCommand } from "../commands/index.js";
import { getAIResponse, clearConversation } from "../ai/chat.js";
import { logger } from "../../lib/logger.js";

const botMessageIds = new Set<string>();
const MAX_BOT_MSG_CACHE = 1000;

export function trackBotMessage(msgId: string): void {
  botMessageIds.add(msgId);
  if (botMessageIds.size > MAX_BOT_MSG_CACHE) {
    const [first] = botMessageIds;
    if (first) botMessageIds.delete(first);
  }
}

function getMessageText(msg: proto.IWebMessageInfo): string | null {
  return (
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.imageMessage?.caption ??
    null
  );
}

function isGroup(jid: string): boolean {
  return jid.endsWith("@g.us");
}

function isReplyToBotMessage(msg: proto.IWebMessageInfo): boolean {
  const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
  return quotedId ? botMessageIds.has(quotedId) : false;
}

export async function handleMessage(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
): Promise<void> {
  const key = msg.key;
  if (!key) return;

  const jid = key.remoteJid;
  if (!jid || key.fromMe) return;

  if (
    msg.message?.protocolMessage ??
    msg.message?.senderKeyDistributionMessage
  )
    return;

  const text = getMessageText(msg);
  const isGroupChat = isGroup(jid);
  const startsWithCommand = text?.startsWith("/");

  if (text?.toLowerCase().trim() === "/clear") {
    const senderId = key.participant ?? jid;
    clearConversation(senderId);
    await sock.sendMessage(jid, {
      text: "🗑️ Riwayat chat AI kamu sudah dihapus!",
    });
    return;
  }

  if (startsWithCommand && text) {
    const handled = await handleCommand(sock, msg, jid, text);
    if (!handled) {
      await sock.sendMessage(jid, {
        text: "❓ Command tidak dikenali. Ketik /help untuk melihat daftar command.",
      });
    }
    return;
  }

  if (isGroupChat && !isReplyToBotMessage(msg)) {
    return;
  }

  if (!text) return;

  const senderId = key.participant ?? jid;
  logger.info({ jid, senderId }, "Routing message to AI");

  try {
    await sock.sendPresenceUpdate("composing", jid);
    const reply = await getAIResponse(senderId, text);
    await sock.sendPresenceUpdate("paused", jid);

    const waMsg = msg as WAMessage;
    const sentMsg = await sock.sendMessage(
      jid,
      { text: reply },
      { quoted: waMsg },
    );

    if (sentMsg?.key?.id) {
      trackBotMessage(sentMsg.key.id);
    }
  } catch (err) {
    logger.error({ err }, "AI chat error");
    await sock.sendMessage(jid, {
      text: "❌ Maaf, terjadi kesalahan. Coba lagi nanti.",
    });
  }
}
