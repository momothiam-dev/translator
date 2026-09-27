import { useEffect, useRef, useState } from 'react'
import { ArrowDownUp, ArrowRight, Check, ChevronDown, Clipboard, Download, Languages, LoaderCircle, Wifi, WifiOff, X } from 'lucide-react'
import { franc } from 'franc-min'
import { nllbLanguages, type Language } from './languages'

type ModelProgress = { status?: string; file?: string; progress?: number; loaded?: number; total?: number }
type WorkerMessage = { type: string; progress?: ModelProgress; text?: string; message?: string; completed?: number; total?: number }
const MODEL_CACHE_KEY = 'parlotte:nllb-model-cached:v1'
const TRANSLATION_CACHE_KEY = 'parlotte:translations:v1'
const MAX_CACHED_TRANSLATIONS = 20
const detectedLanguageAliases: Record<string, string> = { cmn: 'zho_Hans', zlm: 'zsm_Latn' }

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

function detectSourceLanguage(text: string): Language | undefined {
  const detectedCode = franc(text, { minLength: 10 })
  if (detectedCode === 'und') return undefined
  const nllbCode = detectedLanguageAliases[detectedCode]
    ?? nllbLanguages.find((language) => language.code.startsWith(`${detectedCode}_`))?.code
  return nllbCode ? languageMap.get(nllbCode) : undefined
}

function readTranslationCache(): Record<string, string> {
  try {
    const cached = localStorage.getItem(TRANSLATION_CACHE_KEY)
    return cached ? JSON.parse(cached) as Record<string, string> : {}
  } catch {
    return {}
  }
}

function makeTranslationKey(text: string, source: string, target: string): string {
  return JSON.stringify([source, target, text])
}

