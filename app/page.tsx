"use client";

import React from "react";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, Loader2, Workflow } from "lucide-react";
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

export default function Home() {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
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
  const startInterModelChatRef = useRef<
    ((seed?: string) => Promise<void>) | null
  >(null);

  // Fetch available models from Ollama
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("http://localhost:11434/api/tags");
        if (!response.ok) throw new Error("Failed to fetch models");
        const data = await response.json();
        const modelNames = data.models?.map((m: any) => m.name) || [];
        setAvailableModels(modelNames);
        setOllamaError("");
      } catch (error) {
        console.error("[v0] Error fetching models:", error);
        setOllamaError(
          "Could not connect to Ollama. Make sure Ollama is running on localhost:11434",
        );
      }
    };

    fetchModels();
  }, []);

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

    const messageContent = userInput;
    setUserInput("");
    setIsAllLoading(true);

    if (isInterModelSelected) {
      const firstModel = selectedModels[0];
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
        await startInterModelChatRef.current(messageContent);
      }
      setIsAllLoading(false);
      return;
    }

    // Add user message to all model chats
    setModelChats((prev) => {
      const updated = { ...prev };
      selectedModels.forEach((model) => {
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

    if (isInterModelSelected) {
      setIsInterModelSelected(false);
      if (startInterModelChatRef.current) {
        await startInterModelChatRef.current(messageContent);
      }
      setIsAllLoading(false);
      return;
    }
    // Send message to all models in parallel
    const promises = selectedModels.map(async (model) => {
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
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
  }, [userInput, selectedModels, isInterModelSelected]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
    async (seedOverride?: string) => {
      if (selectedModels.length < 2) return;
      let seed =
        (seedOverride ?? getLastAssistantMessageAny()) ||
        getLastUserMessageAny();
      if (!seed) return;
      setIsInterModelChatActive(true);
      interChatActiveRef.current = true;
      let currentIndex = 0;
      while (interChatActiveRef.current) {
        const model = selectedModels[currentIndex];
        setCurrentThinkingModel(model);
        try {
          setModelChats((prev) => ({
            ...prev,
            [model]: {
              ...prev[model],
              isLoading: true,
            },
          }));
          const response = await fetch("http://localhost:11434/api/generate", {
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
        currentIndex = (currentIndex + 1) % selectedModels.length;
        await new Promise((r) => setTimeout(r, 400));
      }
      setCurrentThinkingModel("");
    },
    [
      selectedModels,
      getLastAssistantMessageAny,
      getLastUserMessageAny,
      getLastMessageOfRole,
    ],
  );

  const stopInterModelChat = useCallback(() => {
    setIsInterModelChatActive(false);
    interChatActiveRef.current = false;
  }, []);

  useEffect(() => {
    startInterModelChatRef.current = startInterModelChat;
  }, [startInterModelChat]);
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Chat Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex gap-6 p-6 bg-gradient-to-b from-background to-background"
      >
        {selectedModels.length > 0 ? (
          selectedModels.map((model) => (
            <div
              key={model}
              className={`flex-shrink-0 w-full ${selectedModels.length === 1 ? "max-w-none" : "max-w-2xl"}`}
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
              <p className="text-muted-foreground mb-8 max-w-md">
                Compare responses from multiple AI models side-by-side. Add a
                model to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background p-6">
        {ollamaError && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200 text-sm">
            {ollamaError}
          </div>
        )}

        <div className="max-w-7xl mx-auto space-y-3">
          <div
            className={`${selectedModels.length === 1 ? "max-w-none" : "max-w-2xl"} w-full mx-auto flex gap-2 flex-wrap justify-center ${isInterModelChatActive ? "opacity-50 pointer-events-none" : ""}`}
          >
            {availableModels.map((model) => {
              const isSelected = selectedModels.includes(model);
              return (
                <button
                  key={model}
                  onClick={() => toggleModel(model)}
                  className={`px-3 py-1 rounded-full border text-sm transition-colors ${
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
            <div className="max-w-2xl w-full mx-auto flex gap-2 items-center">
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
                      className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-200 ${
                        isInterModelChatActive
                          ? "bg-green-600 border-green-700 text-white shadow-[0_0_10px_rgba(22,163,74,0.5)] animate-pulse"
                          : isInterModelSelected
                            ? "bg-green-500 border-green-600 text-white hover:bg-green-600 shadow-sm"
                            : selectedModels.length < 2
                              ? "opacity-40 cursor-not-allowed bg-muted text-muted-foreground"
                              : "bg-card border-input hover:bg-accent hover:text-accent-foreground text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                      }`}
                      aria-label="Inter-model communication"
                    >
                      <Workflow className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {selectedModels.length < 2
                      ? "Select at least 2 models for inter-model communication"
                      : isInterModelChatActive
                        ? `Inter-model: Thinking: ${currentThinkingModel || "..."}`
                        : isInterModelSelected
                          ? "Inter-model: Selected (send to start)"
                          : "Inter-model: Off"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Textarea
                placeholder="Ask something..."
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  handleAutoResize(e.target);
                }}
                onKeyDown={handleKeyDown}
                disabled={isAllLoading || isInterModelChatActive}
                className="flex-1 bg-card border border-border text-base px-4 py-2 rounded-lg resize-none min-h-[44px]"
                rows={1}
                ref={(el) => handleAutoResize(el)}
              />
              <Button
                onClick={sendMessage}
                disabled={
                  isAllLoading ||
                  isInterModelChatActive ||
                  selectedModels.length === 0 ||
                  !userInput.trim()
                }
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
              >
                {isAllLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
