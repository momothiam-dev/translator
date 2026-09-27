const languageCodes: Record<string, string> = {
  ace: 'ace', afr: 'af', amh: 'am', arb: 'ar', asm: 'as', ast: 'ast', awa: 'awa',
  ayr: 'ay', azb: 'az', azj: 'az', bak: 'ba', bam: 'bm', ban: 'ban', bel: 'be',
  bem: 'bem', ben: 'bn', bho: 'bho', bjn: 'bjn', bod: 'bo', bos: 'bs', bug: 'bug',
  bul: 'bg', cat: 'ca', ceb: 'ceb', ces: 'cs', cjk: 'cjk', ckb: 'ckb', crh: 'crh',
  cym: 'cy', dan: 'da', deu: 'de', dik: 'dik', dyu: 'dyu', dzo: 'dz', ell: 'el',
  eng: 'en', epo: 'eo', est: 'et', eus: 'eu', ewe: 'ee', fao: 'fo', fij: 'fj',
  fin: 'fi', fon: 'fon', fra: 'fr', fur: 'fur', fuv: 'fuv', gla: 'gd', gle: 'ga',
  glg: 'gl', grn: 'gn', guj: 'gu', hat: 'ht', hau: 'ha', heb: 'he', hin: 'hi',
  hne: 'hne', hrv: 'hr', hun: 'hu', hye: 'hy', ibo: 'ig', ilo: 'ilo', ind: 'id',
  isl: 'is', ita: 'it', jav: 'jv', jpn: 'ja', kab: 'kab', kac: 'kac', kam: 'kam',
  kan: 'kn', kas: 'ks', kat: 'ka', knc: 'knc', kaz: 'kk', kbp: 'kbp', kea: 'kea',
  khm: 'km', kik: 'kik', kin: 'rw', kir: 'ky', kmb: 'kmb', kmr: 'kmr', kon: 'kg',
  kor: 'ko', lao: 'lo', lij: 'lij', lim: 'lim', lin: 'ln', lit: 'lt', lmo: 'lmo',
  ltg: 'ltg', ltz: 'lb', lua: 'lua', lug: 'lg', luo: 'luo', lus: 'lus', lvs: 'lv',
  mag: 'mag', mai: 'mai', mal: 'ml', mar: 'mr', min: 'min', mkd: 'mk', plt: 'plt',
  mlt: 'mt', mni: 'mni', khk: 'mn', mos: 'mos', mri: 'mi', mya: 'my', nld: 'nl',
  nno: 'nn', nob: 'no', npi: 'ne', nso: 'nso', nus: 'nus', nya: 'ny', oci: 'oc',
  gaz: 'gaz', ory: 'or', pag: 'pag', pan: 'pa', pap: 'pap', pes: 'fa', pol: 'pl',
  por: 'pt', prs: 'prs', pbt: 'ps', quy: 'quy', ron: 'ro', run: 'rn', rus: 'ru',
  sag: 'sg', san: 'sa', sat: 'sat', scn: 'scn', shn: 'shn', sin: 'si', slk: 'sk',
  slv: 'sl', smo: 'sm', sna: 'sn', snd: 'sd', som: 'so', sot: 'st', spa: 'es',
  als: 'sq', srd: 'sc', srp: 'sr', ssw: 'ss', sun: 'su', swe: 'sv', swh: 'sw',
  szl: 'szl', tam: 'ta', tat: 'tt', tel: 'te', tgk: 'tg', tgl: 'tl', tha: 'th',
  tir: 'ti', taq: 'taq', tpi: 'tpi', tsn: 'tn', tso: 'ts', tuk: 'tk', tum: 'tum',
  tur: 'tr', twi: 'tw', tzm: 'tzm', uig: 'ug', ukr: 'uk', umb: 'umb', urd: 'ur',
  uzn: 'uz', vec: 'vec', vie: 'vi', war: 'war', wol: 'wo', xho: 'xh', ydd: 'yi',
  yor: 'yo', yue: 'yue', zho: 'zh-CN', zsm: 'ms', zul: 'zu',
}

