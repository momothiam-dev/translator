type NativeTranslationResult = { translate: (text: string) => Promise<string>; destroy?: () => void }
type NativeDownloadProgress = Event & { loaded: number; total: number }
type NativeTranslatorApi = {
  create: (options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
  }) => Promise<NativeTranslationResult>
}

const languageAliases: Record<string, string> = {
  arb: 'ar', azb: 'az', azj: 'az', ces: 'cs', cmn: 'zh', deu: 'de', ell: 'el', eng: 'en',
  fin: 'fi', fra: 'fr', heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu', ind: 'id', ita: 'it',
  jpn: 'ja', kan: 'kn', kor: 'ko', lit: 'lt', mar: 'mr', nld: 'nl', nob: 'no', nno: 'no',
  pol: 'pl', por: 'pt', ron: 'ro', rus: 'ru', slk: 'sk', slv: 'sl', spa: 'es', swe: 'sv',
  tam: 'ta', tel: 'te', tha: 'th', tur: 'tr', ukr: 'uk', vie: 'vi', zho: 'zh',
}

export function browserTranslationAvailable(): boolean {
  return Boolean((globalThis as typeof globalThis & { Translator?: NativeTranslatorApi }).Translator)
}

export function browserLanguageCode(modelCode: string): string | undefined {
  const [language, script] = modelCode.split('_')
  if (language === 'zho' && script === 'Hant') return 'zh-Hant'
  return languageAliases[language] ?? (language.length === 2 ? language : undefined)
}

export async function translateInBrowser(
  text: string,
  source: string,
  target: string,
  onDownloadProgress: (progress: number) => void,
): Promise<string> {
  const sourceLanguage = browserLanguageCode(source)
  const targetLanguage = browserLanguageCode(target)
  if (!sourceLanguage || !targetLanguage) {
    throw new Error('Cette langue n’est pas prise en charge par le traducteur intégré du navigateur. Essayez le mode En ligne.')
  }

  const api = (globalThis as typeof globalThis & { Translator?: NativeTranslatorApi }).Translator
  if (!api) throw new Error('La traduction sur cet appareil n’est pas disponible dans ce navigateur. Utilisez le mode En ligne.')

  const translator = await api.create({
    sourceLanguage,
    targetLanguage,
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progress = event as NativeDownloadProgress
        if (progress.total > 0) onDownloadProgress(Math.round(progress.loaded / progress.total * 100))
      })
    },
  })

  try {
    return await translator.translate(text)
  } finally {
    translator.destroy?.()
  }
}
