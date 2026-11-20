export interface BrazilStateOption {
  uf: string
  name: string
}

export const BRAZIL_STATES: BrazilStateOption[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
]

export function splitCityState(raw?: string | null): { city: string; uf: string } {
  if (!raw) return { city: '', uf: 'SP' }
  const parts = raw.split(/[,-]/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidateUf = parts[parts.length - 1].toUpperCase()
    if (BRAZIL_STATES.some((s) => s.uf === candidateUf)) {
      return { city: parts.slice(0, -1).join(', '), uf: candidateUf }
    }
  }
  const justUf = raw.trim().toUpperCase()
  if (BRAZIL_STATES.some((s) => s.uf === justUf)) {
    return { city: '', uf: justUf }
  }
  return { city: raw.trim(), uf: 'SP' }
}

export function joinCityState(city: string, uf: string): string {
  const c = city.trim()
  const u = (uf || 'SP').trim().toUpperCase()
  return c ? `${c} - ${u}` : u
}
