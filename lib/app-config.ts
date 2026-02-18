import type { ChatSession, UserSettings } from "@/lib/app-types";
import { DEFAULT_MODEL_ROLE, PRESET_MODEL_ROLES } from "@/lib/model-roles";

export const SETTINGS_STORAGE_KEY = "multi_llama_settings_v1";
export const CHAT_STATE_STORAGE_KEY = "multi_llama_chat_state_v1";
export const ONBOARDING_DONE_STORAGE_KEY = "multi_llama_onboarding_done_v1";
export const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const DEFAULT_ROLE = DEFAULT_MODEL_ROLE;
export const MODEL_INSTANCE_DELIMITER = "::instance::";
export const MODEL_REF_DELIMITER = "::host_model::";

export const BUILT_IN_ROLES = PRESET_MODEL_ROLES;

export const DEFAULT_SETTINGS: UserSettings = {
  hosts: [{ id: "host-local", url: "http://127.0.0.1:11434" }],
  persistDataLocally: true,
  enableRoles: true,
  allowSameModelMultiChat: true,
  chatConfigEnabled: false,
  chatConfigPrePrompt: "",
  chatConfigPostPrompt: "",
  chatConfigMaxOutputLength: null,
};

export const createChatSession = (
  seed?: Partial<
    Pick<ChatSession, "selectedModels" | "modelChats" | "modelRoles" | "title">
  >,
): ChatSession => {
  const now = Date.now();
  return {
    id: `chat-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: seed?.title || "New chat",
    createdAt: now,
    updatedAt: now,
    selectedModels: seed?.selectedModels || [],
    modelChats: seed?.modelChats || {},
    modelRoles: seed?.modelRoles || {},
  };
};
