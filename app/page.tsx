"use client";

import React from "react";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
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
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
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
  enableRoles: boolean;
  allowSameModelMultiChat: boolean;
}

interface PersistedChatState {
  selectedModels: string[];
  modelChats: Record<string, ModelChatData>;
  modelRoles?: Record<string, string>;
  roleLibrary?: string[];
}

interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "text";
  textContent?: string;
  base64Content?: string;
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

const SETTINGS_STORAGE_KEY = "multi_llama_settings_v1";
const CHAT_STATE_STORAGE_KEY = "multi_llama_chat_state_v1";
const ONBOARDING_DONE_STORAGE_KEY = "multi_llama_onboarding_done_v1";
const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DEFAULT_ROLE = "general";
const MODEL_INSTANCE_DELIMITER = "::instance::";
const BUILT_IN_ROLES = [
  "general",
  "tester",
  "designer",
  "pm",
  "developer",
  "reviewer",
  "architect",
  "analyst",
];
const DEFAULT_SETTINGS: UserSettings = {
  ollamaBaseUrl: "http://localhost:11434",
  persistDataLocally: true,
  enableRoles: true,
  allowSameModelMultiChat: false,
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
  const [modelRoles, setModelRoles] = useState<Record<string, string>>({});
  const [roleLibrary, setRoleLibrary] = useState<string[]>(BUILT_IN_ROLES);
  const [userInput, setUserInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const modelCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const startInterModelChatRef = useRef<
    ((seed?: string, modelsOverride?: string[]) => Promise<void>) | null
  >(null);

  const onboardingSteps = useMemo(
    () => [
      {
        title: "Welcome to Multi Llama Chat",
        description:
          "Select multiple models and compare their responses side by side in one place.",
      },
      {
        title: "Use @model targeting",
        description:
          "Type @modelname in the input box to send a message only to specific selected models.",
      },
      {
        title: "Assign roles to models",
        description:
          "Click a model's role chip (for example, tester, designer, or product manager) to define how each model should behave during collaboration.",
      },
      {
        title: "Ollama is required",
        description:
          "This app requires a reachable Ollama server. You can run Ollama locally or configure a remote Ollama URL in Settings.",
      },
    ],
    [],
  );

  const apiBaseUrl = useMemo(
    () => normalizeOllamaBaseUrl(settings.ollamaBaseUrl),
    [settings.ollamaBaseUrl],
  );

  const getBaseModelName = useCallback((modelKey: string) => {
    const idx = modelKey.indexOf(MODEL_INSTANCE_DELIMITER);
    return idx === -1 ? modelKey : modelKey.slice(0, idx);
  }, []);

  const createModelInstanceKey = useCallback((modelName: string) => {
    return `${modelName}${MODEL_INSTANCE_DELIMITER}${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }, []);

  useEffect(() => {
    setIsThemeReady(true);
  }, []);

  const parseTaggedModels = useCallback(
    (input: string, modelPool: string[]) => {
      const mentionPattern = /@([^\s@]+)/g;
      const tagged = new Set<string>();
      let match: RegExpExecArray | null;

      const baseToInstances = new Map<string, string[]>();
      modelPool.forEach((modelKey) => {
        const base = getBaseModelName(modelKey).toLowerCase();
        const list = baseToInstances.get(base) || [];
        list.push(modelKey);
        baseToInstances.set(base, list);
      });

      while ((match = mentionPattern.exec(input)) !== null) {
        const token = (match[1] || "").trim();
        if (!token) continue;

        const specificMatch = /^(.+?)#(\d+)$/i.exec(token);
        if (specificMatch) {
          const base = specificMatch[1].toLowerCase();
          const index = Number.parseInt(specificMatch[2], 10);
          if (!base || !Number.isFinite(index) || index < 1) continue;
          const instances = baseToInstances.get(base) || [];
          const target = instances[index - 1];
          if (target) tagged.add(target);
          continue;
        }

        const instances = baseToInstances.get(token.toLowerCase()) || [];
        instances.forEach((modelKey) => tagged.add(modelKey));
      }
      return Array.from(tagged);
    },
    [getBaseModelName],
  );

  const stripModelTags = useCallback((input: string) => {
    return input
      .replace(/(^|\s)@[^\s@]+/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const buildPromptForModel = useCallback(
    (model: string, prompt: string) => {
      if (!settings.enableRoles) return prompt;
      const role = (modelRoles[model] || DEFAULT_ROLE).trim().toLowerCase();
      if (!role || role === DEFAULT_ROLE) return prompt;
      return `Role: ${role}\nInstructions: You must answer as a ${role} and stay consistent with this role.\n\n${prompt}`;
    },
    [modelRoles, settings.enableRoles],
  );

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleAttachmentPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const maxSizeBytes = 8 * 1024 * 1024;
      const next: Attachment[] = [];

      for (const file of Array.from(files)) {
        if (file.size > maxSizeBytes) continue;
        const isImage = file.type.startsWith("image/");
        const isText = file.type === "text/plain" || file.name.endsWith(".txt");
        if (!isImage && !isText) continue;

        if (isImage) {
          const dataUrl = await readFileAsDataUrl(file);
          const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
          if (!base64) continue;
          next.push({
            id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            mimeType: file.type || "image/png",
            kind: "image",
            base64Content: base64,
          });
          continue;
        }

        const text = await readFileAsText(file);
        next.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: file.type || "text/plain",
          kind: "text",
          textContent: text.slice(0, 12000),
        });
      }

      if (next.length > 0) {
        setAttachments((prev) => [...prev, ...next]);
      }
    },
    [],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
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

  const generateWithOllama = useCallback(
    async (model: string, prompt: string, imageBase64List: string[] = []) => {
      const request = async (
        endpoint: "generate" | "chat",
        body: Record<string, unknown>,
      ) => {
        const response = await fetch(`${apiBaseUrl}/api/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const raw = await response.text();
        let data: any = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { error: raw };
        }

        if (!response.ok) {
          const reason = data?.error || data?.message || `HTTP ${response.status}`;
          throw new Error(`${reason} [${apiBaseUrl}/api/${endpoint}]`);
        }

        return data;
      };

      try {
        const data = await request("generate", {
          model: model.trim(),
          prompt,
          ...(imageBase64List.length > 0 ? { images: imageBase64List } : {}),
          stream: false,
        });
        return typeof data.response === "string"
          ? data.response
          : String(data.response || "");
      } catch {
        const data = await request("chat", {
          model: model.trim(),
          messages: [
            {
              role: "user",
              content: prompt,
              ...(imageBase64List.length > 0 ? { images: imageBase64List } : {}),
            },
          ],
          stream: false,
        });
        return typeof data?.message?.content === "string"
          ? data.message.content
          : String(data?.message?.content || "");
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
          enableRoles:
            typeof parsed.enableRoles === "boolean"
              ? parsed.enableRoles
              : DEFAULT_SETTINGS.enableRoles,
          allowSameModelMultiChat:
            typeof parsed.allowSameModelMultiChat === "boolean"
              ? parsed.allowSameModelMultiChat
              : DEFAULT_SETTINGS.allowSameModelMultiChat,
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
        const loadedRoles =
          parsed.modelRoles && typeof parsed.modelRoles === "object"
            ? parsed.modelRoles
            : {};
        const loadedRoleLibrary = Array.isArray(parsed.roleLibrary)
          ? parsed.roleLibrary.filter(
              (v): v is string => typeof v === "string" && !!v.trim(),
            )
          : [];
        setSelectedModels(loadedSelected);
        setModelChats(loadedChats);
        setModelRoles(loadedRoles);
        if (loadedRoleLibrary.length > 0) {
          setRoleLibrary(Array.from(new Set([...BUILT_IN_ROLES, ...loadedRoleLibrary])));
        }
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
      modelRoles,
      roleLibrary,
    };
    localStorage.setItem(CHAT_STATE_STORAGE_KEY, JSON.stringify(payload));
  }, [
    isHydrated,
    settings.persistDataLocally,
    selectedModels,
    modelChats,
    modelRoles,
    roleLibrary,
  ]);

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
        .register(`${PUBLIC_BASE_PATH}/sw.js`)
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
    setModelRoles({});
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

  const handleTestConnection = useCallback(async () => {
    const toastId = toast.loading("Testing Ollama connection...");
    const ok = await fetchOllamaModels(false);
    if (ok) {
      toast.success("Connected to Ollama successfully.", { id: toastId });
      return;
    }
    toast.error(`Unable to connect to ${apiBaseUrl || "configured host"}.`, {
      id: toastId,
    });
  }, [fetchOllamaModels, apiBaseUrl]);

  // Keep model list synced with current Ollama URL
  useEffect(() => {
    fetchOllamaModels(false);
  }, [fetchOllamaModels]);

  useEffect(() => {
    interChatActiveRef.current = isInterModelChatActive;
  }, [isInterModelChatActive]);

  const removeModel = useCallback((modelKey: string) => {
    setSelectedModels((prev) => prev.filter((m) => m !== modelKey));
    setModelChats((prev) => {
      const updated = { ...prev };
      delete updated[modelKey];
      return updated;
    });
    setModelRoles((prev) => {
      const updated = { ...prev };
      delete updated[modelKey];
      return updated;
    });
  }, []);

  const addModelInstance = useCallback(
    (modelName: string) => {
      const modelKey = createModelInstanceKey(modelName);
      setSelectedModels((prev) => [...prev, modelKey]);
      setModelChats((prev) => ({
        ...prev,
        [modelKey]: {
          modelName,
          messages: [],
          isLoading: false,
        },
      }));
      setModelRoles((prev) => ({
        ...prev,
        [modelKey]: prev[modelKey] || DEFAULT_ROLE,
      }));
    },
    [createModelInstanceKey],
  );

  const duplicateModelInstance = useCallback(
    (modelKey: string) => {
      const sourceChat = modelChats[modelKey];
      if (!sourceChat) return;
      const baseModel = getBaseModelName(modelKey);
      const clonedKey = createModelInstanceKey(baseModel);

      setSelectedModels((prev) => [...prev, clonedKey]);
      setModelChats((prev) => ({
        ...prev,
        [clonedKey]: {
          modelName: baseModel,
          messages: (prev[modelKey]?.messages || []).map((m) => ({ ...m })),
          isLoading: false,
        },
      }));
      setModelRoles((prev) => ({
        ...prev,
        [clonedKey]: prev[modelKey] || DEFAULT_ROLE,
      }));
    },
    [modelChats, getBaseModelName, createModelInstanceKey],
  );

  const toggleModel = useCallback(
    (modelName: string) => {
      if (isInterModelSelected || isInterModelChatActive) return;
      const selectedForBase = selectedModels.filter(
        (modelKey) => getBaseModelName(modelKey) === modelName,
      );
      if (selectedForBase.length > 0) {
        // Toggle off removes all instances for this model name.
        selectedForBase.forEach((modelKey) => removeModel(modelKey));
      } else {
        addModelInstance(modelName);
      }
    },
    [
      selectedModels,
      removeModel,
      addModelInstance,
      getBaseModelName,
      isInterModelSelected,
      isInterModelChatActive,
    ],
  );

  const updateModelRole = useCallback((model: string, role: string) => {
    const normalized = role.trim().toLowerCase() || DEFAULT_ROLE;
    setModelRoles((prev) => ({
      ...prev,
      [model]: normalized,
    }));
    setRoleLibrary((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized],
    );
  }, []);

  const sendMessage = useCallback(async () => {
    if ((!userInput.trim() && attachments.length === 0) || selectedModels.length === 0)
      return;
    if (!apiBaseUrl) {
      setOllamaError("Set a valid Ollama host URL in Settings.");
      return;
    }

    const taggedModels = parseTaggedModels(userInput, selectedModels);
    const targetModels =
      taggedModels.length > 0 ? taggedModels : [...selectedModels];
    const messageContent = stripModelTags(userInput);
    const textAttachments = attachments.filter((item) => item.kind === "text");
    const imageAttachments = attachments.filter((item) => item.kind === "image");
    const textAttachmentBlock =
      textAttachments.length > 0
        ? `\n\nAttached text files:\n${textAttachments
            .map(
              (item) =>
                `\n[${item.name}]\n${item.textContent || "(empty file)"}`,
            )
            .join("\n")}`
        : "";
    const imageContextBlock =
      imageAttachments.length > 0
        ? `\n\nAttached images: ${imageAttachments.map((item) => item.name).join(", ")}`
        : "";
    const mergedUserPrompt = `${messageContent}${textAttachmentBlock}${imageContextBlock}`.trim();
    if (!mergedUserPrompt && imageAttachments.length === 0) return;
    const userMessageForUi =
      messageContent ||
      [
        textAttachments.length > 0
          ? `${textAttachments.length} text file${textAttachments.length > 1 ? "s" : ""}`
          : "",
        imageAttachments.length > 0
          ? `${imageAttachments.length} image${imageAttachments.length > 1 ? "s" : ""}`
          : "",
      ]
        .filter(Boolean)
        .join(" + ");
    const imagePayload = imageAttachments
      .map((item) => item.base64Content || "")
      .filter(Boolean);

    setUserInput("");
    setAttachments([]);
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
            { role: "user", content: userMessageForUi },
          ],
          isLoading: true,
        };
        return updated;
      });
      setIsInterModelSelected(false);
      if (startInterModelChatRef.current) {
        await startInterModelChatRef.current(mergedUserPrompt, targetModels);
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
            { role: "user", content: userMessageForUi },
          ],
          isLoading: true,
        };
      });
      return updated;
    });

    // Send message to all models in parallel
    const promises = targetModels.map(async (model) => {
      try {
        const ai = await generateWithOllama(
          getBaseModelName(model),
          buildPromptForModel(model, mergedUserPrompt),
          imagePayload,
        );

        // Add assistant response
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
      } catch (error) {
        console.error(`[v0] Error with model ${model}:`, error);
        const detail =
          error instanceof Error ? error.message : "Unknown error";
        setModelChats((prev) => ({
          ...prev,
          [model]: {
            ...prev[model],
            messages: [
              ...prev[model].messages,
              {
                role: "assistant",
                content: `Error: Could not get response from ${getBaseModelName(model)}. ${detail}`,
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
    attachments,
    selectedModels,
    isInterModelSelected,
    parseTaggedModels,
    stripModelTags,
    apiBaseUrl,
    generateWithOllama,
    getBaseModelName,
    buildPromptForModel,
  ]);

  const mentionSuggestions = useMemo(() => {
    const query = activeMentionQuery.toLowerCase();
    const counts: Record<string, number> = {};
    selectedModels.forEach((modelKey) => {
      const base = getBaseModelName(modelKey);
      counts[base] = (counts[base] || 0) + 1;
    });

    const tokens: string[] = [];
    Object.entries(counts).forEach(([base, count]) => {
      tokens.push(base);
      if (count > 1) {
        for (let i = 1; i <= count; i += 1) {
          tokens.push(`${base}#${i}`);
        }
      }
    });

    return tokens.filter((token) => token.toLowerCase().includes(query));
  }, [selectedModels, activeMentionQuery, getBaseModelName]);

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
      !isInterModelChatActive &&
      selectedModels.length > 0 &&
      (userInput.trim().length > 0 || attachments.length > 0)
    ) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAutoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 160;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const ensureModelCardVisible = useCallback((model: string) => {
    const container = containerRef.current;
    const card = modelCardRefs.current[model];
    if (!container || !card) return;
    const gutter = 20;
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    let delta = 0;
    if (cardRect.left < containerRect.left + gutter) {
      delta = cardRect.left - (containerRect.left + gutter);
    } else if (cardRect.right > containerRect.right - gutter) {
      delta = cardRect.right - (containerRect.right - gutter);
    }
    if (delta !== 0) {
      container.scrollTo({
        left: container.scrollLeft + delta,
        behavior: "smooth",
      });
    }
  }, []);

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
          const ai = await generateWithOllama(
            getBaseModelName(model),
            buildPromptForModel(model, seed),
          );
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
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : "Unknown error";
          setModelChats((prev) => ({
            ...prev,
            [model]: {
              ...prev[model],
              messages: [
                ...prev[model].messages,
                {
                  role: "assistant",
                  content: `Error: Could not get response from ${getBaseModelName(model)}. ${detail}`,
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
      generateWithOllama,
      getBaseModelName,
      buildPromptForModel,
    ],
  );

  const stopInterModelChat = useCallback(() => {
    setIsInterModelChatActive(false);
    interChatActiveRef.current = false;
  }, []);

  useEffect(() => {
    startInterModelChatRef.current = startInterModelChat;
  }, [startInterModelChat]);

  useEffect(() => {
    if (!currentThinkingModel) return;
    ensureModelCardVisible(currentThinkingModel);
  }, [currentThinkingModel, ensureModelCardVisible]);

  useEffect(() => {
    if (settings.allowSameModelMultiChat) return;
    const seen = new Set<string>();
    const deduped = selectedModels.filter((modelKey) => {
      const base = getBaseModelName(modelKey);
      if (seen.has(base)) return false;
      seen.add(base);
      return true;
    });
    if (deduped.length === selectedModels.length) return;
    const dedupedSet = new Set(deduped);
    setSelectedModels(deduped);
    setModelChats((prev) => {
      const next: Record<string, ModelChatData> = {};
      Object.keys(prev).forEach((k) => {
        if (dedupedSet.has(k)) next[k] = prev[k];
      });
      return next;
    });
    setModelRoles((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((k) => {
        if (dedupedSet.has(k)) next[k] = prev[k];
      });
      return next;
    });
  }, [settings.allowSameModelMultiChat, selectedModels, getBaseModelName]);

  const modelDisplayNameByKey = useMemo(() => {
    const seenCount: Record<string, number> = {};
    const totalCount: Record<string, number> = {};
    selectedModels.forEach((modelKey) => {
      const base = getBaseModelName(modelKey);
      totalCount[base] = (totalCount[base] || 0) + 1;
    });

    const out: Record<string, string> = {};
    selectedModels.forEach((modelKey) => {
      const base = getBaseModelName(modelKey);
      seenCount[base] = (seenCount[base] || 0) + 1;
      out[modelKey] =
        totalCount[base] > 1 ? `${base} (${seenCount[base]})` : base;
    });
    return out;
  }, [selectedModels, getBaseModelName]);

  const taggedSelectedModels = useMemo(
    () =>
      Array.from(
        new Set(
          parseTaggedModels(userInput, selectedModels).map(
            (modelKey) =>
              modelDisplayNameByKey[modelKey] || getBaseModelName(modelKey),
          ),
        ),
      ),
    [
      userInput,
      selectedModels,
      parseTaggedModels,
      getBaseModelName,
      modelDisplayNameByKey,
    ],
  );
  const isLastOnboardingStep = onboardingStep === onboardingSteps.length - 1;

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
              <img
                src={`${PUBLIC_BASE_PATH}/logo.png`}
                alt="Multi Llama Chat logo"
                className="h-5 w-5 object-contain invert dark:invert-0"
              />
            <h1 className="text-xs font-semibold tracking-wide text-foreground">
              Multi Llama Chat
            </h1>
          </div>
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
        className={`slim-scrollbar flex-1 overflow-x-auto overflow-y-hidden flex gap-3 p-3 md:gap-4 md:p-4 scroll-px-5 bg-gradient-to-b from-background to-background ${
          selectedModels.length === 1 ? "justify-center" : ""
        }`}
      >
        {selectedModels.length > 0 ? (
          selectedModels.map((modelKey) => (
            <div
              key={modelKey}
              ref={(el) => {
                modelCardRefs.current[modelKey] = el;
              }}
              className={`flex-shrink-0 ${
                selectedModels.length === 1
                  ? "w-full max-w-[600px]"
                  : "w-[600px] max-w-[calc(100vw-1.5rem)]"
              }`}
            >
              <ModelChat
                model={modelDisplayNameByKey[modelKey] || getBaseModelName(modelKey)}
                role={modelRoles[modelKey] || DEFAULT_ROLE}
                roleOptions={roleLibrary}
                onRoleChange={(role) => updateModelRole(modelKey, role)}
                enableRoleAssignment={settings.enableRoles}
                chat={
                  modelChats[modelKey] || {
                    modelName: getBaseModelName(modelKey),
                    messages: [],
                    isLoading: false,
                  }
                }
                onDuplicate={
                  settings.allowSameModelMultiChat
                    ? () => duplicateModelInstance(modelKey)
                    : undefined
                }
                disableDuplicate={isInterModelChatActive}
                onRemove={() => removeModel(modelKey)}
                disableRemove={isInterModelChatActive}
              />
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <img
                src={`${PUBLIC_BASE_PATH}/logo.png`}
                alt="Multi Llama Chat logo"
                className="h-20 w-20 object-contain mx-auto mb-3 invert dark:invert-0"
              />
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Multi Llama Chat
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
        <div className="max-w-7xl mx-auto space-y-3">
          <div
            className={`${selectedModels.length === 1 ? "max-w-none" : "max-w-2xl"} w-full mx-auto flex gap-1.5 flex-wrap justify-center ${isInterModelChatActive ? "opacity-50 pointer-events-none" : ""}`}
          >
            {availableModels.map((model) => {
              const instanceCount = selectedModels.filter(
                (modelKey) => getBaseModelName(modelKey) === model,
              ).length;
              const isSelected = instanceCount > 0;
              return (
                <div
                  key={model}
                  className={`inline-flex items-center rounded-full border text-sm transition-colors overflow-hidden ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border"
                  }`}
                >
                  <button
                    onClick={() => toggleModel(model)}
                    className={`px-3 py-1 ${!isSelected ? "hover:bg-muted/40" : ""}`}
                    aria-label={`Toggle ${model}`}
                  >
                    {model}
                    {instanceCount > 1 ? ` x${instanceCount}` : ""}
                  </button>
                  {settings.allowSameModelMultiChat && isSelected && (
                    <button
                      type="button"
                      onClick={() => addModelInstance(model)}
                      disabled={isInterModelSelected || isInterModelChatActive}
                      className="h-full px-2.5 py-1 border-l border-primary-foreground/30 text-sm leading-none hover:bg-primary-foreground/15 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Add another ${model}`}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {selectedModels.length > 0 && (
            <div className="max-w-2xl w-full mx-auto space-y-1.5">
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/*,.txt,text/plain"
                multiple
                className="hidden"
                onChange={async (e) => {
                  await handleAttachmentPick(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              {attachments.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {attachments.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] text-foreground"
                    >
                      {item.kind === "image" ? (
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="max-w-[180px] truncate">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {attachments.some((item) => item.kind === "image") && (
                <p className="text-[11px] text-muted-foreground">
                  Image attachments may require a vision-capable Ollama model.
                </p>
              )}
              <div className="flex gap-1.5 items-center relative">
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
                          ? `Inter-model active. Click to stop. Thinking: ${
                              currentThinkingModel
                                ? modelDisplayNameByKey[currentThinkingModel] ||
                                  getBaseModelName(currentThinkingModel)
                                : "..."
                            }`
                          : isInterModelSelected
                            ? "Inter-model: Selected (send to start)"
                            : "Inter-model: Off"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isAllLoading || isInterModelChatActive}
                  className="h-9 w-9 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Add attachment"
                >
                  <Paperclip className="h-4 w-4 text-foreground" />
                </button>
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
                  className="flex-1 bg-card border border-border text-sm leading-5 px-3 py-2 rounded-2xl resize-none min-h-[38px] max-h-[160px] transition-[border-color,box-shadow] duration-150"
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
                  (!userInput.trim() && attachments.length === 0)
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
            </div>
          )}

          {selectedModels.length > 0 && taggedSelectedModels.length > 0 && (
            <div className="max-w-2xl w-full mx-auto flex items-center justify-center gap-1.5 flex-wrap text-center">
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

            <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">
                  Persist selected models and chats in browser local storage
                </span>
                <Switch
                  checked={settings.persistDataLocally}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      persistDataLocally: checked,
                    }))
                  }
                  aria-label="Persist data locally"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">Enable Roles</span>
                <Switch
                  checked={settings.enableRoles}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableRoles: checked,
                    }))
                  }
                  aria-label="Enable role assignment"
                />
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">
                  Allow same model multi chat
                </span>
                <Switch
                  checked={settings.allowSameModelMultiChat}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowSameModelMultiChat: checked,
                    }))
                  }
                  aria-label="Allow same model multiple instances"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
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
            <img
              src={`${PUBLIC_BASE_PATH}/logo.png`}
              alt="Multi Llama Chat logo"
              className="h-12 w-12 object-contain mx-auto sm:mx-0 invert dark:invert-0"
            />
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
