import { describe, it, expect } from 'vitest';
import { calculateWeightedAverageCost } from './inventory.js';

describe('calculateWeightedAverageCost', () => {
  it('returns current cost if incoming qty is zero', () => {
    const cost = calculateWeightedAverageCost({
      currentQty: 10,
      currentCostPaisa: 5000,
      incomingQty: 0,
      incomingCostPaisa: 6000,
    });
    expect(cost).toBe(5000);
  });

  it('adopts incoming cost if current stock is zero or negative', () => {
    expect(
      calculateWeightedAverageCost({
        currentQty: 0,
        currentCostPaisa: 5000,
        incomingQty: 10,
        incomingCostPaisa: 6000,
      }),
    ).toBe(6000);

    expect(
      calculateWeightedAverageCost({
        currentQty: -2,
        currentCostPaisa: 5000,
        incomingQty: 10,
        incomingCostPaisa: 6000,
      }),
    ).toBe(6000);
  });

  it('calculates exact weighted-average cost in paisa', () => {
    // 10 units @ 1000 paisa (10 BDT) + 20 units @ 1600 paisa (16 BDT)
    // (10 * 1000 + 20 * 1600) / 30 = (10000 + 32000) / 30 = 42000 / 30 = 1400 paisa (14 BDT)
    const cost = calculateWeightedAverageCost({
      currentQty: 10,
      currentCostPaisa: 1000,
      incomingQty: 20,
      incomingCostPaisa: 1600,
    });
    expect(cost).toBe(1400);
  });

  it('rounds to nearest integer paisa for non-divisible amounts', () => {
    // 10 units @ 1000 paisa + 10 units @ 1001 paisa -> avg 1000.5 -> rounds to 1001
    const cost = calculateWeightedAverageCost({
      currentQty: 10,
      currentCostPaisa: 1000,
      incomingQty: 10,
      incomingCostPaisa: 1001,
    });
    expect(cost).toBe(1001);
  });

  it('property check: weighted cost is always bounded between current and incoming costs', () => {
    for (let c1 = 100; c1 <= 500; c1 += 100) {
      for (let c2 = 100; c2 <= 500; c2 += 100) {
        for (let q1 = 1; q1 <= 50; q1 += 10) {
          for (let q2 = 1; q2 <= 50; q2 += 10) {
            const result = calculateWeightedAverageCost({
              currentQty: q1,
              currentCostPaisa: c1,
              incomingQty: q2,
              incomingCostPaisa: c2,
            });
            const min = Math.min(c1, c2);
            const max = Math.max(c1, c2);
            expect(result).toBeGreaterThanOrEqual(min);
            expect(result).toBeLessThanOrEqual(max);
          }
        }
      }
    }
  });
});
