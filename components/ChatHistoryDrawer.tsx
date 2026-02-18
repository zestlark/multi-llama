import React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";

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
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
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
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
