import { env, pipeline } from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

const MODEL = 'Xenova/nllb-200-distilled-600M'
type TranslationOptions = { src_lang: string; tgt_lang: string; max_new_tokens: number }
type Translator = ((text: string, options: TranslationOptions) => Promise<Array<{ translation_text: string }>>) & { dispose: () => Promise<void> }
type LoadOptions = { dtype: 'q8'; progress_callback: (progress: unknown) => void }
const loadPipeline = pipeline as unknown as (task: 'translation', model: string, options: LoadOptions) => Promise<Translator>
let translator: Translator | null = null

self.addEventListener('message', async (event: MessageEvent) => {
  const message = event.data as { type: string; text?: string; source?: string; target?: string }

  try {
    if (message.type === 'load') {
      if (!translator) {
        translator = await loadPipeline('translation', MODEL, {
          dtype: 'q8',
          progress_callback: (progress) => self.postMessage({ type: 'progress', progress }),
        })
      }
      self.postMessage({ type: 'ready' })
      return
    }

    if (message.type === 'translate' && message.text && message.source && message.target) {
      if (!translator) throw new Error('Le modèle n’est pas encore chargé.')
      const options: TranslationOptions = {
        src_lang: message.source,
        tgt_lang: message.target,
        max_new_tokens: 512,
      }
      const result = await translator(message.text, options)
      const translated = result[0]?.translation_text
      self.postMessage({ type: 'translated', text: translated ?? '' })
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.' })
  }
})