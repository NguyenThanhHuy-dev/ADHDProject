import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InventoryItem, PointsHistoryEntry, Rarity, Reward } from '../types';

interface RewardState {
  rewards: Reward[];
  inventory: InventoryItem[];
  points: number;
  pointsHistory: PointsHistoryEntry[];
  addPoints: (amount: number) => void;
  spendPoints: (amount: number) => void;
  addReward: (reward: Reward) => void;
  addToInventory: (reward: Reward) => void;
  getRarityDistribution: () => Record<Rarity, number>;
  getPointsHistory: () => PointsHistoryEntry[];
  addPointsHistory: (entry: PointsHistoryEntry) => void;
}

const useRewardStore = create<RewardState>()(
  persist(
    (set, get) => ({
      rewards: [],
      inventory: [],
      points: 0,
      pointsHistory: [],
      addPoints: (amount) => set((state) => ({ points: state.points + amount })),
      spendPoints: (amount) => set((state) => ({ points: Math.max(0, state.points - amount) })),
      addReward: (reward) => set((state) => ({ rewards: [...state.rewards, reward] })),
      addToInventory: (reward) =>
        set((state) => ({
          inventory: [...state.inventory, { ...reward, obtainedAt: new Date().toISOString() }],
        })),
      getRarityDistribution: () => {
        const inventory = get().inventory;
        const count = (rarity: Rarity) => inventory.filter((item) => item.rarity === rarity).length;
        return {
          common: count('common'),
          rare: count('rare'),
          epic: count('epic'),
          legendary: count('legendary'),
        };
      },
      getPointsHistory: () => get().pointsHistory,
      addPointsHistory: (entry) =>
        set((state) => ({ pointsHistory: [...state.pointsHistory, entry] })),
    }),
    { name: 'reward-storage' },
  ),
);

export default useRewardStore;
