import { useEffect, useRef, useState } from 'react'
import { ArrowDownUp, ArrowRight, Check, ChevronDown, Clipboard, Cloud, LoaderCircle, RefreshCw, Smartphone, X } from 'lucide-react'
import { nllbLanguages, type Language } from './languages'
import { translateOnline } from './onlineTranslator'
import { browserTranslationAvailable, translateInBrowser } from './browserTranslator'

type TranslationCache = Record<string, string>
type TranslationMode = 'online' | 'device'
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

function translationKey(text: string, source: string, target: string, mode: TranslationMode): string {
  return JSON.stringify([mode, source, target, text])
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
  const [mode, setMode] = useState<TranslationMode>('online')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translationReused, setTranslationReused] = useState(false)
  const [translationProgress, setTranslationProgress] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [isBrowserNative, setIsBrowserNative] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  
  const worker = useRef<Worker | null>(null)
  const pendingTranslation = useRef<{ text: string; source: string; target: string; key: string } | null>(null)

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    const nativeAvailable = browserTranslationAvailable()
    setIsBrowserNative(nativeAvailable)
    
    if (!nativeAvailable) {
      const instance = new Worker(new URL('./translator.worker.ts', import.meta.url), { type: 'module' })
      worker.current = instance
      instance.addEventListener('message', (event: MessageEvent<any>) => {
        const message = event.data
        if (message.type === 'progress') {
          const detail = message.progress
          if (detail?.status === 'progress' && typeof detail.progress === 'number') setTranslationProgress(`Téléchargement ${Math.round(detail.progress)}%`)
          if (detail?.status === 'downloading') setTranslationProgress('Téléchargement du modèle…')
          if (detail?.status === 'ready') setTranslationProgress('Préparation du modèle…')
        } else if (message.type === 'translation-progress') {
           setTranslationProgress(`Traduction ${Math.round((message.completed / message.total) * 100)}%`)
        } else if (message.type === 'ready') {
          setModelReady(true)
          setTranslationProgress('')
          if (pendingTranslation.current) {
            worker.current?.postMessage({ type: 'translate', ...pendingTranslation.current })
            setTranslating(true)
          }
        } else if (message.type === 'translated') {
          setOutput(message.text ?? '')
          setTranslating(false)
          setError('')
          if (pendingTranslation.current) {
            storeTranslation(pendingTranslation.current.key, message.text ?? '')
            pendingTranslation.current = null
          }
          setTranslationProgress('')
        } else if (message.type === 'error') {
          setError(message.message ?? 'Impossible de charger le modèle.')
          pendingTranslation.current = null
          setTranslating(false)
          setTranslationProgress('')
        }
      })
    } else {
      void caches.delete('transformers-cache')
      localStorage.removeItem('parlotte:nllb-model-cached:v1')
    }
    
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      worker.current?.terminate()
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  const translate = async (force = false) => {
    const text = input.trim()
    if (!text || translating) return
    if (mode === 'online' && !navigator.onLine) {
      setOnline(false)
      setError('Une connexion Internet est nécessaire pour le mode en ligne. Essayez Sur cet appareil si votre navigateur le prend en charge.')
      return
    }
    if (mode === 'device' && source === 'auto') {
      setError('Choisissez la langue source pour traduire sur cet appareil.')
      return
    }

    const key = translationKey(text, source, target, mode)
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

    setTranslationReused(false)
    setOutput('')
    setError('')
    
    if (mode === 'online') {
      setTranslating(true)
      try {
        const result = await translateOnline(text, source, target)
        setOutput(result)
        storeTranslation(key, result)
      } catch (translationError) {
        setError(translationError instanceof Error ? translationError.message : 'La traduction en ligne a échoué. Réessayez.')
      } finally {
        setTranslating(false)
        setTranslationProgress('')
      }
    } else {
      if (isBrowserNative) {
        setTranslating(true)
        try {
          const result = await translateInBrowser(text, source, target, (progress) => setTranslationProgress(`Pack de langue ${progress}%`))
          setOutput(result)
          storeTranslation(key, result)
        } catch (translationError) {
          setError(translationError instanceof Error ? translationError.message : 'La traduction a échoué. Réessayez.')
        } finally {
          setTranslating(false)
          setTranslationProgress('')
        }
      } else {
        // Fallback to Transformers.js worker
        pendingTranslation.current = { text, source, target, key }
        setTranslating(true)
        if (!modelReady) {
          worker.current?.postMessage({ type: 'load' })
        } else {
          worker.current?.postMessage({ type: 'translate', text, source, target })
        }
      }
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
          <span className="privacy-label"><span className="privacy-mark">✳</span>{mode === 'online' ? 'Texte envoyé au service' : 'Texte gardé sur l’appareil'}</span>
        </div>
      </header>

      <section className="workspace">
        <div className="intro">
          <div className="eyebrow"><span /> TRADUCTION SANS CONTRÔLE AUDIO</div>
          <h1>Les mots voyagent.<br /><em>En ligne ou ici.</em></h1>
          <p>{mode === 'online' ? 'Traduction en ligne, compatible avec tous les appareils.' : 'Traduction hors ligne sécurisée, effectuée sur votre appareil.'}</p>
        </div>

        <section className="translator" aria-label="Traducteur">
          <div className="mode-bar" role="group" aria-label="Mode de traduction">
            <button className={`mode-option ${mode === 'online' ? 'selected' : ''}`} onClick={() => { setMode('online'); setError(''); setTranslationReused(false) }} aria-pressed={mode === 'online'}><Cloud size={16} /> En ligne</button>
            <button className={`mode-option ${mode === 'device' ? 'selected' : ''}`} onClick={() => { setMode('device'); setError(''); setTranslationReused(false) }} aria-pressed={mode === 'device'}><Smartphone size={16} /> Sur cet appareil</button>
          </div>
          <div className="language-bar">
            <label className="language-select"><span>DE</span><select value={source} onChange={(event) => { setSource(event.target.value); setTranslationReused(false); setOutput('') }} aria-label="Langue source"><option value="auto">Détection automatique</option>{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={15} /></label>
            <button className="swap-button" onClick={swap} disabled={source === 'auto'} title="Inverser les langues" aria-label="Inverser les langues"><ArrowDownUp size={17} /></button>
            <label className="language-select target-select"><span>VERS</span><select value={target} onChange={(event) => { setTarget(event.target.value); setTranslationReused(false); setOutput('') }} aria-label="Langue cible">{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown size={15} /></label>
            <span className="language-count">{mode === 'online' ? <Cloud size={14} /> : <Smartphone size={14} />}{mode === 'online' ? 'En ligne' : isBrowserNative ? 'Moteur natif' : 'Modèle web'}</span>
          </div>

          <div className="translation-panes">
            <div className="pane input-pane">
              <textarea value={input} onChange={(event) => { setInput(event.target.value); setTranslationReused(false); setOutput('') }} maxLength={5000} placeholder="Écrivez ou collez votre texte ici…" aria-label="Texte à traduire" />
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
              <span>{translating ? translationProgress || (mode === 'online' ? 'Requête en ligne…' : 'Traduction sur cet appareil…') : translationReused ? 'Résultat réutilisé sans requête' : mode === 'online' ? online ? 'Service en ligne prêt' : 'Connexion Internet requise' : isBrowserNative ? 'Moteur géré par le navigateur' : modelReady ? 'Modèle web prêt' : 'Modèle web (téléchargement requis)'}</span>
            </div>
            <button className="translate-button" onClick={() => void translate()} disabled={!input.trim() || translating || (mode === 'online' && !online)}>
              {translating ? <><LoaderCircle className="spin" size={17} /> Traduction…</> : translationReused ? <><Check size={17} /> Réutilisée</> : <>Traduire <ArrowRight size={17} /></>}
            </button>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        <div className="offline-note"><span className="offline-icon">{mode === 'online' ? <Cloud size={16} /> : <Smartphone size={16} />}</span><div className="offline-note-copy"><strong>{mode === 'online' ? 'Mode compatible avec tous les appareils' : isBrowserNative ? 'Mode fourni par le navigateur' : 'Mode web complet'}</strong><p>{mode === 'online' ? 'Le texte est envoyé à MyMemory, qui indique pouvoir conserver les segments. Quota gratuit anonyme : 5 000 caractères par jour.' : isBrowserNative ? 'Le navigateur gère lui-même le pack de langue sans modèle lourd supplémentaire.' : 'Votre navigateur n\'intègre pas d\'API de traduction native. Un modèle multilingue lourd (~700 Mo) sera téléchargé la première fois pour fonctionner hors ligne sur ce navigateur.'}</p></div><span className="note-arrow">{mode === 'online' ? <Check size={17} /> : <Smartphone size={17} />}</span></div>

        <footer className="page-footer"><span>AUCUN ACCÈS À L’AUDIO</span><span className="footer-separator" /><span>{mode === 'online' ? 'COMPATIBLE WEB ET MOBILE' : 'MOTEUR LOCAL'}</span></footer>
      </section>
    </main>
  )
}

export default App

