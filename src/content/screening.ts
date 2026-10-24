// PHQ-9 (Kroenke et al., 2001) and GAD-7 (Spitzer et al., 2006). Both are free to reproduce and use.

export type ScreeningKind = 'phq9' | 'gad7';

export const SCREENING_STEM =
  'Over the last 2 weeks, how often have you been bothered by the following?';

export const SCREENING_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
] as const;

export const SCREENINGS: Record<ScreeningKind, { name: string; items: string[] }> = {
  phq9: {
    name: 'PHQ-9 (mood)',
    items: [
      'Little interest or pleasure in doing things',
      'Feeling down, depressed, or hopeless',
      'Trouble falling or staying asleep, or sleeping too much',
      'Feeling tired or having little energy',
      'Poor appetite or overeating',
      'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
      'Trouble concentrating on things, such as reading the newspaper or watching television',
      'Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving around a lot more than usual',
      'Thoughts that you would be better off dead, or of hurting yourself in some way',
    ],
  },
  gad7: {
    name: 'GAD-7 (anxiety)',
    items: [
      'Feeling nervous, anxious, or on edge',
      'Not being able to stop or control worrying',
      'Worrying too much about different things',
      'Trouble relaxing',
      'Being so restless that it is hard to sit still',
      'Becoming easily annoyed or irritable',
      'Feeling afraid, as if something awful might happen',
    ],
  },
};

export const CRISIS_CONTACTS = [
  { name: 'Tele-MANAS (free, 24×7)', phone: '14416' },
  { name: 'Tele-MANAS (toll-free)', phone: '1-800-891-4416' },
  { name: 'Emergency', phone: '112' },
];
