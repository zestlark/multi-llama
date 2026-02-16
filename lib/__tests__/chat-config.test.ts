import {
  applyOutputLengthLimit,
  buildPromptWithChatConfiguration,
  normalizeChatConfiguration,
} from "@/lib/chat-config";

describe("chat-config helpers", () => {
  it("normalizes defaults and invalid values", () => {
    expect(normalizeChatConfiguration(undefined)).toEqual({
      enabled: false,
      prePrompt: "",
      postPrompt: "",
      maxOutputLength: null,
    });

    expect(
      normalizeChatConfiguration({
        enabled: true,
        prePrompt: "a",
        postPrompt: "b",
        maxOutputLength: -10,
      }),
    ).toEqual({
      enabled: true,
      prePrompt: "a",
      postPrompt: "b",
      maxOutputLength: null,
    });
  });

  it("builds prompt with pre/post and output hint when enabled", () => {
    const prompt = buildPromptWithChatConfiguration("user prompt", {
      enabled: true,
      prePrompt: "system pre",
      postPrompt: "system post",
      maxOutputLength: 300,
    });

    expect(prompt).toContain("system pre");
    expect(prompt).toContain("user prompt");
    expect(prompt).toContain("system post");
    expect(prompt).toContain("under 300 characters");
  });

  it("returns base prompt unchanged when config disabled", () => {
    expect(
      buildPromptWithChatConfiguration("hello", {
        enabled: false,
        prePrompt: "x",
        postPrompt: "y",
        maxOutputLength: 100,
      }),
    ).toBe("hello");
  });

  it("applies output length limit only when enabled", () => {
    const long = "a".repeat(20);
    expect(
      applyOutputLengthLimit(long, {
        enabled: true,
        prePrompt: "",
        postPrompt: "",
        maxOutputLength: 10,
      }),
    ).toBe(`${"a".repeat(10)}…`);

    expect(
      applyOutputLengthLimit(long, {
        enabled: false,
        prePrompt: "",
        postPrompt: "",
        maxOutputLength: 10,
      }),
    ).toBe(long);
  });
});

