/**
 * Inventory Pure Calculation Helpers for DokanDesk
 * All money values are in integer paisa.
 */

export interface WeightedAverageCostInput {
  currentQty: number;
  currentCostPaisa: number;
  incomingQty: number;
  incomingCostPaisa: number;
}

/**
 * Calculates new weighted-average cost per unit in integer paisa.
 * Formula: round((currentQty * currentCost + incomingQty * incomingCost) / (currentQty + incomingQty))
 * If currentQty <= 0, the incoming cost becomes the new cost.
 */
export function calculateWeightedAverageCost({
  currentQty,
  currentCostPaisa,
  incomingQty,
  incomingCostPaisa,
}: WeightedAverageCostInput): number {
  if (incomingQty <= 0) {
    return currentCostPaisa;
  }

  if (currentQty <= 0) {
    return Math.round(incomingCostPaisa);
  }

  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) {
    return Math.round(incomingCostPaisa);
  }

  const totalValue =
    currentQty * currentCostPaisa + incomingQty * incomingCostPaisa;
  return Math.round(totalValue / totalQty);
}
