// Detector de códigos de barras (T15, T16). Fuera de core/: usa DOM y cámara.
// La API nativa si existe y soporta ean_13; si no, el ponyfill de barcode-detector, cargado con un único import() dinámico
// (el chunk y el wasm solo se piden al abrir el escáner). El wasm sale del propio build (?url), nunca de una CDN.
export type Detector = { detect(v: HTMLVideoElement): Promise<string[]> }

const FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const

type NativeCtor = { new (o: { formats: string[] }): { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> }

export async function makeDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: NativeCtor }).BarcodeDetector
  let Ctor: NativeCtor | undefined
  if (Native) {
    try { if ((await Native.getSupportedFormats?.())?.includes('ean_13')) Ctor = Native } catch { /* ponytail: si la nativa falla al consultar, se usa el ponyfill */ }
  }
  if (!Ctor) {
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url'),
    ])
    await prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => path.endsWith('.wasm') ? wasmUrl : prefix + path },
      fireImmediately: true,
    })
    Ctor = BarcodeDetector as unknown as NativeCtor
  }
  const d = new Ctor({ formats: [...FORMATS] })
  return { detect: async v => (await d.detect(v)).map(b => b.rawValue) }
}

export const hasCamera = () => !!navigator.mediaDevices?.getUserMedia
