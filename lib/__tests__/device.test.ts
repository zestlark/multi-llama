import { detectClientOs } from "@/lib/device";

describe("detectClientOs", () => {
  it("returns windows for Windows platform/user agent", () => {
    expect(detectClientOs("Win32", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "windows",
    );
  });

  it("returns unix for macOS/Linux platform", () => {
    expect(detectClientOs("MacIntel", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(
      "unix",
    );
    expect(detectClientOs("Linux x86_64", "Mozilla/5.0 (X11; Linux x86_64)")).toBe(
      "unix",
    );
  });
});
