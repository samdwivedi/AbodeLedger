/**
 * Pure bill-splitting function.
 *
 * Distributes totalCents among memberCount members as evenly as possible.
 * Remainder cents go to the first members in order (index 0 gets first extra cent, etc.).
 *
 * @returns An array of integer cent amounts that sum exactly to totalCents.
 */
export function splitTotal(totalCents: number, memberCount: number): number[] {
  const base = Math.floor(totalCents / memberCount)
  const remainder = totalCents % memberCount

  const shares: number[] = []
  for (let i = 0; i < memberCount; i++) {
    shares.push(i < remainder ? base + 1 : base)
  }
  return shares
}
