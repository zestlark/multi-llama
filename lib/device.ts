export type ClientOs = "windows" | "unix";

export const detectClientOs = (
  platform?: string,
  userAgent?: string,
): ClientOs => {
  const value = `${platform || ""} ${userAgent || ""}`.toLowerCase();
  return value.includes("win") ? "windows" : "unix";
};
