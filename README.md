# Multi Llama Chat

**Multi Llama Chat** is a local-first AI workspace to compare multiple models in parallel, assign roles, and run structured model-to-model collaboration.

Instead of asking one model at a time, you can run a full team of models in one screen.

## What Makes It Different

- Side-by-side responses from multiple models in real time
- Multiple instances of the same model (`llama (1)`, `llama (2)`, ...)
- Role-based behavior per model instance (tester, designer, reviewer, custom)
- Precise targeting with mentions (`@model`, `@model#1`)
- Inter-model communication mode for chained reasoning
- Attachment-aware prompts (text + images)

## How It Works

### 1. Select models
Pick one or more models from the chip list.

### 2. (Optional) Add model instances
Enable same-model multi-chat and create multiple instances of the same model.

### 3. Assign roles
Set each instance role from the role chip in card header.

### 4. Send one prompt, get parallel answers
Your input is dispatched to selected model instances simultaneously.

### 5. Target exactly who should answer
- `@qwen:4b` -> all qwen instances
- `@qwen:4b#1` -> only first qwen instance

### 6. Run inter-model communication
Turn on inter-mode so models continue exchanging outputs round-by-round.

### 7. Duplicate any chat instance
Clone a specific model chat (messages + role) to branch exploration safely.

## Core Capabilities

- Multi-model comparison UI
- Role-driven response style
- Mention routing with instance targeting
- Same-model multi-instance orchestration
- Instance-level chat duplication
- Text/image attachments in prompt flow
- Local persistence for chat + settings
- Dark/light mode and compact workspace UI

## Ideal Use Cases

- Prompt A/B testing across models
- Reviewer/tester/designer role simulation
- Fast requirement critique from multiple viewpoints
- Local research with private context
- Consensus and disagreement analysis between models

## Product Experience

- Compact model cards with focused chat area
- Clean bottom composer with tagging + attachments
- Smart mention popover (`@` suggestions)
- Non-blocking input while responses are running
- Toast feedback for connection actions

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`, connect to your Ollama URL in Settings, select models, and start comparing.

## Vision

Build a serious local AI collaboration tool where one user can coordinate a panel of specialized model agents as if they were a small product team.

---

If you find this useful, star the repo and share your workflow.
