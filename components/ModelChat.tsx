"use client";

import { useEffect, useRef, ReactNode, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle, Copy, Check } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelChatProps {
  model: string;
  chat: {
    modelName: string;
    messages: Message[];
    isLoading: boolean;
  };
  onRemove: () => void;
  disableRemove?: boolean;
}

export default function ModelChat({
  model,
  chat,
  onRemove,
  disableRemove,
}: ModelChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
          <code className="font-mono whitespace-pre">{code}</code>
        </pre>
        <button
          onClick={onCopy}
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-card/70 px-2 py-1 text-xs text-foreground hover:bg-card transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-primary" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    );
  }

  const renderTextSegment = (text: string) => {
    const segments: ReactNode[] = [];
    let i = 0;
    while (i < text.length) {
      const start = text.indexOf("`", i);
      if (start === -1) {
        segments.push(
          <span key={`t-${i}`} className="whitespace-pre-wrap">
            {text.slice(i)}
          </span>,
        );
        break;
      }
      if (start > i) {
        segments.push(
          <span key={`t-${i}`} className="whitespace-pre-wrap">
            {text.slice(i, start)}
          </span>,
        );
      }
      const end = text.indexOf("`", start + 1);
      if (end === -1) {
        segments.push(
          <span key={`t-${start}`} className="whitespace-pre-wrap">
            {text.slice(start)}
          </span>,
        );
        break;
      }
      const code = text.slice(start + 1, end);
      segments.push(
        <code
          key={`c-${start}`}
          className="font-mono bg-muted text-foreground/90 px-1 py-0.5 rounded whitespace-pre-wrap"
        >
          {code}
        </code>,
      );
      i = end + 1;
    }
    return <>{segments}</>;
  };

  const renderMessageContent = (content: string) => {
    const parts: ReactNode[] = [];
    let i = 0;
    while (i < content.length) {
      const fenceStart = content.indexOf("```", i);
      if (fenceStart === -1) {
        parts.push(
          <div key={`p-${i}`}>{renderTextSegment(content.slice(i))}</div>,
        );
        break;
      }
      if (fenceStart > i) {
        parts.push(
          <div key={`p-${i}`}>
            {renderTextSegment(content.slice(i, fenceStart))}
          </div>,
        );
      }
      const fenceEnd = content.indexOf("```", fenceStart + 3);
      if (fenceEnd === -1) {
        parts.push(
          <div key={`p-${fenceStart}`}>
            {renderTextSegment(content.slice(fenceStart))}
          </div>,
        );
        break;
      }
      let block = content.slice(fenceStart + 3, fenceEnd);
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

  return (
    <Card className="h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/70 bg-card flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 shrink-0" />
          <h3 className="font-medium text-foreground text-xs truncate">{model}</h3>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {chat.messages.length} msg
          </span>
        </div>
        <button
          onClick={disableRemove ? undefined : onRemove}
          className={`text-muted-foreground transition-colors p-0.5 text-xs ${
            disableRemove
              ? "opacity-40 cursor-not-allowed"
              : "hover:text-foreground"
          }`}
          aria-label={`Remove ${model}`}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 bg-background">
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
            {chat.messages.map((message, idx) => (
              <div
                key={`${idx}-${message.role}`}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-xl px-4 py-3 rounded-lg text-sm leading-relaxed break-words ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-secondary/50 text-foreground rounded-bl-none border border-border/50"
                  }`}
                >
                  {renderMessageContent(message.content)}
                </div>
              </div>
            ))}

            {chat.isLoading && (
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
    </Card>
  );
}
