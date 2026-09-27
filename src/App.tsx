import { useEffect, useState } from 'react'
import { ArrowDownUp, ArrowRight, Check, ChevronDown, Clipboard, Cloud, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { nllbLanguages, type Language } from './languages'
import { translateOnline } from './onlineTranslator'

type TranslationCache = Record<string, string>
const TRANSLATION_CACHE_KEY = 'parlotte:online-translations:v1'
const MAX_CACHED_TRANSLATIONS = 20

const featuredLanguages: Language[] = [
  { name: 'Français', code: 'fra_Latn' }, { name: 'Anglais', code: 'eng_Latn' },
  { name: 'Espagnol', code: 'spa_Latn' }, { name: 'Allemand', code: 'deu_Latn' },
  { name: 'Italien', code: 'ita_Latn' }, { name: 'Portugais', code: 'por_Latn' },
  { name: 'Néerlandais', code: 'nld_Latn' }, { name: 'Russe', code: 'rus_Cyrl' },
  { name: 'Ukrainien', code: 'ukr_Cyrl' }, { name: 'Polonais', code: 'pol_Latn' },
  { name: 'Turc', code: 'tur_Latn' }, { name: 'Arabe', code: 'arb_Arab' },
  { name: 'Hébreu', code: 'heb_Hebr' }, { name: 'Persan', code: 'pes_Arab' },
  { name: 'Hindi', code: 'hin_Deva' }, { name: 'Bengali', code: 'ben_Beng' },
  { name: 'Chinois simplifié', code: 'zho_Hans' }, { name: 'Chinois traditionnel', code: 'zho_Hant' },
  { name: 'Japonais', code: 'jpn_Jpan' }, { name: 'Coréen', code: 'kor_Hang' },
  { name: 'Vietnamien', code: 'vie_Latn' }, { name: 'Thaï', code: 'tha_Thai' },
  { name: 'Indonésien', code: 'ind_Latn' }, { name: 'Swahili', code: 'swh_Latn' },
  { name: 'Suédois', code: 'swe_Latn' }, { name: 'Danois', code: 'dan_Latn' },
  { name: 'Norvégien bokmål', code: 'nob_Latn' }, { name: 'Finnois', code: 'fin_Latn' },
  { name: 'Grec', code: 'ell_Grek' }, { name: 'Tchèque', code: 'ces_Latn' },
  { name: 'Roumain', code: 'ron_Latn' }, { name: 'Hongrois', code: 'hun_Latn' },
  { name: 'Bulgare', code: 'bul_Cyrl' }, { name: 'Serbe', code: 'srp_Cyrl' },
  { name: 'Croate', code: 'hrv_Latn' }, { name: 'Catalan', code: 'cat_Latn' },
  { name: 'Basque', code: 'eus_Latn' }, { name: 'Persan dari', code: 'prs_Arab' },
  { name: 'Ourdou', code: 'urd_Arab' }, { name: 'Tamoul', code: 'tam_Taml' },
  { name: 'Télougou', code: 'tel_Telu' }, { name: 'Pendjabi', code: 'pan_Guru' },
  { name: 'Gujarati', code: 'guj_Gujr' }, { name: 'Marathi', code: 'mar_Deva' },
  { name: 'Népalais', code: 'npi_Deva' }, { name: 'Amharique', code: 'amh_Ethi' },
  { name: 'Yoruba', code: 'yor_Latn' }, { name: 'Igbo', code: 'ibo_Latn' },
  { name: 'Zoulou', code: 'zul_Latn' }, { name: 'Afrikaans', code: 'afr_Latn' },
  { name: 'Gallois', code: 'cym_Latn' }, { name: 'Irlandais', code: 'gle_Latn' },
  { name: 'Esperanto', code: 'epo_Latn' },
]

const languageMap = new Map<string, Language>()
for (const language of [...nllbLanguages, ...featuredLanguages]) languageMap.set(language.code, language)
const languages = [...languageMap.values()].sort((left, right) => left.name.localeCompare(right.name, 'fr'))

function readTranslationCache(): TranslationCache {
  try {
    const cached = localStorage.getItem(TRANSLATION_CACHE_KEY)
    return cached ? JSON.parse(cached) as TranslationCache : {}
  } catch {
    return {}
  }
}

function translationKey(text: string, source: string, target: string): string {
  return JSON.stringify([source, target, text])
}

function storeTranslation(key: string, value: string): void {
  const cache = readTranslationCache()
  cache[key] = value
  try {
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-MAX_CACHED_TRANSLATIONS))))
  } catch {
    // A full or unavailable browser cache must not prevent translation.
  }
}

