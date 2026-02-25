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
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  MessagesSquare,
  Settings2,
  PanelRightOpen,
  Download,
  Trash2,
  Sun,
  Moon,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import ModelChat from "@/components/ModelChat";
import SettingsDrawer from "@/components/SettingsDrawer";
import NetworkScanDialog from "@/components/NetworkScanDialog";
import OnboardingDialog from "@/components/OnboardingDialog";
import OllamaSetupAlertDialog from "@/components/OllamaSetupAlertDialog";
import ChatHistoryDrawer from "@/components/ChatHistoryDrawer";
import ConfirmDlg from "@/components/ConfirmDlg";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  applyOutputLengthLimit,
  buildPromptWithChatConfiguration,
  normalizeChatConfiguration,
} from "@/lib/chat-config";
import { detectClientOs } from "@/lib/device";
import { usePwaLifecycle } from "@/hooks/use-pwa-lifecycle";
import { useNetworkScan } from "@/hooks/use-network-scan";
import {
  BUILT_IN_ROLES,
  CHAT_STATE_STORAGE_KEY,
  DEFAULT_ROLE,
  DEFAULT_SETTINGS,
  MODEL_INSTANCE_DELIMITER,
  MODEL_REF_DELIMITER,
  ONBOARDING_DONE_STORAGE_KEY,
  PUBLIC_BASE_PATH,
  SETTINGS_STORAGE_KEY,
  createChatSession,
} from "@/lib/app-config";
import type {
  Attachment,
  AvailableModelOption,
  ChatSession,
  HostConnectionStatus,
  Message,
  ModelChatData,
  OllamaChatMessage,
  PersistedChatState,
  UserSettings,
} from "@/lib/app-types";
import {
  normalizeOllamaBaseUrl,
} from "@/lib/network-scan";
import { normalizeRoleLabel } from "@/lib/model-roles";

