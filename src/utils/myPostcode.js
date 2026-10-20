/**
 * Malaysia postcode → city / state for booking forms.
 * Ranges cover Sabah/Sarawak first (IPOSB core), then common Peninsular bands.
 */

const RANGES = [
  // Sabah
  [88000, 88999, 'Kota Kinabalu', 'Sabah'],
  [89000, 89099, 'Kudat', 'Sabah'],
  [89100, 89199, 'Kota Marudu', 'Sabah'],
  [89200, 89299, 'Kota Belud', 'Sabah'],
  [89300, 89399, 'Ranau', 'Sabah'],
  [89400, 89499, 'Tuaran', 'Sabah'],
  [89500, 89599, 'Penampang', 'Sabah'],
  [89600, 89699, 'Papar', 'Sabah'],
  [89700, 89799, 'Tambunan', 'Sabah'],
  [89800, 89899, 'Keningau', 'Sabah'],
  [89900, 89999, 'Tenom', 'Sabah'],
  [90000, 90999, 'Sandakan', 'Sabah'],
  [91000, 91199, 'Tawau', 'Sabah'],
  [91200, 91299, 'Lahad Datu', 'Sabah'],
  [91300, 91399, 'Kunak', 'Sabah'],
  [87000, 87999, 'Labuan', 'Labuan'],
  // Sarawak
  [93000, 93999, 'Kuching', 'Sarawak'],
  [94000, 94999, 'Sri Aman', 'Sarawak'],
  [95000, 95999, 'Sibu', 'Sarawak'],
  [96000, 96999, 'Bintulu', 'Sarawak'],
  [97000, 97999, 'Miri', 'Sarawak'],
  [98000, 98999, 'Limbang', 'Sarawak'],
  // Peninsular (broad)
  [50000, 60999, 'Kuala Lumpur', 'Wilayah Persekutuan'],
  [62000, 62999, 'Putrajaya', 'Wilayah Persekutuan'],
  [40000, 43999, 'Shah Alam', 'Selangor'],
  [43000, 43999, 'Kajang', 'Selangor'],
  [46000, 47999, 'Petaling Jaya', 'Selangor'],
  [80000, 81999, 'Johor Bahru', 'Johor'],
  [75000, 76999, 'Melaka', 'Melaka'],
  [70000, 73999, 'Seremban', 'Negeri Sembilan'],
  [30000, 36999, 'Ipoh', 'Perak'],
  [10000, 14999, 'George Town', 'Pulau Pinang'],
  [5000, 9999, 'Alor Setar', 'Kedah'],
  [1000, 2999, 'Kangar', 'Perlis'],
  [20000, 24999, 'Kuala Terengganu', 'Terengganu'],
  [15000, 18999, 'Kota Bharu', 'Kelantan'],
  [25000, 28999, 'Kuantan', 'Pahang'],
]

/** @returns {{ city: string, state: string } | null} */
export function lookupMyPostcode(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length < 5) return null
  const n = parseInt(digits.slice(0, 5), 10)
  if (!Number.isFinite(n)) return null
  for (const [from, to, city, state] of RANGES) {
    if (n >= from && n <= to) return { city, state }
  }
  return null
}

export function normalizePostcode(raw) {
  return String(raw || '').replace(/\D/g, '').slice(0, 5)
}
