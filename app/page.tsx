"use client";

import React from "react";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "next-themes";
import {
  Send,
  Loader2,
  MessagesSquare,
  Settings2,
  Download,
  Trash2,
  Copy,
  Check,
  Sun,
  Moon,
  AlertTriangle,
} from "lucide-react";
import ModelChat from "@/components/ModelChat";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelChatData {
  modelName: string;
  messages: Message[];
  isLoading: boolean;
}

interface UserSettings {
  ollamaBaseUrl: string;
  persistDataLocally: boolean;
}

interface PersistedChatState {
  selectedModels: string[];
  modelChats: Record<string, ModelChatData>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const normalizeOllamaBaseUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
};

const SETTINGS_STORAGE_KEY = "mmc_settings_v1";
const CHAT_STATE_STORAGE_KEY = "mmc_chat_state_v1";
const ONBOARDING_DONE_STORAGE_KEY = "mmc_onboarding_done_v1";
const DEFAULT_SETTINGS: UserSettings = {
  ollamaBaseUrl: "http://localhost:11434",
  persistDataLocally: true,
};

export default function Home() {
  const { resolvedTheme, setTheme } = useTheme();
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOllamaSetupAlert, setShowOllamaSetupAlert] = useState(false);
  const [didCopyInstallCommand, setDidCopyInstallCommand] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelChats, setModelChats] = useState<Record<string, ModelChatData>>(
    {},
  );
  const [userInput, setUserInput] = useState("");
  const [isAllLoading, setIsAllLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInterModelChatActive, setIsInterModelChatActive] = useState(false);
  const interChatActiveRef = useRef(false);
  const [isInterModelSelected, setIsInterModelSelected] = useState(false);
  const [currentThinkingModel, setCurrentThinkingModel] = useState<string>("");
  const [activeMentionStart, setActiveMentionStart] = useState<number | null>(
    null,
  );
  const [activeMentionEnd, setActiveMentionEnd] = useState<number | null>(null);
  const [activeMentionQuery, setActiveMentionQuery] = useState("");
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startInterModelChatRef = useRef<
    ((seed?: string, modelsOverride?: string[]) => Promise<void>) | null
  >(null);

  const onboardingSteps = useMemo(
    () => [
      {
        title: "Welcome to Multi-Model Chat",
        description:
          "Pick multiple models and compare responses side-by-side in one place.",
      },
      {
        title: "Use @model targeting",
        description:
          "Type @modelname in the input to send a message only to specific selected models.",
      },
      {
        title: "Ollama is required",
        description:
          "This app needs a reachable Ollama server. You can run Ollama locally or use a remote Ollama URL in Settings.",
      },
    ],
    [],
  );

  const apiBaseUrl = useMemo(
    () => normalizeOllamaBaseUrl(settings.ollamaBaseUrl),
    [settings.ollamaBaseUrl],
  );

  useEffect(() => {
    setIsThemeReady(true);
  }, []);

  const parseTaggedModels = useCallback(
    (input: string, modelPool: string[]) => {
      const mentionPattern = /@([^\s@]+)/g;
      const tagged = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = mentionPattern.exec(input)) !== null) {
        const token = match[1]?.toLowerCase();
        if (!token) continue;
        const found = modelPool.find((m) => m.toLowerCase() === token);
        if (found) tagged.add(found);
      }
      return Array.from(tagged);
    },
    [],
  );

  const stripModelTags = useCallback((input: string) => {
    return input
      .replace(/(^|\s)@[^\s@]+/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const updateMentionState = useCallback(
    (input: string, cursorPosition: number | null | undefined) => {
      if (cursorPosition == null || selectedModels.length === 0) {
        setActiveMentionStart(null);
        setActiveMentionEnd(null);
        setActiveMentionQuery("");
        return;
      }

      const beforeCursor = input.slice(0, cursorPosition);
      const match = /(^|\s)@([^\s@]*)$/.exec(beforeCursor);
      if (!match) {
        setActiveMentionStart(null);
        setActiveMentionEnd(null);
        setActiveMentionQuery("");
        return;
      }

      const start = (match.index ?? 0) + match[1].length;
      setActiveMentionStart(start);
      setActiveMentionEnd(cursorPosition);
      setActiveMentionQuery(match[2] ?? "");
    },
    [selectedModels],
  );

  const fetchOllamaModels = useCallback(
    async (showSetupAlertOnFailure: boolean) => {
      if (!apiBaseUrl) {
        setAvailableModels([]);
        setOllamaError("Set a valid Ollama host URL in Settings.");
        if (showSetupAlertOnFailure) setShowOllamaSetupAlert(true);
        return false;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/tags`);
        if (!response.ok) throw new Error("Failed to fetch models");
        const data = await response.json();
        const modelNames = data.models?.map((m: any) => m.name) || [];
        setAvailableModels(modelNames);
        setOllamaError("");
        return true;
      } catch (error) {
        console.error("[v0] Error fetching models:", error);
        setAvailableModels([]);
        setOllamaError(
          `Could not connect to Ollama at ${apiBaseUrl}. Check host and ensure Ollama is running.`,
        );
        if (showSetupAlertOnFailure) setShowOllamaSetupAlert(true);
        return false;
      }
    },
    [apiBaseUrl],
  );

  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Partial<UserSettings>;
        setSettings({
          ollamaBaseUrl:
            typeof parsed.ollamaBaseUrl === "string" &&
            normalizeOllamaBaseUrl(parsed.ollamaBaseUrl)
              ? normalizeOllamaBaseUrl(parsed.ollamaBaseUrl)
              : DEFAULT_SETTINGS.ollamaBaseUrl,
          persistDataLocally:
            typeof parsed.persistDataLocally === "boolean"
              ? parsed.persistDataLocally
              : DEFAULT_SETTINGS.persistDataLocally,
        });
      }

      const rawChatState = localStorage.getItem(CHAT_STATE_STORAGE_KEY);
      if (rawChatState) {
        const parsed = JSON.parse(rawChatState) as Partial<PersistedChatState>;
        const loadedSelected = Array.isArray(parsed.selectedModels)
          ? parsed.selectedModels.filter((v): v is string => typeof v === "string")
          : [];
        const loadedChats =
          parsed.modelChats && typeof parsed.modelChats === "object"
            ? parsed.modelChats
            : {};
        setSelectedModels(loadedSelected);
        setModelChats(loadedChats);
      }

      const onboardingDone =
        localStorage.getItem(ONBOARDING_DONE_STORAGE_KEY) === "true";
      if (!onboardingDone) {
        setIsOnboardingOpen(true);
        setOnboardingStep(0);
      }
    } catch (error) {
      console.error("[v0] Failed to load saved settings/state:", error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!settings.persistDataLocally) {
      localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
      return;
    }

    const payload: PersistedChatState = {
      selectedModels,
      modelChats,
    };
    localStorage.setItem(CHAT_STATE_STORAGE_KEY, JSON.stringify(payload));
  }, [isHydrated, settings.persistDataLocally, selectedModels, modelChats]);

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

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) =>
          console.error("[v0] Failed to register service worker:", error),
        );
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker);
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

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

  const clearPersistedData = useCallback(() => {
    localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
    setSelectedModels([]);
    setModelChats({});
    setUserInput("");
  }, []);

  const installPwa = useCallback(async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    setCanInstallPwa(false);
  }, [installPromptEvent]);

  const copyInstallCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("ollama pull llama3.2");
      setDidCopyInstallCommand(true);
      setTimeout(() => setDidCopyInstallCommand(false), 1500);
    } catch {
      setDidCopyInstallCommand(false);
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    localStorage.setItem(ONBOARDING_DONE_STORAGE_KEY, "true");
    setIsOnboardingOpen(false);
    setOnboardingStep(0);
    await fetchOllamaModels(true);
  }, [fetchOllamaModels]);

  // Keep model list synced with current Ollama URL
  useEffect(() => {
    fetchOllamaModels(false);
  }, [fetchOllamaModels]);

  useEffect(() => {
    interChatActiveRef.current = isInterModelChatActive;
  }, [isInterModelChatActive]);

  const removeModel = useCallback((model: string) => {
    setSelectedModels((prev) => prev.filter((m) => m !== model));
    setModelChats((prev) => {
      const updated = { ...prev };
      delete updated[model];
      return updated;
    });
  }, []);

  const toggleModel = useCallback(
    (model: string) => {
      if (isInterModelSelected || isInterModelChatActive) return;
      if (selectedModels.includes(model)) {
        // Remove if already selected
        removeModel(model);
      } else {
        // Add if not selected
        setSelectedModels((prev) => [...prev, model]);
        setModelChats((prev) => ({
          ...prev,
          [model]: {
            modelName: model,
            messages: [],
            isLoading: false,
          },
        }));
      }
    },
    [selectedModels, removeModel, isInterModelSelected, isInterModelChatActive],
  );

  const sendMessage = useCallback(async () => {
    if (!userInput.trim() || selectedModels.length === 0) return;
    if (!apiBaseUrl) {
      setOllamaError("Set a valid Ollama host URL in Settings.");
      return;
    }

    const taggedModels = parseTaggedModels(userInput, selectedModels);
    const targetModels =
      taggedModels.length > 0 ? taggedModels : [...selectedModels];
    const messageContent = stripModelTags(userInput);
    if (!messageContent) return;

    setUserInput("");
    setActiveMentionStart(null);
    setActiveMentionEnd(null);
    setActiveMentionQuery("");
    setIsAllLoading(true);

    if (isInterModelSelected) {
      const firstModel = targetModels[0];
      setModelChats((prev) => {
        const updated = { ...prev };
        const current = updated[firstModel] || {
          modelName: firstModel,
          messages: [],
          isLoading: false,
        };
        updated[firstModel] = {
          ...current,
          messages: [
            ...current.messages,
            { role: "user", content: messageContent },
          ],
          isLoading: true,
        };
        return updated;
      });
      setIsInterModelSelected(false);
      if (startInterModelChatRef.current) {
        await startInterModelChatRef.current(messageContent, targetModels);
      }
      setIsAllLoading(false);
      return;
    }

    // Add user message to all model chats
    setModelChats((prev) => {
      const updated = { ...prev };
      targetModels.forEach((model) => {
        updated[model] = {
          ...updated[model],
          messages: [
            ...updated[model].messages,
            { role: "user", content: messageContent },
          ],
          isLoading: true,
        };
      });
      return updated;
    });

    // Send message to all models in parallel
    const promises = targetModels.map(async (model) => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            prompt: messageContent,
            stream: false,
          }),
        });

        if (!response.ok)
          throw new Error(`Failed to get response from ${model}`);
        const data = await response.json();

        // Add assistant response
        setModelChats((prev) => ({
          ...prev,
          [model]: {
            ...prev[model],
            messages: [
              ...prev[model].messages,
              { role: "assistant", content: data.response },
            ],
            isLoading: false,
          },
        }));
      } catch (error) {
        console.error(`[v0] Error with model ${model}:`, error);
        setModelChats((prev) => ({
          ...prev,
          [model]: {
            ...prev[model],
            messages: [
              ...prev[model].messages,
              {
                role: "assistant",
                content: `Error: Could not get response from ${model}`,
              },
            ],
            isLoading: false,
          },
        }));
      }
    });

    await Promise.all(promises);
    setIsAllLoading(false);
  }, [
    userInput,
    selectedModels,
    isInterModelSelected,
    parseTaggedModels,
    stripModelTags,
    apiBaseUrl,
  ]);

  const mentionSuggestions = useMemo(() => {
    const query = activeMentionQuery.toLowerCase();
    return selectedModels.filter((model) =>
      model.toLowerCase().includes(query),
    );
  }, [selectedModels, activeMentionQuery]);

  const isMentionOpen =
    activeMentionStart !== null &&
    activeMentionEnd !== null &&
    mentionSuggestions.length > 0 &&
    !isAllLoading &&
    !isInterModelChatActive;

  useEffect(() => {
    setMentionHighlightIndex(0);
  }, [activeMentionQuery, selectedModels.length]);

  const insertMention = useCallback(
    (model: string) => {
      if (activeMentionStart === null || activeMentionEnd === null) return;

      const nextValue =
        userInput.slice(0, activeMentionStart) +
        `@${model} ` +
        userInput.slice(activeMentionEnd);
      setUserInput(nextValue);
      setActiveMentionStart(null);
      setActiveMentionEnd(null);
      setActiveMentionQuery("");

      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const cursorPos = activeMentionStart + model.length + 2;
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
        handleAutoResize(el);
      });
    },
    [activeMentionStart, activeMentionEnd, userInput],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlightIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlightIndex(
          (prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionSuggestions[mentionHighlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActiveMentionStart(null);
        setActiveMentionEnd(null);
        setActiveMentionQuery("");
        return;
      }
    }

    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !isAllLoading &&
      selectedModels.length > 0
    ) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAutoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  };

  const getLastMessageOfRole = useCallback(
    (model: string, role: Message["role"]) => {
      const msgs = modelChats[model]?.messages || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === role) return msgs[i].content;
      }
      return "";
    },
    [modelChats],
  );

  const getLastUserMessageAny = useCallback(() => {
    for (const m of selectedModels) {
      const content = getLastMessageOfRole(m, "user");
      if (content) return content;
    }
    return "";
  }, [selectedModels, getLastMessageOfRole]);

  const getLastAssistantMessageAny = useCallback(() => {
    for (const m of selectedModels) {
      const content = getLastMessageOfRole(m, "assistant");
      if (content) return content;
    }
    return "";
  }, [selectedModels, getLastMessageOfRole]);

  const startInterModelChat = useCallback(
    async (seedOverride?: string, modelsOverride?: string[]) => {
      if (!apiBaseUrl) {
        setOllamaError("Set a valid Ollama host URL in Settings.");
        return;
      }
      const modelsToUse =
        modelsOverride && modelsOverride.length > 0
          ? modelsOverride
          : selectedModels;
      if (modelsToUse.length < 2) return;
      let seed =
        (seedOverride ?? getLastAssistantMessageAny()) ||
        getLastUserMessageAny();
      if (!seed) return;
      setIsInterModelChatActive(true);
      interChatActiveRef.current = true;
      let currentIndex = 0;
      while (interChatActiveRef.current) {
        const model = modelsToUse[currentIndex];
        setCurrentThinkingModel(model);
        try {
          setModelChats((prev) => ({
            ...prev,
            [model]: {
              ...prev[model],
              isLoading: true,
            },
          }));
          const response = await fetch(`${apiBaseUrl}/api/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              prompt: seed,
              stream: false,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            const ai =
              typeof data.response === "string"
                ? data.response
                : String(data.response || "");
            seed = ai;
            setModelChats((prev) => ({
              ...prev,
              [model]: {
                ...prev[model],
                messages: [
                  ...prev[model].messages,
                  { role: "assistant", content: ai },
                ],
                isLoading: false,
              },
            }));
          } else {
            setModelChats((prev) => ({
              ...prev,
              [model]: {
                ...prev[model],
                messages: [
                  ...prev[model].messages,
                  {
                    role: "assistant",
                    content: `Error: Could not get response from ${model}`,
                  },
                ],
                isLoading: false,
              },
            }));
          }
        } catch {
          setModelChats((prev) => ({
            ...prev,
            [model]: {
              ...prev[model],
              messages: [
                ...prev[model].messages,
                {
                  role: "assistant",
                  content: `Error: Could not get response from ${model}`,
                },
              ],
              isLoading: false,
            },
          }));
        }
        currentIndex = (currentIndex + 1) % modelsToUse.length;
        await new Promise((r) => setTimeout(r, 400));
      }
      setCurrentThinkingModel("");
    },
    [
      selectedModels,
      getLastAssistantMessageAny,
      getLastUserMessageAny,
      apiBaseUrl,
    ],
  );

  const stopInterModelChat = useCallback(() => {
    setIsInterModelChatActive(false);
    interChatActiveRef.current = false;
  }, []);

  useEffect(() => {
    startInterModelChatRef.current = startInterModelChat;
  }, [startInterModelChat]);

  const taggedSelectedModels = useMemo(
    () => parseTaggedModels(userInput, selectedModels),
    [userInput, selectedModels, parseTaggedModels],
  );
  const isLastOnboardingStep = onboardingStep === onboardingSteps.length - 1;

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
          <h1 className="text-xs font-semibold tracking-wide text-foreground">
            Multi-Model Chat
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTheme(
                  (isThemeReady ? resolvedTheme : "dark") === "dark"
                    ? "light"
                    : "dark",
                )
              }
              className="h-8 w-8 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors inline-flex items-center justify-center"
              aria-label="Toggle theme"
            >
              {(isThemeReady ? resolvedTheme : "dark") === "dark" ? (
                <Sun className="h-4 w-4 text-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-foreground" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="h-8 w-8 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors inline-flex items-center justify-center"
              aria-label="Open settings"
            >
              <Settings2 className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-x-auto overflow-y-hidden flex gap-3 p-3 md:gap-4 md:p-4 bg-gradient-to-b from-background to-background ${
          selectedModels.length === 1 ? "justify-center" : ""
        }`}
      >
        {selectedModels.length > 0 ? (
          selectedModels.map((model) => (
            <div
              key={model}
              className={`flex-shrink-0 ${
                selectedModels.length === 1
                  ? "w-full max-w-[600px]"
                  : "w-[600px] max-w-[calc(100vw-1.5rem)]"
              }`}
            >
              <ModelChat
                model={model}
                chat={
                  modelChats[model] || {
                    modelName: model,
                    messages: [],
                    isLoading: false,
                  }
                }
                onRemove={() => removeModel(model)}
                disableRemove={isInterModelChatActive}
              />
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Multi-Model Chat
              </h2>
              {ollamaError ? (
                <div className="mb-8 max-w-md flex flex-col items-center gap-3">
                  <p className="text-muted-foreground">
                    Unable to connect to Ollama. Open config to set your Ollama URL
                    or follow setup steps.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-foreground/40 hover:border-foreground/60"
                    onClick={() => setShowOllamaSetupAlert(true)}
                  >
                    Open Config
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground mb-8 max-w-md">
                  Select one or more models from the list below to start comparing responses side-by-side.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background px-3 py-2 md:px-4 md:py-3">
        <div className="max-w-7xl mx-auto space-y-2">
          <div
            className={`${selectedModels.length === 1 ? "max-w-none" : "max-w-2xl"} w-full mx-auto flex gap-1.5 flex-wrap justify-center ${isInterModelChatActive ? "opacity-50 pointer-events-none" : ""}`}
          >
            {availableModels.map((model) => {
              const isSelected = selectedModels.includes(model);
              return (
                <button
                  key={model}
                  onClick={() => toggleModel(model)}
                  className={`px-2.5 py-0.5 rounded-full border text-xs transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted/40"
                  }`}
                  aria-label={`Toggle ${model}`}
                >
                  {model}
                </button>
              );
            })}
          </div>

          {selectedModels.length > 0 && (
            <div className="max-w-2xl w-full mx-auto flex gap-1.5 items-center relative">
              {/* Inter-model button always visible if input area is visible (1+ models) */}
              <TooltipProvider>
                <Tooltip open={isInterModelChatActive || undefined}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        // Allow clicking if we are in inter-model chat (to stop it), even if loading
                        if (isAllLoading && !isInterModelChatActive) return;

                        if (isInterModelChatActive) {
                          stopInterModelChat();
                          setIsInterModelSelected(false);
                        } else if (isInterModelSelected) {
                          setIsInterModelSelected(false);
                        } else {
                          if (selectedModels.length < 2) return;
                          setIsInterModelSelected(true);
                        }
                      }}
                      // Only disable for loading if NOT in inter-model chat (so we can stop it)
                      disabled={isAllLoading && !isInterModelChatActive}
                      className={`relative w-9 h-9 rounded-full border flex items-center justify-center overflow-hidden transition-all duration-300 ${
                        isInterModelChatActive
                          ? "bg-background border-violet-300/60 text-white shadow-[0_0_18px_rgba(124,58,237,0.35)] hover:border-red-400"
                          : isInterModelSelected
                            ? "bg-background border-violet-200/60 text-white shadow-[0_0_10px_rgba(124,58,237,0.22)]"
                            : selectedModels.length < 2
                              ? "opacity-50 cursor-not-allowed bg-background border-border text-muted-foreground"
                              : "bg-background border-violet-100/50 text-white/90 hover:border-violet-200/70 disabled:opacity-40 disabled:cursor-not-allowed"
                      }`}
                      aria-label="Inter-model communication"
                    >
                      <span
                        className={`absolute inset-0 rounded-full transition-all duration-300 ${
                          isInterModelChatActive
                            ? "bg-[conic-gradient(from_220deg_at_50%_50%,#60a5fa_0deg,#818cf8_110deg,#a78bfa_210deg,#f472b6_300deg,#60a5fa_360deg)] opacity-95 animate-pulse"
                            : isInterModelSelected
                              ? "bg-[conic-gradient(from_220deg_at_50%_50%,#7dd3fc_0deg,#818cf8_140deg,#c4b5fd_240deg,#f9a8d4_320deg,#7dd3fc_360deg)] opacity-85"
                              : "bg-[conic-gradient(from_220deg_at_50%_50%,#bae6fd_0deg,#c7d2fe_160deg,#e9d5ff_260deg,#fbcfe8_340deg,#bae6fd_360deg)] opacity-65"
                        }`}
                      />
                      <span
                        className={`absolute -inset-2 rounded-full blur-md transition-all ${
                          isInterModelChatActive
                            ? "bg-[radial-gradient(circle,#8b5cf6_0%,rgba(59,130,246,0.35)_45%,transparent_80%)] opacity-80"
                            : isInterModelSelected
                              ? "bg-[radial-gradient(circle,#8b5cf6_0%,rgba(59,130,246,0.2)_45%,transparent_80%)] opacity-60"
                              : "bg-[radial-gradient(circle,#a78bfa_0%,rgba(59,130,246,0.12)_45%,transparent_80%)] opacity-45"
                        }`}
                      />
                      <MessagesSquare className="w-3.5 h-3.5 relative z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {selectedModels.length < 2
                      ? "Select at least 2 models for inter-model communication"
                      : isInterModelChatActive
                        ? `Inter-model active. Click to stop. Thinking: ${currentThinkingModel || "..."}`
                        : isInterModelSelected
                          ? "Inter-model: Selected (send to start)"
                          : "Inter-model: Off"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="relative flex-1">
                <Textarea
                  placeholder="Ask something... (use @model to target one or more selected models)"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    updateMentionState(e.target.value, e.target.selectionStart);
                    handleAutoResize(e.target);
                  }}
                  onSelect={(e) => {
                    updateMentionState(
                      e.currentTarget.value,
                      e.currentTarget.selectionStart,
                    );
                  }}
                  onClick={(e) => {
                    updateMentionState(
                      e.currentTarget.value,
                      e.currentTarget.selectionStart,
                    );
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setActiveMentionStart(null);
                      setActiveMentionEnd(null);
                      setActiveMentionQuery("");
                    }, 120);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isAllLoading || isInterModelChatActive}
                  className="flex-1 bg-card border border-border text-sm px-3 py-1.5 rounded-md resize-none min-h-[38px]"
                  rows={1}
                  ref={(el) => {
                    textareaRef.current = el;
                    handleAutoResize(el);
                  }}
                />
                {isMentionOpen && (
                  <div className="absolute z-30 left-0 bottom-full mb-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                    {mentionSuggestions.map((model, idx) => (
                      <button
                        key={model}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(model);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          idx === mentionHighlightIndex
                            ? "bg-accent text-accent-foreground"
                            : "bg-popover text-popover-foreground hover:bg-accent/60"
                        }`}
                      >
                        <span className="text-muted-foreground">@</span>
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={sendMessage}
                disabled={
                  isAllLoading ||
                  isInterModelChatActive ||
                  selectedModels.length === 0 ||
                  !userInput.trim()
                }
                aria-label="Send message"
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] transition-all shrink-0"
              >
                {isAllLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {selectedModels.length > 0 && taggedSelectedModels.length > 0 && (
            <div className="max-w-2xl w-full mx-auto flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Tagged models:
              </span>
              {taggedSelectedModels.map((model) => (
                <span
                  key={model}
                  className="px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[11px]"
                >
                  {model}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent
          side="right"
          className="w-[320px] max-w-[85vw] px-5 sm:px-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="space-y-3">
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>
              Configure Ollama host, persistence, and app install options.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-7 space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="ollama-host"
                className="text-xs font-medium text-muted-foreground"
              >
                Ollama Host URL
              </label>
              <input
                id="ollama-host"
                type="text"
                value={settings.ollamaBaseUrl}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    ollamaBaseUrl: e.target.value,
                  }))
                }
                onBlur={() =>
                  setSettings((prev) => ({
                    ...prev,
                    ollamaBaseUrl:
                      normalizeOllamaBaseUrl(prev.ollamaBaseUrl) ||
                      DEFAULT_SETTINGS.ollamaBaseUrl,
                  }))
                }
                placeholder="http://localhost:11434"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active host: <code>{apiBaseUrl || "not set"}</code>
              </p>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.persistDataLocally}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      persistDataLocally: e.target.checked,
                    }))
                  }
                />
                <span>
                  Persist selected models and chats in browser local storage
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchOllamaModels(true)}
              >
                Test connection
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearPersistedData}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear saved chats
              </Button>

              {canInstallPwa && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={installPwa}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Install app
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isOnboardingOpen}>
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{onboardingSteps[onboardingStep].title}</DialogTitle>
            <DialogDescription>
              {onboardingSteps[onboardingStep].description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Step {onboardingStep + 1} of {onboardingSteps.length}
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${((onboardingStep + 1) / onboardingSteps.length) * 100}%`,
                }}
              />
            </div>

            {onboardingStep === onboardingSteps.length - 1 && (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
                If Ollama is not running locally, open Settings and set a remote
                Ollama URL.
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                if (onboardingStep === 0) return;
                setOnboardingStep((prev) => Math.max(0, prev - 1));
              }}
              disabled={onboardingStep === 0}
            >
              Back
            </Button>

            <Button
              onClick={() => {
                if (isLastOnboardingStep) {
                  completeOnboarding();
                  return;
                }
                setOnboardingStep((prev) =>
                  Math.min(onboardingSteps.length - 1, prev + 1),
                );
              }}
            >
              {isLastOnboardingStep ? "Finish" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showOllamaSetupAlert} onOpenChange={setShowOllamaSetupAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <AlertDialogTitle>Unable to connect to Ollama</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This app requires a reachable Ollama server before chats can run.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Current Ollama URL</p>
              <code className="text-sm">{apiBaseUrl || "Not configured"}</code>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Setup steps</p>
              <p>
                1. Install Ollama:{" "}
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  ollama.com/download
                </a>
              </p>
              <p>2. Open the Ollama app if it is already installed</p>
              <p>3. Start Ollama on your machine</p>
              <p className="flex items-center gap-2 flex-wrap">
                <span>
                  4. Pull a model: <code>ollama pull llama3.2</code>
                </span>
                <button
                  type="button"
                  onClick={copyInstallCommand}
                  className="h-6 w-6 rounded border border-border inline-flex items-center justify-center hover:bg-muted transition-colors"
                  aria-label="Copy command"
                >
                  {didCopyInstallCommand ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </p>
              <p>5. If using remote server, set its URL in Settings</p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsSettingsOpen(true);
                setShowOllamaSetupAlert(false);
              }}
            >
              Open Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
