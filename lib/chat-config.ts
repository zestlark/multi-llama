export interface ChatConfiguration {
  enabled: boolean;
  prePrompt: string;
  postPrompt: string;
  maxOutputLength: number | null;
}

const clampMaxOutputLength = (value: number | null) => {
  if (value == null || Number.isNaN(value)) return null;
  if (value <= 0) return null;
  return Math.min(Math.floor(value), 120000);
};

export const normalizeChatConfiguration = (
  config: Partial<ChatConfiguration> | null | undefined,
): ChatConfiguration => {
  return {
    enabled: Boolean(config?.enabled),
    prePrompt: typeof config?.prePrompt === "string" ? config.prePrompt : "",
    postPrompt: typeof config?.postPrompt === "string" ? config.postPrompt : "",
    maxOutputLength:
      typeof config?.maxOutputLength === "number"
        ? clampMaxOutputLength(config.maxOutputLength)
        : null,
  };
};

export const buildPromptWithChatConfiguration = (
  basePrompt: string,
  config: ChatConfiguration,
): string => {
  if (!config.enabled) return basePrompt;

  const parts: string[] = [];
  const pre = config.prePrompt.trim();
  const post = config.postPrompt.trim();
  if (pre) parts.push(pre);
  parts.push(basePrompt);
  if (post) parts.push(post);
  if (config.maxOutputLength && config.maxOutputLength > 0) {
    parts.push(
      `Output limit: Keep your final response under ${config.maxOutputLength} characters.`,
    );
  }
  return parts.join("\n\n").trim();
};

export const applyOutputLengthLimit = (
  output: string,
  config: ChatConfiguration,
): string => {
  if (!config.enabled || !config.maxOutputLength || config.maxOutputLength <= 0) {
    return output;
  }
  if (output.length <= config.maxOutputLength) return output;
  return `${output.slice(0, config.maxOutputLength).trimEnd()}…`;
};

