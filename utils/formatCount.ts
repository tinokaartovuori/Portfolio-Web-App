/**
 * A count in at most four characters, the way a social counter shows it:
 * 999 stays a number, 1234 is "1.2k", 12345 is "12k", 123456 is "123k",
 * and a million on is "M". The decimal is dropped when it is a zero or
 * when it would push the string past four characters (9950 rounds to
 * "10k", not "10.0k"), and a value that rounds up to a thousand of its
 * unit moves up a unit (999500 is "1M").
 */
export function formatCount(count: number): string {
  if (count < 1000) return String(Math.max(0, Math.round(count)))
  const units: [number, string][] = [
    [1e3, 'k'],
    [1e6, 'M'],
    [1e9, 'B'],
  ]
  for (const [size, suffix] of units) {
    const value = count / size
    if (value < 10) {
      const oneDecimal = Math.round(value * 10) / 10
      if (oneDecimal < 10) {
        return `${oneDecimal.toFixed(1).replace(/\.0$/, '')}${suffix}`
      }
      return `10${suffix}`
    }
    const rounded = Math.round(value)
    if (rounded < 1000 || suffix === 'B') return `${rounded}${suffix}`
  }
  return String(count)
}
