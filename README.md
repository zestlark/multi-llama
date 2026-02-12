# Multi Llama Chat

Compare multiple Ollama models side-by-side in one interface, assign roles, target specific model instances, and run collaborative inter-model conversations.

## Why This Project

Most local LLM UIs are built for one-model-at-a-time chat.
Multi Llama Chat is built for **comparison and collaboration**:

- Run many model chats at once
- Duplicate model instances with different roles
- Target specific instances (`@model#1`)
- Use inter-model conversation mode
- Attach text/images
- Keep everything in-browser with local persistence

## Key Features

- **Multi-model side-by-side chat**
- **Same-model multi-instance mode** (e.g. multiple `llama3` instances)
- **Per-instance roles** (tester, designer, developer, custom roles)
- **Tag-based routing**
  - `@llama3` -> all `llama3` instances
  - `@llama3#1` -> first instance only
- **Inter-model communication mode**
- **Attachment support**
  - `.txt` files (prompt context)
  - images (`.jpg`, `.png`, etc. for vision models)
- **PWA-ready** (installable)
- **Theme toggle** (dark/light)
- **Settings drawer** with connection testing + user preferences
- **Local persistence** for selected models/chats/settings
- **Slim UI + optimized chat space**

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS + shadcn/ui
- Lucide icons
- Sonner toasts

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd MULTI_MODEL_CHAT
npm install
```

### 2. Start Ollama

Make sure Ollama is running locally:

```bash
ollama serve
```

Pull at least one model:

```bash
ollama pull llama3.2
```

### 3. Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Configuration

Use **Settings** in the app to configure:

- Ollama host URL (default `http://localhost:11434`)
- Local persistence on/off
- Role assignment on/off
- Same-model multi-chat on/off

## Deploy to GitHub Pages

This repo is configured for static export + GitHub Pages workflow.

### Included

- `next.config.mjs` with static export settings
- `.github/workflows/deploy-pages.yml` to build/deploy `out/`

### Required in GitHub

Go to:

- `Settings` -> `Pages` -> `Build and deployment`
- Set **Source** to **GitHub Actions**

### Important Runtime Note

The app calls Ollama from the browser.
For hosted usage, users must have a reachable Ollama endpoint and proper CORS/private-network permissions if using localhost.

## Usage Tips

- Select models from chips at the bottom
- Use `+` inside selected chip to add same-model instance
- Click duplicate icon on a model card to clone that chat instance
- Assign roles by clicking role chip in model header
- Use mentions in input:
  - `@qwen:4b`
  - `@qwen:4b#2`

## Roadmap Ideas

- Export/import chats
- Better model capability detection (vision/text)
- Prompt templates per role
- Keyboard command palette
- Shareable conversation snapshots

## Contributing

PRs and issues are welcome.
If you add a feature, include:

- short before/after behavior note
- screenshots or short gif
- test notes

## License

Choose a license and add `LICENSE` file (MIT is common for OSS).

---

If this project helps you, consider starring the repo.
