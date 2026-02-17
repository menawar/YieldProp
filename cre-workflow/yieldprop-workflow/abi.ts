/**
 * Minimal ABIs for YieldProp CRE workflow
 * - Phase 4: Reserve health check (read distributionPool + getCurrentRentalPrice)
 * - Phase 4b: On-chain write via RecommendationConsumer → PriceManager
 */

export const YieldDistributorAbi = [
  {
    inputs: [],
    name: "distributionPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const PriceManagerAbi = [
  {
    inputs: [],
    name: "getCurrentRentalPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "recommendationCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
