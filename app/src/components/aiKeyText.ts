import type { HaikuError } from '../core/haiku'

export const TEST_TEXT: Record<HaikuError | 'ok', string> = {
  ok: 'La clave funciona.',
  auth: 'Anthropic rechaza la clave. Comprueba que la has copiado entera.',
  rate: 'Has llegado al límite de uso o de gasto de la clave.',
  'bad-request': 'Anthropic no acepta la petición (modelo o parámetros). Hay que revisar la app.',
  network: 'No hay conexión con Anthropic. Inténtalo más tarde.',
  timeout: 'No hay conexión con Anthropic. Inténtalo más tarde.',
  http: 'Anthropic ha respondido algo inesperado.',
  refusal: 'Anthropic ha respondido algo inesperado.',
  invalid: 'Anthropic ha respondido algo inesperado.',
}
