/**
 * Financial currency and split calculation utilities
 * All backend storage represents whole integer paise/cents (100 paise = ₹1.00)
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats integer paise/cents into Indian Rupee presentation (e.g., 150000 => ₹1,500.00)
 */
export function formatPaise(paise: number): string {
  if (!Number.isFinite(paise)) return '₹0.00'
  return inrFormatter.format(paise / 100)
}

/**
 * Formats paise as compact rupees without decimal when zero cents (e.g. 150000 => ₹1,500)
 */
export function formatPaiseShort(paise: number): string {
  if (!Number.isFinite(paise)) return '₹0'
  const rupees = paise / 100
  if (Number.isInteger(rupees)) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(rupees)
  }
  return inrFormatter.format(rupees)
}

/**
 * Safely parses rupee input string into exact integer paise.
 * Returns null if invalid or <= 0.
 */
export function parseRupeesToPaise(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Allow standard whole numbers or up to 2 decimal places (paise)
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null
  }

  const num = Number.parseFloat(trimmed)
  if (Number.isNaN(num) || num <= 0 || !Number.isFinite(num)) {
    return null
  }

  // Exact whole paise conversion avoiding floating precision issues
  return Math.round(num * 100)
}

/**
 * Computes fair integer division with deterministic FIFO remainder distribution
 * Exactly mirrors the backend splitTotal() pure function
 */
export function previewSplit(totalPaise: number, memberCount: number): number[] {
  if (memberCount <= 0 || totalPaise <= 0) return []

  const base = Math.floor(totalPaise / memberCount)
  const remainder = totalPaise % memberCount

  const shares: number[] = []
  for (let i = 0; i < memberCount; i++) {
    shares.push(base + (i < remainder ? 1 : 0))
  }
  return shares
}
