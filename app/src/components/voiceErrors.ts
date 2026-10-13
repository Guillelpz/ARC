import type { SpeechError } from '../speech'

export const offlineText = (what: string) => `Sin conexión: el reconocimiento de voz necesita internet. Escribe ${what}.`
export const noApiText = (what: string) => `Este navegador no puede reconocer la voz. Escribe ${what}.`

// Texto del error del reconocimiento (null = no hay que decir nada: lo paró el usuario). `what`: «la serie», «lo que has hecho».
export function speechErrorText(error: SpeechError, detail: string | undefined, what: string): string | null {
  switch (error) {
    case 'not-allowed': case 'service-not-allowed':
      return `No hay permiso para el micrófono o el reconocimiento de voz. Escribe ${what} o revisa los permisos (en el iPhone: Siri y Dictado activados).`
    case 'no-speech': case 'no-result': case 'timeout': return `No se ha oído nada. Vuelve a intentarlo o escribe ${what}.`
    case 'audio-capture': return 'No se encuentra el micrófono.'
    case 'network': return offlineText(what)
    case 'not-supported': return noApiText(what)
    case 'other': return `No se ha podido reconocer la voz (${detail ?? 'error desconocido'}).`
    case 'aborted': return null
  }
}
