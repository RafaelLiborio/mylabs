import { describe, expect, it } from 'vitest'
import {
  CONSENT_LABELS,
  LEGAL_DOCUMENTS,
  LEGAL_VERSIONS,
  requiredConsentsForRole,
} from './legal'

describe('documentos legais', () => {
  it('exige consentimentos específicos por perfil', () => {
    expect(requiredConsentsForRole('client')).toEqual(['terms', 'privacy', 'health_data'])
    expect(requiredConsentsForRole('nutritionist')).toEqual(['terms', 'privacy', 'professional_duties'])
    expect(requiredConsentsForRole('admin')).toEqual(['terms', 'privacy'])
    expect(requiredConsentsForRole(undefined)).toEqual(['terms', 'privacy'])
  })

  it('todo consentimento exigido tem versão e texto', () => {
    for (const role of ['client', 'nutritionist', 'admin']) {
      for (const doc of requiredConsentsForRole(role)) {
        expect(LEGAL_VERSIONS[doc]).toBeTruthy()
        expect(CONSENT_LABELS[doc].text.length).toBeGreaterThan(20)
      }
    }
  })

  it('seções têm ids únicos e conteúdo (âncoras do sumário)', () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      const ids = doc.sections.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const s of doc.sections) expect(s.blocks.length).toBeGreaterThan(0)
    }
  })

  it('a política de privacidade cobre os pontos obrigatórios da LGPD', () => {
    const text = JSON.stringify(LEGAL_DOCUMENTS.privacy).toLowerCase()
    for (const needle of ['art. 11', 'art. 18', 'art. 33', 'art. 48', 'encarregado', 'anpd', 'controlador', 'operador']) {
      expect(text).toContain(needle)
    }
  })

  it('a política de reembolso cobre o art. 49 do CDC e prazo de 7 dias', () => {
    const text = JSON.stringify(LEGAL_DOCUMENTS.refund).toLowerCase()
    expect(text).toContain('art. 49')
    expect(text).toContain('7 dias')
  })

  it('nenhum documento legal contém travessões (—)', () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      expect(JSON.stringify(doc)).not.toContain('—')
    }
  })
})
