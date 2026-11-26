/**
 * Protocolos científicos de antropometria e composição corporal.
 * Referências:
 * - Jackson AS, Pollock ML. Br J Nutr 1978;40:497-504 (homens, 3 e 7 dobras)
 * - Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc 1980;12:175-181 (mulheres, 3 e 7 dobras)
 * - Durnin JVGA, Womersley J. Br J Nutr 1974;32:77-97 (4 dobras por faixa etária)
 * - Faulkner JA. Physiology of Swimming and Diving, 1968 (4 dobras)
 * - Siri WE. Body composition from fluid spaces and density, 1961 (%G = (495 / D) - 450)
 * - Hodgdon JA, Beckett MB. Naval Health Research Center, 1984 (US Navy)
 * - OMS (1995/2000): IMC e Relação Cintura-Quadril (RCQ)
 * - Ashwell M, Hsieh SD. Int J Food Sci Nutr 2005;56:303-307 (Relação Cintura-Estatura)
 * - Schutz Y, Kyle UUG, Pichard C. Int J Obes 2002;26:953-960 (FFMI)
 */
import type { Sex } from './types'

export type AnthropometryProtocolId =
  | 'jackson_pollock_3'
  | 'jackson_pollock_7'
  | 'durnin_womersley_4'
  | 'faulkner_4'
  | 'us_navy'
  | 'bioimpedance'

export type SkinfoldKey =
  | 'chest'
  | 'midaxillary'
  | 'triceps'
  | 'subscapular'
  | 'abdomen'
  | 'suprailiac'
  | 'thigh'
  | 'biceps'

export type CircumferenceKey =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'abdomen'
  | 'hip'
  | 'armRight'
  | 'armLeft'
  | 'forearmRight'
  | 'thighRight'
  | 'thighLeft'
  | 'calfRight'

export type SkinfoldsMap = Partial<Record<SkinfoldKey, number>>
export type CircumferencesMap = Partial<Record<CircumferenceKey, number>>

export interface SkinfoldFieldMeta {
  key: SkinfoldKey
  label: string
  anatomicalHint: string
  region: 'trunk' | 'upper_limb' | 'lower_limb'
  min: number
  max: number
  defaultVal: number
}

export interface CircumferenceFieldMeta {
  key: CircumferenceKey
  label: string
  anatomicalHint: string
  region: 'trunk' | 'upper_limb' | 'lower_limb'
  min: number
  max: number
  defaultVal: number
  betterDown?: boolean
}

export const SKINFOLD_FIELDS: SkinfoldFieldMeta[] = [
  { key: 'chest', label: 'Peitoral', anatomicalHint: 'Diagonal entre a linha axilar anterior e o mamilo', region: 'trunk', min: 2, max: 60, defaultVal: 10 },
  { key: 'midaxillary', label: 'Axilar Média', anatomicalHint: 'Linha axilar média no nível do apêndice xifoide', region: 'trunk', min: 2, max: 60, defaultVal: 11 },
  { key: 'triceps', label: 'Tricipital', anatomicalHint: 'Face posterior do braço, ponto médio acrômio-olécrano', region: 'upper_limb', min: 2, max: 60, defaultVal: 12 },
  { key: 'biceps', label: 'Bicipital', anatomicalHint: 'Face anterior do braço sobre o ventre do bíceps', region: 'upper_limb', min: 2, max: 60, defaultVal: 7 },
  { key: 'subscapular', label: 'Subescapular', anatomicalHint: '2 cm abaixo do ângulo inferior da escápula (45°)', region: 'trunk', min: 2, max: 60, defaultVal: 14 },
  { key: 'abdomen', label: 'Abdominal', anatomicalHint: 'Vertical, 2 cm à direita da cicatriz umbilical', region: 'trunk', min: 2, max: 70, defaultVal: 18 },
  { key: 'suprailiac', label: 'Supra-ilíaca', anatomicalHint: 'Diagonal acima da crista ilíaca na linha axilar anterior', region: 'trunk', min: 2, max: 70, defaultVal: 15 },
  { key: 'thigh', label: 'Coxa Medial', anatomicalHint: 'Ponto médio entre a prega inguinal e a borda superior da patela', region: 'lower_limb', min: 2, max: 70, defaultVal: 16 },
]

