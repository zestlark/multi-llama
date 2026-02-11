'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2, MessageCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ModelChatProps {
  model: string
  chat: {
    modelName: string
    messages: Message[]
    isLoading: boolean
  }
  onRemove: () => void
}

export default function ModelChat({ model, chat, onRemove }: ModelChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages, chat.isLoading])

  return (
    <Card className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-card to-card/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold text-foreground text-sm">{model}</h3>
            <p className="text-xs text-muted-foreground">
              {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label={`Remove ${model}`}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-6 bg-background">
        {chat.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageCircle className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No messages yet
            </p>
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
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                } animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div
                  className={`max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed break-words ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary/50 text-foreground rounded-bl-none border border-border/50'
                  }`}
                >
                  {message.content}
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
  )
}
