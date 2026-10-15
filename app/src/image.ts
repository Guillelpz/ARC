export const MAX_SIDE = 1568
export const JPEG_QUALITY = 0.85

type Source = { img: CanvasImageSource; w: number; h: number; close: () => void }

async function open(file: File): Promise<Source> {
  try {
    const b = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { img: b, w: b.width, h: b.height, close: () => b.close() }
  } catch {
    // ponytail: HEIC en navegadores que no lo decodifican acaba en null (error `image`); no se convierte.
    const url = URL.createObjectURL(file)
    try {
      const el = new Image()
      await new Promise<void>((res, rej) => { el.onload = () => res(); el.onerror = () => rej(new Error('image')); el.src = url })
      return { img: el, w: el.naturalWidth, h: el.naturalHeight, close: () => URL.revokeObjectURL(url) }
    } catch (e) { URL.revokeObjectURL(url); throw e }
  }
}

// Reduce la foto a ≤ 1568 px de lado largo (sin ampliar) y la reexporta como JPEG: al redibujar en canvas se pierde el EXIF (ubicación incluida).
// Devuelve el base64 sin prefijo; cualquier fallo → null.
export async function downscale(file: File): Promise<{ data: string; mediaType: 'image/jpeg' } | null> {
  let src: Source | null = null
  try {
    src = await open(file)
    if (!(src.w > 0 && src.h > 0)) return null
    const k = Math.min(1, MAX_SIDE / Math.max(src.w, src.h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(src.w * k)); canvas.height = Math.max(1, Math.round(src.h * k))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(src.img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return null
    const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob) })
    const data = url.slice(url.indexOf(',') + 1)
    return data ? { data, mediaType: 'image/jpeg' } : null
  } catch { return null } finally { src?.close() }
}
