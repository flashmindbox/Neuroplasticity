# L3 · Judgement & calibration

[← Handbook](../README.md)

**Dimensions served:** 9 Judgement under uncertainty, 6 Confidence, 3 Stress.
**Evidence grade:** A (calibration/forecasting training) · A (expected-value arithmetic — it is maths).

## Why it matters for UPSC
Prelims GS Paper I has 100 questions at 2 marks each and deducts one-third of the question's marks
(0.66) for a wrong answer. Over-attempting and under-attempting both cost marks. The right strategy depends on
**how accurate your confidence actually is** — which most people do not know. The board also tests "balance of
judgement": reasoning explicitly about uncertainty and trade-offs.

## How it works
- **Calibration** means your confidence matches your accuracy: when you are "70% sure", you are right about
  70% of the time. It is trainable — short training in probabilistic reasoning improved forecasters' accuracy in
  a large forecasting tournament (Mellers et al., 2014; Tetlock & Gardner, 2015).
- **Expected value (EV) of attempting** a question you think you are right on with probability *p*:
  EV = 2p − 0.66 (1 − p) = 2.66p − 0.66. It is positive when **p > 0.25**.
  - Pure blind guess among 4 options (p = 0.25): EV ≈ 0.
  - One option eliminated (p ≈ 0.33): EV ≈ +0.22.
  - Two eliminated (p = 0.5): EV ≈ +0.67.
  - But your *felt* 50% may really be 35% — or 65%. That is why you measure.

## Exercises & dose

### 1. Confidence tagging (A) — every mock, every question
Mark each answer: **Sure (~95%) · Likely (~75%) · 50-50 · Guess (~30%)**. Record skipped questions too.
After the mock, enter per bucket: attempted and correct. The app computes:
- accuracy per bucket,
- **calibration gap** (stated confidence − actual accuracy),
- **EV per attempt** for each bucket,
- **Brier score** (lower is better).

### 2. Personal attempt rule (A) — from your data, revised monthly
Example: "My 50-50 bucket is 58% accurate → attempt. My Guess bucket is 22% → skip unless I can eliminate two."
Your rule should come from at least ~5 mocks of data.

### 3. Calibration quiz (A) — part of the drill rotation
Ten quick factual or estimation questions with a confidence %. Track whether your 70%s are right 70% of the time.

### 4. Decision journal (B) — weekly, for real decisions
Before a decision: options, your probability estimates, expected outcomes. Later: what happened, and was the
*reasoning* good (not just the result)?

### 5. Balanced verdicts (B)
In drills and talks, state conclusions with explicit uncertainty: "On balance, X, because A and B, although C
is a real risk."

## Progression
- **L1** Confidence tags used on mocks.
- **L2** Accuracy per bucket known; attempt rule written.
- **L3** Calibration gap within ~10 points in each bucket.
- **L4** Calibrated under time pressure; probabilistic reasoning shows up in speech and writing.

## Objective markers
Calibration gap per bucket · Brier score trend · EV per bucket · attempts vs score across mocks.

## Common traps
- Changing the attempt rule after one good or bad mock.
- Tagging confidence *after* checking answers.
- Treating "50-50" as a feeling rather than a measured number.

## References
Mellers et al. 2014 · Tetlock & Gardner 2015 — see [References](../references.md).
