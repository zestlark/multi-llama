import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { BeforeInstallPromptEvent } from "@/lib/app-types";

export const usePwaLifecycle = (publicBasePath: string) => {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [waitingServiceWorker, setWaitingServiceWorker] =
    useState<ServiceWorker | null>(null);
  const [canUpdatePwa, setCanUpdatePwa] = useState(false);
  const [isUpdatingPwa, setIsUpdatingPwa] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
      return;
    }

    const markUpdateAvailable = (worker: ServiceWorker) => {
      setWaitingServiceWorker(worker);
      setCanUpdatePwa(true);
      toast.info("App update available", {
        description: "Open Settings and click Update app to load the latest version.",
      });
    };

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register(`${publicBasePath}/sw.js`)
        .then((registration) => {
          if (registration.waiting) {
            markUpdateAvailable(registration.waiting);
          }

          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                markUpdateAvailable(installing);
              }
            });
          });
        })
        .catch((error) =>
          console.error("[v0] Failed to register service worker:", error),
        );
    };

    const handleControllerChange = () => {
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    if (document.readyState === "complete") {
      registerServiceWorker();
      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange,
        );
      };
    }

    window.addEventListener("load", registerServiceWorker);
    return () => {
      window.removeEventListener("load", registerServiceWorker);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, [publicBasePath]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setCanInstallPwa(true);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setCanInstallPwa(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installPwa = useCallback(async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    setCanInstallPwa(false);
  }, [installPromptEvent]);

  const updatePwa = useCallback(async () => {
    if (!waitingServiceWorker) return;
    setIsUpdatingPwa(true);
    waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    setCanUpdatePwa(false);
    setWaitingServiceWorker(null);
  }, [waitingServiceWorker]);

  return {
    canInstallPwa,
    canUpdatePwa,
    isUpdatingPwa,
    installPwa,
    updatePwa,
  };
};
