"use client";

import { createContext, useContext } from "react";
import type { LngLat } from "@/contracts/common";
import type { TravelMode } from "@/contracts/geo";
import type { PlaceCategory, Place } from "@/contracts/place";

/** Chat → map bus (C3): what chat cards can do on the page without knowing about the map. */
export type ChatActions = {
  /** Ask the assistant a follow-up question. */
  ask: (text: string) => void;
  /** Select a place: popup on the map, the map moves to it. */
  showPlace: (place: Place) => void;
  /** Show only these layers on the map. */
  showCategories: (categories: PlaceCategory[]) => void;
  /** Open "Kraków w 15 minut" (C4) for this point. */
  showNearby: (origin: { label: string; coords: LngLat }, mode: TravelMode) => void;
};

const noop: ChatActions = { ask: () => {}, showPlace: () => {}, showCategories: () => {}, showNearby: () => {} };

export const ChatActionsContext = createContext<ChatActions>(noop);

export const useChatActions = () => useContext(ChatActionsContext);