export const CIRCUMFERENCE_FIELDS: CircumferenceFieldMeta[] = [
  { key: 'neck', label: 'Pescoço', anatomicalHint: 'Logo abaixo da proeminência laríngea', region: 'trunk', min: 25, max: 60, defaultVal: 38, betterDown: true },
  { key: 'shoulders', label: 'Ombros', anatomicalHint: 'Maior perímetro sobre os deltoides', region: 'trunk', min: 75, max: 160, defaultVal: 114, betterDown: false },
  { key: 'chest', label: 'Tórax', anatomicalHint: 'Ao nível do quarto espaço intercostal / mamilos', region: 'trunk', min: 65, max: 150, defaultVal: 98, betterDown: false },
  { key: 'waist', label: 'Cintura', anatomicalHint: 'Menor perímetro entre a última costela e a crista ilíaca', region: 'trunk', min: 50, max: 160, defaultVal: 82, betterDown: true },
  { key: 'abdomen', label: 'Abdômen', anatomicalHint: 'Ao nível da cicatriz umbilical', region: 'trunk', min: 55, max: 170, defaultVal: 85, betterDown: true },
  { key: 'hip', label: 'Quadril', anatomicalHint: 'Maior proeminência glútea posterior', region: 'lower_limb', min: 70, max: 170, defaultVal: 99, betterDown: true },
  { key: 'armRight', label: 'Braço Direito', anatomicalHint: 'Ponto médio do braço relaxado / contraído', region: 'upper_limb', min: 18, max: 60, defaultVal: 35, betterDown: false },
  { key: 'armLeft', label: 'Braço Esquerdo', anatomicalHint: 'Ponto médio do braço esquerdo', region: 'upper_limb', min: 18, max: 60, defaultVal: 34.8, betterDown: false },
  { key: 'forearmRight', label: 'Antebraço Direito', anatomicalHint: 'Maior perímetro proximal do antebraço', region: 'upper_limb', min: 16, max: 45, defaultVal: 28, betterDown: false },
  { key: 'thighRight', label: 'Coxa Medial Dir.', anatomicalHint: 'Ponto médio entre prega inguinal e patela', region: 'lower_limb', min: 35, max: 90, defaultVal: 57, betterDown: false },
  { key: 'thighLeft', label: 'Coxa Medial Esq.', anatomicalHint: 'Ponto médio da coxa esquerda', region: 'lower_limb', min: 35, max: 90, defaultVal: 56.8, betterDown: false },
  { key: 'calfRight', label: 'Panturrilha Dir.', anatomicalHint: 'Maior perímetro da perna', region: 'lower_limb', min: 24, max: 60, defaultVal: 38, betterDown: false },
]

export interface ProtocolMeta {
  id: AnthropometryProtocolId
  label: string
  reference: string
  description: string
  requiredSkinfolds: (sex: Sex) => SkinfoldKey[]
  requiredCircumferences: (sex: Sex) => CircumferenceKey[]
}

