"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatRequestBody } from "@/contracts/chat";
import type { Locale } from "@/contracts/common";
import type { z } from "zod";

type MapContext = z.infer<typeof ChatRequestBody>["map"];

/** Chat with the agent at /api/chat (zone B) via the AI SDK UI stream (C3). */
export function useAssistant({ getMap, initialQuestion }: { getMap: () => MapContext; initialQuestion?: string }) {
  const locale = useLocale() as Locale;
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const chat = useChat({ transport, experimental_throttle: 60 });
  const { sendMessage, stop, setMessages, regenerate, clearError } = chat;

  // Sent with every request, so the agent always gets the current locale and map view.
  const requestBody = useCallback(() => ({ body: { locale, map: getMap() } }), [locale, getMap]);

  const ask = useCallback(
    (text: string) => {
      const q = text.trim();
      if (q) void sendMessage({ text: q }, requestBody());
    },
    [sendMessage, requestBody],
  );

  // A question typed on the home page (`/mapa?q=`) is asked once, as soon as the chat mounts.
  const askedInitial = useRef(false);
  useEffect(() => {
    if (!initialQuestion || askedInitial.current) return;
    askedInitial.current = true;
    ask(initialQuestion);
  }, [initialQuestion, ask]);

  const reset = useCallback(() => {
    void stop();
    setMessages([]);
    clearError();
  }, [stop, setMessages, clearError]);

  const retry = useCallback(() => {
    clearError();
    void regenerate(requestBody());
  }, [clearError, regenerate, requestBody]);

  const busy = chat.status === "submitted" || chat.status === "streaming";
  // The server answers 429 with {"error":"Too many requests"}; the transport puts the body in the message.
  const rateLimited = !!chat.error && /too many requests|429/i.test(chat.error.message);

  return { messages: chat.messages, status: chat.status, error: chat.error, busy, rateLimited, ask, stop, reset, retry };
}

export type Assistant = ReturnType<typeof useAssistant>;
