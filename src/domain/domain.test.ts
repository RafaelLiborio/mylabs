import { describe, expect, it } from 'vitest'
import {
  bmrCunningham,
  bmrFaoWho,
  bmrHarrisBenedict,
  bmrKatchMcArdle,
  bmrMifflin,
  suggestMacros,
  waterGoalMl,
} from './energy'
import {
  calcDurninWomersley4,
  calcFaulkner4,
  calcJacksonPollock3,
  calcJacksonPollock7,
  calcUsNavy,
  computeAnthropometry,
} from './anthropometry'
import { evaluateFormula, SAMPLE_VARIABLES } from './formula'
import { buildReadyWhatsappMessage, buildWhatsappUrl, sanitizeWhatsappDigits } from './whatsapp'
import { calcFoodPortionMacros, getSmartFoodEquivalents } from './nutrition'

describe('Scientific Energy Equations', () => {
  it('computes Mifflin-St Jeor accurately for male and female', () => {
    const male = bmrMifflin({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(male).toBe(1780)
    const female = bmrMifflin({ sex: 'female', weightKg: 60, heightCm: 165, age: 28 })
    // 600 + 1031.25 - 140 - 161 = 1330.25
    expect(female).toBeCloseTo(1330.25, 2)
  })

  it('computes Revised Harris-Benedict, FAO/WHO, Cunningham and Katch-McArdle', () => {
    expect(bmrHarrisBenedict({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBeGreaterThan(1800)
    expect(bmrFaoWho({ sex: 'male', weightKg: 80, heightCm: 180, age: 25 })).toBeCloseTo(15.057 * 80 + 692.2, 1)
    expect(bmrCunningham({ sex: 'male', weightKg: 80, heightCm: 180, age: 25, leanMassKg: 65 })).toBe(500 + 22 * 65)
    expect(bmrKatchMcArdle({ sex: 'male', weightKg: 80, heightCm: 180, age: 25, leanMassKg: 65 })).toBeCloseTo(370 + 21.6 * 65, 1)
  })

  it('computes macro targets and water goal properly', () => {
    const macros = suggestMacros({ kcal: 2400, weightKg: 80, proteinPerKg: 2.0, fatPct: 25 })
    expect(macros.proteinG).toBe(160)
    expect(macros.fatG).toBe(67)
    expect(macros.carbG).toBeGreaterThan(250)
    expect(waterGoalMl(80, 35)).toBe(2800)
  })
})

describe('Scientific Anthropometry & Body Composition', () => {
  it('computes Jackson & Pollock 3 and 7 skinfolds + Siri equation', () => {
    const jp3 = calcJacksonPollock3('male', 29, { chest: 10, abdomen: 18, thigh: 14 })
    expect(jp3.sumMm).toBe(42)
    expect(jp3.bodyFatPct).toBeGreaterThan(10)
    expect(jp3.bodyFatPct).toBeLessThan(16)

    const jp7 = calcJacksonPollock7('male', 29, {
      chest: 10,
      midaxillary: 11,
      triceps: 9,
      subscapular: 13,
      abdomen: 18,
      suprailiac: 12,
      thigh: 14,
    })
    expect(jp7.sumMm).toBe(87)
    expect(jp7.bodyFatPct).toBeGreaterThan(11)
    expect(jp7.bodyFatPct).toBeLessThan(18)
  })

  it('computes Durnin & Womersley, Faulkner, US Navy, BMI, WHR and FFMI', () => {
    const dw = calcDurninWomersley4('female', 32, { biceps: 8, triceps: 15, subscapular: 14, suprailiac: 16 })
    expect(dw.bodyFatPct).toBeGreaterThan(20)
    const fk = calcFaulkner4({ triceps: 10, subscapular: 12, suprailiac: 14, abdomen: 16 })
    expect(fk.bodyFatPct).toBeCloseTo(52 * 0.153 + 5.783, 1)
    const navy = calcUsNavy('male', 178, { neck: 39, waist: 84, hip: 98 })
    expect(navy.bodyFatPct).toBeGreaterThan(12)

    const full = computeAnthropometry({
      protocol: 'jackson_pollock_3',
      sex: 'male',
      age: 29,
      weightKg: 80.8,
      heightCm: 178,
      skinfolds: { chest: 10, abdomen: 18, thigh: 14 },
      circumferences: { waist: 83.5, hip: 99.5, armRight: 38.4, thighRight: 59.2 },
    })
    expect(full.bmi).toBeCloseTo(25.5, 1)
    expect(full.whr).toBeCloseTo(0.84, 2)
    expect(full.leanMassKg + full.fatMassKg).toBeCloseTo(80.8, 1)
    expect(full.ffmi).toBeGreaterThan(20)
  })
})

describe('Safe Custom Formula Parser', () => {
  it('evaluates custom scientific formulas with variables and functions', () => {
    // Owen et al. male BMR: 879 + 10.2 * peso
    const owen = evaluateFormula('879 + 10.2 * peso', { ...SAMPLE_VARIABLES, peso: 80 })
    expect(owen).toBeCloseTo(1695, 1)

    // With parentheses, power, and functions
    const res = evaluateFormula('round(500 + 22 * massa_magra + sqrt(peso) * 2)', {
      ...SAMPLE_VARIABLES,
      massa_magra: 65,
      peso: 81,
    })
    expect(res).toBe(500 + 22 * 65 + 18)
  })

  it('rejects unknown variables or invalid syntax safely', () => {
    expect(() => evaluateFormula('peso + variavel_inexistente', SAMPLE_VARIABLES)).toThrow()
    expect(() => evaluateFormula('10 / 0', SAMPLE_VARIABLES)).toThrow()
  })
})

describe('WhatsApp & Nutrition Equivalence', () => {
  it('sanitizes phone numbers and builds ready message URLs', () => {
    expect(sanitizeWhatsappDigits('(11) 98877-6655')).toBe('5511988776655')
    const msg = buildReadyWhatsappMessage({
      kind: 'nutritionist',
      clientName: 'Lucas Mendes',
      nutritionistName: 'Dra. Camila',
      category: 'Dieta & Substituições',
      customMessage: 'Posso trocar tilápia por frango hoje?',
      goal: 'Hipertrofia',
    })
    expect(msg).toContain('Lucas Mendes')
    expect(msg).toContain('MyLabs')
    const url = buildWhatsappUrl('(11) 98877-6655', msg)
    expect(url.startsWith('https://wa.me/5511988776655?text=')).toBe(true)
  })

  it('calculates portion macros and smart equivalents', () => {
    const frango = { id: '1', name: 'Frango', food_group: 'protein', protein_g: 32, carb_g: 0, fat_g: 2.5, fiber_g: 0 }
    const tilapia = { id: '2', name: 'Tilápia', food_group: 'protein', protein_g: 26.2, carb_g: 0, fat_g: 2.7, fiber_g: 0 }
    const m = calcFoodPortionMacros(frango, 150)
    expect(m.p).toBe(48)
    const eqs = getSmartFoodEquivalents(frango, 150, [frango, tilapia])
    expect(eqs).toHaveLength(1)
    expect(eqs[0].grams).toBeGreaterThan(170)
  })
})
