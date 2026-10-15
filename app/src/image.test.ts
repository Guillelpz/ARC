// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { downscale } from './image'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('downscale', () => {
  test('reduce a 1568 px de lado largo y devuelve base64 sin prefijo', async () => {
    const close = vi.fn(), draw = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 3136, height: 1568, close })))
    const canvases: HTMLCanvasElement[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { canvases.push(this); return { drawImage: draw } as unknown as CanvasRenderingContext2D } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback, type?: string, q?: unknown) => { expect(type).toBe('image/jpeg'); expect(q).toBe(0.85); cb(new Blob(['abc'], { type: 'image/jpeg' })) })
    const r = await downscale(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))
    expect(r).toEqual({ data: 'YWJj', mediaType: 'image/jpeg' })
    expect([canvases[0].width, canvases[0].height]).toEqual([1568, 784])
    expect(close).toHaveBeenCalled()
  })
  test('no amplia las pequeñas', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 400, height: 300, close: () => {} })))
    const made: HTMLCanvasElement[] = []
    const real = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((t: string) => { const e = real(t); if (t === 'canvas') made.push(e as HTMLCanvasElement); return e }) as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({ drawImage: () => {} })) as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb: BlobCallback) => cb(new Blob(['a'])))
    await downscale(new File(['x'], 'a.jpg'))
    expect([made[0].width, made[0].height]).toEqual([400, 300])
  })
  test('fallo de decodificación → null', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('heic') }))
    vi.stubGlobal('Image', class { onerror: (() => void) | null = null; set src(_: string) { setTimeout(() => this.onerror?.(), 0) } })
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    expect(await downscale(new File(['x'], 'a.heic'))).toBeNull()
  })
})
