/**
 * Equações de gasto energético e metas de macronutrientes.
 * Todas as funções são puras. Unidades: kg, cm, anos, kcal/dia.
 */
import type { Sex } from './types'

export type EnergyEquationId =
  | 'mifflin'
  | 'harris_benedict'
  | 'fao_who'
  | 'cunningham'
  | 'katch_mcardle'

export interface EnergyInput {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  /** massa livre de gordura (kg) — exigida por Cunningham/Katch-McArdle */
  leanMassKg?: number
}

export interface EnergyEquationMeta {
  id: EnergyEquationId
  label: string
  reference: string
  needsLeanMass: boolean
  note: string
}

export const ENERGY_EQUATIONS: EnergyEquationMeta[] = [
  {
    id: 'mifflin',
    label: 'Mifflin-St Jeor',
    reference: 'Mifflin MD et al. Am J Clin Nutr, 1990;51:241-247',
    needsLeanMass: false,
    note: 'Equação mais precisa para adultos saudáveis, inclusive com sobrepeso (ADA).',
  },
  {
    id: 'harris_benedict',
    label: 'Harris-Benedict (revisada)',
    reference: 'Roza AM, Shizgal HM. Am J Clin Nutr, 1984;40:168-182',
    needsLeanMass: false,
    note: 'Revisão de 1984 da equação original de 1919.',
  },
  {
    id: 'fao_who',
    label: 'FAO/OMS/UNU (Schofield)',
    reference: 'FAO/WHO/UNU. Energy and protein requirements, 1985 (Schofield)',
    needsLeanMass: false,
    note: 'Equações por faixa etária e sexo, baseadas apenas no peso.',
  },
  {
    id: 'cunningham',
    label: 'Cunningham',
    reference: 'Cunningham JJ. Am J Clin Nutr, 1980;33:2372-2374',
    needsLeanMass: true,
    note: 'Recomendada para atletas e indivíduos com alta massa magra.',
  },
  {
    id: 'katch_mcardle',
    label: 'Katch-McArdle',
    reference: 'McArdle WD, Katch FI, Katch VL. Exercise Physiology, 2010',
    needsLeanMass: true,
    note: 'Baseada na massa livre de gordura; requer composição corporal.',
  },
]

export function bmrMifflin({ sex, weightKg, heightCm, age }: EnergyInput): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function bmrHarrisBenedict({ sex, weightKg, heightCm, age }: EnergyInput): number {
  return sex === 'male'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age
}

/** Schofield (FAO/WHO/UNU, 1985) — equações baseadas no peso, por faixa etária. */
export function bmrFaoWho({ sex, weightKg, age }: EnergyInput): number {
  if (sex === 'male') {
    if (age < 18) return 17.686 * weightKg + 658.2
    if (age < 30) return 15.057 * weightKg + 692.2
    if (age < 60) return 11.472 * weightKg + 873.1
    return 11.711 * weightKg + 587.7
  }
  if (age < 18) return 13.384 * weightKg + 692.6
  if (age < 30) return 14.818 * weightKg + 486.6
  if (age < 60) return 8.126 * weightKg + 845.6
  return 9.082 * weightKg + 658.5
}

export function bmrCunningham({ leanMassKg }: EnergyInput): number {
  if (leanMassKg == null) throw new Error('Cunningham exige massa livre de gordura')
  return 500 + 22 * leanMassKg
}

export function bmrKatchMcArdle({ leanMassKg }: EnergyInput): number {
  if (leanMassKg == null) throw new Error('Katch-McArdle exige massa livre de gordura')
  return 370 + 21.6 * leanMassKg
}

export function computeBmr(id: EnergyEquationId, input: EnergyInput): number {
  switch (id) {
    case 'mifflin':
      return bmrMifflin(input)
    case 'harris_benedict':
      return bmrHarrisBenedict(input)
    case 'fao_who':
      return bmrFaoWho(input)
    case 'cunningham':
      return bmrCunningham(input)
    case 'katch_mcardle':
      return bmrKatchMcArdle(input)
  }
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

/** Fatores de atividade física clássicos (Harris-Benedict / McArdle). */
export const ACTIVITY_FACTORS: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentário', hint: 'Pouco ou nenhum exercício' },
  light: { factor: 1.375, label: 'Levemente ativo', hint: 'Exercício leve 1–3 dias/semana' },
  moderate: { factor: 1.55, label: 'Moderadamente ativo', hint: 'Exercício moderado 3–5 dias/semana' },
  active: { factor: 1.725, label: 'Muito ativo', hint: 'Exercício intenso 6–7 dias/semana' },
  very_active: { factor: 1.9, label: 'Extremamente ativo', hint: 'Treino pesado diário ou trabalho físico' },
}

export const tdee = (bmr: number, factor: number) => bmr * factor

export interface MacroTargets {
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
}

/**
 * Distribuição de macros: proteína em g/kg (ISSN, Jäger et al. 2017: 1,4–2,0 g/kg para
 * praticantes de exercício), gordura em % das calorias (mín. 20% — DRI/IOM) e o restante em carboidratos.
 */
export function suggestMacros(params: {
  kcal: number
  weightKg: number
  proteinPerKg: number
  fatPct: number
}): MacroTargets {
  const { kcal, weightKg, proteinPerKg, fatPct } = params
  const proteinG = Math.round(weightKg * proteinPerKg)
  const fatG = Math.round((kcal * fatPct) / 100 / 9)
  const carbKcal = Math.max(kcal - proteinG * 4 - fatG * 9, 0)
  return { kcal: Math.round(kcal), proteinG, fatG, carbG: Math.round(carbKcal / 4) }
}

/** Ajuste calórico por objetivo (% sobre o GET). Negativo = déficit. */
export const applyCalorieAdjustment = (tdeeKcal: number, pct: number) => tdeeKcal * (1 + pct / 100)

/** Meta hídrica usual: 35 mL/kg/dia (limites 30–40 mL/kg). */
export const waterGoalMl = (weightKg: number, mlPerKg = 35) => Math.round((weightKg * mlPerKg) / 50) * 50

/** Energia por macronutriente (fatores de Atwater: 4-4-9). */
export const kcalFromMacros = (p: number, c: number, g: number) => Math.round(p * 4 + c * 4 + g * 9)
