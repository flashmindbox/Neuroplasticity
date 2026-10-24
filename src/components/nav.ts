export type NavGroup = 'Daily practice' | 'Track progress' | 'Plan & learn';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** One line on what the page is for, shown on More. */
  description: string;
  group: NavGroup;
  /** In the phone's bottom bar. */
  primary?: boolean;
}

export const NAV_GROUPS: NavGroup[] = ['Daily practice', 'Track progress', 'Plan & learn'];

export const NAV: NavItem[] = [
  {
    to: '/',
    label: 'Today',
    icon: '☀️',
    description: 'Your mentor: one next step at a time.',
    group: 'Daily practice',
    primary: true,
  },
  {
    to: '/focus',
    label: 'Focus',
    icon: '🎯',
    description: 'Focus-block timer, attention training, breathing.',
    group: 'Daily practice',
    primary: true,
  },
  {
    to: '/drills',
    label: 'Drills',
    icon: '🧠',
    description: 'Timed thinking drills for Mains and the Essay.',
    group: 'Daily practice',
  },
  {
    to: '/speak',
    label: 'Speak',
    icon: '🎙️',
    description: 'Record a 2-minute talk; see fillers and pace.',
    group: 'Daily practice',
  },
  {
    to: '/journal',
    label: 'Journal',
    icon: '📓',
    description: 'Nightly reflection, evidence log, leadership stories.',
    group: 'Daily practice',
    primary: true,
  },
  {
    to: '/progress',
    label: 'Progress',
    icon: '📈',
    description: 'What’s changing, milestones and trends.',
    group: 'Track progress',
    primary: true,
  },
  {
    to: '/review',
    label: 'Review',
    icon: '🗓️',
    description: 'Sunday review with your mentor’s weekly note.',
    group: 'Track progress',
  },
  {
    to: '/tests',
    label: 'Tests',
    icon: '🧪',
    description: 'Brain Check, wellbeing check-in, fog audit.',
    group: 'Track progress',
  },
  {
    to: '/mocks',
    label: 'Mocks',
    icon: '📝',
    description: 'Log mocks with confidence tags; see calibration.',
    group: 'Track progress',
  },
  {
    to: '/experiments',
    label: 'Experiments',
    icon: '🔬',
    description: 'Test a technique on yourself before trusting it.',
    group: 'Track progress',
  },
  {
    to: '/charter',
    label: 'Charter',
    icon: '🧭',
    description: 'Your purpose, values, Plan B and targets.',
    group: 'Plan & learn',
  },
  {
    to: '/interview',
    label: 'Mock board',
    icon: '🪑',
    description: 'Practise the UPSC interview with Claude.',
    group: 'Plan & learn',
  },
  {
    to: '/handbook',
    label: 'Handbook',
    icon: '📖',
    description: 'The programme explained, with the evidence.',
    group: 'Plan & learn',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: '⚙️',
    description: 'Exam dates, AI second opinion, backup.',
    group: 'Plan & learn',
  },
];