export const ANTHROPOMETRY_PROTOCOLS: ProtocolMeta[] = [
  {
    id: 'jackson_pollock_3',
    label: 'Jackson & Pollock (3 Dobras)',
    reference: 'Jackson & Pollock (1978) / Jackson, Pollock & Ward (1980) + Siri (1961)',
    description: 'Rápido e validado clinicamente. Homens: Peitoral, Abdominal e Coxa. Mulheres: Tricipital, Supra-ilíaca e Coxa.',
    requiredSkinfolds: (sex) => (sex === 'male' ? ['chest', 'abdomen', 'thigh'] : ['triceps', 'suprailiac', 'thigh']),
    requiredCircumferences: () => ['waist', 'hip', 'armRight', 'thighRight'],
  },
  {
    id: 'jackson_pollock_7',
    label: 'Jackson & Pollock (7 Dobras)',
    reference: 'Jackson & Pollock (1978, Br J Nutr) + Siri (1961)',
    description: 'Padrão-ouro em avaliação esportiva e clínica para mapeamento completo de gordura subcutânea.',
    requiredSkinfolds: () => ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh'],
    requiredCircumferences: () => ['waist', 'hip', 'armRight', 'thighRight'],
  },
  {
    id: 'durnin_womersley_4',
    label: 'Durnin & Womersley (4 Dobras)',
    reference: 'Durnin & Womersley (1974, Br J Nutr) + Siri (1961)',
    description: 'Indicado para população geral e clínica (Bicipital, Tricipital, Subescapular e Supra-ilíaca).',
    requiredSkinfolds: () => ['biceps', 'triceps', 'subscapular', 'suprailiac'],
    requiredCircumferences: () => ['waist', 'hip', 'armRight', 'thighRight'],
  },
  {
    id: 'faulkner_4',
    label: 'Faulkner (4 Dobras)',
    reference: 'Faulkner JA (1968)',
    description: 'Clássico em avaliação física no Brasil (Tricipital, Subescapular, Supra-ilíaca e Abdominal).',
    requiredSkinfolds: () => ['triceps', 'subscapular', 'suprailiac', 'abdomen'],
    requiredCircumferences: () => ['waist', 'hip', 'armRight', 'thighRight'],
  },
  {
    id: 'us_navy',
    label: 'Marinha dos EUA (Sem Adipômetro)',
    reference: 'Hodgdon & Beckett (1984, US Navy)',
    description: 'Estima % de gordura apenas com fita métrica (Pescoço, Cintura e Quadril). Ideal para avaliação remota.',
    requiredSkinfolds: () => [],
    requiredCircumferences: (sex) => (sex === 'male' ? ['neck', 'waist', 'hip', 'armRight'] : ['neck', 'waist', 'hip', 'armRight']),
  },
  {
    id: 'bioimpedance',
    label: 'Bioimpedância / Direto',
    reference: 'InBody / Tanita / Omron Octapolar',
    description: 'Informe diretamente o % de gordura da balança de bioimpedância junto com as circunferências.',
    requiredSkinfolds: () => [],
    requiredCircumferences: () => ['waist', 'hip', 'armRight', 'thighRight'],
  },
]

/** Equação de Siri (1961): %G = (495 / Densidade) - 450 */
export function siriBodyFatFromDensity(density: number): number {
  if (density <= 0) return 0
  const bf = 495 / density - 450
  return Math.max(2, Math.min(65, +bf.toFixed(1)))
}

/** Jackson & Pollock 3 Dobras (1978/1980) */
export function calcJacksonPollock3(sex: Sex, age: number, skinfolds: SkinfoldsMap): { density: number; bodyFatPct: number; sumMm: number } {
  const keys: SkinfoldKey[] = sex === 'male' ? ['chest', 'abdomen', 'thigh'] : ['triceps', 'suprailiac', 'thigh']
  const s = keys.reduce((acc, k) => acc + (Number(skinfolds[k]) || 0), 0)
  const density =
    sex === 'male'
      ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * age
      : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * age
  return { density: +density.toFixed(4), bodyFatPct: siriBodyFatFromDensity(density), sumMm: +s.toFixed(1) }
}

