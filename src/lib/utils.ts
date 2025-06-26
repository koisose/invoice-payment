import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getChainName(chainId: number | undefined): string {
  if (chainId === undefined) return 'Unknown Network';
  switch (chainId) {
    case 84532:
      return 'Base Sepolia';
    case 8453:
      return 'Base';
    case 1:
      return 'Ethereum';
    case 11155111:
      return 'Sepolia';
    default:
      return `Chain ID: ${chainId}`;
  }
}
