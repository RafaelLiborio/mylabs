/**
 * Validação real de arquivos de imagem por assinatura binária (magic bytes) e sanitização de URLs.
 * Impede upload de scripts, HTML, SVGs maliciosos ou arquivos falsificados renomeados para .jpg/.png.
 */

export type ImageValidationResult =
  | { ok: true; mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; ext: 'jpg' | 'png' | 'gif' | 'webp' }
  | { ok: false; error: string }

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024

function detectImageTypeFromBytes(bytes: Uint8Array): {
  mime: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  ext: 'jpg' | 'png' | 'gif' | 'webp'
} | null {
  if (bytes.length < 12) return null

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' }
  }

  // GIF: "GIF87a" or "GIF89a"
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return { mime: 'image/gif', ext: 'gif' }
  }

  // WEBP: "RIFF" (0..3) + "WEBP" (8..11)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }

  return null
}

/**
 * Valida tamanho e assinatura binária de uma imagem. Rejeita SVG, HTML, scripts e arquivos disfarçados.
 */
export async function validateImageFile(
  file: File,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<ImageValidationResult> {
  if (!file || file.size <= 0) {
    return { ok: false, error: 'O arquivo selecionado está vazio.' }
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024))
    return { ok: false, error: `Arquivo muito grande. O limite máximo é ${mb} MB.` }
  }

  const lowerName = (file.name || '').toLowerCase()
  const lowerType = (file.type || '').toLowerCase()
  if (lowerName.endsWith('.svg') || lowerType.includes('svg')) {
    return {
      ok: false,
      error: 'Arquivos SVG não são permitidos por segurança. Envie apenas JPG, PNG, WEBP ou GIF.',
    }
  }

  try {
    const buffer = await file.slice(0, 16).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const detected = detectImageTypeFromBytes(bytes)
    if (!detected) {
      return {
        ok: false,
        error:
          'Arquivo inválido ou disfarçado. Envie uma imagem real nos formatos JPG, PNG, WEBP ou GIF.',
      }
    }
    return { ok: true, mime: detected.mime, ext: detected.ext }
  } catch {
    return { ok: false, error: 'Não foi possível ler o arquivo selecionado.' }
  }
}

/**
 * Sanitiza um nome de arquivo preservando base segura e aplicando a extensão real verificada.
 */
export function buildSafeImageFileName(originalName: string, verifiedExt: string): string {
  const base = (originalName || 'imagem')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${base || 'imagem'}.${verifiedExt}`
}

/**
 * Valida URLs externas permitindo apenas HTTPS (ou HTTP em localhost/127.0.0.1 para desenvolvimento).
 * Bloqueia javascript:, data:, vbscript:, file: e formatos inválidos.
 */
export function sanitizeHttpUrl(raw: string): string | null {
  const trimmed = (raw || '').trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:') {
      return parsed.toString()
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}
