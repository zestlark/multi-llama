export const normalizeOllamaBaseUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    const isLocalHost =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (isLocalHost && (parsed.port === "3000" || parsed.port === "5173")) {
      parsed.port = "11434";
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return withProtocol.replace(/\/+$/, "");
  }
};

const parseIpv4 = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".").map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4) return null;
    if (parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
      return null;
    }
    return parts;
  } catch {
    return null;
  }
};

const parseIpv4Raw = (raw: string) => {
  const trimmed = raw.trim();
  const match = trimmed.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (!match) return null;
  const parts = match[1].split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4) return null;
  if (parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
};

export const normalizeScanRangeInput = (raw: string) => {
  const parsed = parseIpv4Raw(raw);
  if (!parsed) return "";
  return `${parsed[0]}.${parsed[1]}.${parsed[2]}`;
};

export const getLocalIpv4PrefixesFromBrowser = async () => {
  if (typeof window === "undefined") return [] as string[];
  if (typeof RTCPeerConnection === "undefined") return [] as string[];

  return new Promise<string[]>((resolve) => {
    const prefixes = new Set<string>();
    const pc = new RTCPeerConnection({ iceServers: [] });

    const addFromCandidate = (text: string) => {
      const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
      ips.forEach((ip) => {
        const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
        if (
          parts.length !== 4 ||
          parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)
        ) {
          return;
        }
        const isPrivate =
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168);
        if (!isPrivate) return;
        prefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      });
    };

    const finish = () => {
      pc.onicecandidate = null;
      pc.onicegatheringstatechange = null;
      try {
        pc.close();
      } catch {}
      resolve(Array.from(prefixes));
    };

    const timeout = setTimeout(finish, 1500);

    pc.onicecandidate = (event) => {
      const candidate = event.candidate?.candidate || "";
      if (candidate) addFromCandidate(candidate);
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeout);
        finish();
      }
    };

    pc.createDataChannel("scan");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        clearTimeout(timeout);
        finish();
      });
  });
};

export const buildScanCandidates = (
  hostUrls: string[],
  preferredSubnets: string[] = [],
  options?: { strictSubnets?: boolean },
) => {
  const strictSubnets = !!options?.strictSubnets;
  const candidates = new Set<string>(
    strictSubnets ? [] : ["http://127.0.0.1:11434", "http://localhost:11434"],
  );
  const subnets = new Set<string>(preferredSubnets.filter(Boolean));
  if (subnets.size === 0) {
    subnets.add("10.0.0");
    subnets.add("192.168.0");
    subnets.add("192.168.1");
  }

  hostUrls.forEach((hostUrl) => {
    if (strictSubnets) return;
    const normalized = normalizeOllamaBaseUrl(hostUrl);
    if (!normalized) return;
    candidates.add(normalized);
    const ipv4 = parseIpv4(normalized);
    if (!ipv4) return;
    subnets.add(`${ipv4[0]}.${ipv4[1]}.${ipv4[2]}`);
  });

  subnets.forEach((prefix) => {
    for (let i = 1; i <= 254; i += 1) {
      candidates.add(`http://${prefix}.${i}:11434`);
    }
  });

  return Array.from(candidates);
};

export interface ScannedHostSummary {
  url: string;
  modelCount: number;
}

export const scanNetworkForOllamaHosts = async (hostUrls: string[]) => {
  return scanNetworkForOllamaHostsWithOptions(hostUrls);
};

export const scanNetworkForOllamaHostsWithOptions = async (
  hostUrls: string[],
  options?: { customRangeInput?: string },
) => {
  const customPrefix = options?.customRangeInput
    ? normalizeScanRangeInput(options.customRangeInput)
    : "";
  const detectedSubnets = customPrefix
    ? [customPrefix]
    : await getLocalIpv4PrefixesFromBrowser();
  const candidates = buildScanCandidates(hostUrls, detectedSubnets, {
    strictSubnets: !!customPrefix,
  });
  const found: ScannedHostSummary[] = [];
  const concurrency = 24;
  let cursor = 0;

  const probe = async (url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 900);
    try {
      const response = await fetch(`${url}/api/tags`, { signal: controller.signal });
      if (!response.ok) return null;
      const data = await response.json();
      const modelCount = Array.isArray(data?.models) ? data.models.length : 0;
      return { url, modelCount };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }).map(async () => {
      while (cursor < candidates.length) {
        const next = cursor;
        cursor += 1;
        const candidate = normalizeOllamaBaseUrl(candidates[next]);
        if (!candidate) continue;
        const result = await probe(candidate);
        if (result) found.push(result);
      }
    }),
  );

  return Array.from(
    new Map(found.map((item) => [normalizeOllamaBaseUrl(item.url), item])).values(),
  ).sort((a, b) => a.url.localeCompare(b.url));
};
