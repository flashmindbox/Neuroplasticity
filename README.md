# Rewire — the Topper Mind Programme

An evidence-based neuroplasticity programme for one UPSC CSE 2027 aspirant: a **handbook** that explains
what to train and why, and a **daily companion app** that runs it, measures it and tells you when to change course.

It trains the person, not the syllabus: focus, discipline, stress handling, motivation, vision, confidence,
resilience, multi-angle thinking, judgement under uncertainty, structured expression, communication, leadership,
integrity, and exam-day performance.

## Start here

1. Read the handbook: [`handbook/README.md`](handbook/README.md) (also readable inside the app).
2. Open the app, write your **Personal Charter**, and follow **Today**.
3. Week 1: doctor visit + baseline tests ([Brain clarity](handbook/modules/L0-brain-clarity.md)).

If you are struggling: **Tele-MANAS 14416** (free, 24×7) · emergency **112**.

## What is in the repo

```
handbook/        The programme (Markdown) — foundations, roadmap, protocols, safety, 13 modules,
                 assessments, drill banks, references. The app renders it and reads the drill banks from it.
src/             The companion app (React + TypeScript, installable PWA, local-first)
  content/       Dimensions, protocol, roadmap, screening items, drill parsing
  lib/           Storage (IndexedDB), phase/dose, calibration, decision rules, Brain Check, experiments, backup
  lib/ai/        Optional Claude second opinion (drills, talks, mock interview board)
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

## Optional AI second opinion

Drills, recorded talks and the mock interview board can be rated by Claude (`claude-opus-5-5`) with **your own**
Anthropic API key (Settings). Notes:

- Nothing is sent until you press an AI button. Your journal is never sent. The AI never sees your self-scores
  (independent rating); the gap between your scores and its scores is tracked as a self-awareness measure.
- The key is stored only in this browser. Create a dedicated key and set a monthly spend limit in the Anthropic Console.
- Server-side refusal fallback is enabled: if the model declines a request, the API may retry it on a default
  fallback model. Typical cost: a few cents per evaluation; well under a dollar per mock interview. The app shows a cost meter.
- Safety screening (PHQ-9 / GAD-7) uses fixed rules and never depends on the AI.

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
