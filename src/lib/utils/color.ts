import type { ColorFamily } from '@/lib/types/app.types'

/**
 * Returns true if the string is a valid 6-digit hex color (with #)
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}

/**
 * Returns a CSS background-color style value for a polish swatch.
 * Falls back to a neutral grey if no hex is provided.
 */
export function swatchStyle(
  hexColor: string | null,
  hexSecondary?: string | null
): React.CSSProperties {
  if (!hexColor) return { backgroundColor: '#D1D5DB' }

  if (hexSecondary) {
    return {
      background: `linear-gradient(135deg, ${hexColor} 50%, ${hexSecondary} 50%)`,
    }
  }

  return { backgroundColor: hexColor }
}

/**
 * Get a Tailwind bg class hint for a color family (used for filter UI)
 */
export function colorFamilyBg(family: ColorFamily | null): string {
  const map: Record<ColorFamily, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-400',
    yellow: 'bg-yellow-400',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    pink: 'bg-pink-400',
    neutral: 'bg-stone-400',
    white: 'bg-white border border-gray-300',
    black: 'bg-gray-900',
    brown: 'bg-amber-800',
    grey: 'bg-gray-400',
    multicolor: 'bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400',
  }
  if (!family) return 'bg-gray-300'
  return map[family] ?? 'bg-gray-300'
}
