import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";

export interface ScannedHostItem {
  url: string;
  modelCount: number;
}

interface NetworkScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isScanning: boolean;
  scanError: string;
  items: ScannedHostItem[];
  configuredHostUrls: string[];
  addedHostUrls: string[];
  onScan: () => void;
  onAddHost: (url: string) => void;
}

export default function NetworkScanDialog({
  open,
  onOpenChange,
  isScanning,
  scanError,
  items,
  configuredHostUrls,
  addedHostUrls,
  onScan,
  onAddHost,
}: NetworkScanDialogProps) {
  const guidanceMessages = [
    "Keep this device and Ollama host on the same Wi-Fi network.",
    "Make sure Ollama is running and listening on port 11434.",
    "Use OLLAMA_HOST=0.0.0.0:11434 to allow LAN access.",
  ];
  const [tipIndex, setTipIndex] = React.useState(0);
  const isNotFound = !isScanning && !!scanError && items.length === 0;
  const hasScanned = items.length > 0 || !!scanError;
  const canTriggerScan = !isScanning;

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % guidanceMessages.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [guidanceMessages.length]);

  const configuredSet = new Set(configuredHostUrls);
  const addedSet = new Set(addedHostUrls);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Network Scan</DialogTitle>
          <DialogDescription>
            Discover active Ollama APIs in your local network.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-5 text-center">
            <button
              type="button"
              onClick={() => {
                if (canTriggerScan) onScan();
              }}
              disabled={!canTriggerScan}
              aria-label={
                !hasScanned ? "Scan network" : isNotFound ? "Rescan network" : "Scan network"
              }
              className={`mx-auto mb-3 h-28 w-28 rounded-full border border-border/80 bg-background/70 flex items-center justify-center relative ${
                canTriggerScan ? "cursor-pointer" : "cursor-default"
              }`}
            >
              {isScanning ? (
                <>
                  <div className="absolute h-24 w-24 rounded-full border-4 border-border/40" />
                  <div className="absolute h-24 w-24 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                  <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                </>
              ) : !hasScanned ? (
                <>
                  <div className="absolute h-24 w-24 rounded-full border-4 border-border/50" />
                  <div className="h-12 w-12 rounded-full bg-muted border border-border/70 flex items-center justify-center">
                    <span className="text-xs font-semibold text-muted-foreground">SCAN</span>
                  </div>
                </>
              ) : isNotFound ? (
                <>
                  <div className="absolute h-24 w-24 rounded-full border-4 border-rose-300/50" />
                  <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-400/40 flex items-center justify-center">
                    <span className="text-lg font-bold text-rose-500">!</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute h-24 w-24 rounded-full border-4 border-emerald-300/50" />
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-400/40 flex items-center justify-center">
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      OK
                    </span>
                  </div>
                </>
              )}
            </button>
            <p
              className={`text-base font-semibold ${
                isNotFound ? "text-rose-600 dark:text-rose-400" : "text-foreground"
              }`}
            >
              {isScanning
                ? "Searching network..."
                : isNotFound
                  ? "No active host found"
                  : hasScanned
                    ? "Scan complete"
                    : "Ready to scan"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Looking for hosts that respond to <code>/api/tags</code>
            </p>
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              This scan is network-intensive. Start it only when needed.
            </p>
            {!isScanning ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={onScan}
              >
                {isNotFound ? "Rescan Network" : "Scan Network"}
              </Button>
            ) : null}
          </div>

          <div className="rounded-md border border-border/60 bg-background/50 px-3 py-2 text-center">
            <div className="h-5 overflow-hidden">
              <div
                className="transition-transform duration-500 ease-out"
                style={{ transform: `translateY(-${tipIndex * 20}px)` }}
              >
                {guidanceMessages.map((message) => (
                  <p
                    key={message}
                    className="h-5 leading-5 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {message}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {scanError ? (
            <div className="rounded-md border border-rose-300/60 bg-rose-100/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {scanError}
            </div>
          ) : null}

          <div className="space-y-2 max-h-64 overflow-y-auto slim-scrollbar">
            {items.map((item) => {
              const isAlreadyConfigured = configuredSet.has(item.url);
              const isAddedNow = addedSet.has(item.url);
              const isAdded = isAlreadyConfigured || isAddedNow;
              return (
                <div
                  key={item.url}
                  className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{item.url}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.modelCount} model{item.modelCount === 1 ? "" : "s"} found
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isAdded ? "secondary" : "outline"}
                    size="sm"
                    className="h-8"
                    disabled={isAdded}
                    onClick={() => onAddHost(item.url)}
                  >
                    {isAdded ? (
                      "Added"
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              );
            })}

            {!isScanning && !scanError && items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No scan results yet.
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
