/**
 * Minimal ABIs for YieldProp reserve health check (Phase 4)
 * Used by CRE workflow to query YieldDistributor pool and PriceManager rental price
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
] as const;
