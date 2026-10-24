// The 13 trainable dimensions. Level descriptors mirror handbook/00-foundations/target-profile.md.

export type DimensionId =
  | 'focus'
  | 'discipline'
  | 'stress'
  | 'vision'
  | 'motivation'
  | 'confidence'
  | 'resilience'
  | 'thinking'
  | 'judgement'
  | 'expression'
  | 'communication'
  | 'leadership'
  | 'integrity';

export type Cluster = 'Self-regulation' | 'Mindset' | 'Thinking' | 'Personality';

export interface Dimension {
  id: DimensionId;
  name: string;
  cluster: Cluster;
  why: string;
  levels: [string, string, string, string];
  /** Daily practice shown on Today when this dimension is an active target. */
  practice: string;
  module: string;
}

export const DIMENSIONS: Dimension[] = [
  {
    id: 'focus',
    name: 'Deep focus',
    cluster: 'Self-regulation',
    why: 'Every paper is 2–3 hours of sustained, accurate attention.',
    levels: [
      'Focus breaks within 10–15 minutes; phone checks are frequent and automatic.',
      '25-minute blocks with ≤3 noticed mind-wanders; phone out of reach.',
      '50–90-minute blocks routinely; 4+ deep-work hours on most days.',
      'Full 3-hour simulations with stable accuracy in the last 30 minutes.',
    ],
    practice: 'Attention training + every study block run with the focus-block protocol.',
    module: 'modules/L1-focus-discipline.md',
  },
  {
    id: 'discipline',
    name: 'Discipline & habits',
    cluster: 'Self-regulation',
    why: 'Ten months are won by the median day, not the best day.',
    levels: [
      'Plans often abandoned; days depend on mood.',
      'Keystone habits done on most days; misses are followed by return.',
      'Habits automatic; minimum viable day instead of zero days; never two misses in a row.',
      'System runs through illness, travel and bad news with planned adjustments.',
    ],
    practice: 'Write one if-then plan for today’s most likely obstacle; keep the fixed wake time.',
    module: 'modules/L1-focus-discipline.md',
  },
  {
    id: 'stress',
    name: 'Stress & emotional regulation',
    cluster: 'Self-regulation',
    why: 'Anxiety consumes the working memory you need under pressure.',
    levels: [
      'Stress spirals into avoidance, rumination or poor sleep.',
      'You name what you feel and use one regulation tool when prompted.',
      'You regulate in the moment without prompting; bad scores processed within a day.',
      'High stakes feel like energy; you perform near your practice level under pressure.',
    ],
    practice: 'Name your strongest emotion today; 3 minutes of cyclic sighing between blocks.',
    module: 'modules/L1-stress-emotions.md',
  },
  {
    id: 'vision',
    name: 'Vision & purpose',
    cluster: 'Mindset',
    why: 'A concrete, owned “why” sustains effort through the long middle months.',
    levels: [
      'No concrete picture of the work or why it matters to you.',
      'A written purpose statement; you can describe the officer you want to be.',
      'A vivid picture of the daily work, linked to today’s tasks.',
      'Purpose guides choices; you can articulate it convincingly in 60 seconds.',
    ],
    practice: 'Read your purpose statement; 2-minute process simulation of today’s hardest task.',
    module: 'modules/L2-vision-identity.md',
  },
  {
    id: 'motivation',
    name: 'Motivation & drive',
    cluster: 'Mindset',
    why: 'Motivation will dip; the system must carry you through dips.',
    levels: [
      'Effort depends on how you feel; dips last weeks.',
      'You start with the 2-minute rule on low days; dips last days.',
      'You diagnose dips (purpose / progress / connection / energy) and fix the cause.',
      'Effort itself feels rewarding; dips are anticipated and short.',
    ],
    practice: 'Log one win tonight; use the 2-minute start on anything you are avoiding.',
    module: 'modules/L2-motivation.md',
  },
  {
    id: 'confidence',
    name: 'Confidence',
    cluster: 'Mindset',
    why: 'Belief in specific abilities predicts persistence and performance.',
    levels: [
      'Confidence swings with each score; frequent “I can’t”.',
      'Confidence based on a log of evidence.',
      'You take on stretch tasks voluntarily; failures barely move your self-assessment.',
      'Calm, evidence-based confidence visible in voice and decisions.',
    ],
    practice: 'Climb one rung of your mastery ladder; add one entry to the evidence log.',
    module: 'modules/L2-confidence-resilience.md',
  },
  {
    id: 'resilience',
    name: 'Resilience',
    cluster: 'Mindset',
    why: 'Setbacks are guaranteed; recovery speed decides the year.',
    levels: [
      'A setback derails you for a week or more.',
      'You use the failure protocol and return within 2–3 days.',
      'You extract a specific lesson from each setback within 24 hours.',
      'Setbacks become fuel; identity does not depend on one outcome.',
    ],
    practice: 'Run the failure protocol on today’s worst moment (5 minutes, in the journal).',
    module: 'modules/L2-confidence-resilience.md',
  },
  {
    id: 'thinking',
    name: 'Critical & multi-angle thinking',
    cluster: 'Thinking',
    why: 'Mains and the Essay reward multidimensional, balanced analysis.',
    levels: [
      'One or two angles; opinions without reasons.',
      '4–5 angles in 90 seconds; you can state the other side.',
      '7+ relevant angles, causal chains and a steelman without prompting.',
      'You find the non-obvious angle and the central trade-off, quickly.',
    ],
    practice: 'One thinking drill (7 lenses, steelman or causal chain).',
    module: 'modules/L3-thinking.md',
  },
  {
    id: 'judgement',
    name: 'Judgement under uncertainty',
    cluster: 'Thinking',
    why: 'Negative marking punishes both overconfidence and timidity.',
    levels: [
      'Attempts based on gut feel; calibration unknown.',
      'Confidence tagged on every mock; accuracy per bucket known.',
      'Confidence matches accuracy within ~10 points; personal attempt rule followed.',
      'Well-calibrated under time pressure; explicit about probabilities and trade-offs.',
    ],
    practice: 'Calibration quiz, or tag confidence on every practice MCQ today.',
    module: 'modules/L3-judgement-calibration.md',
  },
  {
    id: 'expression',
    name: 'Clear, structured expression',
    cluster: 'Thinking',
    why: 'Structure is how your thinking becomes visible to an examiner.',
    levels: [
      'Ideas come out in the order you think of them.',
      'You use a structure when you remember to.',
      'Structure automatic in writing and speech; clear signposting.',
      'Crisp, layered answers at exam speed, matched to the directive word.',
    ],
    practice: 'One 1-minute structure drill (skeleton only).',
    module: 'modules/L3-expression.md',
  },
  {
    id: 'communication',
    name: 'Communication & presence',
    cluster: 'Personality',
    why: '275 marks are a conversation with a board.',
    levels: [
      'Hesitant, filler-heavy speech; avoids speaking.',
      '2-minute talks with a clear point; fillers falling.',
      'Calm pace, concise answers; you listen before answering.',
      'Composed, warm and conversational under questioning.',
    ],
    practice: 'Record a 2-minute talk and listen back once.',
    module: 'modules/L4-communication.md',
  },
  {
    id: 'leadership',
    name: 'Leadership & social cohesion',
    cluster: 'Personality',
    why: 'Explicitly assessed by the board; real stories make answers authentic.',
    levels: [
      'Studies in isolation; no current leadership role.',
      'Has an accountability partner; helps others occasionally.',
      'Runs a study circle or regular service activity; resolves conflict constructively.',
      'Others seek you out; several true leadership stories with reflections.',
    ],
    practice: 'One act of help or initiative today; log it if it becomes a story.',
    module: 'modules/L4-leadership-integrity.md',
  },
  {
    id: 'integrity',
    name: 'Integrity, empathy & identity',
    cluster: 'Personality',
    why: 'GS4 and the board test values; identity sustains behaviour unobserved.',
    levels: [
      'Values are abstract; little exposure to very different lives.',
      'Weekly reflection on a dilemma and on another perspective.',
      'Regular field exposure; you reason through dilemmas with stakeholders and principles.',
      'Values show in daily choices; identity rests on character, not rank.',
    ],
    practice: 'Honest logging today; 10 minutes on one ethical dilemma or another person’s view.',
    module: 'modules/L4-leadership-integrity.md',
  },
];

export const DIMENSION_BY_ID = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d])) as Record<
  DimensionId,
  Dimension
>;

export const CLUSTERS: Cluster[] = ['Self-regulation', 'Mindset', 'Thinking', 'Personality'];

export const MAX_ACTIVE_TARGETS = 3;