/** Jackson & Pollock 7 Dobras (1978/1980) */
export function calcJacksonPollock7(sex: Sex, age: number, skinfolds: SkinfoldsMap): { density: number; bodyFatPct: number; sumMm: number } {
  const keys: SkinfoldKey[] = ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdomen', 'suprailiac', 'thigh']
  const s = keys.reduce((acc, k) => acc + (Number(skinfolds[k]) || 0), 0)
  const density =
    sex === 'male'
      ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * age
      : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * age
  return { density: +density.toFixed(4), bodyFatPct: siriBodyFatFromDensity(density), sumMm: +s.toFixed(1) }
}

/** Durnin & Womersley 4 Dobras (1974) */
export function calcDurninWomersley4(sex: Sex, age: number, skinfolds: SkinfoldsMap): { density: number; bodyFatPct: number; sumMm: number } {
  const keys: SkinfoldKey[] = ['biceps', 'triceps', 'subscapular', 'suprailiac']
  const s = Math.max(4, keys.reduce((acc, k) => acc + (Number(skinfolds[k]) || 0), 0))
  const logS = Math.log10(s)
  let c = 1.1631
  let m = 0.0632
  if (sex === 'male') {
    if (age < 20) { c = 1.162; m = 0.063 }
    else if (age < 30) { c = 1.1631; m = 0.0632 }
    else if (age < 40) { c = 1.1422; m = 0.0544 }
    else if (age < 50) { c = 1.162; m = 0.07 }
    else { c = 1.1715; m = 0.0779 }
  } else {
    if (age < 20) { c = 1.1549; m = 0.0678 }
    else if (age < 30) { c = 1.1599; m = 0.0717 }
    else if (age < 40) { c = 1.1423; m = 0.0632 }
    else if (age < 50) { c = 1.1333; m = 0.0612 }
    else { c = 1.1339; m = 0.0645 }
  }
  const density = c - m * logS
  return { density: +density.toFixed(4), bodyFatPct: siriBodyFatFromDensity(density), sumMm: +s.toFixed(1) }
}

/** Faulkner 4 Dobras (1968): %G = (soma4 * 0.153) + 5.783 */
export function calcFaulkner4(skinfolds: SkinfoldsMap): { bodyFatPct: number; sumMm: number } {
  const keys: SkinfoldKey[] = ['triceps', 'subscapular', 'suprailiac', 'abdomen']
  const s = keys.reduce((acc, k) => acc + (Number(skinfolds[k]) || 0), 0)
  const bf = Math.max(3, Math.min(60, +(s * 0.153 + 5.783).toFixed(1)))
  return { bodyFatPct: bf, sumMm: +s.toFixed(1) }
}

/** US Navy (Hodgdon & Beckett, 1984) */
export function calcUsNavy(sex: Sex, heightCm: number, circumferences: CircumferencesMap): { bodyFatPct: number } {
  const neck = Number(circumferences.neck) || 38
  const waist = Number(circumferences.waist) || 82
  const hip = Number(circumferences.hip) || 98
  const h = Math.max(100, heightCm)
  let bf: number
  if (sex === 'male') {
    const diff = Math.max(10, waist - neck)
    bf = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(h)) - 450
  } else {
    const sum = Math.max(20, waist + hip - neck)
    bf = 495 / (1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(h)) - 450
  }
  return { bodyFatPct: Math.max(3, Math.min(60, +bf.toFixed(1))) }
}

export interface AnthropometryResults {
  bmi: number
  bmiCategory: string
  bodyFatPct: number
  bodyFatCategory: string
  fatMassKg: number
  leanMassKg: number
  ffmi: number
  whr: number | null
  whrRisk: string
  whtr: number | null
  sumSkinfoldsMm: number
  bodyDensity?: number
}

export function classifyBmi(bmi: number): string {
  if (bmi < 18.5) return 'Baixo peso'
  if (bmi < 25) return 'Eutrofia (Normal)'
  if (bmi < 30) return 'Sobrepeso'
  if (bmi < 35) return 'Obesidade Grau I'
  if (bmi < 40) return 'Obesidade Grau II'
  return 'Obesidade Grau III'
}

