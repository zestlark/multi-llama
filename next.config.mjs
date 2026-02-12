/** @type {import('next').NextConfig} */
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isUserOrOrgPageRepo = repo.endsWith(".github.io");
const computedBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (process.env.GITHUB_ACTIONS === "true" && repo && !isUserOrOrgPageRepo
    ? `/${repo}`
    : "");

const nextConfig = {
  output: "export",
  trailingSlash: true,
  ...(computedBasePath
    ? {
        basePath: computedBasePath,
        assetPrefix: `${computedBasePath}/`,
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: computedBasePath,
  },
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
