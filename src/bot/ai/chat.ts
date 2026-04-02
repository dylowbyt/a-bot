import OpenAI from "openai";
import { logger } from "../../lib/logger.js";

const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

type Message = { role: "user" | "assistant"; content: string };
const conversations = new Map<string, Message[]>();
const MAX_HISTORY = 20;

export async function getAIResponse(
  userId: string,
  message: string,
): Promise<string> {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }

  const history = conversations.get(userId)!;
  history.push({ role: "user", content: message });

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah asisten AI yang ramah, cerdas, dan helpful. Jawab dalam bahasa yang sama dengan pengguna. Jika pengguna berbicara bahasa Indonesia, balas dengan bahasa Indonesia yang natural dan santai.",
      },
      ...history,
    ],
    max_tokens: 1000,
  });

  const reply =
    response.choices[0]?.message?.content ??
    "Maaf, saya tidak bisa memproses pesan ini sekarang.";

  history.push({ role: "assistant", content: reply });
  logger.info({ userId, historyLen: history.length }, "AI response generated");

  return reply;
}

export function clearConversation(userId: string): void {
  conversations.delete(userId);
  logger.info({ userId }, "Conversation cleared");
}
