export function formatScore(score: number | null): string {
  if (score === null) return '—'
  return score.toFixed(1)
}

export function formatScorePercent(score: number | null): number {
  if (score === null) return 0
  return Math.round((score / 5) * 100)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatPrice(price: number | null): string {
  if (price === null) return 'Price unknown'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price)
}

export function scoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 4) return 'text-emerald-500'
  if (score >= 3) return 'text-amber-500'
  return 'text-rose-500'
}

export function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-muted'
  if (score >= 4) return 'bg-emerald-500'
  if (score >= 3) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function colorLabel(color: string): string {
  const labels: Record<string, string> = {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    blue: 'Blue',
    purple: 'Purple',
    pink: 'Pink',
    neutral: 'Neutral',
    white: 'White',
    black: 'Black',
    brown: 'Brown',
    grey: 'Grey',
    multicolor: 'Multicolor',
  }
  return labels[color] ?? color
}

export function finishLabel(finish: string): string {
  const labels: Record<string, string> = {
    cream: 'Cream',
    shimmer: 'Shimmer',
    glitter: 'Glitter',
    flakies: 'Flakies',
    duochrome: 'Duochrome',
    multichrome: 'Multichrome',
    holo: 'Holo',
    magnetic: 'Magnetic',
    jelly: 'Jelly',
    tinted: 'Tinted',
    matte: 'Matte',
    satin: 'Satin',
    topper: 'Topper',
    other: 'Other',
  }
  return labels[finish] ?? finish
}
