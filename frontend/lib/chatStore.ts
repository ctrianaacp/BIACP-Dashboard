"use client";
import { useSyncExternalStore, useEffect } from "react";

let contextData: any = null;
let listeners: Array<() => void> = [];

export const chatStore = {
  setContext: (data: any) => {
    contextData = data;
    listeners.forEach((l) => l());
  },
  getContext: () => contextData,
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};

export function useChatContext() {
  return useSyncExternalStore(chatStore.subscribe, chatStore.getContext, chatStore.getContext);
}

// Hook de utilidad para inyectar datos de forma sencilla desde cualquier página
export function useBotContext(dataName: string, data: any) {
  useEffect(() => {
    chatStore.setContext({ modulo: dataName, ...data });
    // Cleanup opcional al desmontar
    return () => {
      const current = chatStore.getContext();
      if (current?.modulo === dataName) {
        chatStore.setContext(null);
      }
    };
  }, [dataName, data]);
}
