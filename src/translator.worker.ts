import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true
env.backends.onnx.wasm!.numThreads = 1

const MODEL = 'Xenova/nllb-200-distilled-600M'
type TranslationOptions = { src_lang: string; tgt_lang: string; max_new_tokens: number; num_beams: number }
type Translator = ((text: string, options: TranslationOptions) => Promise<Array<{ translation_text: string }>>) & { dispose: () => Promise<void> }
type LoadOptions = { dtype: 'q8'; progress_callback: (progress: unknown) => void }
const loadPipeline = pipeline as unknown as (task: 'translation', model: string, options: LoadOptions) => Promise<Translator>
let translator: Translator | null = null
let loadPromise: Promise<Translator> | null = null
let operationQueue = Promise.resolve()
let idleUnloadTimer: ReturnType<typeof setTimeout> | undefined
const MAX_CHUNK_LENGTH = 420
const IDLE_UNLOAD_DELAY = 30_000

type WorkerRequest = { type: 'load' | 'unload' | 'translate'; text?: string; source?: string; target?: string }

function splitParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/gu) ?? [paragraph]
  const chunks: string[] = []
  let chunk = ''

  for (const sentence of sentences) {
    const words = sentence.match(/\S+\s*/gu) ?? [sentence]
    for (const word of words) {
      if (chunk.length && chunk.length + word.length > MAX_CHUNK_LENGTH) {
        chunks.push(chunk.trim())
        chunk = ''
      }
      chunk += word
    }
  }

  if (chunk.trim()) chunks.push(chunk.trim())
  return chunks
}

function splitText(text: string): string[][] {
  return text.split(/\n{2,}/u).map(splitParagraph).filter((paragraph) => paragraph.length > 0)
}

async function ensureTranslator(): Promise<Translator> {
  if (translator) return translator
  if (!loadPromise) {
    loadPromise = loadPipeline('translation', MODEL, {
      dtype: 'q8',
      progress_callback: (progress) => self.postMessage({ type: 'progress', progress }),
    }).then((loaded) => {
      translator = loaded
      return loaded
    }).finally(() => {
      loadPromise = null
    })
  }
  return loadPromise
}

async function unloadTranslator(): Promise<void> {
  clearTimeout(idleUnloadTimer)
  idleUnloadTimer = undefined
  if (loadPromise) await loadPromise
  if (translator) {
    await translator.dispose()
    translator = null
  }
  self.postMessage({ type: 'unloaded' })
}

function scheduleIdleUnload(): void {
  clearTimeout(idleUnloadTimer)
  idleUnloadTimer = setTimeout(() => {
    operationQueue = operationQueue.then(unloadTranslator).catch((error: unknown) => {
      self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Impossible de libérer la mémoire.' })
    })
  }, IDLE_UNLOAD_DELAY)
}

async function handleMessage(message: WorkerRequest): Promise<void> {
  try {
    if (message.type === 'load') {
      clearTimeout(idleUnloadTimer)
      translator = await ensureTranslator()
      self.postMessage({ type: 'ready' })
      return
    }

    if (message.type === 'unload') {
      await unloadTranslator()
      return
    }

    if (message.type === 'translate' && message.text && message.source && message.target) {
      clearTimeout(idleUnloadTimer)
      const loadedTranslator = await ensureTranslator()
      const paragraphChunks = splitText(message.text)
      const totalChunks = paragraphChunks.reduce((total, paragraph) => total + paragraph.length, 0)
      let completedChunks = 0
      const translatedParagraphs: string[] = []

      for (const chunks of paragraphChunks) {
        const translatedChunks: string[] = []
        for (const chunk of chunks) {
          const options: TranslationOptions = {
            src_lang: message.source,
            tgt_lang: message.target,
            max_new_tokens: Math.min(192, Math.max(48, Math.ceil(chunk.length * 0.8))),
            num_beams: 1,
          }
          const result = await loadedTranslator(chunk, options)
          translatedChunks.push(result[0]?.translation_text ?? '')
          completedChunks += 1
          self.postMessage({ type: 'translation-progress', completed: completedChunks, total: totalChunks })
        }
        translatedParagraphs.push(translatedChunks.join(' '))
      }

      self.postMessage({ type: 'translated', text: translatedParagraphs.join('\n\n') })
      scheduleIdleUnload()
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.' })
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  operationQueue = operationQueue.then(() => handleMessage(event.data)).catch((error: unknown) => {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.' })
  })
})