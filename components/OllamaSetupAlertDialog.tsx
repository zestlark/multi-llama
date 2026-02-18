import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Check, Copy } from "lucide-react";

interface OllamaSetupAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBaseUrl: string;
  didCopyInstallCommand: boolean;
  didCopyNetworkCommand: boolean;
  ollamaNetworkCommand: string;
  ollamaNetworkCommandLabel: string;
  onCopyInstallCommand: () => void;
  onCopyNetworkCommand: () => void;
  onOpenSettings: () => void;
}

export default function OllamaSetupAlertDialog({
  open,
  onOpenChange,
  apiBaseUrl,
  didCopyInstallCommand,
  didCopyNetworkCommand,
  ollamaNetworkCommand,
  ollamaNetworkCommandLabel,
  onCopyInstallCommand,
  onCopyNetworkCommand,
  onOpenSettings,
}: OllamaSetupAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <AlertDialogTitle>Unable to connect to Ollama</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This app requires a reachable Ollama server before chats can run.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">Current Ollama URL</p>
            <code className="text-sm">{apiBaseUrl || "Not configured"}</code>
          </div>

          <div className="text-xs text-muted-foreground space-y-3 break-words">
            <p className="font-medium text-foreground">Setup steps</p>
            <p>
              1. Install Ollama:{" "}
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                ollama.com/download
              </a>
            </p>
            <p>2. Open the Ollama app if it is already installed</p>
            <p>3. Start Ollama on your machine</p>
            <p className="flex items-center gap-2 flex-wrap min-w-0">
              <span>
                4. Pull a model: <code>ollama pull llama3.2</code>
              </span>
              <button
                type="button"
                onClick={onCopyInstallCommand}
                className="h-6 w-6 rounded border border-border inline-flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Copy command"
              >
                {didCopyInstallCommand ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </p>
            <div className="space-y-1.5">
              <p>
                5. Start Ollama for browser/network access ({ollamaNetworkCommandLabel}):
              </p>
              <div className="rounded-md border border-border bg-background/60 px-2.5 py-2 text-xs break-all flex items-start justify-between gap-2">
                <code className="break-all whitespace-pre-wrap flex-1">
                  {ollamaNetworkCommand}
                </code>
                <button
                  type="button"
                  onClick={onCopyNetworkCommand}
                  className="h-6 w-6 rounded border border-border inline-flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                  aria-label="Copy network command"
                >
                  {didCopyNetworkCommand ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Note: <code>OLLAMA_ORIGINS=&quot;*&quot;</code> allows all browser
              origins. You can replace <code>*</code> with specific URLs later
              for tighter security.
            </p>
            <p>
              6. In Settings, set Ollama URL to <code>http://127.0.0.1:11434</code>{" "}
              if this app and Ollama run on the same machine. Use{" "}
              <code>http://&lt;LAN-IP&gt;:11434</code> only when connecting from
              another device.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <AlertDialogAction onClick={onOpenSettings}>
            Open Settings
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