const truncateMiddle = (value: string, maxLength = 22) => {
  if (value.length <= maxLength) return value;
  const side = Math.max(3, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, side)}...${value.slice(value.length - side)}`;
};

const formatBytes = (bytes?: number) => {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const LOCAL_MODEL_CATALOG = [
  { name: "llama3.2:1b", sizeLabel: "~1.3 GB" },
  { name: "llama3.2:3b", sizeLabel: "~2.0 GB" },
  { name: "qwen2.5:0.5b", sizeLabel: "~0.4 GB" },
  { name: "qwen2.5:1.5b", sizeLabel: "~1.0 GB" },
  { name: "qwen2.5:3b", sizeLabel: "~1.9 GB" },
  { name: "qwen2.5:7b", sizeLabel: "~4.7 GB" },
  { name: "qwen2.5-coder:7b", sizeLabel: "~4.8 GB" },
  { name: "gemma3:1b", sizeLabel: "~0.8 GB" },
  { name: "gemma3:4b", sizeLabel: "~2.6 GB" },
  { name: "phi3:mini", sizeLabel: "~2.2 GB" },
  { name: "mistral:7b", sizeLabel: "~4.1 GB" },
  { name: "deepseek-r1:1.5b", sizeLabel: "~1.1 GB" },
  { name: "deepseek-r1:7b", sizeLabel: "~4.7 GB" },
  { name: "codellama:7b", sizeLabel: "~3.8 GB" },
];

const isLocalHostUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ["127.0.0.1", "localhost", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const sessionHasMessages = (session: ChatSession) =>
  Object.values(session.modelChats || {}).some((chat) =>
    (chat.messages || []).some((message) => !!message.content?.trim()),
  );

const normalizePersistedModelChats = (
  modelChats: unknown,
): Record<string, ModelChatData> => {
  if (!modelChats || typeof modelChats !== "object") return {};
  const input = modelChats as Record<string, any>;
  const out: Record<string, ModelChatData> = {};
  Object.entries(input).forEach(([modelKey, chat]) => {
    if (!chat || typeof chat !== "object") return;
    const rawMessages: unknown[] = Array.isArray(chat.messages) ? chat.messages : [];
    let messages: Message[] = rawMessages
      .filter(
        (
          msg: unknown,
        ): msg is { role: "user" | "assistant"; content: string } =>
          !!msg &&
          typeof msg === "object" &&
          "role" in msg &&
          "content" in msg &&
          ((msg as { role?: string }).role === "user" ||
            (msg as { role?: string }).role === "assistant") &&
          typeof (msg as { content?: unknown }).content === "string",
      )
      .map((msg: { role: "user" | "assistant"; content: string }) => ({
        role: msg.role,
        content: msg.content,
      }));

    const wasLoading = !!chat.isLoading;
    if (wasLoading && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === "assistant" && !last.content.trim()) {
        messages = messages.slice(0, -1);
      }
    }

    out[modelKey] = {
      modelName:
        typeof chat.modelName === "string" && chat.modelName.trim()
          ? chat.modelName
          : modelKey,
      messages,
      isLoading: false,
    };
  });
  return out;
};

const MAX_QUEUED_MESSAGES = 5;

interface QueuedMessageItem {
  id: string;
  input: string;
  attachments: Attachment[];
  selectedModels: string[];
  isInterModelSelected: boolean;
}

export default function Home() {
  const { resolvedTheme, setTheme } = useTheme();
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModelOption[]>(
    [],
  );
  const [hostStatuses, setHostStatuses] = useState<
    Record<string, HostConnectionStatus>
  >({});
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOllamaSetupAlert, setShowOllamaSetupAlert] = useState(false);
  const [didCopyInstallCommand, setDidCopyInstallCommand] = useState(false);
  const [didCopyNetworkCommand, setDidCopyNetworkCommand] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [modelActionStatus, setModelActionStatus] = useState<
    Record<string, "downloading" | "deleting">
  >({});
  const [pendingModelConfirm, setPendingModelConfirm] = useState<{
    action: "download" | "delete";
    modelName: string;
    sizeLabel?: string;
  } | null>(null);
  const [pendingClearChatsConfirm, setPendingClearChatsConfirm] =
    useState(false);
  const [pendingDeleteChatId, setPendingDeleteChatId] = useState<string | null>(
    null,
  );
  const [chatRouteAlert, setChatRouteAlert] = useState<{
    requestedId: string;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const { canInstallPwa, canUpdatePwa, isUpdatingPwa, installPwa, updatePwa } =
    usePwaLifecycle(PUBLIC_BASE_PATH);
  const [isNetworkScanOpen, setIsNetworkScanOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [modelChats, setModelChats] = useState<Record<string, ModelChatData>>(
    {},
  );
  const [modelRoles, setModelRoles] = useState<Record<string, string>>({});
  const [roleLibrary, setRoleLibrary] = useState<string[]>(BUILT_IN_ROLES);
  const [userInput, setUserInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [messageQueue, setMessageQueue] = useState<QueuedMessageItem[]>([]);
  const [processingQueueId, setProcessingQueueId] = useState<string | null>(null);
  const [isAllLoading, setIsAllLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInterModelChatActive, setIsInterModelChatActive] = useState(false);
  const interChatActiveRef = useRef(false);
  const [isInterModelSelected, setIsInterModelSelected] = useState(false);
  const [currentThinkingModel, setCurrentThinkingModel] = useState<string>("");
  const [pendingInterruption, setPendingInterruption] = useState("");
  const pendingInterruptionRef = useRef("");
  const [activeMentionStart, setActiveMentionStart] = useState<number | null>(
    null,
  );
  const [activeMentionEnd, setActiveMentionEnd] = useState<number | null>(null);
  const [activeMentionQuery, setActiveMentionQuery] = useState("");
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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

  const normalizedHosts = useMemo(
    () =>
      settings.hosts.map((host) => ({
        ...host,
        url: normalizeOllamaBaseUrl(host.url),
      })),
    [settings.hosts],
  );
  const apiBaseUrl = normalizedHosts[0]?.url || "";
  const clientOs = useMemo(
    () =>
      detectClientOs(
        typeof navigator !== "undefined" ? navigator.platform : "",
        typeof navigator !== "undefined" ? navigator.userAgent : "",
      ),
    [],
  );
  const ollamaNetworkCommand =
    clientOs === "windows"
      ? '$env:OLLAMA_HOST="0.0.0.0:11434"; $env:OLLAMA_ORIGINS="*"; ollama serve'
      : 'OLLAMA_HOST=0.0.0.0:11434 OLLAMA_ORIGINS="*" ollama serve';
  const ollamaNetworkCommandLabel =
    clientOs === "windows" ? "Windows PowerShell" : "macOS / Ubuntu / Linux";
  const connectedLocalHost = useMemo(
    () =>
      normalizedHosts.find(
        (host) =>
          isLocalHostUrl(host.url) && hostStatuses[host.id] === "connected",
      ) || null,
    [normalizedHosts, hostStatuses],
  );
  const localDownloadedModels = useMemo(() => {
    if (!connectedLocalHost) return [];
    const items = availableModels
      .filter((model) => model.hostId === connectedLocalHost.id)
      .map((model) => ({ name: model.modelName, size: model.size }));
    return Array.from(
      new Map(items.map((item) => [item.name, item])).values(),
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [connectedLocalHost, availableModels]);
  const localNotDownloadedModels = useMemo(
    () =>
      LOCAL_MODEL_CATALOG.filter(
        (model) =>
          !localDownloadedModels.some((downloaded) => downloaded.name === model.name),
      ),
    [localDownloadedModels],
  );

  const getBaseModelRef = useCallback((modelKey: string) => {
    const idx = modelKey.indexOf(MODEL_INSTANCE_DELIMITER);
    return idx === -1 ? modelKey : modelKey.slice(0, idx);
  }, []);

  const createModelRef = useCallback((hostId: string, modelName: string) => {
    return `${hostId}${MODEL_REF_DELIMITER}${modelName}`;
  }, []);

  const parseModelRef = useCallback(
    (modelRef: string) => {
      const idx = modelRef.indexOf(MODEL_REF_DELIMITER);
      if (idx === -1) return { hostId: "", modelName: modelRef };
      return {
        hostId: modelRef.slice(0, idx),
        modelName: modelRef.slice(idx + MODEL_REF_DELIMITER.length),
      };
    },
    [],
  );

  const getBaseModelName = useCallback(
    (modelKey: string) => {
      const { modelName } = parseModelRef(getBaseModelRef(modelKey));
      return modelName;
    },
    [getBaseModelRef, parseModelRef],
  );

  const getHostIdFromModelKey = useCallback(
    (modelKey: string) => parseModelRef(getBaseModelRef(modelKey)).hostId,
    [getBaseModelRef, parseModelRef],
  );

  const getHostUrlById = useCallback(
    (hostId: string) =>
      normalizedHosts.find((host) => host.id === hostId)?.url || "",
    [normalizedHosts],
  );

  const createModelInstanceKey = useCallback((modelRef: string) => {
    return `${modelRef}${MODEL_INSTANCE_DELIMITER}${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }, []);

  const setChatIdQuery = useCallback(
    (chatId: string, mode: "replace" | "push" = "replace") => {
      if (typeof window === "undefined" || !chatId) return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("chatid") === chatId) return;
      url.searchParams.set("chatid", chatId);
      if (mode === "push") {
        window.history.pushState({}, "", url.toString());
      } else {
        window.history.replaceState({}, "", url.toString());
      }
    },
    [],
  );

  const clearChatIdQuery = useCallback((mode: "replace" | "push" = "replace") => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("chatid")) return;
    url.searchParams.delete("chatid");
    if (mode === "push") {
      window.history.pushState({}, "", url.toString());
    } else {
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
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
      let built = prompt;
      if (!settings.enableRoles) {
        return buildPromptWithChatConfiguration(
          built,
          normalizeChatConfiguration({
            enabled: settings.chatConfigEnabled,
            prePrompt: settings.chatConfigPrePrompt,
            postPrompt: settings.chatConfigPostPrompt,
            maxOutputLength: settings.chatConfigMaxOutputLength,
          }),
        );
      }
      const roleLabel = normalizeRoleLabel(modelRoles[model] || DEFAULT_ROLE);
      const role = roleLabel.toLowerCase();
      if (role && role !== DEFAULT_ROLE.toLowerCase()) {
        built = `Role: ${role}\nInstructions: You must answer as a ${role} and stay consistent with this role.\n\n${built}`;
      }
      return buildPromptWithChatConfiguration(
        built,
        normalizeChatConfiguration({
          enabled: settings.chatConfigEnabled,
          prePrompt: settings.chatConfigPrePrompt,
          postPrompt: settings.chatConfigPostPrompt,
          maxOutputLength: settings.chatConfigMaxOutputLength,
        }),
      );
    },
    [
      modelRoles,
      settings.enableRoles,
      settings.chatConfigEnabled,
      settings.chatConfigPrePrompt,
      settings.chatConfigPostPrompt,
      settings.chatConfigMaxOutputLength,
      settings.enableMessageStreaming,
    ],
  );

  const buildSystemMessageForModel = useCallback(
    (modelKey: string): OllamaChatMessage | null => {
      const systemParts: string[] = [];
      if (settings.enableRoles) {
        const roleLabel = normalizeRoleLabel(modelRoles[modelKey] || DEFAULT_ROLE);
        const role = roleLabel.toLowerCase();
        if (role && role !== DEFAULT_ROLE.toLowerCase()) {
          systemParts.push(
            `You are participating as a ${role}. Stay consistent with this role.`,
          );
        }
      }

      if (settings.chatConfigEnabled) {
        const pre = settings.chatConfigPrePrompt.trim();
        const post = settings.chatConfigPostPrompt.trim();
        if (pre) systemParts.push(`Pre instruction: ${pre}`);
        if (post) systemParts.push(`Post instruction: ${post}`);
        if (settings.chatConfigMaxOutputLength && settings.chatConfigMaxOutputLength > 0) {
          systemParts.push(
            `Keep each response under ${settings.chatConfigMaxOutputLength} characters.`,
          );
        }
      }

      if (systemParts.length === 0) return null;
      return { role: "system", content: systemParts.join("\n\n") };
    },
    [
      modelRoles,
      settings.enableRoles,
      settings.chatConfigEnabled,
      settings.chatConfigPrePrompt,
      settings.chatConfigPostPrompt,
      settings.chatConfigMaxOutputLength,
    ],
  );

  const convertUiMessagesToOllama = useCallback((messages: Message[]): OllamaChatMessage[] => {
    return messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  }, []);

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

  const fetchModelsFromHost = useCallback(
    async (hostId: string, hostUrl: string) => {
      const response = await fetch(`${hostUrl}/api/tags`);
      if (!response.ok) throw new Error("Failed to fetch models");
      const data = await response.json();
      const models: any[] = Array.isArray(data.models) ? data.models : [];
      return models.map((model) => ({
        hostId,
        hostUrl,
        modelName: model.name,
        modelRef: createModelRef(hostId, model.name),
        size: typeof model.size === "number" ? model.size : undefined,
        modifiedAt:
          typeof model.modified_at === "string" ? model.modified_at : undefined,
        details: model.details
          ? {
              family:
                typeof model.details.family === "string"
                  ? model.details.family
                  : undefined,
              parameterSize:
                typeof model.details.parameter_size === "string"
                  ? model.details.parameter_size
                  : undefined,
              quantizationLevel:
                typeof model.details.quantization_level === "string"
                  ? model.details.quantization_level
                  : undefined,
              format:
                typeof model.details.format === "string"
                  ? model.details.format
                  : undefined,
            }
          : undefined,
      }));
    },
    [createModelRef],
  );

  const refreshHostModels = useCallback(
    async (hostId: string, hostUrl: string) => {
      const models = await fetchModelsFromHost(hostId, hostUrl);
      setAvailableModels((prev) => {
        const withoutHost = prev.filter((model) => model.hostId !== hostId);
        return [...withoutHost, ...models];
      });
    },
    [fetchModelsFromHost],
  );

  const fetchAllHostModels = useCallback(
    async (showSetupAlertOnFailure: boolean) => {
      const validHosts = normalizedHosts.filter((host) => !!host.url);
      if (validHosts.length === 0) {
        setAvailableModels([]);
        setOllamaError("Set at least one valid Ollama host URL in Settings.");
        if (showSetupAlertOnFailure) setShowOllamaSetupAlert(true);
        return false;
      }

      const allModels: AvailableModelOption[] = [];
      let connectedCount = 0;

      for (const host of validHosts) {
        try {
          const models = await fetchModelsFromHost(host.id, host.url);
          allModels.push(...models);
          connectedCount += 1;
          setHostStatuses((prev) => ({ ...prev, [host.id]: "connected" }));
        } catch (error) {
          console.error(`[v0] Error fetching models for host ${host.url}:`, error);
          setHostStatuses((prev) => ({ ...prev, [host.id]: "failed" }));
        }
      }

      setAvailableModels(allModels);
      if (connectedCount > 0) {
        setOllamaError("");
        return true;
      }

      setOllamaError(
        "Could not connect to any configured Ollama host. Check Settings and ensure Ollama is running.",
      );
      if (showSetupAlertOnFailure) setShowOllamaSetupAlert(true);
      return false;
    },
    [normalizedHosts, fetchModelsFromHost],
  );

  const generateWithOllama = useCallback(
    async (
      hostUrl: string,
      model: string,
      messages: OllamaChatMessage[],
      options?: { stream?: boolean; onChunk?: (accumulated: string) => void },
    ) => {
      const shouldStream = !!options?.stream;
      const response = await fetch(`${hostUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.trim(),
          messages,
          stream: shouldStream,
        }),
      });

      if (shouldStream) {
        if (!response.ok) {
          const raw = await response.text();
          let data: any = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { error: raw };
          }
          const reason = data?.error || data?.message || `HTTP ${response.status}`;
          throw new Error(`${reason} [${hostUrl}/api/chat]`);
        }

        const reader = response.body?.getReader();
        if (!reader) return "";
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let parsed: any = null;
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              continue;
            }
            if (parsed?.error) {
              throw new Error(`${parsed.error} [${hostUrl}/api/chat]`);
            }
            const chunk = parsed?.message?.content;
            if (typeof chunk === "string" && chunk.length > 0) {
              accumulated += chunk;
              options?.onChunk?.(accumulated);
            }
          }
        }

        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            const chunk = parsed?.message?.content;
            if (typeof chunk === "string" && chunk.length > 0) {
              accumulated += chunk;
              options?.onChunk?.(accumulated);
            }
          } catch {}
        }

        return accumulated;
      }

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw };
      }

      if (!response.ok) {
        const reason = data?.error || data?.message || `HTTP ${response.status}`;
        throw new Error(`${reason} [${hostUrl}/api/chat]`);
      }

      return typeof data?.message?.content === "string"
        ? data.message.content
        : String(data?.message?.content || "");
    },
    [],
  );

  useEffect(() => {
    try {
      const requestedChatId = (() => {
        if (typeof window === "undefined") return "";
        return new URLSearchParams(window.location.search).get("chatid")?.trim() || "";
      })();

      const rawSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Partial<UserSettings>;
        const parsedHosts =
          Array.isArray((parsed as any).hosts) &&
          (parsed as any).hosts.length > 0
            ? (parsed as any).hosts
                .filter(
                  (host: any) =>
                    host &&
                    typeof host.id === "string" &&
                    typeof host.url === "string",
                )
                .map((host: any) => ({
                  id: host.id,
                  url: normalizeOllamaBaseUrl(host.url),
                }))
            : [];
        const legacyHost =
          typeof (parsed as any).ollamaBaseUrl === "string"
            ? normalizeOllamaBaseUrl((parsed as any).ollamaBaseUrl)
            : "";
        const hosts =
          parsedHosts.length > 0
            ? parsedHosts
            : legacyHost
              ? [{ id: "host-local", url: legacyHost }]
              : DEFAULT_SETTINGS.hosts;
        setSettings({
          hosts,
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
          enableMessageStreaming:
            typeof parsed.enableMessageStreaming === "boolean"
              ? parsed.enableMessageStreaming
              : DEFAULT_SETTINGS.enableMessageStreaming,
          chatConfigEnabled:
            typeof parsed.chatConfigEnabled === "boolean"
              ? parsed.chatConfigEnabled
              : DEFAULT_SETTINGS.chatConfigEnabled,
          chatConfigPrePrompt:
            typeof parsed.chatConfigPrePrompt === "string"
              ? parsed.chatConfigPrePrompt
              : DEFAULT_SETTINGS.chatConfigPrePrompt,
          chatConfigPostPrompt:
            typeof parsed.chatConfigPostPrompt === "string"
              ? parsed.chatConfigPostPrompt
              : DEFAULT_SETTINGS.chatConfigPostPrompt,
          chatConfigMaxOutputLength:
            typeof parsed.chatConfigMaxOutputLength === "number" &&
            Number.isFinite(parsed.chatConfigMaxOutputLength) &&
            parsed.chatConfigMaxOutputLength > 0
              ? Math.floor(parsed.chatConfigMaxOutputLength)
              : DEFAULT_SETTINGS.chatConfigMaxOutputLength,
        });
      }

      const rawChatState = localStorage.getItem(CHAT_STATE_STORAGE_KEY);
      if (rawChatState) {
        const parsed = JSON.parse(rawChatState) as Partial<PersistedChatState>;
        const loadedRoles =
          parsed.modelRoles && typeof parsed.modelRoles === "object"
            ? parsed.modelRoles
            : {};
        const loadedRoleLibrary = Array.isArray(parsed.roleLibrary)
          ? parsed.roleLibrary.filter(
              (v): v is string => typeof v === "string" && !!v.trim(),
            ).map((role) => normalizeRoleLabel(role))
          : [];

        const loadedSessions = Array.isArray(parsed.chatSessions)
          ? parsed.chatSessions.filter(
              (session): session is ChatSession =>
                !!session &&
                typeof session.id === "string" &&
                typeof session.title === "string" &&
                typeof session.createdAt === "number" &&
                typeof session.updatedAt === "number" &&
                Array.isArray(session.selectedModels) &&
                typeof session.modelChats === "object" &&
                !!session.modelChats &&
                typeof session.modelRoles === "object" &&
                !!session.modelRoles,
            )
              .map((session) => ({
                ...session,
                modelChats: normalizePersistedModelChats(session.modelChats),
              }))
              .filter((session) => sessionHasMessages(session))
          : [];

        if (loadedSessions.length > 0) {
          const normalizeSessionRoles = (session: ChatSession) =>
            Object.fromEntries(
              Object.entries(session.modelRoles || {}).map(([k, v]) => [
                k,
                normalizeRoleLabel(String(v || DEFAULT_ROLE)),
              ]),
            );

          if (requestedChatId) {
            const requestedSession = loadedSessions.find(
              (session) => session.id === requestedChatId,
            );
            if (requestedSession) {
              setChatSessions(loadedSessions);
              setActiveChatId(requestedSession.id);
              setSelectedModels(requestedSession.selectedModels || []);
              setModelChats(normalizePersistedModelChats(requestedSession.modelChats));
              setModelRoles(normalizeSessionRoles(requestedSession));
            } else {
              const fresh = createChatSession();
              setChatSessions([fresh, ...loadedSessions]);
              setActiveChatId(fresh.id);
              setSelectedModels(fresh.selectedModels);
              setModelChats(fresh.modelChats);
              setModelRoles(fresh.modelRoles);
              setChatRouteAlert({ requestedId: requestedChatId });
            }
          } else {
            const fresh = createChatSession();
            setChatSessions([fresh, ...loadedSessions]);
            setActiveChatId(fresh.id);
            setSelectedModels(fresh.selectedModels);
            setModelChats(fresh.modelChats);
            setModelRoles(fresh.modelRoles);
          }
        } else {
          const loadedSelected = Array.isArray(parsed.selectedModels)
            ? parsed.selectedModels.filter((v): v is string => typeof v === "string")
            : [];
          const loadedChats =
            normalizePersistedModelChats(parsed.modelChats);
          const migratedSession = createChatSession({
            selectedModels: loadedSelected,
            modelChats: loadedChats,
            modelRoles: loadedRoles,
          });
          if (requestedChatId && requestedChatId !== migratedSession.id) {
            const fresh = createChatSession();
            setChatSessions([fresh, migratedSession]);
            setActiveChatId(fresh.id);
            setSelectedModels(fresh.selectedModels);
            setModelChats(fresh.modelChats);
            setModelRoles(fresh.modelRoles);
            setChatRouteAlert({ requestedId: requestedChatId });
          } else if (requestedChatId && requestedChatId === migratedSession.id) {
            setChatSessions([migratedSession]);
            setActiveChatId(migratedSession.id);
            setSelectedModels(migratedSession.selectedModels);
            setModelChats(normalizePersistedModelChats(migratedSession.modelChats));
            const normalizedMigratedRoles = Object.fromEntries(
              Object.entries(migratedSession.modelRoles || {}).map(([k, v]) => [
                k,
                normalizeRoleLabel(String(v || DEFAULT_ROLE)),
              ]),
            );
            setModelRoles(normalizedMigratedRoles);
          } else {
            const fresh = createChatSession();
            setChatSessions([fresh, migratedSession]);
            setActiveChatId(fresh.id);
            setSelectedModels(fresh.selectedModels);
            setModelChats(fresh.modelChats);
            setModelRoles(fresh.modelRoles);
          }
        }

        if (loadedRoleLibrary.length > 0) {
          setRoleLibrary(Array.from(new Set([...BUILT_IN_ROLES, ...loadedRoleLibrary])));
        }
      } else {
        const initialSession = createChatSession();
        setChatSessions([initialSession]);
        setActiveChatId(initialSession.id);
        if (requestedChatId) {
          setChatRouteAlert({ requestedId: requestedChatId });
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
    if (!isHydrated || !activeChatId) return;
    const nextTitle = (() => {
      for (const modelKey of selectedModels) {
        const messages = modelChats[modelKey]?.messages || [];
        const firstUser = messages.find((m) => m.role === "user" && !!m.content.trim());
        if (firstUser) return firstUser.content.trim().slice(0, 80);
      }
      return "New chat";
    })();

    setChatSessions((prev) =>
      prev.map((session) =>
        session.id === activeChatId
          ? {
              ...session,
              title: nextTitle || "New chat",
              updatedAt: Date.now(),
              selectedModels,
              modelChats,
              modelRoles,
            }
          : session,
      ),
    );
  }, [isHydrated, activeChatId, selectedModels, modelChats, modelRoles]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!settings.persistDataLocally) {
      localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
      return;
    }

    const persistedSessions = chatSessions
      .map((session) => ({
        ...session,
        modelChats: normalizePersistedModelChats(session.modelChats),
      }))
      .filter((session) => sessionHasMessages(session));
    const payload: PersistedChatState = {
      chatSessions: persistedSessions,
      activeChatId,
      selectedModels,
      modelChats: normalizePersistedModelChats(modelChats),
      modelRoles,
      roleLibrary,
    };
    localStorage.setItem(CHAT_STATE_STORAGE_KEY, JSON.stringify(payload));
  }, [
    isHydrated,
    settings.persistDataLocally,
    chatSessions,
    activeChatId,
    selectedModels,
    modelChats,
    modelRoles,
    roleLibrary,
  ]);


  const clearPersistedData = useCallback(() => {
    localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
    const fresh = createChatSession();
    setChatSessions([fresh]);
    setActiveChatId(fresh.id);
    setSelectedModels(fresh.selectedModels);
    setModelChats(fresh.modelChats);
    setModelRoles(fresh.modelRoles);
    setUserInput("");
    setMessageQueue([]);
    setProcessingQueueId(null);
    setIsAllLoading(false);
    setPendingInterruption("");
    pendingInterruptionRef.current = "";
  }, []);

  const startNewChat = useCallback(() => {
    setActiveChatId("");
    setSelectedModels([]);
    setModelChats({});
    setModelRoles({});
    setUserInput("");
    setAttachments([]);
    setIsInterModelSelected(false);
    setIsInterModelChatActive(false);
    setCurrentThinkingModel("");
    setIsChatHistoryOpen(false);
    clearChatIdQuery("push");
    setMessageQueue([]);
    setProcessingQueueId(null);
    setIsAllLoading(false);
    setPendingInterruption("");
    pendingInterruptionRef.current = "";
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [clearChatIdQuery]);

  const switchToChat = useCallback(
    (chatId: string) => {
      const target = chatSessions.find((session) => session.id === chatId);
      if (!target) return;
      setActiveChatId(target.id);
      setSelectedModels(target.selectedModels || []);
      setModelChats(target.modelChats || {});
      setModelRoles(target.modelRoles || {});
      setUserInput("");
      setAttachments([]);
      setIsInterModelSelected(false);
      setIsInterModelChatActive(false);
      setMessageQueue([]);
      setProcessingQueueId(null);
      setIsAllLoading(false);
      setPendingInterruption("");
      pendingInterruptionRef.current = "";
      setIsChatHistoryOpen(false);
      setChatIdQuery(target.id, "push");
    },
    [chatSessions, setChatIdQuery],
  );

  const deleteChatSession = useCallback(
    (chatId: string) => {
      const remaining = chatSessions.filter((session) => session.id !== chatId);
      setChatSessions(remaining);
      if (activeChatId !== chatId) return;

      if (remaining.length > 0) {
        const nextSession = remaining[0];
        setActiveChatId(nextSession.id);
        setSelectedModels(nextSession.selectedModels || []);
        setModelChats(nextSession.modelChats || {});
        setModelRoles(nextSession.modelRoles || {});
        setUserInput("");
        setAttachments([]);
        setIsInterModelSelected(false);
        setIsInterModelChatActive(false);
        setCurrentThinkingModel("");
        setMessageQueue([]);
        setProcessingQueueId(null);
        setIsAllLoading(false);
        setPendingInterruption("");
        pendingInterruptionRef.current = "";
        setChatIdQuery(nextSession.id, "replace");
        return;
      }

      setActiveChatId("");
      setSelectedModels([]);
      setModelChats({});
      setModelRoles({});
      setUserInput("");
      setAttachments([]);
      setIsInterModelSelected(false);
      setIsInterModelChatActive(false);
      setCurrentThinkingModel("");
      setMessageQueue([]);
      setProcessingQueueId(null);
      setIsAllLoading(false);
      setPendingInterruption("");
      pendingInterruptionRef.current = "";
      clearChatIdQuery("replace");
    },
    [activeChatId, chatSessions, clearChatIdQuery, setChatIdQuery],
  );

  const copyInstallCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("ollama pull llama3.2");
      setDidCopyInstallCommand(true);
      setTimeout(() => setDidCopyInstallCommand(false), 1500);
    } catch {
      setDidCopyInstallCommand(false);
    }
  }, []);

  const copyNetworkCommand = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ollamaNetworkCommand);
      setDidCopyNetworkCommand(true);
      setTimeout(() => setDidCopyNetworkCommand(false), 1500);
    } catch {
      setDidCopyNetworkCommand(false);
    }
  }, [ollamaNetworkCommand]);

  const addHost = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      hosts: [
        ...prev.hosts,
        {
          id: `host-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: "",
        },
      ],
    }));
  }, []);

  const downloadModelToLocalHost = useCallback(
    async (modelName: string, sizeLabel?: string) => {
      if (!connectedLocalHost) return;
      setModelActionStatus((prev) => ({ ...prev, [modelName]: "downloading" }));
      const toastId = toast.loading(`Downloading ${modelName}...`);
      try {
        const response = await fetch(`${connectedLocalHost.url}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: modelName, stream: false }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        await refreshHostModels(connectedLocalHost.id, connectedLocalHost.url);
        toast.success(`Downloaded ${modelName}`, { id: toastId });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Download failed: ${detail}`, { id: toastId });
      } finally {
        setModelActionStatus((prev) => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });
      }
    },
    [connectedLocalHost, refreshHostModels],
  );

  const deleteModelFromLocalHost = useCallback(
    async (modelName: string, sizeLabel?: string) => {
      if (!connectedLocalHost) return;
      setModelActionStatus((prev) => ({ ...prev, [modelName]: "deleting" }));
      const toastId = toast.loading(`Deleting ${modelName}...`);
      try {
        let response = await fetch(`${connectedLocalHost.url}/api/delete`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: modelName }),
        });
        if (!response.ok) {
          response = await fetch(`${connectedLocalHost.url}/api/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: modelName }),
          });
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        await refreshHostModels(connectedLocalHost.id, connectedLocalHost.url);
        toast.success(`Deleted ${modelName}`, { id: toastId });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Delete failed: ${detail}`, { id: toastId });
      } finally {
        setModelActionStatus((prev) => {
          const next = { ...prev };
          delete next[modelName];
          return next;
        });
      }
    },
    [connectedLocalHost, refreshHostModels],
  );

  const requestDownloadModel = useCallback((modelName: string, sizeLabel?: string) => {
    setPendingModelConfirm({ action: "download", modelName, sizeLabel });
  }, []);

  const requestDeleteModel = useCallback((modelName: string, sizeLabel?: string) => {
    setPendingModelConfirm({ action: "delete", modelName, sizeLabel });
  }, []);

  const confirmPendingModelAction = useCallback(async () => {
    if (!pendingModelConfirm) return;
    const { action, modelName, sizeLabel } = pendingModelConfirm;
    setPendingModelConfirm(null);
    if (action === "download") {
      await downloadModelToLocalHost(modelName, sizeLabel);
      return;
    }
    await deleteModelFromLocalHost(modelName, sizeLabel);
  }, [pendingModelConfirm, downloadModelToLocalHost, deleteModelFromLocalHost]);

  const removeHost = useCallback((hostId: string) => {
    setSettings((prev) => {
      const nextHosts = prev.hosts.filter((host) => host.id !== hostId);
      return {
        ...prev,
        hosts: nextHosts.length > 0 ? nextHosts : prev.hosts,
      };
    });
    setHostStatuses((prev) => {
      const next = { ...prev };
      delete next[hostId];
      return next;
    });
    setAvailableModels((prev) => prev.filter((model) => model.hostId !== hostId));
    setSelectedModels((prev) =>
      prev.filter((modelKey) => getHostIdFromModelKey(modelKey) !== hostId),
    );
    setModelChats((prev) => {
      const next: Record<string, ModelChatData> = {};
      Object.keys(prev).forEach((key) => {
        if (getHostIdFromModelKey(key) !== hostId) next[key] = prev[key];
      });
      return next;
    });
    setModelRoles((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        if (getHostIdFromModelKey(key) !== hostId) next[key] = prev[key];
      });
      return next;
    });
    setChatSessions((prev) =>
      prev.map((session) => {
        const nextSelected = session.selectedModels.filter(
          (modelKey) => getHostIdFromModelKey(modelKey) !== hostId,
        );
        const nextChats: Record<string, ModelChatData> = {};
        Object.keys(session.modelChats || {}).forEach((key) => {
          if (getHostIdFromModelKey(key) !== hostId) nextChats[key] = session.modelChats[key];
        });
        const nextRoles: Record<string, string> = {};
        Object.keys(session.modelRoles || {}).forEach((key) => {
          if (getHostIdFromModelKey(key) !== hostId) nextRoles[key] = session.modelRoles[key];
        });
        return {
          ...session,
          selectedModels: nextSelected,
          modelChats: nextChats,
          modelRoles: nextRoles,
          updatedAt: Date.now(),
        };
      }),
    );
  }, [getHostIdFromModelKey]);

  const testHostConnection = useCallback(
    async (hostId: string) => {
      const host = normalizedHosts.find((item) => item.id === hostId);
      if (!host || !host.url) {
        setHostStatuses((prev) => ({ ...prev, [hostId]: "failed" }));
        toast.error("Set a valid host URL before testing.");
        return;
      }

      setHostStatuses((prev) => ({ ...prev, [hostId]: "testing" }));
      const toastId = toast.loading(`Testing ${host.url}...`);
      try {
        const models = await fetchModelsFromHost(host.id, host.url);
        setHostStatuses((prev) => ({ ...prev, [host.id]: "connected" }));
        setAvailableModels((prev) => {
          const withoutHost = prev.filter((model) => model.hostId !== host.id);
          return [...withoutHost, ...models];
        });
        setOllamaError("");
        toast.success(`Connected: ${host.url}`, { id: toastId });
      } catch {
        setHostStatuses((prev) => ({ ...prev, [host.id]: "failed" }));
        setAvailableModels((prev) => prev.filter((model) => model.hostId !== host.id));
        toast.error(`Failed: ${host.url}`, { id: toastId });
      }
    },
    [normalizedHosts, fetchModelsFromHost],
  );

  const {
    isNetworkScanning,
    scannedHosts,
    scanErrorMessage,
    addedScannedHostUrls,
    startNetworkScan,
    addScannedHost,
  } = useNetworkScan({
    normalizedHosts,
    fetchModelsFromHost,
    setSettings,
    setHostStatuses,
    setAvailableModels,
    setOllamaError,
  });

  const completeOnboarding = useCallback(async () => {
    localStorage.setItem(ONBOARDING_DONE_STORAGE_KEY, "true");
    setIsOnboardingOpen(false);
    setOnboardingStep(0);
    await fetchAllHostModels(true);
  }, [fetchAllHostModels]);

  // Keep model list synced with current Ollama URL
  useEffect(() => {
    fetchAllHostModels(false);
  }, [fetchAllHostModels]);

  useEffect(() => {
    interChatActiveRef.current = isInterModelChatActive;
  }, [isInterModelChatActive]);

  useEffect(() => {
    pendingInterruptionRef.current = pendingInterruption;
  }, [pendingInterruption]);

  const removeModel = useCallback((modelKey: string) => {
    setSelectedModels((prev) => {
      const next = prev.filter((m) => m !== modelKey);
      if (next.length === 0) {
        setIsAllLoading(false);
        setProcessingQueueId(null);
        setIsInterModelSelected(false);
      }
      return next;
    });
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
    setMessageQueue((prev) =>
      prev
        .map((item) => ({
          ...item,
          selectedModels: item.selectedModels.filter((m) => m !== modelKey),
        }))
        .filter((item) => item.selectedModels.length > 0),
    );
  }, []);

  useEffect(() => {
    if (!processingQueueId) return;
    const exists = messageQueue.some((item) => item.id === processingQueueId);
    if (!exists) {
      setProcessingQueueId(null);
    }
  }, [processingQueueId, messageQueue]);

  const addModelInstance = useCallback(
    (modelRef: string) => {
      const modelKey = createModelInstanceKey(modelRef);
      const { modelName } = parseModelRef(modelRef);
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
    [createModelInstanceKey, parseModelRef],
  );

  const duplicateModelInstance = useCallback(
    (modelKey: string) => {
      const sourceChat = modelChats[modelKey];
      if (!sourceChat) return;
      const baseRef = getBaseModelRef(modelKey);
      const { modelName } = parseModelRef(baseRef);
      const clonedKey = createModelInstanceKey(baseRef);

      setSelectedModels((prev) => [...prev, clonedKey]);
      setModelChats((prev) => ({
        ...prev,
        [clonedKey]: {
          modelName,
          messages: (prev[modelKey]?.messages || []).map((m) => ({ ...m })),
          isLoading: false,
        },
      }));
      setModelRoles((prev) => ({
        ...prev,
        [clonedKey]: prev[modelKey] || DEFAULT_ROLE,
      }));
    },
    [modelChats, getBaseModelRef, parseModelRef, createModelInstanceKey],
  );

  const toggleModel = useCallback(
    (modelRef: string) => {
      if (isInterModelSelected || isInterModelChatActive) return;
      const selectedForBase = selectedModels.filter(
        (modelKey) => getBaseModelRef(modelKey) === modelRef,
      );
      if (selectedForBase.length > 0) {
        // Toggle off removes all instances for this model name.
        selectedForBase.forEach((modelKey) => removeModel(modelKey));
      } else {
        addModelInstance(modelRef);
      }
    },
    [
      selectedModels,
      removeModel,
      addModelInstance,
      getBaseModelRef,
      isInterModelSelected,
      isInterModelChatActive,
    ],
  );

  const updateModelRole = useCallback((model: string, role: string) => {
    const normalized = normalizeRoleLabel(role);
    setModelRoles((prev) => ({
      ...prev,
      [model]: normalized,
    }));
    setRoleLibrary((prev) => {
      const alreadyExists = prev.some(
        (item) => item.toLowerCase() === normalized.toLowerCase(),
      );
      return alreadyExists ? prev : [...prev, normalized];
    });
  }, []);

  const processQueuedMessage = useCallback(
    async (queueItem: QueuedMessageItem) => {
      const { input, attachments: queuedAttachments, selectedModels: queuedModels } =
        queueItem;
      if ((!input.trim() && queuedAttachments.length === 0) || queuedModels.length === 0)
        return;

      let sessionIdForMessage = activeChatId;
      if (!sessionIdForMessage) {
        const fresh = createChatSession({
          selectedModels: queuedModels,
          modelChats,
          modelRoles,
        });
        sessionIdForMessage = fresh.id;
        setChatSessions((prev) => [fresh, ...prev]);
        setActiveChatId(fresh.id);
      }

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (!params.get("chatid")) {
          setChatIdQuery(sessionIdForMessage, "push");
        }
      }

      const taggedModels = parseTaggedModels(input, queuedModels);
      const targetModels = taggedModels.length > 0 ? taggedModels : [...queuedModels];
      const messageContent = stripModelTags(input);
      const textAttachments = queuedAttachments.filter((item) => item.kind === "text");
      const imageAttachments = queuedAttachments.filter((item) => item.kind === "image");
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

      setIsAllLoading(true);
      try {
        if (queueItem.isInterModelSelected) {
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
              messages: [...current.messages, { role: "user", content: userMessageForUi }],
              isLoading: true,
            };
            return updated;
          });
          if (startInterModelChatRef.current) {
            await startInterModelChatRef.current(mergedUserPrompt, targetModels);
          }
          return;
        }

        const previousModelChats = modelChats;

        // Add user message to all model chats (UI state)
        setModelChats((prev) => {
          const updated = { ...prev };
          targetModels.forEach((model) => {
            const current = updated[model] || {
              modelName: getBaseModelName(model),
              messages: [],
              isLoading: false,
            };
            updated[model] = {
              ...current,
              messages: [...current.messages, { role: "user", content: userMessageForUi }],
              isLoading: true,
            };
          });
          return updated;
        });

        // Send message to all models in parallel
        const promises = targetModels.map(async (model) => {
          try {
            const hostUrl = getHostUrlById(getHostIdFromModelKey(model));
            if (!hostUrl) throw new Error("Host URL not found for selected model.");

            const systemMessage = buildSystemMessageForModel(model);
            const priorMessages = previousModelChats[model]?.messages || [];
            const ollamaMessages: OllamaChatMessage[] = [
              ...(systemMessage ? [systemMessage] : []),
              ...convertUiMessagesToOllama(priorMessages),
              {
                role: "user",
                content: buildPromptForModel(model, mergedUserPrompt),
                ...(imagePayload.length > 0 ? { images: imagePayload } : {}),
              },
            ];

            if (settings.enableMessageStreaming) {
              setModelChats((prev) => {
                const current = prev[model] || {
                  modelName: getBaseModelName(model),
                  messages: [],
                  isLoading: true,
                };
                return {
                  ...prev,
                  [model]: {
                    ...current,
                    messages: [
                      ...current.messages,
                      { role: "assistant", content: "" },
                    ],
                    isLoading: true,
                  },
                };
              });
            }

            const rawAi = await generateWithOllama(
              hostUrl,
              getBaseModelName(model),
              ollamaMessages,
              {
                stream: settings.enableMessageStreaming,
                onChunk: settings.enableMessageStreaming
                  ? (accumulated) => {
                      setModelChats((prev) => {
                        const current = prev[model] || {
                          modelName: getBaseModelName(model),
                          messages: [],
                          isLoading: true,
                        };
                        const messages = [...(current.messages || [])];
                        if (
                          messages.length > 0 &&
                          messages[messages.length - 1].role === "assistant"
                        ) {
                          messages[messages.length - 1] = {
                            ...messages[messages.length - 1],
                            content: accumulated,
                          };
                        } else {
                          messages.push({ role: "assistant", content: accumulated });
                        }
                        return {
                          ...prev,
                          [model]: {
                            ...current,
                            messages,
                            isLoading: true,
                          },
                        };
                      });
                    }
                  : undefined,
              },
            );
            const ai = applyOutputLengthLimit(
              rawAi,
              normalizeChatConfiguration({
                enabled: settings.chatConfigEnabled,
                prePrompt: settings.chatConfigPrePrompt,
                postPrompt: settings.chatConfigPostPrompt,
                maxOutputLength: settings.chatConfigMaxOutputLength,
              }),
            );

            setModelChats((prev) => {
              const currentMessages: Message[] = [...(prev[model]?.messages || [])];
              const nextMessages: Message[] = settings.enableMessageStreaming
                ? (() => {
                    if (
                      currentMessages.length > 0 &&
                      currentMessages[currentMessages.length - 1].role === "assistant"
                    ) {
                      currentMessages[currentMessages.length - 1] = {
                        ...currentMessages[currentMessages.length - 1],
                        content: ai,
                      };
                      return currentMessages;
                    }
                    return [...currentMessages, { role: "assistant", content: ai }];
                  })()
                : [...currentMessages, { role: "assistant", content: ai }];

              return {
                ...prev,
                [model]: {
                  ...(prev[model] || {
                    modelName: getBaseModelName(model),
                    messages: [],
                    isLoading: false,
                  }),
                  messages: nextMessages,
                  isLoading: false,
                },
              };
            });
          } catch (error) {
            console.error(`[v0] Error with model ${model}:`, error);
            const hostId = getHostIdFromModelKey(model);
            if (hostId) {
              setHostStatuses((prev) => ({ ...prev, [hostId]: "failed" }));
            }
            const detail = error instanceof Error ? error.message : "Unknown error";
            setModelChats((prev) => {
              const currentMessages: Message[] = [...(prev[model]?.messages || [])];
              const errorText = `Error: Could not get response from ${getBaseModelName(model)}. ${detail}`;
              const nextMessages: Message[] = settings.enableMessageStreaming
                ? (() => {
                    if (
                      currentMessages.length > 0 &&
                      currentMessages[currentMessages.length - 1].role === "assistant"
                    ) {
                      currentMessages[currentMessages.length - 1] = {
                        ...currentMessages[currentMessages.length - 1],
                        content: errorText,
                      };
                      return currentMessages;
                    }
                    return [...currentMessages, { role: "assistant", content: errorText }];
                  })()
                : [...currentMessages, { role: "assistant", content: errorText }];

              return {
                ...prev,
                [model]: {
                  ...(prev[model] || {
                    modelName: getBaseModelName(model),
                    messages: [],
                    isLoading: false,
                  }),
                  messages: nextMessages,
                  isLoading: false,
                },
              };
            });
          }
        });

        await Promise.all(promises);
      } finally {
        setIsAllLoading(false);
      }
    },
    [
      activeChatId,
      buildPromptForModel,
      buildSystemMessageForModel,
      convertUiMessagesToOllama,
      createChatSession,
      generateWithOllama,
      getBaseModelName,
      getHostIdFromModelKey,
      getHostUrlById,
      modelChats,
      modelRoles,
      parseTaggedModels,
      setChatIdQuery,
      settings.chatConfigEnabled,
      settings.chatConfigMaxOutputLength,
      settings.chatConfigPostPrompt,
      settings.chatConfigPrePrompt,
      settings.enableMessageStreaming,
      stripModelTags,
    ],
  );

  const queuePreview = useCallback((item: QueuedMessageItem) => {
    const text = stripModelTags(item.input).trim();
    if (text) return text;
    const fileCount = item.attachments.length;
    return fileCount > 0
      ? `${fileCount} attachment${fileCount === 1 ? "" : "s"}`
      : "Message";
  }, [stripModelTags]);

  const sendMessage = useCallback(() => {
    const trimmedInput = userInput.trim();

    if (isInterModelChatActive) {
      if (!trimmedInput) return;
      if (pendingInterruptionRef.current.trim()) {
        toast.error("Only one interrupt can be queued at a time.");
        return;
      }
      setPendingInterruption(trimmedInput);
      setUserInput("");
      setActiveMentionStart(null);
      setActiveMentionEnd(null);
      setActiveMentionQuery("");
      toast.success("Interrupt queued. It will be applied on the next turn.");
      return;
    }

    if ((!trimmedInput && attachments.length === 0) || selectedModels.length === 0)
      return;
    if (messageQueue.length >= MAX_QUEUED_MESSAGES) {
      toast.error(`Queue limit reached (${MAX_QUEUED_MESSAGES}).`);
      return;
    }

    const queueItem: QueuedMessageItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      input: userInput,
      attachments: attachments.map((item) => ({ ...item })),
      selectedModels: [...selectedModels],
      isInterModelSelected,
    };
    setMessageQueue((prev) => [...prev, queueItem]);
    setUserInput("");
    setAttachments([]);
    setActiveMentionStart(null);
    setActiveMentionEnd(null);
    setActiveMentionQuery("");
    setIsInterModelSelected(false);
  }, [
    userInput,
    attachments,
    selectedModels,
    isInterModelSelected,
    messageQueue.length,
    isInterModelChatActive,
  ]);

  const removeQueuedMessage = useCallback((id: string) => {
    if (processingQueueId === id) return;
    setMessageQueue((prev) => prev.filter((item) => item.id !== id));
  }, [processingQueueId]);

  useEffect(() => {
    if (processingQueueId || messageQueue.length === 0 || isInterModelChatActive) return;
    const next = messageQueue[0];
    setProcessingQueueId(next.id);
    void processQueuedMessage(next).finally(() => {
      setMessageQueue((prev) => prev.filter((item) => item.id !== next.id));
      setProcessingQueueId((current) => (current === next.id ? null : current));
    });
  }, [isInterModelChatActive, messageQueue, processQueuedMessage, processingQueueId]);

  const isQueueFull = messageQueue.length >= MAX_QUEUED_MESSAGES;

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
      selectedModels.length > 0 &&
      (userInput.trim().length > 0 || attachments.length > 0)
    ) {
      if (!isInterModelChatActive && isQueueFull) return;
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAutoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    if (!el.value.trim()) {
      el.style.height = "38px";
      el.style.overflowY = "hidden";
      return;
    }
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
      const localHistory: Record<string, Message[]> = {};
      modelsToUse.forEach((modelKey) => {
        localHistory[modelKey] = [...(modelChats[modelKey]?.messages || [])];
      });
      const baseCountByModelRef: Record<string, number> = {};
      modelsToUse.forEach((modelKey) => {
        const baseRef = getBaseModelRef(modelKey);
        baseCountByModelRef[baseRef] = (baseCountByModelRef[baseRef] || 0) + 1;
      });
      const seenByModelRef: Record<string, number> = {};
      const speakerByModelKey: Record<string, string> = {};
      modelsToUse.forEach((modelKey) => {
        const baseRef = getBaseModelRef(modelKey);
        seenByModelRef[baseRef] = (seenByModelRef[baseRef] || 0) + 1;
        const instanceSuffix =
          baseCountByModelRef[baseRef] > 1 ? `#${seenByModelRef[baseRef]}` : "";
        const hostId = getHostIdFromModelKey(modelKey);
        const hostLabel = (getHostUrlById(hostId) || hostId).replace(/^https?:\/\//, "");
        speakerByModelKey[modelKey] = `${getBaseModelName(modelKey)}${instanceSuffix}@${hostLabel}`;
      });
      const participantList = modelsToUse
        .map((modelKey) => speakerByModelKey[modelKey])
        .filter(Boolean);
      const transcript: Array<{ speaker: string; content: string }> = [];
      const seedSpeaker = "User";
      transcript.push({ speaker: seedSpeaker, content: seed });
      while (interChatActiveRef.current) {
        const interruptText = pendingInterruptionRef.current.trim();
        if (interruptText) {
          transcript.push({ speaker: "User", content: interruptText });
          seed = interruptText;
          modelsToUse.forEach((modelKey) => {
            localHistory[modelKey] = [
              ...localHistory[modelKey],
              { role: "user", content: interruptText },
            ];
          });
          setModelChats((prev) => {
            const next = { ...prev };
            modelsToUse.forEach((modelKey) => {
              const current = next[modelKey] || {
                modelName: getBaseModelName(modelKey),
                messages: [],
                isLoading: false,
              };
              next[modelKey] = {
                ...current,
                messages: [...current.messages, { role: "user", content: interruptText }],
                isLoading: false,
              };
            });
            return next;
          });
          pendingInterruptionRef.current = "";
          setPendingInterruption("");
        }

        const model = modelsToUse[currentIndex];
        setCurrentThinkingModel(model);
        try {
          setModelChats((prev) => {
            const current = prev[model] || {
              modelName: getBaseModelName(model),
              messages: [],
              isLoading: false,
            };
            return {
              ...prev,
              [model]: {
                ...current,
                isLoading: true,
              },
            };
          });
          const hostUrl = getHostUrlById(getHostIdFromModelKey(model));
          if (!hostUrl) throw new Error("Host URL not found for selected model.");
          const displayName =
            speakerByModelKey[model] || `${getBaseModelName(model)}@${getHostIdFromModelKey(model)}`;
          const latest = transcript[transcript.length - 1];
          const interPrompt = `Participants in this room:\n${participantList
            .map((name, idx) => `${idx + 1}. ${name}`)
            .join("\n")}\n\nInter-model conversation transcript:\n${transcript
            .map((t, idx) => `${idx + 1}. ${t.speaker}: ${t.content}`)
            .join("\n\n")}\n\nLatest speaker: ${latest.speaker}.\nRespond as ${displayName}, address the latest message, and continue the discussion.`;
          const systemMessage = buildSystemMessageForModel(model);
          const ollamaMessages: OllamaChatMessage[] = [
            ...(systemMessage ? [systemMessage] : []),
            ...convertUiMessagesToOllama(localHistory[model]),
            {
              role: "user",
              content: buildPromptForModel(model, interPrompt),
            },
          ];

          if (settings.enableMessageStreaming) {
            setModelChats((prev) => {
              const current = prev[model] || {
                modelName: getBaseModelName(model),
                messages: [],
                isLoading: true,
              };
              return {
                ...prev,
                [model]: {
                  ...current,
                  messages: [
                    ...current.messages,
                    { role: "assistant", content: "" },
                  ],
                  isLoading: true,
                },
              };
            });
          }

          const rawAi = await generateWithOllama(
            hostUrl,
            getBaseModelName(model),
            ollamaMessages,
            {
              stream: settings.enableMessageStreaming,
              onChunk: settings.enableMessageStreaming
                ? (accumulated) => {
                    setModelChats((prev) => {
                      const current = prev[model] || {
                        modelName: getBaseModelName(model),
                        messages: [],
                        isLoading: true,
                      };
                      const messages = [...current.messages];
                      if (
                        messages.length > 0 &&
                        messages[messages.length - 1].role === "assistant"
                      ) {
                        messages[messages.length - 1] = {
                          ...messages[messages.length - 1],
                          content: accumulated,
                        };
                      } else {
                        messages.push({ role: "assistant", content: accumulated });
                      }
                      return {
                        ...prev,
                        [model]: {
                          ...current,
                          messages,
                          isLoading: true,
                        },
                      };
                    });
                  }
                : undefined,
            },
          );
          const ai = applyOutputLengthLimit(
            rawAi,
            normalizeChatConfiguration({
              enabled: settings.chatConfigEnabled,
              prePrompt: settings.chatConfigPrePrompt,
              postPrompt: settings.chatConfigPostPrompt,
              maxOutputLength: settings.chatConfigMaxOutputLength,
            }),
          );
          seed = ai;
          transcript.push({ speaker: displayName, content: ai });
          localHistory[model] = [
            ...localHistory[model],
            { role: "user", content: interPrompt },
            { role: "assistant", content: ai },
          ];
          setModelChats((prev) => {
            const current = prev[model] || {
              modelName: getBaseModelName(model),
              messages: [],
              isLoading: false,
            };
            const currentMessages: Message[] = [...current.messages];
            const nextMessages: Message[] = settings.enableMessageStreaming
              ? (() => {
                  if (
                    currentMessages.length > 0 &&
                    currentMessages[currentMessages.length - 1].role === "assistant"
                  ) {
                    currentMessages[currentMessages.length - 1] = {
                      ...currentMessages[currentMessages.length - 1],
                      content: ai,
                    };
                    return currentMessages;
                  }
                  return [...currentMessages, { role: "assistant", content: ai }];
                })()
              : [...currentMessages, { role: "assistant", content: ai }];
            return {
              ...prev,
              [model]: {
                ...current,
                messages: nextMessages,
                isLoading: false,
              },
            };
          });
        } catch (error) {
          const hostId = getHostIdFromModelKey(model);
          if (hostId) {
            setHostStatuses((prev) => ({ ...prev, [hostId]: "failed" }));
          }
          const detail =
            error instanceof Error ? error.message : "Unknown error";
          setModelChats((prev) => {
            const current = prev[model] || {
              modelName: getBaseModelName(model),
              messages: [],
              isLoading: false,
            };
            const currentMessages: Message[] = [...current.messages];
            const errorText = `Error: Could not get response from ${getBaseModelName(model)}. ${detail}`;
            const nextMessages: Message[] = settings.enableMessageStreaming
              ? (() => {
                  if (
                    currentMessages.length > 0 &&
                    currentMessages[currentMessages.length - 1].role === "assistant"
                  ) {
                    currentMessages[currentMessages.length - 1] = {
                      ...currentMessages[currentMessages.length - 1],
                      content: errorText,
                    };
                    return currentMessages;
                  }
                  return [...currentMessages, { role: "assistant", content: errorText }];
                })()
              : [...currentMessages, { role: "assistant", content: errorText }];
            return {
              ...prev,
              [model]: {
                ...current,
                messages: nextMessages,
                isLoading: false,
              },
            };
          });
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
      generateWithOllama,
      getHostIdFromModelKey,
      getHostUrlById,
      getBaseModelName,
      buildSystemMessageForModel,
      convertUiMessagesToOllama,
      buildPromptForModel,
      modelChats,
      getBaseModelRef,
      settings.chatConfigEnabled,
      settings.chatConfigPrePrompt,
      settings.chatConfigPostPrompt,
      settings.chatConfigMaxOutputLength,
    ],
  );

  const stopInterModelChat = useCallback(() => {
    setIsInterModelChatActive(false);
    interChatActiveRef.current = false;
    pendingInterruptionRef.current = "";
    setPendingInterruption("");
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
      const base = getBaseModelRef(modelKey);
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
  }, [settings.allowSameModelMultiChat, selectedModels, getBaseModelRef]);

  const modelDisplayNameByKey = useMemo(() => {
    const seenCount: Record<string, number> = {};
    const totalCount: Record<string, number> = {};
    selectedModels.forEach((modelKey) => {
      const base = getBaseModelRef(modelKey);
      totalCount[base] = (totalCount[base] || 0) + 1;
    });

    const out: Record<string, string> = {};
    selectedModels.forEach((modelKey) => {
      const base = getBaseModelRef(modelKey);
      const { hostId, modelName } = parseModelRef(base);
      const hostLabel = normalizedHosts.find((host) => host.id === hostId)?.url || hostId;
      const compactHost = hostLabel.replace(/^https?:\/\//, "");
      seenCount[base] = (seenCount[base] || 0) + 1;
      const instanceLabel = totalCount[base] > 1 ? ` (${seenCount[base]})` : "";
      out[modelKey] = `${modelName}${instanceLabel}@${compactHost}`;
    });
    return out;
  }, [selectedModels, getBaseModelRef, parseModelRef, normalizedHosts]);

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

  const chatSessionItems = useMemo(
    () =>
      [...chatSessions]
        .filter((session) => sessionHasMessages(session))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((session) => {
          const baseRefs = new Set(
            session.selectedModels.map((modelKey) => getBaseModelRef(modelKey)),
          );
          const hostIds = new Set(
            session.selectedModels.map((modelKey) => getHostIdFromModelKey(modelKey)),
          );
          return {
            id: session.id,
            title: session.title || "New chat",
            updatedAt: session.updatedAt,
            modelCount: baseRefs.size,
            hostCount: Array.from(hostIds).filter(Boolean).length,
          };
        }),
    [chatSessions, getBaseModelRef, getHostIdFromModelKey],
  );

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsChatHistoryOpen(true)}
              className="h-8 w-8 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors inline-flex items-center justify-center"
              aria-label="Open chat history"
            >
              <PanelRightOpen className="h-4 w-4 text-foreground" />
            </button>
            {connectedLocalHost ? (
              <Popover
                open={isModelManagerOpen}
                onOpenChange={setIsModelManagerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors inline-flex items-center justify-center"
                    aria-label="Manage local models"
                  >
                    <Download className="h-4 w-4 text-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-80 max-h-[70vh] overflow-y-auto slim-scrollbar p-3 space-y-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Local Models</p>
                    <p className="text-[11px] text-muted-foreground break-all">
                      Host: {connectedLocalHost.url}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Downloaded</p>
                    <div className="space-y-1">
                      {localDownloadedModels.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No models downloaded.</p>
                      ) : (
                        localDownloadedModels.map((model) => {
                          const modelName = model.name;
                          const busy = modelActionStatus[modelName] === "deleting";
                          return (
                            <div
                              key={`local-${modelName}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-2 py-1.5"
                            >
                              <span className="text-xs truncate">
                                {modelName}
                                <span className="text-muted-foreground"> ({formatBytes(model.size)})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  requestDeleteModel(
                                    modelName,
                                    formatBytes(model.size),
                                  )
                                }
                                disabled={!!modelActionStatus[modelName]}
                                className="h-6 w-6 rounded border border-border inline-flex items-center justify-center hover:bg-muted disabled:opacity-50"
                                aria-label={`Delete ${modelName}`}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Available to download</p>
                    <div className="space-y-1">
                      {localNotDownloadedModels.map((model) => {
                        const modelName = model.name;
                        const busy = modelActionStatus[modelName] === "downloading";
                        return (
                          <div
                            key={`catalog-${modelName}`}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-2 py-1.5"
                          >
                            <span className="text-xs truncate">
                              {modelName}
                              <span className="text-muted-foreground"> ({model.sizeLabel})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                requestDownloadModel(modelName, model.sizeLabel)
                              }
                              disabled={!!modelActionStatus[modelName]}
                              className="h-6 w-6 rounded border border-border inline-flex items-center justify-center hover:bg-muted disabled:opacity-50"
                              aria-label={`Download ${modelName}`}
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled
                      className="h-8 w-8 rounded-full border border-border bg-card text-muted-foreground opacity-60 cursor-not-allowed inline-flex items-center justify-center"
                      aria-label="Manage local models"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Local Ollama is not connected. Connect localhost/127.0.0.1 in
                    Settings to manage downloads.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-2 justify-self-center">
              <img
                src={`${PUBLIC_BASE_PATH}/logo-black.png`}
                alt="Multi Llama Chat logo"
                className="h-5 w-5 object-contain dark:hidden"
              />
              <img
                src={`${PUBLIC_BASE_PATH}/logo.png`}
                alt="Multi Llama Chat logo"
                className="hidden h-5 w-5 object-contain dark:block"
              />
            <h1 className="text-xs font-semibold tracking-wide text-foreground">
              Multi Llama Chat
            </h1>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
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
                enableMessageStreaming={settings.enableMessageStreaming}
              />
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <img
                src={`${PUBLIC_BASE_PATH}/logo-black.png`}
                alt="Multi Llama Chat logo"
                className="h-20 w-20 object-contain mx-auto mb-3 dark:hidden"
              />
              <img
                src={`${PUBLIC_BASE_PATH}/logo.png`}
                alt="Multi Llama Chat logo"
                className="hidden h-20 w-20 object-contain mx-auto mb-3 dark:block"
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
            className={`w-full mx-auto overflow-x-auto slim-scrollbar ${isInterModelChatActive ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="flex w-max min-w-full justify-center gap-1.5">
            {availableModels.map((model) => {
              const hostLabel = model.hostUrl.replace(/^https?:\/\//, "");
              const chipLabel = truncateMiddle(`${model.modelName}@${hostLabel}`, 22);
              const modifiedDate = model.modifiedAt
                ? new Date(model.modifiedAt).toLocaleString()
                : "-";
              const instanceCount = selectedModels.filter(
                (modelKey) => getBaseModelRef(modelKey) === model.modelRef,
              ).length;
              const isSelected = instanceCount > 0;
              return (
                <HoverCard key={model.modelRef} openDelay={140}>
                  <HoverCardTrigger asChild>
                    <div
                      className={`inline-flex items-center rounded-full border text-sm transition-colors overflow-hidden ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border"
                      } shrink-0`}
                    >
                      <button
                        onClick={() => toggleModel(model.modelRef)}
                        className={`px-3 py-1 ${!isSelected ? "hover:bg-muted/40" : ""} max-w-[260px] truncate`}
                        aria-label={`Toggle ${model.modelName} on ${hostLabel}`}
                        title={`${model.modelName}@${hostLabel}`}
                      >
                        {chipLabel}
                        {instanceCount > 1 ? ` x${instanceCount}` : ""}
                      </button>
                      {settings.allowSameModelMultiChat && isSelected && (
                        <button
                          type="button"
                          onClick={() => addModelInstance(model.modelRef)}
                          disabled={isInterModelSelected || isInterModelChatActive}
                          className="h-full px-2.5 py-1 border-l border-primary-foreground/30 text-sm leading-none hover:bg-primary-foreground/15 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Add another ${model.modelName}`}
                        >
                          +
                        </button>
                      )}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent align="center" className="w-72 space-y-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{model.modelName}</p>
                      <p className="text-xs text-muted-foreground break-all">@{hostLabel}</p>
                    </div>
                    <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Size</span>
                      <span>{formatBytes(model.size)}</span>
                      <span className="text-muted-foreground">Family</span>
                      <span>{model.details?.family || "-"}</span>
                      <span className="text-muted-foreground">Params</span>
                      <span>{model.details?.parameterSize || "-"}</span>
                      <span className="text-muted-foreground">Quant</span>
                      <span>{model.details?.quantizationLevel || "-"}</span>
                      <span className="text-muted-foreground">Format</span>
                      <span>{model.details?.format || "-"}</span>
                      <span className="text-muted-foreground">Updated</span>
                      <span>{modifiedDate}</span>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
            </div>
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
              {messageQueue.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto slim-scrollbar pb-0.5">
                  {messageQueue.map((item) => {
                    const isProcessing = item.id === processingQueueId;
                    return (
                      <span
                        key={item.id}
                        className={`inline-flex max-w-[220px] items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
                          isProcessing
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                        ) : null}
                        <span className="truncate" title={queuePreview(item)}>
                          {queuePreview(item)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQueuedMessage(item.id)}
                          disabled={isProcessing}
                          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Remove queued message"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Queue {messageQueue.length}/{MAX_QUEUED_MESSAGES}
                  </span>
                </div>
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
                          ? `Inter-model running. Click to stop.${
                              currentThinkingModel
                                ? ` Thinking: ${truncateMiddle(
                                    modelDisplayNameByKey[currentThinkingModel] ||
                                      getBaseModelName(currentThinkingModel),
                                    24,
                                  )}`
                                : ""
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
                  disabled={isInterModelChatActive}
                  className="h-9 w-9 rounded-full border border-border bg-card hover:bg-muted/50 transition-colors inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Add attachment"
                >
                  <Paperclip className="h-4 w-4 text-foreground" />
                </button>
                <div className="relative flex-1">
                <Textarea
                  placeholder={
                    isInterModelChatActive
                      ? isMobileViewport
                        ? "Send interrupt message..."
                        : "Send interrupt message to guide the ongoing inter-model conversation..."
                      : isMobileViewport
                        ? "Ask something..."
                        : "Ask something... (use @model to target one or more selected models)"
                  }
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
                  (isInterModelChatActive &&
                    (!userInput.trim() || !!pendingInterruption.trim())) ||
                  (!isInterModelChatActive && isQueueFull) ||
                  selectedModels.length === 0 ||
                  (!userInput.trim() && attachments.length === 0)
                }
                aria-label="Send message"
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] transition-all shrink-0"
              >
                <Send className="h-4 w-4" />
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

      <ChatHistoryDrawer
        open={isChatHistoryOpen}
        onOpenChange={setIsChatHistoryOpen}
        sessions={chatSessionItems}
        activeSessionId={activeChatId}
        onSelectSession={switchToChat}
        onDeleteSession={(chatId) => setPendingDeleteChatId(chatId)}
        onNewChat={startNewChat}
      />

      <ConfirmDlg
        open={!!pendingModelConfirm}
        onOpenChange={(open) => {
          if (!open) setPendingModelConfirm(null);
        }}
        title={
          pendingModelConfirm?.action === "delete"
            ? "Delete local model?"
            : "Download model?"
        }
        description={
          pendingModelConfirm
            ? pendingModelConfirm.action === "delete"
              ? `Delete ${pendingModelConfirm.modelName}${pendingModelConfirm.sizeLabel ? ` (${pendingModelConfirm.sizeLabel})` : ""} from local Ollama? This action cannot be undone.`
              : `Download ${pendingModelConfirm.modelName}${pendingModelConfirm.sizeLabel ? ` (${pendingModelConfirm.sizeLabel})` : ""}? This may take some time depending on your internet speed.`
            : ""
        }
        confirmText={pendingModelConfirm?.action === "delete" ? "Delete" : "Download"}
        confirmClassName={
          pendingModelConfirm?.action === "delete"
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : undefined
        }
        onConfirm={() => void confirmPendingModelAction()}
      />

      <ConfirmDlg
        open={!!chatRouteAlert}
        onOpenChange={(open) => {
          if (!open) setChatRouteAlert(null);
        }}
        title="Chat not found"
        description={
          chatRouteAlert
            ? `No chat exists for chatid "${chatRouteAlert.requestedId}". Opened a new chat instead.`
            : ""
        }
        confirmText="OK"
        hideCancel
        onConfirm={() => setChatRouteAlert(null)}
      />

      <ConfirmDlg
        open={pendingClearChatsConfirm}
        onOpenChange={setPendingClearChatsConfirm}
        title="Clear saved chats?"
        description="This will remove all locally saved chat history for this app."
        confirmText="Clear"
        onConfirm={() => {
          clearPersistedData();
          setPendingClearChatsConfirm(false);
        }}
      />

      <ConfirmDlg
        open={!!pendingDeleteChatId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteChatId(null);
        }}
        title="Delete chat?"
        description="This chat will be removed from local history."
        confirmText="Delete"
        confirmClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onConfirm={() => {
          if (!pendingDeleteChatId) return;
          deleteChatSession(pendingDeleteChatId);
          setPendingDeleteChatId(null);
        }}
      />

      <SettingsDrawer
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        hostStatuses={hostStatuses}
        onAddHost={addHost}
        onRemoveHost={removeHost}
        onHostUrlChange={(hostId, value) =>
          setSettings((prev) => ({
            ...prev,
            hosts: prev.hosts.map((host) =>
              host.id === hostId ? { ...host, url: value } : host,
            ),
          }))
        }
        onHostUrlBlur={(hostId) =>
          setSettings((prev) => ({
            ...prev,
            hosts: prev.hosts.map((host) =>
              host.id === hostId
                ? { ...host, url: normalizeOllamaBaseUrl(host.url) }
                : host,
            ),
          }))
        }
        onTestHostConnection={testHostConnection}
        onOpenNetworkScan={() => {
          setIsNetworkScanOpen(true);
        }}
        onPersistDataChange={(checked) =>
          setSettings((prev) => ({
            ...prev,
            persistDataLocally: checked,
          }))
        }
        onEnableRolesChange={(checked) =>
          setSettings((prev) => ({
            ...prev,
            enableRoles: checked,
          }))
        }
        onAllowSameModelMultiChatChange={(checked) =>
          setSettings((prev) => ({
            ...prev,
            allowSameModelMultiChat: checked,
          }))
        }
        onEnableMessageStreamingChange={(checked) =>
          setSettings((prev) => {
            if (isInterModelChatActive) return prev;
            return {
              ...prev,
              enableMessageStreaming: checked,
            };
          })
        }
        onChatConfigEnabledChange={(checked) =>
          setSettings((prev) => ({
            ...prev,
            chatConfigEnabled: checked,
          }))
        }
        onChatConfigPrePromptChange={(value) =>
          setSettings((prev) => ({
            ...prev,
            chatConfigPrePrompt: value,
          }))
        }
        onChatConfigPostPromptChange={(value) =>
          setSettings((prev) => ({
            ...prev,
            chatConfigPostPrompt: value,
          }))
        }
        onChatConfigMaxOutputLengthChange={(value) =>
          setSettings((prev) => ({
            ...prev,
            chatConfigMaxOutputLength: value,
          }))
        }
        onClearSavedChats={() => setPendingClearChatsConfirm(true)}
        canInstallPwa={canInstallPwa}
        canUpdatePwa={canUpdatePwa}
        isUpdatingPwa={isUpdatingPwa}
        onInstallPwa={installPwa}
        onUpdatePwa={updatePwa}
        isInterModelChatActive={isInterModelChatActive}
      />

      <NetworkScanDialog
        open={isNetworkScanOpen}
        onOpenChange={setIsNetworkScanOpen}
        isScanning={isNetworkScanning}
        scanError={scanErrorMessage}
        items={scannedHosts}
        configuredHostUrls={normalizedHosts.map((host) => host.url)}
        addedHostUrls={addedScannedHostUrls}
        onScan={startNetworkScan}
        onAddHost={addScannedHost}
      />

      <OnboardingDialog
        open={isOnboardingOpen}
        onboardingStep={onboardingStep}
        onboardingSteps={onboardingSteps}
        publicBasePath={PUBLIC_BASE_PATH}
        onBack={() => {
          if (onboardingStep === 0) return;
          setOnboardingStep((prev) => Math.max(0, prev - 1));
        }}
        onNext={() =>
          setOnboardingStep((prev) =>
            Math.min(onboardingSteps.length - 1, prev + 1),
          )
        }
        onFinish={completeOnboarding}
      />

      <OllamaSetupAlertDialog
        open={showOllamaSetupAlert}
        onOpenChange={setShowOllamaSetupAlert}
        apiBaseUrl={apiBaseUrl}
        didCopyInstallCommand={didCopyInstallCommand}
        didCopyNetworkCommand={didCopyNetworkCommand}
        ollamaNetworkCommand={ollamaNetworkCommand}
        ollamaNetworkCommandLabel={ollamaNetworkCommandLabel}
        onCopyInstallCommand={copyInstallCommand}
        onCopyNetworkCommand={copyNetworkCommand}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
          setShowOllamaSetupAlert(false);
        }}
      />
    </div>
  );
}
