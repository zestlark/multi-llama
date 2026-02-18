import React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";

interface ChatSessionListItem {
  id: string;
  title: string;
  updatedAt: number;
  modelCount: number;
  hostCount: number;
}

interface ChatHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSessionListItem[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
}

const formatUpdatedAt = (timestamp: number) => {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "";
  }
};

export default function ChatHistoryDrawer({
  open,
  onOpenChange,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}: ChatHistoryDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[360px] max-w-[92vw] px-5 sm:px-6 overflow-y-auto">
        <SheetHeader className="space-y-3">
          <SheetTitle>Chats</SheetTitle>
          <SheetDescription>
            Switch chats or start a new one.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          <Button type="button" variant="outline" className="w-full" onClick={onNewChat}>
            <Plus className="h-4 w-4 mr-1" />
            New chat
          </Button>

          <div className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className={`group w-full rounded-md border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="text-sm font-medium text-foreground truncate">
                        {session.title || "New chat"}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {session.modelCount} model{session.modelCount === 1 ? "" : "s"} • {session.hostCount} host{session.hostCount === 1 ? "" : "s"}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Updated {formatUpdatedAt(session.updatedAt)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSession(session.id)}
                      className="h-7 w-7 shrink-0 rounded-md border border-border inline-flex items-center justify-center hover:bg-destructive/10 hover:text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity"
                      aria-label={`Delete chat ${session.title || "New chat"}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
