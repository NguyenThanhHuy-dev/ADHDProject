import useRewardStore from '../rewardStore';

const reward = (rarity: 'common' | 'rare') => ({
  id: 1,
  name: 'Break',
  description: '',
  rarity,
  image: '🎁',
});

beforeEach(() => useRewardStore.setState({ points: 0, inventory: [], pointsHistory: [] }));

describe('rewardStore', () => {
  it('adds points and never spends below zero', () => {
    const s = useRewardStore.getState();
    s.addPoints(20);
    s.spendPoints(30);
    expect(useRewardStore.getState().points).toBe(0);
  });

  it('counts inventory by rarity', () => {
    const s = useRewardStore.getState();
    s.addToInventory(reward('common'));
    s.addToInventory(reward('common'));
    s.addToInventory(reward('rare'));
    expect(useRewardStore.getState().getRarityDistribution()).toEqual({
      common: 2,
      rare: 1,
      epic: 0,
      legendary: 0,
    });
  });

  it('records points history even when it started empty', () => {
    useRewardStore.getState().addPointsHistory({ amount: 5 });
    expect(useRewardStore.getState().getPointsHistory()).toHaveLength(1);
  });
});
