"use client";

import { createContext, useContext } from "react";
import type { PlaceCategory, Place } from "@/contracts/place";

/** Chat → map bus (C3): what chat cards can do on the page without knowing about the map. */
export type ChatActions = {
  /** Ask the assistant a follow-up question. */
  ask: (text: string) => void;
  /** Select a place: popup on the map, the map moves to it. */
  showPlace: (place: Place) => void;
  /** Show only these layers on the map. */
  showCategories: (categories: PlaceCategory[]) => void;
};

const noop: ChatActions = { ask: () => {}, showPlace: () => {}, showCategories: () => {} };

export const ChatActionsContext = createContext<ChatActions>(noop);

export const useChatActions = () => useContext(ChatActionsContext);
