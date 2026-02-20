import { useCallback, useState } from "react";
import type { ScannedHostItem } from "@/components/NetworkScanDialog";
import type {
  AvailableModelOption,
  HostConnectionStatus,
  UserSettings,
} from "@/lib/app-types";
import {
  normalizeOllamaBaseUrl,
  scanNetworkForOllamaHostsWithOptions,
} from "@/lib/network-scan";

interface HostRef {
  id: string;
  url: string;
}

interface UseNetworkScanParams {
  normalizedHosts: HostRef[];
  fetchModelsFromHost: (
    hostId: string,
    hostUrl: string,
  ) => Promise<AvailableModelOption[]>;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  setHostStatuses: React.Dispatch<
    React.SetStateAction<Record<string, HostConnectionStatus>>
  >;
  setAvailableModels: React.Dispatch<React.SetStateAction<AvailableModelOption[]>>;
  setOllamaError: React.Dispatch<React.SetStateAction<string>>;
}

export const useNetworkScan = ({
  normalizedHosts,
  fetchModelsFromHost,
  setSettings,
  setHostStatuses,
  setAvailableModels,
  setOllamaError,
}: UseNetworkScanParams) => {
  const [isNetworkScanning, setIsNetworkScanning] = useState(false);
  const [scannedHosts, setScannedHosts] = useState<ScannedHostItem[]>([]);
  const [scanErrorMessage, setScanErrorMessage] = useState("");
  const [addedScannedHostUrls, setAddedScannedHostUrls] = useState<string[]>([]);

  const startNetworkScan = useCallback(async (customRangeInput?: string) => {
    if (isNetworkScanning) return;
    setIsNetworkScanning(true);
    setScanErrorMessage("");
    setScannedHosts([]);
    setAddedScannedHostUrls([]);

    const scanned = await scanNetworkForOllamaHostsWithOptions(
      normalizedHosts.map((host) => host.url),
      { customRangeInput },
    );
    setScannedHosts(scanned as ScannedHostItem[]);
    if (scanned.length === 0) {
      setScanErrorMessage(
        "No active Ollama API found on your network. Ensure Ollama is running and reachable.",
      );
    }
    setIsNetworkScanning(false);
  }, [isNetworkScanning, normalizedHosts]);

  const addScannedHost = useCallback(
    async (hostUrl: string) => {
      const normalizedUrl = normalizeOllamaBaseUrl(hostUrl);
      if (!normalizedUrl) return;

      const existing = normalizedHosts.find((host) => host.url === normalizedUrl);
      const hostId =
        existing?.id ||
        `host-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (!existing) {
        setSettings((prev) => ({
          ...prev,
          hosts: [...prev.hosts, { id: hostId, url: normalizedUrl }],
        }));
      }

      setHostStatuses((prev) => ({ ...prev, [hostId]: "testing" }));
      try {
        const models = await fetchModelsFromHost(hostId, normalizedUrl);
        setAvailableModels((prev) => {
          const withoutHost = prev.filter((model) => model.hostId !== hostId);
          return [...withoutHost, ...models];
        });
        setHostStatuses((prev) => ({ ...prev, [hostId]: "connected" }));
        setAddedScannedHostUrls((prev) =>
          prev.includes(normalizedUrl) ? prev : [...prev, normalizedUrl],
        );
        setOllamaError("");
      } catch {
        setHostStatuses((prev) => ({ ...prev, [hostId]: "failed" }));
      }
    },
    [
      normalizedHosts,
      fetchModelsFromHost,
      setSettings,
      setHostStatuses,
      setAvailableModels,
      setOllamaError,
    ],
  );

  return {
    isNetworkScanning,
    scannedHosts,
    scanErrorMessage,
    addedScannedHostUrls,
    startNetworkScan,
    addScannedHost,
  };
};
