# Rewire — the Topper Mind Programme

An evidence-based neuroplasticity programme for one UPSC CSE 2027 aspirant: a **handbook** that explains
what to train and why, and a **daily companion app** that runs it, measures it and tells you when to change course.

It trains the person, not the syllabus: focus, discipline, stress handling, motivation, vision, confidence,
resilience, multi-angle thinking, judgement under uncertainty, structured expression, communication, leadership,
integrity, and exam-day performance.

## Start here

1. Read the handbook: [`handbook/README.md`](handbook/README.md) (also readable inside the app).
2. Open the app, write your **Personal Charter**, and follow **Today**.
3. Week 1: baseline tests; doctor visit + blood tests unless you've had them in the last ~3 months
   ([Brain clarity](handbook/modules/L0-brain-clarity.md)).

If you are struggling: **Tele-MANAS 14416** (free, 24×7) · emergency **112**.

## What is in the repo

```
handbook/        The programme (Markdown) — foundations, roadmap, protocols, safety, 13 modules,
                 assessments, drill banks, references. The app renders it and reads the drill banks from it.
src/             The companion app (React + TypeScript, installable PWA, local-first)
  content/       Dimensions, protocol, roadmap, screening items, drill parsing
  lib/           Storage (IndexedDB), phase/dose, calibration, decision rules, Brain Check, experiments, backup
  lib/ai/        Claude second opinion: copy/paste prompts for your subscription, or API-key mode
.claude/skills/  rewire-coach — Claude Code skill for rating drills/talks and running the mock board
  pages/         Today, Focus, Drills, Journal, Speak, Mocks, Tests, Experiments, Review, Progress,
                 Mock board, Charter, Handbook, Settings
tests/unit/      Vitest — logic, safety rules, AI layer (mocked), handbook integrity
tests/e2e/       Playwright — every page at phone and desktop width, the daily loop, AI path (mocked API)
```

## Run it

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:5173
```

Install it on your phone: open the deployed URL (or your computer's dev server on the same Wi-Fi) in Chrome →
menu → _Add to Home screen_. It works offline.

## Privacy and data

- Everything is stored **only in your browser** (IndexedDB). There is no server and no account.
- **Back up monthly**: Settings → Export backup. Restore with Settings → Choose backup. Backups never contain your API key.
- Live transcription on the Speak page uses your browser's speech service (in Chrome, Google processes the audio).
  You can turn it off and type the transcript instead.

## AI second opinion with your Claude subscription

Drills, recorded talks and the mock interview board can get an independent rating from Claude. By default this
uses your **Claude subscription** — no API key:

1. In the app, save a drill or talk and press **Copy prompt for Claude** (Mock board: **Copy board prompt**).
2. In a terminal, open Claude Code inside this repository and paste it:

   ```bash
   cd Neuroplasticity
   claude            # then type /rewire-coach and paste, or just paste
   ```

   The project skill `.claude/skills/rewire-coach/` knows the prompt formats, the scoring anchors and the
   handbook. The same prompt also works in claude.ai or the Claude app.

3. Paste Claude's whole reply into **Claude's reply** (or **Claude's debrief**) in the app. The app validates it
   and stores the rating as an external opinion next to your self-scores.

Notes:

- The prompt contains the exercise and your response — never your journal or your self-scores (independent rating).
- Safety screening (PHQ-9 / GAD-7) uses fixed rules in the app and never depends on the AI.
- **API-key mode** is still available (Settings → AI second opinion → Anthropic API key): one button inside the
  app, `claude-opus-5-5`, pay-per-use on your own key, with server-side refusal fallback and a cost meter. The key
  stays in this browser only and is never included in backups.

## Develop

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm run typecheck     # TypeScript
npm test              # unit tests
npm run build         # production build (adds a Content-Security-Policy)
npm run test:e2e      # Playwright (after build)
```

## Deploy (optional)

`.github/workflows/deploy.yml` publishes the app to GitHub Pages when run manually (Actions → Deploy → Run workflow).
Enable Pages first: repository Settings → Pages → Source: _GitHub Actions_. Private repositories need a paid GitHub
plan for Pages; otherwise run it locally or on any static host (the `dist/` folder is fully static).

## Honest limits

This programme was assembled by an AI from published research. It is not medical or psychological care, and no
programme can guarantee a rank. Ask a counselling psychologist and someone who has reached the UPSC interview stage
to review the handbook, and record their changes in [`handbook/CHANGELOG.md`](handbook/CHANGELOG.md).
