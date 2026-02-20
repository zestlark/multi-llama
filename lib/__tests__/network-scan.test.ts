import {
  buildScanCandidates,
  getLocalIpv4PrefixesFromBrowser,
  normalizeOllamaBaseUrl,
  normalizeScanRangeInput,
  scanNetworkForOllamaHosts,
  scanNetworkForOllamaHostsWithOptions,
} from "@/lib/network-scan";

describe("network-scan", () => {
  it("normalizes custom range input from plain IP or URL-like text", () => {
    expect(normalizeScanRangeInput("192.168.1.42")).toBe("192.168.1");
    expect(normalizeScanRangeInput("http://10.0.62.99:11434")).toBe("10.0.62");
    expect(normalizeScanRangeInput("bad-input")).toBe("");
  });

  it("normalizes ollama base url and handles parser fallback", () => {
    expect(normalizeOllamaBaseUrl("localhost:3000")).toBe("http://127.0.0.1:11434");
    expect(normalizeOllamaBaseUrl("http://localhost:5173/")).toBe(
      "http://127.0.0.1:11434",
    );
    expect(normalizeOllamaBaseUrl("http://[::1")).toContain("http://");
  });

  it("limits candidates to preferred subnet when strictSubnets is enabled", () => {
    const candidates = buildScanCandidates(
      ["http://10.0.10.12:11434"],
      ["192.168.1"],
      { strictSubnets: true },
    );

    expect(candidates.some((url) => url.startsWith("http://192.168.1."))).toBe(true);
    expect(candidates.some((url) => url.startsWith("http://10.0.10."))).toBe(false);
    expect(candidates).not.toContain("http://127.0.0.1:11434");
  });

  it("includes defaults and host-derived subnet candidates when not strict", () => {
    const candidates = buildScanCandidates(["http://10.0.62.72:11434"]);
    expect(candidates).toContain("http://127.0.0.1:11434");
    expect(candidates).toContain("http://localhost:11434");
    expect(candidates).toContain("http://10.0.62.72:11434");
    expect(candidates.some((url) => url.startsWith("http://10.0.62."))).toBe(true);
    expect(candidates.some((url) => url.startsWith("http://192.168.1."))).toBe(true);
  });

  it("returns empty local prefixes when RTCPeerConnection is unavailable", async () => {
    const previousRtc = (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = undefined;
    const result = await getLocalIpv4PrefixesFromBrowser();
    expect(result).toEqual([]);
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousRtc;
  });

  it("extracts private subnet prefixes from WebRTC candidates", async () => {
    const previousRtc = (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;

    class FakeRTCPeerConnection {
      onicecandidate: ((event: { candidate?: { candidate?: string } }) => void) | null =
        null;
      onicegatheringstatechange: (() => void) | null = null;
      iceGatheringState: "new" | "complete" = "new";
      createDataChannel() {}
      createOffer() {
        return Promise.resolve({ type: "offer", sdp: "sdp" });
      }
      setLocalDescription() {
        this.onicecandidate?.({
          candidate: {
            candidate:
              "candidate 1 1 udp 2122260223 192.168.0.54 8998 typ host",
          },
        });
        this.onicecandidate?.({
          candidate: {
            candidate: "candidate 1 1 udp 2122260223 8.8.8.8 8998 typ host",
          },
        });
        this.iceGatheringState = "complete";
        this.onicegatheringstatechange?.();
        return Promise.resolve();
      }
      close() {}
    }

    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
      FakeRTCPeerConnection;
    const result = await getLocalIpv4PrefixesFromBrowser();
    expect(result).toContain("192.168.0");
    expect(result).not.toContain("8.8.8");
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousRtc;
  });

  it("returns gracefully when WebRTC offer creation fails", async () => {
    const previousRtc = (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
    class FakeFailingRTCPeerConnection {
      onicecandidate: ((event: { candidate?: { candidate?: string } }) => void) | null =
        null;
      onicegatheringstatechange: (() => void) | null = null;
      iceGatheringState: "new" | "complete" = "new";
      createDataChannel() {}
      createOffer() {
        return Promise.reject(new Error("offer failed"));
      }
      setLocalDescription() {
        return Promise.resolve();
      }
      close() {}
    }
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection =
      FakeFailingRTCPeerConnection;
    const result = await getLocalIpv4PrefixesFromBrowser();
    expect(result).toEqual([]);
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousRtc;
  });

  it("scans only custom subnet when range input is provided", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("http://192.168.9.7:11434/api/tags")) {
        return {
          ok: true,
          json: async () => ({ models: [{}, {}] }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await scanNetworkForOllamaHostsWithOptions([], {
      customRangeInput: "192.168.9.55",
    });

    expect(result).toEqual([{ url: "http://192.168.9.7:11434", modelCount: 2 }]);
    expect(fetchMock).toHaveBeenCalled();
    const firstArg = String(fetchMock.mock.calls[0]?.[0] || "");
    expect(firstArg.startsWith("http://192.168.9.")).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).startsWith("http://127.0.0.1:11434"),
      ),
    ).toBe(false);
    globalThis.fetch = previousFetch;
  });

  it("delegates default scan helper", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response);
    const previousFetch = globalThis.fetch;
    const previousRtc = (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = undefined;
    await scanNetworkForOllamaHosts([]);
    expect(fetchMock).toHaveBeenCalled();
    globalThis.fetch = previousFetch;
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = previousRtc;
  });

  it("skips failed probes and keeps successful sorted unique hosts", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("http://10.10.10.3:11434/api/tags")) {
        return { ok: true, json: async () => ({ models: [{}] }) } as Response;
      }
      if (url.startsWith("http://10.10.10.4:11434/api/tags")) {
        throw new Error("network");
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await scanNetworkForOllamaHostsWithOptions([], {
      customRangeInput: "10.10.10.8",
    });

    expect(result).toEqual([{ url: "http://10.10.10.3:11434", modelCount: 1 }]);
    globalThis.fetch = previousFetch;
  });
});
