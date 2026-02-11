'use client'

import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSectionProps {
  model: string
  chat: {
    modelName: string
    messages: Message[]
    isLoading: boolean
  }
}

export default function ChatSection({ model, chat }: ChatSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [chat.messages])

  return (
    <Card className="flex-shrink-0 w-96 h-full flex flex-col bg-card border border-border">
      {/* Model Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <h3 className="font-semibold text-sm text-foreground">
          {model}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {chat.messages.length} messages
        </p>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="flex flex-col gap-3 p-4">
          {chat.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground">
                No messages yet. Start chatting!
              </p>
            </div>
          ) : (
            chat.messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm break-words ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary text-foreground rounded-bl-none border border-border'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {chat.isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary text-foreground px-3 py-2 rounded-lg border border-border flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}
