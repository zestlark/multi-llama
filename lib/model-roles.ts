export const PRESET_MODEL_ROLES = [
  "General",
  "Tester",
  "Designer",
  "Product Manager",
  "Developer",
  "Reviewer",
  "Architect",
  "Analyst",
  "Security Engineer",
  "DevOps Engineer",
  "Data Scientist",
  "Researcher",
  "Technical Writer",
  "SRE",
  "QA Engineer",
];

export const DEFAULT_MODEL_ROLE = PRESET_MODEL_ROLES[0];

export const normalizeRoleLabel = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_MODEL_ROLE;

  const lower = trimmed.toLowerCase();
  if (lower === "pm") return "Product Manager";
  if (lower === "qa") return "QA Engineer";
  if (lower === "sre") return "SRE";
  if (lower === "devops") return "DevOps Engineer";

  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};
