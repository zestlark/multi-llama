'use client'

import React from "react"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Send, Loader2, Plus } from 'lucide-react'
import ModelChat from '@/components/ModelChat'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ModelChatData {
  modelName: string
  messages: Message[]
  isLoading: boolean
}

export default function Home() {
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [modelChats, setModelChats] = useState<Record<string, ModelChatData>>({})
  const [userInput, setUserInput] = useState('')
  const [isAllLoading, setIsAllLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch available models from Ollama
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags')
        if (!response.ok) throw new Error('Failed to fetch models')
        const data = await response.json()
        const modelNames = data.models?.map((m: any) => m.name) || []
        setAvailableModels(modelNames)
        setOllamaError('')
      } catch (error) {
        console.error('[v0] Error fetching models:', error)
        setOllamaError(
          'Could not connect to Ollama. Make sure Ollama is running on localhost:11434'
        )
      }
    }

    fetchModels()
  }, [])

  const addModel = useCallback(() => {
    if (selectedModel && !selectedModels.includes(selectedModel)) {
      setSelectedModels((prev) => [...prev, selectedModel])
      setModelChats((prev) => ({
        ...prev,
        [selectedModel]: {
          modelName: selectedModel,
          messages: [],
          isLoading: false,
        },
      }))
      setSelectedModel('')
    }
  }, [selectedModel, selectedModels])

  const removeModel = useCallback((model: string) => {
    setSelectedModels((prev) => prev.filter((m) => m !== model))
    setModelChats((prev) => {
      const updated = { ...prev }
      delete updated[model]
      return updated
    })
  }, [])

  const sendMessage = useCallback(async () => {
    if (!userInput.trim() || selectedModels.length === 0) return

    const messageContent = userInput
    setUserInput('')
    setIsAllLoading(true)

    // Add user message to all model chats
    setModelChats((prev) => {
      const updated = { ...prev }
      selectedModels.forEach((model) => {
        updated[model] = {
          ...updated[model],
          messages: [
            ...updated[model].messages,
            { role: 'user', content: messageContent },
          ],
          isLoading: true,
        }
      })
      return updated
    })

    // Send message to all models in parallel
    const promises = selectedModels.map(async (model) => {
      try {
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: messageContent,
            stream: false,
          }),
        })

        if (!response.ok) throw new Error(`Failed to get response from ${model}`)
        const data = await response.json()

        // Add assistant response
        setModelChats((prev) => ({
          ...prev,
          [model]: {
            ...prev[model],
            messages: [
              ...prev[model].messages,
              { role: 'assistant', content: data.response },
            ],
            isLoading: false,
          },
        }))
      } catch (error) {
        console.error(`[v0] Error with model ${model}:`, error)
        setModelChats((prev) => ({
          ...prev,
          [model]: {
            ...prev[model],
            messages: [
              ...prev[model].messages,
              { role: 'assistant', content: `Error: Could not get response from ${model}` },
            ],
            isLoading: false,
          },
        }))
      }
    })

    await Promise.all(promises)
    setIsAllLoading(false)
  }, [userInput, selectedModels])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isAllLoading && selectedModels.length > 0) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Chat Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex gap-6 p-6 bg-gradient-to-b from-background to-background"
      >
        {selectedModels.length > 0 ? (
          selectedModels.map((model) => (
            <div key={model} className="flex-shrink-0 w-full max-w-2xl">
              <ModelChat
                model={model}
                chat={modelChats[model] || {
                  modelName: model,
                  messages: [],
                  isLoading: false,
                }}
                onRemove={() => removeModel(model)}
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
                Compare responses from multiple AI models side-by-side. Add a model to get started.
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
          {/* Model Selection - Always Visible */}
          <div className="flex gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-64 bg-card border border-border">
                <SelectValue placeholder="Add another model..." />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={addModel}
              disabled={!selectedModel}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Selected Models Display */}
          {selectedModels.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {selectedModels.map((model) => (
                <div
                  key={model}
                  className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary px-3 py-1 rounded-full text-sm font-medium"
                >
                  {model}
                  <button
                    onClick={() => removeModel(model)}
                    className="hover:opacity-70 transition-opacity"
                    aria-label={`Remove ${model}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat Input - Only visible when models are selected */}
          {selectedModels.length > 0 && (
            <div className="flex gap-2">
              <Input
                placeholder="Ask something..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isAllLoading}
                className="flex-1 bg-card border border-border text-base py-6 px-4 rounded-lg"
              />
              <Button
                onClick={sendMessage}
                disabled={
                  isAllLoading ||
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
  )
}
