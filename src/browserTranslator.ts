type NativeTranslationResult = { translate: (text: string) => Promise<string>; destroy?: () => void }
type NativeDownloadProgress = Event & { loaded: number; total: number }

const languageAliases: Record<string, string> = {
  arb: 'ar', azb: 'az', azj: 'az', ces: 'cs', cmn: 'zh', deu: 'de', ell: 'el', eng: 'en',
  fin: 'fi', fra: 'fr', heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu', ind: 'id', ita: 'it',
  jpn: 'ja', kan: 'kn', kor: 'ko', lit: 'lt', mar: 'mr', nld: 'nl', nob: 'no', nno: 'no',
  pol: 'pl', por: 'pt', ron: 'ro', rus: 'ru', slk: 'sk', slv: 'sl', spa: 'es', swe: 'sv',
  tam: 'ta', tel: 'te', tha: 'th', tur: 'tr', ukr: 'uk', vie: 'vi', zho: 'zh',
}

function getTranslatorApi(): any {
  const g = globalThis as any
  if (g.translation && typeof g.translation.createTranslator === 'function') return g.translation
  if (g.ai && g.ai.translator && typeof g.ai.translator.create === 'function') return g.ai.translator
  if (g.Translator && typeof g.Translator.create === 'function') return g.Translator
  return undefined
}

export function browserTranslationAvailable(): boolean {
  return Boolean(getTranslatorApi())
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

  const api = getTranslatorApi()
  if (!api) throw new Error('La traduction sur cet appareil n’est pas disponible dans ce navigateur. Utilisez le mode En ligne.')

  const options = {
    sourceLanguage,
    targetLanguage,
    monitor(monitor: EventTarget) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progress = event as NativeDownloadProgress
        if (progress.total > 0) onDownloadProgress(Math.round(progress.loaded / progress.total * 100))
      })
    },
  }

  let translator: NativeTranslationResult
  if (api.createTranslator) {
    translator = await api.createTranslator(options)
  } else {
    translator = await api.create(options)
  }

  try {
    return await translator.translate(text)
  } finally {
    if (translator.destroy) {
      translator.destroy()
    }
  }
}
