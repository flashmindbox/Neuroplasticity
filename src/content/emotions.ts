// Precise emotion words for affect labelling (handbook/modules/L1-stress-emotions.md).
export const EMOTION_GROUPS: { group: string; words: string[] }[] = [
  {
    group: 'Anxious',
    words: ['worried', 'dread', 'nervous', 'overwhelmed', 'panicky', 'insecure'],
  },
  { group: 'Low', words: ['sad', 'flat', 'hopeless', 'lonely', 'disappointed', 'tired'] },
  { group: 'Angry', words: ['frustrated', 'irritated', 'resentful', 'envious', 'betrayed'] },
  { group: 'Self-conscious', words: ['ashamed', 'embarrassed', 'guilty', 'inadequate'] },
  {
    group: 'Positive',
    words: ['calm', 'content', 'proud', 'hopeful', 'grateful', 'energised', 'curious'],
  },
];
