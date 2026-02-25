export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ModelChatData {
  modelName: string;
  messages: Message[];
  isLoading: boolean;
}

export interface UserSettings {
  hosts: Array<{ id: string; url: string }>;
  persistDataLocally: boolean;
  enableRoles: boolean;
  allowSameModelMultiChat: boolean;
  enableMessageStreaming: boolean;
  chatConfigEnabled: boolean;
  chatConfigPrePrompt: string;
  chatConfigPostPrompt: string;
  chatConfigMaxOutputLength: number | null;
}

export type HostConnectionStatus = "idle" | "testing" | "connected" | "failed";

export interface AvailableModelOption {
  hostId: string;
  hostUrl: string;
  modelName: string;
  modelRef: string;
  size?: number;
  modifiedAt?: string;
  details?: {
    family?: string;
    parameterSize?: string;
    quantizationLevel?: string;
    format?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  selectedModels: string[];
  modelChats: Record<string, ModelChatData>;
  modelRoles: Record<string, string>;
}

export interface PersistedChatState {
  chatSessions?: ChatSession[];
  activeChatId?: string;
  selectedModels?: string[];
  modelChats?: Record<string, ModelChatData>;
  modelRoles?: Record<string, string>;
  roleLibrary?: string[];
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "text";
  textContent?: string;
  base64Content?: string;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}