function App() {
  const worker = useRef<Worker | null>(null)
  const pendingTranslation = useRef<{ text: string; source: string; target: string } | null>(null)
  const activeTranslation = useRef<{ text: string; source: string; target: string } | null>(null)
  const [source, setSource] = useState('auto')
  const [target, setTarget] = useState('fra_Latn')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [modelReady, setModelReady] = useState(false)
  const [modelCached, setModelCached] = useState(() => localStorage.getItem(MODEL_CACHE_KEY) === '1')
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState('')
  const [translationReused, setTranslationReused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const instance = new Worker(new URL('./translator.worker.ts', import.meta.url), { type: 'module' })
    worker.current = instance
    instance.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        const detail = message.progress
        if (detail?.status === 'progress' && typeof detail.progress === 'number') setProgress(Math.round(detail.progress))
        if (detail?.status === 'downloading') setStatus(modelCached ? 'Chargement du modèle enregistré…' : 'Téléchargement initial du modèle…')
        if (detail?.status === 'ready') setStatus('Préparation du modèle…')
      } else if (message.type === 'ready') {
        setModelReady(true)
        setModelCached(true)
        localStorage.setItem(MODEL_CACHE_KEY, '1')
        if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false)
        setLoading(false)
        setStatus('Modèle prêt sur cet appareil')
        if (pendingTranslation.current) {
          const pending = pendingTranslation.current
          worker.current?.postMessage({ type: 'translate', ...pending })
          activeTranslation.current = pending
          pendingTranslation.current = null
          setTranslating(true)
        }
      } else if (message.type === 'unloaded') {
        setModelReady(false)
        setStatus('Modèle conservé hors ligne')
      } else if (message.type === 'translation-progress') {
        setTranslationProgress(`${message.completed ?? 0}/${message.total ?? 0}`)
      } else if (message.type === 'translated') {
        const translatedText = message.text ?? ''
        setOutput(translatedText)
        if (activeTranslation.current) {
          const cache = readTranslationCache()
          const key = makeTranslationKey(activeTranslation.current.text, activeTranslation.current.source, activeTranslation.current.target)
          cache[key] = translatedText
          try {
            const recentEntries = Object.entries(cache).slice(-MAX_CACHED_TRANSLATIONS)
            localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(recentEntries)))
          } catch {
            // Translation still succeeds if browser storage is unavailable or full.
          }
          activeTranslation.current = null
        }
        setTranslating(false)
        setTranslationProgress('')
        setTranslationReused(false)
        setError('')
      } else if (message.type === 'error') {
        setError(message.message ?? 'Impossible de charger le modèle.')
        pendingTranslation.current = null
        activeTranslation.current = null
        setLoading(false)
        setTranslating(false)
        setTranslationProgress('')
      }
    })
    instance.addEventListener('error', (event) => {
      setError(event.message || 'Le moteur de traduction a été interrompu. Réessayez avec un texte plus court.')
      setLoading(false)
      setTranslating(false)
      pendingTranslation.current = null
    })
    instance.addEventListener('messageerror', () => {
      setError('La réponse du moteur est illisible. Rechargez la page et réessayez.')
      setLoading(false)
      setTranslating(false)
    })
    const updateConnection = () => setOnline(navigator.onLine)
    const releaseMemoryWhenHidden = () => {
      if (document.visibilityState === 'hidden') instance.postMessage({ type: 'unload' })
    }
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    document.addEventListener('visibilitychange', releaseMemoryWhenHidden)
    return () => {
      instance.terminate()
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      document.removeEventListener('visibilitychange', releaseMemoryWhenHidden)
    }
  }, [])

  const loadModel = () => {
    setLoading(true)
    setError('')
    setProgress(0)
    setStatus(modelCached ? 'Chargement du modèle depuis cet appareil…' : online ? 'Téléchargement initial du modèle…' : 'Recherche du modèle en cache…')
    worker.current?.postMessage({ type: 'load' })
  }

  const translate = () => {
    if (!input.trim() || !worker.current) return
    const detectedSource = source === 'auto' ? detectSourceLanguage(input) : undefined
    const sourceCode = source === 'auto' ? detectedSource?.code : source
    if (!sourceCode) {
      setError('Langue source non reconnue automatiquement. Choisissez-la dans le menu « DE ».')
      return
    }
    const text = input.trim()
    const translationKey = makeTranslationKey(text, sourceCode, target)
    const cache = readTranslationCache()
    const cachedTranslation = cache[translationKey]
    if (cachedTranslation !== undefined) {
      delete cache[translationKey]
      cache[translationKey] = cachedTranslation
      try {
        localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache))
      } catch {
        // A cache hit remains usable if storage becomes unavailable.
      }
      setOutput(cachedTranslation)
      setError('')
      setTranslationProgress('')
      setTranslationReused(true)
      return
    }
    if (sourceCode === target) {
      setOutput(text)
      setTranslationReused(true)
      setError('')
      return
    }
    setTranslationReused(false)
    if (!modelReady) {
      pendingTranslation.current = { text, source: sourceCode, target }
      loadModel()
      return
    }
    setTranslating(true)
    setTranslationProgress('')
    setError('')
    const request = { text, source: sourceCode, target }
    activeTranslation.current = request
    worker.current.postMessage({ type: 'translate', ...request })
  }

  const swap = () => {
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
          <span className="privacy-label"><span className="privacy-mark">✳</span> Privé par nature</span>
        </div>
      </header>

      <section className="workspace">
        <div className="intro">
          <div className="eyebrow"><span /> LE MONDE, À PORTÉE DE MOTS</div>
          <h1>Les mots voyagent.<br /><em>Vos données, non.</em></h1>
          <p>Traduisez directement sur votre appareil. Vos textes restent à vous, même sans connexion.</p>
        </div>

        <section className="translator" aria-label="Traducteur">
          <div className="language-bar">
            <label className="language-select"><span>DE</span><select value={source} onChange={(event) => { setSource(event.target.value); setTranslationReused(false) }} aria-label="Langue source"><option value="auto">Détection automatique</option>{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={15} /></label>
            <button className="swap-button" onClick={swap} title="Inverser les langues" aria-label="Inverser les langues"><ArrowDownUp size={17} /></button>
            <label className="language-select target-select"><span>VERS</span><select value={target} onChange={(event) => { setTarget(event.target.value); setTranslationReused(false) }} aria-label="Langue cible">{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={15} /></label>
            <span className="language-count"><Languages size={14} /> {languages.length} langues</span>
          </div>

          <div className="translation-panes">
            <div className="pane input-pane">
              <textarea value={input} onChange={(event) => { setInput(event.target.value); setTranslationReused(false) }} maxLength={5000} placeholder="Écrivez ou collez votre texte ici…" aria-label="Texte à traduire" />
              <div className="pane-footer"><span>{input.length} / 5 000</span><button className="icon-button" onClick={() => { setInput(''); setOutput('') }} disabled={!input} title="Effacer le texte" aria-label="Effacer le texte"><X size={17} /></button></div>
            </div>
            <div className="pane output-pane" aria-live="polite">
              {output ? <p className="translated-text">{output}</p> : <div className="output-placeholder"><span className="placeholder-icon"><ArrowRight size={17} /></span><span>Votre traduction<br />apparaîtra ici</span></div>}
              <div className="pane-footer"><span>{output ? `${output.length} caractères` : languageName(target)}</span><button className="icon-button" onClick={copyOutput} disabled={!output} title="Copier la traduction" aria-label="Copier la traduction">{copied ? <Check size={17} /> : <Clipboard size={17} />}</button></div>
            </div>
          </div>

          <div className="action-row">
            <div className="model-status">
              <span className={`model-indicator ${modelReady ? 'ready' : loading ? 'busy' : ''}`} />
              <span>{loading ? status : translating ? `Traduction en cours ${translationProgress}` : translationReused ? 'Résultat réutilisé sans recalcul' : modelReady ? 'Moteur chargé en mémoire' : modelCached ? 'Modèle enregistré · hors ligne' : 'Modèle requis pour démarrer'}</span>
            </div>
            <button className="translate-button" onClick={translate} disabled={!input.trim() || translating || loading}>
              {translating ? <><LoaderCircle className="spin" size={17} /> Traduction {translationProgress}</> : translationReused ? <><Check size={17} /> Réutilisée</> : <>{!modelReady && <Languages size={17} />} Traduire <ArrowRight size={17} /></>}
            </button>
          </div>

          <div className={`download-progress ${loading ? '' : 'is-idle'}`} aria-hidden={!loading}><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{modelCached ? 'Chargement du modèle depuis le cache local · aucun nouveau téléchargement' : `${progress ? `${progress}%` : 'Préparation'} · premier téléchargement du modèle`}</span></div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        <div className="offline-note"><span className="offline-icon">{online ? <Wifi size={16} /> : <WifiOff size={16} />}</span><div className="offline-note-copy"><strong>{modelReady ? 'Prêt pour le hors ligne' : modelCached ? 'Modèle déjà téléchargé' : 'Une première étape, ensuite libre'}</strong><p>{modelReady ? 'Les nouveaux textes sont calculés localement. Les 20 dernières traductions exactes sont enregistrées pour être réutilisées sans calcul.' : modelCached ? 'Le modèle reste dans le cache après fermeture. Il est rechargé depuis l’appareil, sans nouveau téléchargement. Les 20 dernières traductions peuvent être réutilisées sans calcul.' : 'Le modèle multilingue (~900 Mo) est téléchargé une seule fois. Les textes restent sur cet appareil.'}</p></div>{modelReady ? <span className="note-arrow"><Check size={17} /></span> : <button className="download-model-button" onClick={loadModel} disabled={loading} aria-busy={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : modelCached ? <Languages size={15} /> : <Download size={15} />}{loading ? 'Chargement…' : modelCached ? 'Charger hors ligne' : 'Télécharger'}{!modelCached && <span>(~900 Mo)</span>}</button>}</div>

        <footer className="page-footer"><span>FAIT POUR LES CONVERSATIONS SANS FRONTIÈRES</span><span className="footer-separator" /><span>TRADUCTION LOCALE · AUCUN TEXTE ENVOYÉ</span></footer>
      </section>
    </main>
  )
}

export default App