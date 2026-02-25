"use client";

import { useEffect, useRef, ReactNode, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageCircle, Copy, Check, Plus } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelChatProps {
  model: string;
  role: string;
  roleOptions: string[];
  onRoleChange: (role: string) => void;
  enableRoleAssignment?: boolean;
  chat: {
    modelName: string;
    messages: Message[];
    isLoading: boolean;
  };
  onDuplicate?: () => void;
  disableDuplicate?: boolean;
  onRemove: () => void;
  disableRemove?: boolean;
  enableMessageStreaming?: boolean;
}

export default function ModelChat({
  model,
  role,
  roleOptions,
  onRoleChange,
  enableRoleAssignment = true,
  chat,
  onDuplicate,
  disableDuplicate,
  onRemove,
  disableRemove,
  enableMessageStreaming = false,
}: ModelChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roleDraft, setRoleDraft] = useState(role);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  useEffect(() => {
    setRoleDraft(role);
  }, [role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
      inline: "nearest",
    });
  }, [chat.messages, chat.isLoading]);

  function CodeBlock({ code, lang }: { code: string; lang?: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    };
    return (
      <div className="relative">
        <pre
          className="mt-2 mb-1 max-w-full overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground"
          data-lang={lang || undefined}
        >
          <code className="font-mono whitespace-pre">{renderHighlightedCode(code, lang)}</code>
        </pre>
        <button
          onClick={onCopy}
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-card/70 px-2 py-1 text-xs text-foreground hover:bg-card transition-colors"
          aria-label="Copy code"
          title={copied ? "Copied" : "Copy code"}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  }

  const renderHighlightedCode = (code: string, lang?: string) => {
    type TokenType = "plain" | "comment" | "string" | "keyword" | "number" | "tag" | "attr";
    interface MatchToken {
      start: number;
      end: number;
      type: Exclude<TokenType, "plain">;
    }

    const language = (lang || "").toLowerCase();
    const keywords =
      language === "css"
        ? [
            "display",
            "position",
            "color",
            "background",
            "border",
            "padding",
            "margin",
            "width",
            "height",
            "font-size",
          ]
        : [
            "const",
            "let",
            "var",
            "function",
            "return",
            "if",
            "else",
            "for",
            "while",
            "class",
            "import",
            "from",
            "export",
            "new",
            "try",
            "catch",
            "throw",
            "async",
            "await",
            "interface",
            "type",
            "extends",
            "implements",
          ];

    const keywordRegex =
      keywords.length > 0
        ? new RegExp(`\\b(?:${keywords.map((k) => k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`, "g")
        : null;

    const patterns: Array<{ regex: RegExp; type: MatchToken["type"] }> = [
      { regex: /\/\/.*$/gm, type: "comment" },
      { regex: /\/\*[\s\S]*?\*\//g, type: "comment" },
      {
        regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
        type: "string",
      },
      ...(keywordRegex ? [{ regex: keywordRegex, type: "keyword" as const }] : []),
      { regex: /\b\d+(?:\.\d+)?\b/g, type: "number" },
      { regex: /<\/?[A-Za-z][^>]*>/g, type: "tag" },
      { regex: /\b[A-Za-z-]+(?==)/g, type: "attr" },
    ];

    const matches: MatchToken[] = [];
    patterns.forEach(({ regex, type }) => {
      const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
      let match = re.exec(code);
      while (match) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
        });
        match = re.exec(code);
      }
    });

    matches.sort((a, b) => (a.start === b.start ? b.end - b.start - (a.end - a.start) : a.start - b.start));

    const merged: Array<{ text: string; type: TokenType }> = [];
    let cursor = 0;
    matches.forEach((m) => {
      if (m.start < cursor) return;
      if (m.start > cursor) {
        merged.push({ text: code.slice(cursor, m.start), type: "plain" });
      }
      merged.push({ text: code.slice(m.start, m.end), type: m.type });
      cursor = m.end;
    });
    if (cursor < code.length) {
      merged.push({ text: code.slice(cursor), type: "plain" });
    }

    const tokenClass: Record<TokenType, string> = {
      plain: "text-foreground",
      comment: "text-emerald-500",
      string: "text-amber-500",
      keyword: "text-sky-500",
      number: "text-fuchsia-500",
      tag: "text-cyan-500",
      attr: "text-violet-500",
    };

    return merged.map((token, idx) => (
      <span key={`tok-${idx}`} className={tokenClass[token.type]}>
        {token.text}
      </span>
    ));
  };

  const renderTextSegment = (text: string) => {
    const segments: ReactNode[] = [];
    let i = 0;
    while (i < text.length) {
      const inlineMatch = /(`[^`]+`|\*\*[^*]+\*\*)/g;
      inlineMatch.lastIndex = i;
      const match = inlineMatch.exec(text);
      if (!match) {
        segments.push(
          <span key={`t-${i}`} className="whitespace-pre-wrap">
            {text.slice(i)}
          </span>,
        );
        break;
      }
      const start = match.index;
      if (start > i) {
        segments.push(
          <span key={`t-${i}`} className="whitespace-pre-wrap">
            {text.slice(i, start)}
          </span>,
        );
      }
      const token = match[0];
      if (token.startsWith("`") && token.endsWith("`")) {
        const code = token.slice(1, -1);
        segments.push(
          <code
            key={`c-${start}`}
            className="font-mono bg-muted text-foreground/90 px-1 py-0.5 rounded whitespace-pre-wrap"
          >
            {code}
          </code>,
        );
      } else if (token.startsWith("**") && token.endsWith("**")) {
        const strongText = token.slice(2, -2);
        segments.push(
          <strong key={`b-${start}`} className="font-semibold">
            {strongText}
          </strong>,
        );
      }
      i = start + token.length;
    }
    return <>{segments}</>;
  };

  const renderTextSections = (text: string, keyPrefix: string) => {
    const blocks = text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (blocks.length === 0) {
      return <p className="whitespace-pre-wrap">{renderTextSegment(text)}</p>;
    }

    return (
      <div className="space-y-2.5">
        {blocks.map((block, index) => {
          const blockKey = `${keyPrefix}-${index}`;
          const blockLines = block.split("\n");
          const firstHeadingMatch = blockLines[0]?.trim().match(/^(#{1,6})\s+(.+)$/);
          if (firstHeadingMatch) {
            const level = Math.min(6, firstHeadingMatch[1].length);
            const title = firstHeadingMatch[2];
            const sizeClass =
              level <= 2 ? "text-sm font-semibold" : "text-xs font-semibold";
            const rest = blockLines.slice(1).join("\n").trim();
            return (
              <div key={blockKey} className="space-y-1.5">
                <p className={`${sizeClass} text-foreground`}>
                  {renderTextSegment(title)}
                </p>
                {rest ? (
                  <div className="text-[inherit]">{renderTextSections(rest, `${blockKey}-rest`)}</div>
                ) : null}
              </div>
            );
          }

          const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
          const isBulletList = lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
          if (isBulletList) {
            return (
              <ul key={blockKey} className="list-disc pl-5 space-y-1">
                {lines.map((line, li) => (
                  <li key={`${blockKey}-li-${li}`}>{renderTextSegment(line.replace(/^[-*]\s+/, ""))}</li>
                ))}
              </ul>
            );
          }

          const isOrderedList =
            lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
          if (isOrderedList) {
            return (
              <ol key={blockKey} className="list-decimal pl-5 space-y-1">
                {lines.map((line, li) => (
                  <li key={`${blockKey}-li-${li}`}>
                    {renderTextSegment(line.replace(/^\d+\.\s+/, ""))}
                  </li>
                ))}
              </ol>
            );
          }

          return (
            <p key={blockKey} className="whitespace-pre-wrap">
              {renderTextSegment(block)}
            </p>
          );
        })}
      </div>
    );
  };

  const normalizeNamedCodeSections = (content: string) => {
    const lines = content.split("\n");
    const output: string[] = [];
    const detectHeader = (line: string) =>
      line.match(
        /^(html|css|javascript|typescript|js|ts|json|bash|shell|python|sql|xml|yaml)(?:\s*\([^)]+\))?\s*:?$/i,
      );
    const mapLang = (label: string) => {
      const lower = label.toLowerCase();
      if (lower === "js") return "javascript";
      if (lower === "ts") return "typescript";
      if (lower === "shell") return "bash";
      return lower;
    };
    const looksLikeCodeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return (
        /^<\/?[a-zA-Z!][^>]*>/.test(trimmed) ||
        /[{};<>]/.test(trimmed) ||
        /^\.[\w-]+\s*\{/.test(trimmed) ||
        /^[\w-]+\s*:\s*.+;?$/.test(trimmed) ||
        /^(const|let|var|function|class|if|for|while|return|import|export)\b/.test(
          trimmed,
        )
      );
    };

    let i = 0;
    while (i < lines.length) {
      const headerMatch = detectHeader(lines[i].trim());
      if (!headerMatch) {
        output.push(lines[i]);
        i += 1;
        continue;
      }

      let start = i + 1;
      while (start < lines.length && lines[start].trim() === "") start += 1;
      if (start >= lines.length || !looksLikeCodeLine(lines[start])) {
        output.push(lines[i]);
        i += 1;
        continue;
      }

      const sectionTitle = lines[i].trim();
      const lang = mapLang(headerMatch[1]);
      let end = start;
      while (end < lines.length) {
        const current = lines[end].trim();
        const isNextSection = !!detectHeader(current);
        const isNarrativeHeading =
          /^#{1,6}\s+/.test(current) || /^explanation\b/i.test(current);
        if ((isNextSection || isNarrativeHeading) && end > start) break;
        end += 1;
      }

      const blockLines = lines.slice(start, end);
      while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === "") {
        blockLines.pop();
      }

      output.push(`**${sectionTitle}**`);
      output.push(`\`\`\`${lang}`);
      output.push(blockLines.join("\n"));
      output.push("```");
      i = end;
    }

    return output.join("\n");
  };

  const renderMessageContent = (content: string) => {
    const normalizedContent = normalizeNamedCodeSections(content);
    const parts: ReactNode[] = [];
    let i = 0;
    while (i < normalizedContent.length) {
      const fenceStart = normalizedContent.indexOf("```", i);
      if (fenceStart === -1) {
        parts.push(
          <div key={`p-${i}`}>{renderTextSections(normalizedContent.slice(i), `s-${i}`)}</div>,
        );
        break;
      }
      if (fenceStart > i) {
        parts.push(
          <div key={`p-${i}`} className="mb-1">
            {renderTextSections(normalizedContent.slice(i, fenceStart), `s-${i}`)}
          </div>,
        );
      }
      const fenceEnd = normalizedContent.indexOf("```", fenceStart + 3);
      if (fenceEnd === -1) {
        parts.push(
          <div key={`p-${fenceStart}`}>
            {renderTextSections(
              normalizedContent.slice(fenceStart),
              `s-${fenceStart}`,
            )}
          </div>,
        );
        break;
      }
      let block = normalizedContent.slice(fenceStart + 3, fenceEnd);
      let lang = "";
      const nl = block.indexOf("\n");
      if (nl !== -1) {
        lang = block.slice(0, nl).trim();
        block = block.slice(nl + 1);
      }
      parts.push(
        <CodeBlock key={`pre-${fenceStart}`} code={block} lang={lang} />,
      );
      i = fenceEnd + 3;
    }
    return <>{parts}</>;
  };

  const onCopyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(id);
      setTimeout(() => {
        setCopiedMessageId((prev) => (prev === id ? null : prev));
      }, 1500);
    } catch {}
  };

  const getRoleChipClass = (value: string) => {
    const key = value.trim().toLowerCase();
    const palette = [
      "bg-sky-500/15 text-sky-600 border-sky-500/30",
      "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
      "bg-amber-500/15 text-amber-600 border-amber-500/30",
      "bg-violet-500/15 text-violet-600 border-violet-500/30",
      "bg-rose-500/15 text-rose-600 border-rose-500/30",
      "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash + key.charCodeAt(i)) % 997;
    return palette[hash % palette.length];
  };

  const filteredRoles = roleOptions.filter((option) =>
    option.toLowerCase().includes(roleDraft.toLowerCase()),
  );
  const lastMessage = chat.messages[chat.messages.length - 1];
  const showStreamingTypingBubble =
    enableMessageStreaming &&
    chat.isLoading &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.trim().length === 0;
  const showStandaloneStreamingTypingBubble =
    enableMessageStreaming &&
    chat.isLoading &&
    !showStreamingTypingBubble &&
    !(lastMessage?.role === "assistant" && lastMessage.content.trim().length > 0);

  return (
    <Card className="h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/70 bg-card flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 shrink-0" />
          <h3
            className="font-medium text-foreground text-xs truncate max-w-[20ch] md:max-w-none"
            title={model}
          >
            {model}
          </h3>
          {enableRoleAssignment && (
            <button
              type="button"
              onClick={() => setIsRoleDialogOpen(true)}
              className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${getRoleChipClass(role)}`}
              aria-label={`Edit role for ${model}`}
            >
              {role}
            </button>
          )}
          <span className="text-[11px] text-muted-foreground shrink-0">
            {chat.messages.length} msg
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onDuplicate && (
            <button
              onClick={disableDuplicate ? undefined : onDuplicate}
              className={`text-muted-foreground transition-colors p-0.5 relative ${
                disableDuplicate
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:text-primary"
              }`}
              aria-label={`Duplicate ${model}`}
              title="Duplicate chat"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="absolute -right-0.5 -bottom-0.5 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Plus className="w-2 h-2" />
              </span>
            </button>
          )}
          <button
            onClick={disableRemove ? undefined : onRemove}
            className={`text-muted-foreground transition-colors p-0.5 text-xs ${
              disableRemove
                ? "opacity-40 cursor-not-allowed"
                : "hover:text-destructive"
            }`}
            aria-label={`Remove ${model}`}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="slim-scrollbar flex-1 overflow-y-auto flex flex-col gap-3 p-4 bg-background">
        {chat.messages.length === 0 && !chat.isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start a conversation to see responses
            </p>
          </div>
        ) : (
          <>
            {chat.messages.map((message, idx) => {
              const messageId = `${idx}-${message.role}`;
              const isCopied = copiedMessageId === messageId;
              const isAssistant = message.role === "assistant";
              const isStreamingPlaceholder =
                showStreamingTypingBubble && idx === chat.messages.length - 1;
              return (
                <div
                  key={messageId}
                  className={`group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    message.role === "user" ? "ml-auto" : "mr-auto"
                  }`}
                >
                  <div
                    className={`max-w-xl px-4 py-3 rounded-lg text-sm leading-relaxed break-words ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-secondary/50 text-foreground rounded-bl-none border border-border/50"
                    }`}
                  >
                    {isStreamingPlaceholder ? (
                      <div
                        className="flex items-center gap-1.5"
                        aria-label="Assistant is typing"
                      >
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70" />
                      </div>
                    ) : (
                      renderMessageContent(message.content)
                    )}
                  </div>

                  {isAssistant && !isStreamingPlaceholder ? (
                    <div className="mt-1 flex items-center">
                      <button
                        type="button"
                        onClick={() => onCopyMessage(messageId, message.content)}
                        className={`inline-flex items-center rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${
                          isCopied
                            ? "opacity-100"
                            : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        }`}
                        aria-label={`Copy message ${idx + 1}`}
                        title={isCopied ? "Copied" : "Copy message"}
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {showStandaloneStreamingTypingBubble && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-secondary/50 text-foreground px-4 py-3 rounded-lg border border-border/50 rounded-bl-none">
                  <div className="flex items-center gap-1.5" aria-label="Assistant is typing">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70" />
                  </div>
                </div>
              </div>
            )}

            {chat.isLoading && !enableMessageStreaming && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-secondary/50 text-foreground px-4 py-3 rounded-lg border border-border/50 rounded-bl-none flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <Dialog
        open={enableRoleAssignment && isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Choose a role for <code>{model}</code> or enter a custom one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              placeholder="Type role (e.g. tester, designer, pm)"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            />

            <div className="max-h-36 overflow-y-auto rounded-md border border-border p-2 flex flex-wrap gap-1.5">
              {filteredRoles.length > 0 ? (
                filteredRoles.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRoleDraft(option)}
                    className={`px-2 py-1 rounded-full border text-xs ${
                      roleDraft.toLowerCase() === option.toLowerCase()
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {option}
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No matching roles</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleDraft(role);
                setIsRoleDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onRoleChange(roleDraft);
                setIsRoleDialogOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
