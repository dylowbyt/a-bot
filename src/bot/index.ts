import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { logger } from "../lib/logger.js";
import { handleMessage } from "./handlers/message.js";
import path from "path";
import fs from "fs";

let currentQR: string | null = null;
let isConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function getQR(): string | null {
  return currentQR;
}

export function getBotStatus(): { connected: boolean; qrAvailable: boolean } {
  return { connected: isConnected, qrAvailable: currentQR !== null };
}

const baileysLogger = pino({ level: "warn" });

export async function startBot(): Promise<void> {
  const sessionDir = path.resolve(process.cwd(), "wa-session");
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, "Starting WhatsApp bot");

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: baileysLogger,
    browser: ["AI WhatsApp Bot", "Chrome", "1.0.0"],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      isConnected = false;
      logger.info("New QR code generated — scan to connect");
    }

    if (connection === "close") {
      isConnected = false;
      currentQR = null;

      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.info({ statusCode, shouldReconnect }, "WhatsApp connection closed");

      if (shouldReconnect) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => startBot(), 5000);
      } else {
        logger.warn(
          "WhatsApp logged out — delete wa-session folder and restart to re-authenticate",
        );
      }
    } else if (connection === "open") {
      currentQR = null;
      isConnected = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      logger.info("✅ WhatsApp connected successfully!");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        logger.error({ err }, "Unhandled error in message handler");
      }
    }
  });
}
