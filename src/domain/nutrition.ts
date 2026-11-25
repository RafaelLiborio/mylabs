/**
 * Cálculos nutricionais de refeições e equivalência isocalórica/isoproteica (Tabela TACO).
 */

export interface FoodItemMacro {
  id: string
  name: string
  food_group: string
  protein_g: number
  carb_g: number
  fat_g: number
  fiber_g: number
  image_url?: string | null
}

export const FOOD_GROUP_LABELS: Record<string, string> = {
  protein: 'Proteínas',
  carb: 'Carboidratos & Tubérculos',
  legume: 'Leguminosas',
  vegetable: 'Hortaliças & Vegetais',
  fruit: 'Frutas',
  fat: 'Gorduras Boas & Oleaginosas',
  dairy: 'Laticínios',
  other: 'Outros',
}

export function calcFoodPortionMacros(food: FoodItemMacro, grams: number) {
  const factor = Math.max(0, grams) / 100
  const p = +(Number(food.protein_g) * factor).toFixed(1)
  const c = +(Number(food.carb_g) * factor).toFixed(1)
  const g = +(Number(food.fat_g) * factor).toFixed(1)
  const fiber = +(Number(food.fiber_g || 0) * factor).toFixed(1)
  const kcal = Math.round(p * 4 + c * 4 + g * 9)
  return { p, c, g, fiber, kcal }
}

export function getSmartFoodEquivalents(sourceFood: FoodItemMacro, sourceGrams: number, allFoods: FoodItemMacro[]) {
  const sourceMacros = calcFoodPortionMacros(sourceFood, sourceGrams)
  return allFoods
    .filter((f) => f.food_group === sourceFood.food_group && f.id !== sourceFood.id)
    .map((target) => {
      let eqGrams = 100
      if (sourceFood.food_group === 'protein' && Number(target.protein_g) > 2) {
        eqGrams = Math.round(((sourceMacros.p / Number(target.protein_g)) * 100) / 5) * 5
      } else {
        const targetKcal100 = Number(target.protein_g) * 4 + Number(target.carb_g) * 4 + Number(target.fat_g) * 9
        eqGrams = targetKcal100 > 0 ? Math.round(((sourceMacros.kcal / targetKcal100) * 100) / 5) * 5 : 100
      }
      eqGrams = Math.max(5, Math.min(1000, eqGrams))
      const macros = calcFoodPortionMacros(target, eqGrams)
      return {
        food: target,
        grams: eqGrams,
        macros,
        kcalDelta: macros.kcal - sourceMacros.kcal,
      }
    })
    .sort((a, b) => Math.abs(a.kcalDelta) - Math.abs(b.kcalDelta))
    .slice(0, 8)
}