export function classifyBodyFat(sex: Sex, bf: number): string {
  if (sex === 'male') {
    if (bf < 6) return 'Essencial'
    if (bf <= 13) return 'Atleta'
    if (bf <= 17) return 'Fitness / Ótimo'
    if (bf <= 24) return 'Aceitável'
    return 'Acima do recomendado'
  }
  if (bf < 14) return 'Essencial'
  if (bf <= 20) return 'Atleta'
  if (bf <= 24) return 'Fitness / Ótimo'
  if (bf <= 31) return 'Aceitável'
  return 'Acima do recomendado'
}

export function classifyWhr(sex: Sex, whr: number | null): string {
  if (whr == null) return '-'
  if (sex === 'male') {
    if (whr < 0.9) return 'Baixo risco'
    if (whr < 1.0) return 'Risco moderado'
    return 'Alto risco cardiometabólico'
  }
  if (whr < 0.8) return 'Baixo risco'
  if (whr < 0.85) return 'Risco moderado'
  return 'Alto risco cardiometabólico'
}

export function computeAnthropometry(params: {
  protocol: AnthropometryProtocolId
  sex: Sex
  age: number
  weightKg: number
  heightCm: number
  skinfolds: SkinfoldsMap
  circumferences: CircumferencesMap
  directBodyFatPct?: number
}): AnthropometryResults {
  const { protocol, sex, age, weightKg, heightCm, skinfolds, circumferences, directBodyFatPct } = params
  const hM = Math.max(0.5, heightCm / 100)
  const bmi = +(weightKg / (hM * hM)).toFixed(1)

  let bodyFatPct = 18
  let sumSkinfoldsMm = 0
  let bodyDensity: number | undefined

  if (protocol === 'jackson_pollock_3') {
    const r = calcJacksonPollock3(sex, age, skinfolds)
    bodyFatPct = r.bodyFatPct
    sumSkinfoldsMm = r.sumMm
    bodyDensity = r.density
  } else if (protocol === 'jackson_pollock_7') {
    const r = calcJacksonPollock7(sex, age, skinfolds)
    bodyFatPct = r.bodyFatPct
    sumSkinfoldsMm = r.sumMm
    bodyDensity = r.density
  } else if (protocol === 'durnin_womersley_4') {
    const r = calcDurninWomersley4(sex, age, skinfolds)
    bodyFatPct = r.bodyFatPct
    sumSkinfoldsMm = r.sumMm
    bodyDensity = r.density
  } else if (protocol === 'faulkner_4') {
    const r = calcFaulkner4(skinfolds)
    bodyFatPct = r.bodyFatPct
    sumSkinfoldsMm = r.sumMm
  } else if (protocol === 'us_navy') {
    bodyFatPct = calcUsNavy(sex, heightCm, circumferences).bodyFatPct
  } else {
    bodyFatPct = Math.max(3, Math.min(65, Number(directBodyFatPct) || 18))
  }

  const fatMassKg = +((weightKg * bodyFatPct) / 100).toFixed(1)
  const leanMassKg = +(weightKg - fatMassKg).toFixed(1)
  const ffmi = +(leanMassKg / (hM * hM)).toFixed(1)

  const waist = Number(circumferences.waist) || 0
  const hip = Number(circumferences.hip) || 0
  const whr = waist > 0 && hip > 0 ? +(waist / hip).toFixed(2) : null
  const whtr = waist > 0 && heightCm > 0 ? +(waist / heightCm).toFixed(2) : null

  return {
    bmi,
    bmiCategory: classifyBmi(bmi),
    bodyFatPct,
    bodyFatCategory: classifyBodyFat(sex, bodyFatPct),
    fatMassKg,
    leanMassKg,
    ffmi,
    whr,
    whrRisk: classifyWhr(sex, whr),
    whtr,
    sumSkinfoldsMm,
    bodyDensity,
  }
}
