# Failure modes — the pre-mortem

[← Handbook](README.md)

Imagine it is 2028 and this programme failed. Why? These are the most likely reasons, in rough order of
probability, and what the programme does about each. Re-read this page every month.

| # | Failure | Evidence | Built-in defence |
|---|---|---|---|
| 1 | **You stop using it.** | Wellbeing apps: median 30-day retention 3.3% (Baumel et al., 2019) | Dose ramps from 30 min; logging ≤ 3 min/day; practices embedded in study; 5-minute minimum viable day; accountability partner |
| 2 | **Overload backfires.** | Failed self-change challenges moved traits the *wrong* way (Hudson et al., 2019) | Max 2–3 active targets; challenges sized for ~80% success; level up only after success |
| 3 | **Self-ratings mislead.** | Self-evaluations correlate ~.29 with performance (Zell & Krizan, 2014) | Objective tests, AI and human ratings; self-vs-external gap tracked |
| 4 | **Skills don't transfer to the exam.** | Far transfer is rare (Sala et al., 2019) | Exam-format drills; every skill tested in mock conditions |
| 5 | **It eats study time.** | 60–90 min/day ≈ 300–400 h by Mains | Every component must move a marker or it is cut; phase-based dosing; tapers |
| 6 | **Identity collapses with a bad result.** | Contingent self-worth is fragile (Crocker & Park, 2004) | Values-based identity; Plan B; self-compassion |
| 7 | **A mental-health crisis goes unnoticed.** | High-stakes, isolated preparation | Monthly PHQ-9/GAD-7 with fixed rules; crisis contacts; counsellor identified early |
| 8 | **It feels imposed.** | Autonomy supports lasting motivation (Ryan & Deci, 2000) | You choose targets and techniques; menus, not orders |
| 9 | **Exam randomness is read as personal failure.** | Paper difficulty, evaluation and boards vary | Process goals daily; safety margins; multi-attempt resilience plan |
| 10 | **Plateaus are read as failure.** | Progress is non-linear | Judge 4-week trends; predicted dip calendar |
| 11 | **A physical cause is missed** (B12, vitamin D, iron, thyroid, sleep apnoea). | Common and treatable | Doctor visit in week 1; Brain Check decline rule |
| 12 | **Data is lost.** | Local-only storage | Monthly export reminder; backup file |
| 13 | **The programme itself is wrong somewhere.** | Written by an AI from research | Expert review; monthly programme retrospective; changelog |

## Pre-committed decision rules (enforced by the app)

| Trigger | Action |
|---|---|
| A target's marker shows no improvement over 4 weeks | Change the technique (not the goal) |
| Habit completion < 70% for 2 weeks | Shrink the challenge |
| Stress ≥ 7/10 on 7 consecutive logged days | Deload week; talk to someone |
| PHQ-9 or GAD-7 ≥ 10 | Talk to a professional ([Safety](04-safety-and-wellbeing.md)) |
| PHQ-9 item 9 > 0 | Crisis contacts today |
| Brain Check below your baseline for 2+ consecutive weeks without explanation | See a doctor |
| Low clarity (≤ 4) for a week together with elevated PHQ-9/GAD-7 | Professional help screen |
| Two missed days in a row | Next day is a minimum viable day; review what broke |
