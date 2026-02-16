import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Download, Link2, Loader2, Plus, Trash2 } from "lucide-react";

interface HostSettingsItem {
  id: string;
  url: string;
}

type HostConnectionStatus = "idle" | "testing" | "connected" | "failed";

interface UserSettings {
  hosts: HostSettingsItem[];
  persistDataLocally: boolean;
  enableRoles: boolean;
  allowSameModelMultiChat: boolean;
  chatConfigEnabled: boolean;
  chatConfigPrePrompt: string;
  chatConfigPostPrompt: string;
  chatConfigMaxOutputLength: number | null;
}

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: UserSettings;
  hostStatuses: Record<string, HostConnectionStatus>;
  onAddHost: () => void;
  onRemoveHost: (hostId: string) => void;
  onHostUrlChange: (hostId: string, value: string) => void;
  onHostUrlBlur: (hostId: string) => void;
  onTestHostConnection: (hostId: string) => void | Promise<void>;
  onPersistDataChange: (checked: boolean) => void;
  onEnableRolesChange: (checked: boolean) => void;
  onAllowSameModelMultiChatChange: (checked: boolean) => void;
  onChatConfigEnabledChange: (checked: boolean) => void;
  onChatConfigPrePromptChange: (value: string) => void;
  onChatConfigPostPromptChange: (value: string) => void;
  onChatConfigMaxOutputLengthChange: (value: number | null) => void;
  onClearSavedChats: () => void;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
}

export default function SettingsDrawer({
  open,
  onOpenChange,
  settings,
  hostStatuses,
  onAddHost,
  onRemoveHost,
  onHostUrlChange,
  onHostUrlBlur,
  onTestHostConnection,
  onPersistDataChange,
  onEnableRolesChange,
  onAllowSameModelMultiChatChange,
  onChatConfigEnabledChange,
  onChatConfigPrePromptChange,
  onChatConfigPostPromptChange,
  onChatConfigMaxOutputLengthChange,
  onClearSavedChats,
  canInstallPwa,
  onInstallPwa,
}: SettingsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[380px] max-w-[92vw] px-5 sm:px-6 overflow-y-auto"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="space-y-3">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Configure Ollama hosts, chat behavior, persistence, and app install options.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Ollama Hosts</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2"
                onClick={onAddHost}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add host
              </Button>
            </div>

            <div className="space-y-2">
              {settings.hosts.map((host, index) => {
                const status = hostStatuses[host.id] || "idle";
                return (
                  <div key={host.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        id={`ollama-host-${host.id}`}
                        type="text"
                        value={host.url}
                        onChange={(e) => onHostUrlChange(host.id, e.target.value)}
                        onBlur={() => onHostUrlBlur(host.id)}
                        placeholder="http://127.0.0.1:11434"
                        className={`flex-1 h-9 rounded-md border bg-background px-3 text-sm transition-colors ${
                          status === "connected"
                            ? "border-emerald-300 ring-1 ring-emerald-200"
                            : status === "failed"
                              ? "border-rose-300 ring-1 ring-rose-200"
                              : "border-input"
                        }`}
                        aria-label={`Ollama host ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => onTestHostConnection(host.id)}
                        disabled={status === "testing"}
                        aria-label={`Test host ${index + 1}`}
                        title="Test host connection"
                      >
                        {status === "testing" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                      </Button>
                      {settings.hosts.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => onRemoveHost(host.id)}
                          aria-label={`Remove host ${index + 1}`}
                          title="Remove host"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Save chats locally</span>
              <Switch
                checked={settings.persistDataLocally}
                onCheckedChange={onPersistDataChange}
                aria-label="Persist data locally"
              />
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Enable Roles</span>
              <Switch
                checked={settings.enableRoles}
                onCheckedChange={onEnableRolesChange}
                aria-label="Enable role assignment"
              />
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Allow model duplicates</span>
              <Switch
                checked={settings.allowSameModelMultiChat}
                onCheckedChange={onAllowSameModelMultiChatChange}
                aria-label="Allow same model multiple instances"
              />
            </div>
          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">Chat configuration</span>
              <Switch
                checked={settings.chatConfigEnabled}
                onCheckedChange={onChatConfigEnabledChange}
                aria-label="Enable chat configuration"
              />
            </div>

            {settings.chatConfigEnabled && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="chat-config-pre-prompt"
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    Pre prompt (optional)
                  </label>
                  <textarea
                    id="chat-config-pre-prompt"
                    value={settings.chatConfigPrePrompt}
                    onChange={(e) => onChatConfigPrePromptChange(e.target.value)}
                    placeholder="Apply before user message"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="chat-config-post-prompt"
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    Post prompt (optional)
                  </label>
                  <textarea
                    id="chat-config-post-prompt"
                    value={settings.chatConfigPostPrompt}
                    onChange={(e) => onChatConfigPostPromptChange(e.target.value)}
                    placeholder="Apply after user message"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="chat-config-max-output-length"
                    className="text-[11px] font-medium text-muted-foreground"
                  >
                    Max output length (optional)
                  </label>
                  <input
                    id="chat-config-max-output-length"
                    type="number"
                    min={1}
                    step={1}
                    value={settings.chatConfigMaxOutputLength ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        onChatConfigMaxOutputLengthChange(null);
                        return;
                      }
                      const next = Number.parseInt(raw, 10);
                      onChatConfigMaxOutputLengthChange(
                        Number.isFinite(next) && next > 0 ? next : null,
                      );
                    }}
                    placeholder="e.g. 800"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearSavedChats}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear saved chats
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onInstallPwa}
              disabled={!canInstallPwa}
              title={
                canInstallPwa
                  ? "Install this app"
                  : "Install prompt not available in this browser/context"
              }
            >
              <Download className="h-4 w-4 mr-1" />
              Install app
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