const modelCodeOverrides: Record<string, string> = {
  arb_Arab: 'ar', arb_Latn: 'ar', pes_Arab: 'fa', prs_Arab: 'prs', pbt_Arab: 'ps',
  zho_Hans: 'zh-CN', zho_Hant: 'zh-TW', yue_Hant: 'yue', zsm_Latn: 'ms',
}
const MAX_CHUNK_BYTES = 450

type MyMemoryResponse = {
  responseStatus: number
  responseDetails?: string
  responseData?: { translatedText?: string }
  quotaFinished?: boolean
}

function toApiLanguage(modelCode: string): string | undefined {
  if (modelCode === 'auto') return 'autodetect'
  const apiCode = modelCodeOverrides[modelCode] ?? languageCodes[modelCode.split('_')[0]]
  return apiCode && /^[a-z]{2}(?:-[A-Z]{2})?$/u.test(apiCode) ? apiCode : undefined
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function splitText(text: string): string[][] {
  const paragraphs = text.split(/\n{2,}/u)
  const result: string[][] = []

  for (const paragraph of paragraphs) {
    const chunks: string[] = []
    const sentences = paragraph.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/gu) ?? [paragraph]
    let chunk = ''
    for (const sentence of sentences) {
      const words = sentence.match(/\S+\s*/gu) ?? [sentence]
      for (const word of words) {
        if (byteLength(word) > MAX_CHUNK_BYTES) {
          if (chunk.trim()) chunks.push(chunk.trim())
          chunk = ''
          let wordPart = ''
          for (const character of [...word]) {
            if (wordPart && byteLength(wordPart + character) > MAX_CHUNK_BYTES) {
              chunks.push(wordPart)
              wordPart = ''
            }
            wordPart += character
          }
          chunk = wordPart
          continue
        }
        if (chunk.length > 0 && byteLength(chunk + word) > MAX_CHUNK_BYTES) {
          chunks.push(chunk.trim())
          chunk = ''
        }
        chunk += word
      }
    }
    if (chunk.trim()) chunks.push(chunk.trim())
    if (chunks.length > 0) result.push(chunks)
  }

  return result
}

function decodeEntities(text: string): string {
  const element = document.createElement('textarea')
  element.innerHTML = text
  return element.value
}

export async function translateOnline(text: string, source: string, target: string): Promise<string> {
  const sourceLanguage = toApiLanguage(source)
  const targetLanguage = toApiLanguage(target)
  if (!sourceLanguage || !targetLanguage) {
    throw new Error('Cette langue n’est pas disponible en ligne. Choisissez le mode hors ligne pour utiliser le modèle multilingue.')
  }

  const translatedParagraphs: string[] = []
  for (const paragraph of splitText(text)) {
    const translatedChunks: string[] = []
    for (const chunk of paragraph) {
      const params = new URLSearchParams({ q: chunk, langpair: `${sourceLanguage}|${targetLanguage}` })
      let response: Response
      try {
        response = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal: AbortSignal.timeout(20_000) })
      } catch {
        throw new Error('Le service en ligne ne répond pas. Vérifiez votre connexion ou passez en mode hors ligne.')
      }

      if (!response.ok) throw new Error(`Le service en ligne a répondu avec l’erreur ${response.status}. Réessayez plus tard ou passez en mode hors ligne.`)
      const result = await response.json() as MyMemoryResponse
      if (result.quotaFinished || result.responseStatus === 429) {
        throw new Error('La limite gratuite du service en ligne est atteinte (5 000 caractères par jour). Passez en mode hors ligne ou réessayez demain.')
      }
      if (result.responseStatus !== 200 || !result.responseData?.translatedText) {
        throw new Error(result.responseDetails || 'Le service en ligne n’a pas pu traduire ce texte.')
      }
      translatedChunks.push(decodeEntities(result.responseData.translatedText))
    }
    translatedParagraphs.push(translatedChunks.join(' '))
  }

  return translatedParagraphs.join('\n\n')
}
