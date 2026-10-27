export function normalizeTranslationInput(text: string, source: string): string {
  if (source !== 'fra_Latn') return text

  return text.replace(/\b(au)(\s+)marcher\b/giu, (_match, preposition: string, spacing: string) => {
    const normalizedPreposition = preposition[0] === preposition[0].toUpperCase() ? 'Au' : 'au'
    return `${normalizedPreposition}${spacing}marché`
  })
}
