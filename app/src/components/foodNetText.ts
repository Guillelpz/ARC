export type NetKind = 'off' | 'label'
export const NET_PRIVACY: Record<NetKind, { title: string; text: string }> = {
  off: { title: 'Privacidad del código de barras', text: 'Para buscar el producto, la app envía el código de barras a Open Food Facts (con tu IP, como cualquier web). No se envía nada más. Los datos de Open Food Facts tienen licencia ODbL.' },
  label: { title: 'Privacidad de la foto', text: 'Para leer la etiqueta, la app envía la foto, reducida y sin datos de ubicación, a Anthropic con tu clave. Haz la foto solo de la tabla nutricional. No se envía nada más.' },
}