function App() {
  const [source, setSource] = useState('auto')
  const [target, setTarget] = useState('fra_Latn')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translationReused, setTranslationReused] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    void caches.delete('transformers-cache')
    localStorage.removeItem('parlotte:nllb-model-cached:v1')
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  const translate = async (force = false) => {
    const text = input.trim()
    if (!text || translating) return
    if (!navigator.onLine) {
      setOnline(false)
      setError('Une connexion Internet est nécessaire. Cette version ne télécharge aucun modèle hors ligne.')
      return
    }

    const key = translationKey(text, source, target)
    const cached = readTranslationCache()[key]
    if (!force && cached !== undefined) {
      setOutput(cached)
      setTranslationReused(true)
      setError('')
      return
    }
    if (source !== 'auto' && source === target) {
      setOutput(text)
      setTranslationReused(true)
      setError('')
      return
    }

    setTranslating(true)
    setTranslationReused(false)
    setError('')
    try {
      const result = await translateOnline(text, source, target)
      setOutput(result)
      storeTranslation(key, result)
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : 'La traduction en ligne a échoué. Réessayez.')
    } finally {
      setTranslating(false)
    }
  }

  const recalculateTranslation = () => {
    setOutput('')
    void translate(true)
  }

  const swap = () => {
    if (source === 'auto') return
    setSource(target)
    setTarget(source)
    if (output) {
      setInput(output)
      setOutput(input)
    }
  }

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const languageName = (code: string) => languages.find((language) => language.code === code)?.name ?? code

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Parlotte, accueil">
          <img src="/parlotte.svg" alt="" />
          <span>parlotte<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-right">
          <span className={`connection ${online ? 'is-online' : ''}`}><span className="connection-dot" />{online ? 'En ligne' : 'Hors ligne'}</span>
          <span className="privacy-label"><span className="privacy-mark">✳</span> Texte envoyé au service</span>
        </div>
      </header>

      <section className="workspace">
        <div className="intro">
          <div className="eyebrow"><span /> TRADUCTION EN LIGNE</div>
          <h1>Les mots voyagent.<br /><em>Sans gros téléchargement.</em></h1>
          <p>Traduisez sans installer de modèle. Une connexion Internet est nécessaire.</p>
        </div>

        <section className="translator" aria-label="Traducteur en ligne">
          <div className="language-bar">
            <label className="language-select"><span>DE</span><select value={source} onChange={(event) => { setSource(event.target.value); setTranslationReused(false) }} aria-label="Langue source"><option value="auto">Détection automatique</option>{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={15} /></label>
            <button className="swap-button" onClick={swap} disabled={source === 'auto'} title="Inverser les langues" aria-label="Inverser les langues"><ArrowDownUp size={17} /></button>
            <label className="language-select target-select"><span>VERS</span><select value={target} onChange={(event) => { setTarget(event.target.value); setTranslationReused(false) }} aria-label="Langue cible">{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={15} /></label>
            <span className="language-count"><Cloud size={14} /> En ligne</span>
          </div>

          <div className="translation-panes">
            <div className="pane input-pane">
              <textarea value={input} onChange={(event) => { setInput(event.target.value); setTranslationReused(false) }} maxLength={5000} placeholder="Écrivez ou collez votre texte ici…" aria-label="Texte à traduire" />
              <div className="pane-footer"><span>{input.length} / 5 000</span><button className="icon-button" onClick={() => { setInput(''); setOutput('') }} disabled={!input} title="Effacer le texte" aria-label="Effacer le texte"><X size={17} /></button></div>
            </div>
            <div className="pane output-pane" aria-live="polite">
              {output ? <p className="translated-text">{output}</p> : <div className="output-placeholder"><span className="placeholder-icon"><ArrowRight size={17} /></span><span>Votre traduction<br />apparaîtra ici</span></div>}
              <div className="pane-footer"><span>{output ? `${output.length} caractères` : languageName(target)}</span><div className="output-actions"><button className="icon-button" onClick={recalculateTranslation} disabled={!output || translating} title="Recalculer la traduction" aria-label="Recalculer la traduction"><RefreshCw size={16} /></button><button className="icon-button" onClick={copyOutput} disabled={!output} title="Copier la traduction" aria-label="Copier la traduction">{copied ? <Check size={17} /> : <Clipboard size={17} />}</button></div></div>
            </div>
          </div>

          <div className="action-row">
            <div className="model-status">
              <span className={`model-indicator ${translating ? 'busy' : online ? 'ready' : ''}`} />
              <span>{translating ? 'Requête en cours…' : translationReused ? 'Résultat réutilisé sans requête' : online ? 'Service prêt · aucun modèle local' : 'Connexion Internet requise'}</span>
            </div>
            <button className="translate-button" onClick={() => void translate()} disabled={!input.trim() || translating || !online}>
              {translating ? <><LoaderCircle className="spin" size={17} /> Traduction…</> : translationReused ? <><Check size={17} /> Réutilisée</> : <>Traduire <ArrowRight size={17} /></>}
            </button>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        <div className="offline-note"><span className="offline-icon"><Cloud size={16} /></span><div className="offline-note-copy"><strong>Pas de modèle à télécharger</strong><p>Les textes sont transmis à MyMemory pour être traduits. Quota gratuit anonyme : 5 000 caractères par jour. Le cache retient les 20 derniers résultats sur cet appareil.</p></div><span className="note-arrow"><Check size={17} /></span></div>

        <footer className="page-footer"><span>TRADUCTION EN LIGNE</span><span className="footer-separator" /><span>LE MODE HORS LIGNE N’EST PAS DISPONIBLE</span></footer>
      </section>
    </main>
  )
}

export default App
