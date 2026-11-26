import { describe, expect, it } from 'vitest'
import { buildSafeImageFileName, sanitizeHttpUrl, validateImageFile } from './fileValidation'

function makeFile(bytes: number[], name: string, type: string): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('Validação binária de imagens e URLs', () => {
  it('aceita JPEG, PNG, GIF e WEBP reais pelos magic bytes', async () => {
    const jpeg = makeFile([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5, 6, 7], 'foto.jpg', 'image/jpeg')
    const png = makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], 'foto.png', 'image/png')
    const gif = makeFile([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0], 'ex.gif', 'image/gif')
    const webp = makeFile(
      [0x52, 0x49, 0x46, 0x46, 0x20, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20],
      'foto.webp',
      'image/webp',
    )

    expect(await validateImageFile(jpeg)).toEqual({ ok: true, mime: 'image/jpeg', ext: 'jpg' })
    expect(await validateImageFile(png)).toEqual({ ok: true, mime: 'image/png', ext: 'png' })
    expect(await validateImageFile(gif)).toEqual({ ok: true, mime: 'image/gif', ext: 'gif' })
    expect(await validateImageFile(webp)).toEqual({ ok: true, mime: 'image/webp', ext: 'webp' })
  })

  it('rejeita HTML/script disfarçado como .jpg e arquivos SVG com XSS', async () => {
    const htmlBytes = Array.from(new TextEncoder().encode('<html><script>alert(1)</script></html>'))
    const fakeJpg = makeFile(htmlBytes, 'falso.jpg', 'image/jpeg')
    const svgBytes = Array.from(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))
    const svgFile = makeFile(svgBytes, 'vetor.svg', 'image/svg+xml')
    const emptyFile = makeFile([], 'vazio.jpg', 'image/jpeg')

    const rFake = await validateImageFile(fakeJpg)
    expect(rFake.ok).toBe(false)

    const rSvg = await validateImageFile(svgFile)
    expect(rSvg.ok).toBe(false)

    const rEmpty = await validateImageFile(emptyFile)
    expect(rEmpty.ok).toBe(false)
  })

  it('rejeita arquivo acima do limite máximo', async () => {
    const huge = makeFile([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5, 6, 7], 'grande.jpg', 'image/jpeg')
    const res = await validateImageFile(huge, 4)
    expect(res.ok).toBe(false)
  })

  it('sanitiza nome e valida URLs permitindo apenas HTTPS ou localhost', () => {
    expect(buildSafeImageFileName('../../malicioso<script>.jpg', 'png')).toBe('malicioso-script.png')
    expect(sanitizeHttpUrl('https://cdn.exemplo.com/prato.jpg')).toBe('https://cdn.exemplo.com/prato.jpg')
    expect(sanitizeHttpUrl('http://127.0.0.1:4173/teste.png')).toBe('http://127.0.0.1:4173/teste.png')
    expect(sanitizeHttpUrl('http://exemplo.com/inseguro.png')).toBeNull()
    expect(sanitizeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
  })
})
