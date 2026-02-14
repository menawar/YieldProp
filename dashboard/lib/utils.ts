import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io"

export function getBlockExplorerTxUrl(txHash: `0x${string}` | undefined): string {
  if (!txHash) return SEPOLIA_EXPLORER
  return `${SEPOLIA_EXPLORER}/tx/${txHash}`
}

/** Map contract revert reasons to user-friendly messages */
const ERROR_MAPPINGS: Array<{ pattern: RegExp | string; message: string }> = [
  { pattern: /TransferRestricted|transfer restricted/i, message: 'Sender or recipient must be whitelisted.' },
  { pattern: /NotWhitelisted|not whitelisted/i, message: 'Your address is not whitelisted. Contact the property manager.' },
  { pattern: /PaymentBelowRentalPrice|payment below/i, message: 'Payment is below the current rental price.' },
  { pattern: /InsufficientTokenBalance|insufficient balance/i, message: 'Insufficient token balance.' },
  { pattern: /InsufficientPartitionBalance/i, message: 'Insufficient balance in partition.' },
  { pattern: /ExceedsOffering|exceeds offering/i, message: 'Amount exceeds tokens offered for sale.' },
  { pattern: /SaleNotActive|sale not active/i, message: 'The token sale is not active.' },
  { pattern: /CannotBuyOwnTokens/i, message: 'You cannot purchase your own tokens.' },
  { pattern: /InvalidAmount|invalid amount/i, message: 'Please enter a valid amount.' },
  { pattern: /DistributionPoolEmpty|pool empty/i, message: 'No funds in distribution pool.' },
  { pattern: /NoTokenHolders|no token holders/i, message: 'No registered token holders for distribution.' },
  { pattern: /TransferFailed|transfer failed/i, message: 'Token transfer failed. Please try again.' },
  { pattern: /RecommendationAlreadyProcessed/i, message: 'This recommendation has already been accepted or rejected.' },
  { pattern: /ERC20: insufficient allowance/i, message: 'Approve USDC spending first, then retry.' },
  { pattern: /ERC20: transfer amount exceeds allowance/i, message: 'Approve more USDC, then retry.' },
  { pattern: /user rejected|user denied|rejected the request/i, message: 'Transaction was rejected in your wallet.' },
]

export function getErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  for (const { pattern, message } of ERROR_MAPPINGS) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
    if (regex.test(msg)) return message
  }
  return msg
}
