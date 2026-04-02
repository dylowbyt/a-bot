import type { WASocket, proto } from "@whiskeysockets/baileys";
import { stikerCommand } from "./stiker.js";
import { logger } from "../../lib/logger.js";

export type CommandContext = {
  sock: WASocket;
  msg: proto.IWebMessageInfo;
  jid: string;
  args: string[];
};

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

const commands: Map<string, CommandHandler> = new Map();

commands.set("stiker", stikerCommand);
commands.set("sticker", stikerCommand);

commands.set("help", async ({ sock, jid }) => {
  const helpText = [
    "*🤖 AI WhatsApp Bot*",
    "",
    "*Commands yang tersedia:*",
    "• /stiker — Buat stiker dari gambar",
    "  (kirim gambar + caption /stiker, atau reply gambar dengan /stiker)",
    "• /help — Tampilkan pesan bantuan ini",
    "• /clear — Hapus riwayat chat AI kamu",
    "",
    "*💬 Mode Chat Pribadi:*",
    "Kirim pesan apapun langsung untuk ngobrol dengan AI.",
    "",
    "*👥 Mode Grup:*",
    "Gunakan /command atau reply pesan bot untuk berinteraksi.",
  ].join("\n");

  await sock.sendMessage(jid, { text: helpText });
});

export async function handleCommand(
  sock: WASocket,
  msg: proto.IWebMessageInfo,
  jid: string,
  commandText: string,
): Promise<boolean> {
  const parts = commandText.trim().split(/\s+/);
  const rawCommand = parts[0] ?? "";
  const commandName = rawCommand.toLowerCase().replace(/^\//, "");
  const args = parts.slice(1);

  const handler = commands.get(commandName);
  if (!handler) return false;

  logger.info({ commandName, jid }, "Handling command");

  try {
    await handler({ sock, msg, jid, args });
  } catch (err) {
    logger.error({ err, commandName }, "Command handler error");
    await sock.sendMessage(jid, {
      text: "❌ Terjadi kesalahan saat menjalankan command.",
    });
  }

  return true;
}

export function registerCommand(
  name: string,
  handler: CommandHandler,
): void {
  commands.set(name.toLowerCase(), handler);
  logger.info({ name }, "Command registered");
}
