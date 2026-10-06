"use client";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
export function MobileLifecycle() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
  return null;
}
