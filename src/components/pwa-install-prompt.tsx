"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PwaContextType {
  isInstallable: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isStandalone: false,
  promptInstall: async () => {},
});

export const usePwa = () => useContext(PwaContext);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Service Worker registration failed:", err);
          });
      });
    }

    // 2. Check if already running in standalone mode (PWA installed)
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      const standalone = isDisplayStandalone || isIosStandalone;
      setIsStandalone(standalone);
      return standalone;
    };

    const standalone = checkStandalone();

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 4. Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user dismissed banner recently
      const dismissed = localStorage.getItem("rendesk-pwa-dismissed");
      if (!standalone && (!dismissed || Date.now() - Number(dismissed) > 86400000 * 3)) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. App installed listener
    window.addEventListener("appinstalled", () => {
      setIsStandalone(true);
      setShowBanner(false);
      setDeferredPrompt(null);
      console.log("[PWA] RenDesk app successfully installed!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setShowBanner(false);
      }
    } else if (isIos && !isStandalone) {
      setShowIosGuide(true);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("rendesk-pwa-dismissed", String(Date.now()));
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable: Boolean(deferredPrompt) || (isIos && !isStandalone),
        isStandalone,
        promptInstall,
      }}
    >
      {children}

      {/* Mobile PWA Install Floating Banner */}
      {showBanner && !isStandalone && (
        <div className="fixed bottom-16 left-3 right-3 z-50 animate-in slide-in-from-bottom duration-300 md:bottom-5 md:left-auto md:right-5 md:max-w-md">
          <div className="rounded-2xl border border-primary/20 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Install RenDesk Mobile App</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    Fast 1-tap punch, offline attendance & instant alerts
                  </p>
                </div>
              </div>
              <button
                onClick={dismissBanner}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-8 rounded-lg shadow-sm"
                onClick={promptInstall}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Install App
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={dismissBanner}
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-2xl border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Smartphone className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-foreground text-base">Install on iPhone / iPad</h3>
              </div>
              <button onClick={() => setShowIosGuide(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              To install RenDesk as a standalone native app on your home screen:
            </p>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3 bg-muted/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Share2 className="h-4 w-4" />
                </div>
                <span>1. Tap the <strong>Share</strong> button in Safari's bottom toolbar</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3 bg-muted/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PlusSquare className="h-4 w-4" />
                </div>
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong></span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3 bg-muted/30">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span>3. Tap <strong>Add</strong> in the top-right corner</span>
              </div>
            </div>
            <Button
              className="mt-5 w-full rounded-xl text-xs font-semibold"
              onClick={() => setShowIosGuide(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
}
