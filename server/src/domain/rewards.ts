export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Reward {
  id: number;
  name: string;
  description: string;
  rarity: Rarity;
  image: string;
}

export const GACHA_COST = 30;

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.08,
  legendary: 0.02,
};

export const REWARDS: Reward[] = [
  { id: 1, name: 'Common Reward 1', description: 'A basic reward', rarity: 'common', image: '🎁' },
  {
    id: 2,
    name: 'Common Reward 2',
    description: 'Another basic reward',
    rarity: 'common',
    image: '🎯',
  },
  { id: 3, name: 'Rare Reward 1', description: 'A special reward', rarity: 'rare', image: '🏆' },
  {
    id: 4,
    name: 'Rare Reward 2',
    description: 'Another special reward',
    rarity: 'rare',
    image: '🎨',
  },
  { id: 5, name: 'Epic Reward 1', description: 'An amazing reward', rarity: 'epic', image: '🌟' },
  {
    id: 6,
    name: 'Epic Reward 2',
    description: 'Another amazing reward',
    rarity: 'epic',
    image: '💫',
  },
  {
    id: 7,
    name: 'Legendary Reward 1',
    description: 'An incredible reward',
    rarity: 'legendary',
    image: '👑',
  },
  {
    id: 8,
    name: 'Legendary Reward 2',
    description: 'Another incredible reward',
    rarity: 'legendary',
    image: '🏰',
  },
];

export const findReward = (id: number) => REWARDS.find((r) => r.id === id);

/** `random` must return a float in [0, 1). The server decides the roll, never the client. */
export const rollReward = (random: () => number): Reward => {
  const roll = random();
  let cumulative = 0;
  let rarity: Rarity = 'common';
  for (const [name, weight] of Object.entries(RARITY_WEIGHTS) as [Rarity, number][]) {
    cumulative += weight;
    rarity = name;
    if (roll < cumulative) break;
  }
  const pool = REWARDS.filter((r) => r.rarity === rarity);
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
};
