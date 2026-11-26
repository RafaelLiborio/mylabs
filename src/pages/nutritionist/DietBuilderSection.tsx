import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getSignedOrPublicUrl, translateErrorPt } from '@/lib/supabase'
import { sanitizeHttpUrl } from '@/lib/fileValidation'
import { useAuth } from '@/contexts/AuthContext'
import { MediaAttachmentPicker, type CapturedMediaFile } from '@/components/shared/MediaAttachmentPicker'
import { FoodThumb } from '@/components/shared/FoodThumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ACTIVITY_FACTORS,
  type ActivityLevel,
  applyCalorieAdjustment,
  computeBmr,
  ENERGY_EQUATIONS,
  type EnergyEquationId,
  kcalFromMacros,
  suggestMacros,
  tdee,
} from '@/domain/energy'
import { calcFoodPortionMacros, FOOD_GROUP_LABELS, type FoodItemMacro } from '@/domain/nutrition'
import { WEEKDAYS } from '@/domain/workouts'
import {
  Apple,
  Calculator,
  Calendar,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Image as ImageIcon,
  Minus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react'
import { toast } from 'sonner'

interface DietBuilderSectionProps {
  clientId: string
  clientName: string
  clientMeta: {
    sex: 'male' | 'female'
    age: number
    heightCm: number
    weightKg: number
    leanMassKg: number
    activityLevel: ActivityLevel
  }
}

export function DietBuilderSection({ clientId, clientName, clientMeta }: DietBuilderSectionProps) {
  const { profile } = useAuth()
  const [foods, setFoods] = useState<FoodItemMacro[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [meals, setMeals] = useState<any[]>([])
  const [attachments, setAttachments] = useState<
    { id: string; storage_path: string; url: string; caption: string; file_name: string }[]
  >([])
  const [mealPhotoPostsByMealId, setMealPhotoPostsByMealId] = useState<
    Record<string, { id: string; log_date: string; caption: string; url: string }[]>
  >({})

  // Weekly / Monthly Planning state
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  // null = Cardápio Base (Todos os Dias), 0..6 = Dom..Sáb
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
  const [replicatingSchedule, setReplicatingSchedule] = useState(false)

  // Scientific calculator quick panel state
  const [eqId, setEqId] = useState<EnergyEquationId>('mifflin')
  const [calAdjustPct, setCalAdjustPct] = useState<number>(0)
  const [proteinPerKg, setProteinPerKg] = useState<number>(2.0)
  const [fatPct, setFatPct] = useState<number>(25)

  // Add Meal modal
  const [newMealOpen, setNewMealOpen] = useState(false)
  const [newMealName, setNewMealName] = useState('Lanche da Tarde')
  const [newMealTime, setNewMealTime] = useState('16:00')
  const [newMealNotes, setNewMealNotes] = useState('')
  const [newMealTargetScope, setNewMealTargetScope] = useState<'current' | 'all_weekdays' | 'full_month'>('current')

  // Add Food modal (TACO + Custom Food)
  const [addFoodOpen, setAddFoodOpen] = useState(false)
  const [targetMealId, setTargetMealId] = useState<string>('')
  const [foodSearch, setFoodSearch] = useState('')
  const [foodGroupFilter, setFoodGroupFilter] = useState('all')
  const [selectedFoodId, setSelectedFoodId] = useState<string>('')
  const [foodGrams, setFoodGrams] = useState<number>(120)

  // Register New Custom Food modal
  const [customFoodOpen, setCustomFoodOpen] = useState(false)
  const [newFoodName, setNewFoodName] = useState('')
  const [newFoodGroup, setNewFoodGroup] = useState<string>('protein')
  const [newFoodProtein, setNewFoodProtein] = useState<number>(25)
  const [newFoodCarb, setNewFoodCarb] = useState<number>(5)
  const [newFoodFat, setNewFoodFat] = useState<number>(3)
  const [newFoodFiber, setNewFoodFiber] = useState<number>(1)
  const [newFoodImageUrl, setNewFoodImageUrl] = useState<string>('')
  const [savingCustomFood, setSavingCustomFood] = useState(false)

  // New Diet Plan modal
  const [newPlanOpen, setNewPlanOpen] = useState(false)
  const [newPlanName, setNewPlanName] = useState('Dia de Descanso / Low Carb')
  const [newPlanKind, setNewPlanKind] = useState<'training' | 'rest' | 'standard'>('rest')
  const [newPlanScope, setNewPlanScope] = useState<'weekly' | 'monthly'>('weekly')

  const loadPlansAndFoods = useCallback(async () => {
    if (!clientId) return
    const [{ data: fList }, { data: pList }] = await Promise.all([
      supabase.from('foods').select('id, name, food_group, protein_g, carb_g, fat_g, fiber_g, image_url').order('name'),
      supabase.from('diet_plans').select('*').eq('client_id', clientId).order('created_at'),
    ])
    const allFoods = (fList as FoodItemMacro[]) || []
    setFoods(allFoods)
    if (allFoods.length > 0 && !selectedFoodId) {
      setSelectedFoodId(allFoods[0].id)
    }

    const clientPlans = pList || []
    setPlans(clientPlans)
    if (clientPlans.length > 0) {
      setSelectedPlanId((prev) =>
        prev && clientPlans.some((p) => p.id === prev) ? prev : clientPlans[0].id,
      )
    } else {
      setSelectedPlanId('')
      setMeals([])
      setAttachments([])
    }
  }, [clientId, selectedFoodId])

  useEffect(() => {
    loadPlansAndFoods()
  }, [loadPlansAndFoods])

  const loadMealsAndAttachments = useCallback(async (planId: string) => {
    if (!planId) return
    const [{ data: mRows }, { data: aRows }] = await Promise.all([
      supabase
        .from('diet_meals')
        .select('*, diet_meal_items(*, foods(*))')
        .eq('plan_id', planId)
        .order('position'),
      supabase
        .from('diet_attachments')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false }),
    ])

    const allMealRows = (mRows || []).map((m: any) => ({
      ...m,
      week_number: m.week_number ?? 1,
      weekday: m.weekday ?? null,
      diet_meal_items: (m.diet_meal_items || []).sort((a: any, b: any) => a.position - b.position),
    }))
    setMeals(allMealRows)

    // Load client meal photo posts for these meals
    const mealIds = allMealRows.map((m: any) => m.id)
    if (mealIds.length > 0) {
      const { data: postRows } = await supabase
        .from('meal_photo_posts')
        .select('*')
        .in('meal_id', mealIds)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })

      const grouped: Record<string, { id: string; log_date: string; caption: string; url: string }[]> = {}
      for (const p of postRows || []) {
        const url = await getSignedOrPublicUrl('client-diary-photos', p.storage_path)
        if (!url) continue
        if (!grouped[p.meal_id]) grouped[p.meal_id] = []
        grouped[p.meal_id].push({
          id: p.id,
          log_date: p.log_date,
          caption: p.caption || 'Registro fotográfico da refeição',
          url,
        })
      }
      setMealPhotoPostsByMealId(grouped)
    } else {
      setMealPhotoPostsByMealId({})
    }

    const resolved = await Promise.all(
      (aRows || []).map(async (a: any) => ({
        id: a.id,
        storage_path: a.storage_path,
        url: await getSignedOrPublicUrl('diet-attachments', a.storage_path),
        caption: a.caption || a.file_name,
        file_name: a.file_name,
      })),
    )
    setAttachments(resolved.filter((a) => a.url))
  }, [])

  useEffect(() => {
    if (selectedPlanId) {
      loadMealsAndAttachments(selectedPlanId)
    }
  }, [selectedPlanId, loadMealsAndAttachments])

  const activePlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || plans[0] || null,
    [plans, selectedPlanId],
  )

  const planningScope: 'weekly' | 'monthly' = useMemo(() => {
    if (activePlan?.planning_scope === 'monthly') return 'monthly'
    if (meals.some((m) => (m.week_number ?? 1) > 1)) return 'monthly'
    return 'weekly'
  }, [activePlan, meals])

  // Determine which meals are displayed for the active (selectedWeek, selectedWeekday)
  const { displayedMeals, isInheritingFromBase } = useMemo(() => {
    // Direct matches for (selectedWeek, selectedWeekday)
    const exactMatches = meals.filter(
      (m) => (m.week_number ?? 1) === selectedWeek && (m.weekday ?? null) === selectedWeekday,
    )
    if (exactMatches.length > 0) {
      return { displayedMeals: exactMatches, isInheritingFromBase: false }
    }

    // If a specific weekday is selected (0..6) and has no custom rows yet, fall back to base meals of that week (or Week 1 base meals)
    const weekBaseMatches = meals.filter(
      (m) => (m.week_number ?? 1) === selectedWeek && (m.weekday ?? null) === null,
    )
    if (weekBaseMatches.length > 0) {
      return { displayedMeals: weekBaseMatches, isInheritingFromBase: selectedWeekday !== null }
    }

    const week1BaseMatches = meals.filter(
      (m) => (m.week_number ?? 1) === 1 && (m.weekday ?? null) === null,
    )
    return {
      displayedMeals: week1BaseMatches,
      isInheritingFromBase: selectedWeekday !== null || selectedWeek > 1,
    }
  }, [meals, selectedWeek, selectedWeekday])

  // Helper to change planning scope (Semanal vs Mês Inteiro)
  const handleChangePlanningScope = async (nextScope: 'weekly' | 'monthly') => {
    if (!activePlan) return
    const weeksCount = nextScope === 'monthly' ? 4 : 1
    setPlans((prev) =>
      prev.map((p) =>
        p.id === activePlan.id ? { ...p, planning_scope: nextScope, weeks_count: weeksCount } : p,
      ),
    )
    if (nextScope === 'weekly') {
      setSelectedWeek(1)
    }
    const { error } = await supabase
      .from('diet_plans')
      .update({ planning_scope: nextScope, weeks_count: weeksCount })
      .eq('id', activePlan.id)
    if (error) {
      toast.error(translateErrorPt(error))
      return
    }
    toast.success(
      nextScope === 'monthly'
        ? 'Modo Planejamento Mensal (4 Semanas) ativado!'
        : 'Modo Planejamento Semanal (Seg a Dom) ativado!',
    )
  }

  // Clone helper: copies a list of source meals (and their diet_meal_items) into target (week, weekday) slots
  const cloneMealsToTargets = async (
    sourceMeals: any[],
    targets: { week_number: number; weekday: number | null }[],
  ) => {
    if (!activePlan || sourceMeals.length === 0) return
    for (const target of targets) {
      // Remove existing meals in target slot first to avoid duplicates
      let delQuery = supabase
        .from('diet_meals')
        .delete()
        .eq('plan_id', activePlan.id)
        .eq('week_number', target.week_number)
      if (target.weekday === null) {
        delQuery = delQuery.is('weekday', null)
      } else {
        delQuery = delQuery.eq('weekday', target.weekday)
      }
      await delQuery

      for (const sm of sourceMeals) {
        const { data: createdMeal } = await supabase
          .from('diet_meals')
          .insert({
            plan_id: activePlan.id,
            name: sm.name,
            meal_time: sm.meal_time,
            position: sm.position,
            notes: sm.notes,
            week_number: target.week_number,
            weekday: target.weekday,
          })
          .select('id')
          .single()

        if (createdMeal && (sm.diet_meal_items || []).length > 0) {
          const itemsPayload = sm.diet_meal_items.map((it: any, idx: number) => ({
            meal_id: createdMeal.id,
            food_id: it.food_id,
            grams: Number(it.grams),
            position: idx + 1,
          }))
          await supabase.from('diet_meal_items').insert(itemsPayload)
        }
      }
    }
  }

  const handleCustomizeCurrentDayFromBase = async () => {
    if (!activePlan || selectedWeekday === null) return
    setReplicatingSchedule(true)
    try {
      await cloneMealsToTargets(displayedMeals, [
        { week_number: selectedWeek, weekday: selectedWeekday },
      ])
      const wdLabel = WEEKDAYS.find((w) => w.id === selectedWeekday)?.full || 'Dia'
      toast.success(`Cardápio personalizado criado para ${wdLabel} (Semana ${selectedWeek})!`)
      await loadMealsAndAttachments(activePlan.id)
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setReplicatingSchedule(false)
    }
  }

  const handleReplicateToFullWeek = async () => {
    if (!activePlan || displayedMeals.length === 0) return
    setReplicatingSchedule(true)
    try {
      const targets = WEEKDAYS.filter((w) => w.id !== selectedWeekday).map((w) => ({
        week_number: selectedWeek,
        weekday: w.id,
      }))
      if (selectedWeekday === null) {
        // Replicate base menu to all 7 days of selectedWeek
        await cloneMealsToTargets(
          displayedMeals,
          WEEKDAYS.map((w) => ({ week_number: selectedWeek, weekday: w.id })),
        )
      } else {
        await cloneMealsToTargets(displayedMeals, targets)
      }
      toast.success(
        `Planejamento replicado para todos os 7 dias da Semana ${selectedWeek} (Seg a Dom)!`,
      )
      await loadMealsAndAttachments(activePlan.id)
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setReplicatingSchedule(false)
    }
  }

  const handleReplicateToFullMonth = async () => {
    if (!activePlan || displayedMeals.length === 0) return
    setReplicatingSchedule(true)
    try {
      await supabase
        .from('diet_plans')
        .update({ planning_scope: 'monthly', weeks_count: 4 })
        .eq('id', activePlan.id)
      setPlans((prev) =>
        prev.map((p) =>
          p.id === activePlan.id ? { ...p, planning_scope: 'monthly', weeks_count: 4 } : p,
        ),
      )

      // Copy current displayedMeals into weeks 1..4 for the current weekday (or base slot)
      const targets: { week_number: number; weekday: number | null }[] = []
      for (let wk = 1; wk <= 4; wk++) {
        if (wk === selectedWeek && !isInheritingFromBase) continue
        targets.push({ week_number: wk, weekday: selectedWeekday })
      }
      await cloneMealsToTargets(displayedMeals, targets)
      toast.success('Planejamento replicado para as 4 semanas do mês inteiro!')
      await loadMealsAndAttachments(activePlan.id)
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setReplicatingSchedule(false)
    }
  }

  // IDs of foods already included in the active target meal card (prevents duplicates in same card, allows in other cards)
  const existingFoodIdsInTargetMeal = useMemo(() => {
    const meal = meals.find((m) => m.id === targetMealId)
    if (!meal) return new Set<string>()
    return new Set<string>((meal.diet_meal_items || []).map((it: any) => String(it.food_id)))
  }, [meals, targetMealId])

  const scientificCalc = useMemo(() => {
    const bmr = computeBmr(eqId, {
      sex: clientMeta.sex,
      weightKg: clientMeta.weightKg,
      heightCm: clientMeta.heightCm,
      age: clientMeta.age,
      leanMassKg: clientMeta.leanMassKg,
    })
    const factor = ACTIVITY_FACTORS[clientMeta.activityLevel]?.factor || 1.55
    const getKcal = tdee(bmr, factor)
    const targetKcal = applyCalorieAdjustment(getKcal, calAdjustPct)
    const macros = suggestMacros({
      kcal: targetKcal,
      weightKg: clientMeta.weightKg,
      proteinPerKg,
      fatPct,
    })
    return {
      bmr: Math.round(bmr),
      tdee: Math.round(getKcal),
      ...macros,
    }
  }, [eqId, clientMeta, calAdjustPct, proteinPerKg, fatPct])

  const handleApplyScientificTargets = async () => {
    if (!activePlan) {
      toast.error('Crie ou selecione um plano alimentar primeiro.')
      return
    }
    const { error } = await supabase
      .from('diet_plans')
      .update({
        kcal_target: scientificCalc.kcal,
        protein_target_g: scientificCalc.proteinG,
        carb_target_g: scientificCalc.carbG,
        fat_target_g: scientificCalc.fatG,
      })
      .eq('id', activePlan.id)
    if (error) {
      toast.error(translateErrorPt(error))
      return
    }
    toast.success(`Metas científicas aplicadas (${scientificCalc.kcal} kcal)!`)
    loadPlansAndFoods()
  }

  const handleCreatePlan = async () => {
    if (!profile?.id || !clientId) return
    const { data, error } = await supabase
      .from('diet_plans')
      .insert({
        client_id: clientId,
        nutritionist_id: profile.id,
        name: newPlanName.trim() || 'Novo Protocolo Alimentar',
        kind: newPlanKind,
        planning_scope: newPlanScope,
        weeks_count: newPlanScope === 'monthly' ? 4 : 1,
        kcal_target: scientificCalc.kcal,
        protein_target_g: scientificCalc.proteinG,
        carb_target_g: scientificCalc.carbG,
        fat_target_g: scientificCalc.fatG,
        active: true,
      })
      .select('id')
      .single()

    if (error || !data) {
      toast.error(translateErrorPt(error))
      return
    }

    await supabase.from('diet_meals').insert([
      { plan_id: data.id, name: 'Café da Manhã', meal_time: '07:30', position: 1, week_number: 1, weekday: null },
      { plan_id: data.id, name: 'Almoço', meal_time: '12:30', position: 2, week_number: 1, weekday: null },
      { plan_id: data.id, name: 'Jantar', meal_time: '20:00', position: 3, week_number: 1, weekday: null },
    ])

    toast.success('Novo plano alimentar criado!')
    setNewPlanOpen(false)
    await loadPlansAndFoods()
    setSelectedPlanId(data.id)
  }

  const handleAddMeal = async () => {
    if (!activePlan) return
    const cleanName = newMealName.trim() || 'Refeição'
    const cleanTime = newMealTime || '12:00'
    const cleanNotes = newMealNotes.trim() || null

    // If current day was inheriting from base and user adds a meal to 'current', materialize current day first
    if (newMealTargetScope === 'current' && isInheritingFromBase && selectedWeekday !== null) {
      await cloneMealsToTargets(displayedMeals, [
        { week_number: selectedWeek, weekday: selectedWeekday },
      ])
    }

    let rowsToInsert: any[] = []
    if (newMealTargetScope === 'current') {
      rowsToInsert = [
        {
          plan_id: activePlan.id,
          name: cleanName,
          meal_time: cleanTime,
          position: displayedMeals.length + 1,
          notes: cleanNotes,
          week_number: selectedWeek,
          weekday: selectedWeekday,
        },
      ]
    } else if (newMealTargetScope === 'all_weekdays') {
      rowsToInsert = [
        {
          plan_id: activePlan.id,
          name: cleanName,
          meal_time: cleanTime,
          position: displayedMeals.length + 1,
          notes: cleanNotes,
          week_number: selectedWeek,
          weekday: null,
        },
        ...WEEKDAYS.map((w) => ({
          plan_id: activePlan.id,
          name: cleanName,
          meal_time: cleanTime,
          position: displayedMeals.length + 1,
          notes: cleanNotes,
          week_number: selectedWeek,
          weekday: w.id,
        })),
      ]
    } else {
      // full_month (weeks 1..4)
      for (let wk = 1; wk <= 4; wk++) {
        rowsToInsert.push({
          plan_id: activePlan.id,
          name: cleanName,
          meal_time: cleanTime,
          position: displayedMeals.length + 1,
          notes: cleanNotes,
          week_number: wk,
          weekday: selectedWeekday,
        })
      }
    }

    const { error } = await supabase.from('diet_meals').insert(rowsToInsert)
    if (error) {
      toast.error(translateErrorPt(error))
      return
    }
    toast.success('Refeição adicionada ao planejamento!')
    setNewMealOpen(false)
    setNewMealNotes('')
    loadMealsAndAttachments(activePlan.id)
  }

  const handleDeleteMeal = async (mealId: string) => {
    if (!activePlan) return
    await supabase.from('diet_meals').delete().eq('id', mealId)
    toast.info('Refeição removida.')
    loadMealsAndAttachments(activePlan.id)
  }

  const handleConfirmAddFood = async () => {
    if (!targetMealId || !selectedFoodObj) return

    if (existingFoodIdsInTargetMeal.has(selectedFoodObj.id)) {
      toast.error(
        `"${selectedFoodObj.name}" já está incluído nesta refeição. Ajuste a gramatura no card ou adicione em outra refeição.`,
      )
      return
    }

    const { error } = await supabase.from('diet_meal_items').insert({
      meal_id: targetMealId,
      food_id: selectedFoodObj.id,
      grams: Math.max(5, foodGrams),
      position: 99,
    })
    if (error) {
      toast.error(translateErrorPt(error))
      return
    }
    toast.success(`"${selectedFoodObj.name}" incluído na refeição!`)
    setAddFoodOpen(false)
    if (activePlan) loadMealsAndAttachments(activePlan.id)
  }

  const handleCreateCustomFood = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    if (!newFoodName.trim()) {
      toast.error('Informe o nome do alimento.')
      return
    }
    const rawImgUrl = newFoodImageUrl.trim()
    const safeImgUrl = rawImgUrl ? sanitizeHttpUrl(rawImgUrl) : null
    if (rawImgUrl && !safeImgUrl) {
      toast.error('URL da imagem inválida. Use um endereço HTTPS válido.')
      return
    }
    setSavingCustomFood(true)
    try {
      const { data, error } = await supabase
        .from('foods')
        .insert({
          name: newFoodName.trim(),
          food_group: newFoodGroup,
          protein_g: Math.max(0, Number(newFoodProtein) || 0),
          carb_g: Math.max(0, Number(newFoodCarb) || 0),
          fat_g: Math.max(0, Number(newFoodFat) || 0),
          fiber_g: Math.max(0, Number(newFoodFiber) || 0),
          image_url: safeImgUrl,
          source: 'personalizado',
          owner_id: profile.id,
        })
        .select('id, name, food_group, protein_g, carb_g, fat_g, fiber_g, image_url')
        .single()

      if (error || !data) throw error || new Error('Erro ao cadastrar alimento.')

      toast.success(`Alimento "${data.name}" cadastrado com sucesso na base nutricional!`)
      setFoods((prev) => [...prev, data as FoodItemMacro].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedFoodId(data.id)
      setFoodGroupFilter('all')
      setFoodSearch('')
      setCustomFoodOpen(false)
      setNewFoodName('')
      setNewFoodImageUrl('')
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setSavingCustomFood(false)
    }
  }

  const handleUpdateGrams = async (itemId: string, grams: number) => {
    const next = Math.max(5, Math.min(2000, Math.round(grams)))
    setMeals((prev) =>
      prev.map((m) => ({
        ...m,
        diet_meal_items: (m.diet_meal_items || []).map((it: any) =>
          it.id === itemId ? { ...it, grams: next } : it,
        ),
      })),
    )
    await supabase.from('diet_meal_items').update({ grams: next }).eq('id', itemId)
  }

  const handleRemoveFoodItem = async (itemId: string) => {
    if (!activePlan) return
    await supabase.from('diet_meal_items').delete().eq('id', itemId)
    loadMealsAndAttachments(activePlan.id)
  }

  const handleUploadDietAttachment = async (captured: CapturedMediaFile) => {
    if (!activePlan || !profile?.id) return
    const ext = captured.file.name.split('.').pop() || 'jpg'
    const safePath = `${clientId}/${activePlan.id}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('diet-attachments')
      .upload(safePath, captured.file, { upsert: true, contentType: captured.file.type })

    if (upErr) throw upErr

    const { error: dbErr } = await supabase.from('diet_attachments').insert({
      plan_id: activePlan.id,
      storage_path: safePath,
      file_name: captured.file.name,
      mime_type: captured.file.type,
      caption: captured.caption,
      created_by: profile.id,
    })
    if (dbErr) throw dbErr

    toast.success('Foto/anexo adicionado ao plano alimentar!')
    loadMealsAndAttachments(activePlan.id)
  }

  const handleDeleteAttachment = async (attId: string, storagePath: string) => {
    if (!activePlan) return
    await supabase.storage.from('diet-attachments').remove([storagePath]).catch(() => null)
    await supabase.from('diet_attachments').delete().eq('id', attId)
    toast.info('Anexo removido.')
    loadMealsAndAttachments(activePlan.id)
  }

  // Totals computed for the currently displayed day/week view
  const totals = useMemo(() => {
    let p = 0
    let c = 0
    let g = 0
    let kcal = 0
    for (const m of displayedMeals) {
      for (const it of m.diet_meal_items || []) {
        if (it.foods) {
          const mac = calcFoodPortionMacros(it.foods, Number(it.grams))
          p += mac.p
          c += mac.c
          g += mac.g
          kcal += mac.kcal
        }
      }
    }
    return { p: Math.round(p), c: Math.round(c), g: Math.round(g), kcal: Math.round(kcal) }
  }, [displayedMeals])

  const filteredFoods = useMemo(() => {
    return foods.filter((f) => {
      const matchGroup = foodGroupFilter === 'all' || f.food_group === foodGroupFilter
      const matchQuery = !foodSearch || f.name.toLowerCase().includes(foodSearch.toLowerCase())
      return matchGroup && matchQuery
    })
  }, [foods, foodGroupFilter, foodSearch])

  const selectedFoodObj = useMemo(
    () => foods.find((f) => f.id === selectedFoodId) || filteredFoods[0] || null,
    [foods, selectedFoodId, filteredFoods],
  )

  const currentScopeLabel = useMemo(() => {
    const wdLabel =
      selectedWeekday === null
        ? 'Cardápio Base (Todos os Dias)'
        : WEEKDAYS.find((w) => w.id === selectedWeekday)?.full || 'Dia'
    return planningScope === 'monthly' ? `Semana ${selectedWeek} • ${wdLabel}` : wdLabel
  }, [planningScope, selectedWeek, selectedWeekday])

  return (
    <div className="space-y-5">
      {/* 1. Barra Científica de Cálculo Energético e Metas */}
      <Card className="rounded-2xl border-emerald-200 bg-gradient-to-r from-emerald-50/60 via-white to-teal-50/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="font-display text-base">
                  Prescrição Calórica Baseada em Evidências Científicas
                </CardTitle>
                <CardDescription className="text-xs">
                  Paciente: <strong>{clientName}</strong> ({clientMeta.weightKg} kg • {clientMeta.heightCm} cm •{' '}
                  {clientMeta.age} anos • MLG: {clientMeta.leanMassKg} kg)
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleApplyScientificTargets}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aplicar {scientificCalc.kcal} kcal ao Plano Ativo</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Equação Científica (TMB)</Label>
              <Select value={eqId} onValueChange={(v) => setEqId(v as EnergyEquationId)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENERGY_EQUATIONS.map((eq) => (
                    <SelectItem key={eq.id} value={eq.id}>
                      {eq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Ajuste sobre GET (%)</Label>
              <Select value={String(calAdjustPct)} onValueChange={(v) => setCalAdjustPct(Number(v))}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-20">Déficit -20% (Cutting)</SelectItem>
                  <SelectItem value="-15">Déficit -15% (Recomposição)</SelectItem>
                  <SelectItem value="0">Manutenção Isocalórica (0%)</SelectItem>
                  <SelectItem value="10">Superávit +10% (Lean Bulk)</SelectItem>
                  <SelectItem value="15">Superávit +15% (Hipertrofia)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Proteína Alvo (g/kg - ISSN)</Label>
              <Select value={String(proteinPerKg)} onValueChange={(v) => setProteinPerKg(Number(v))}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.6">1,6 g/kg (Manutenção)</SelectItem>
                  <SelectItem value="1.8">1,8 g/kg (Treino Moderado)</SelectItem>
                  <SelectItem value="2">2,0 g/kg (Hipertrofia)</SelectItem>
                  <SelectItem value="2.2">2,2 g/kg (Déficit / Definição)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Lipídios (% kcal - DRI/IOM)</Label>
              <Select value={String(fatPct)} onValueChange={(v) => setFatPct(Number(v))}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20% das Calorias</SelectItem>
                  <SelectItem value="25">25% das Calorias</SelectItem>
                  <SelectItem value="30">30% das Calorias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            <div className="rounded-xl bg-white border border-border p-2.5">
              <span className="text-muted-foreground block">TMB Calculada</span>
              <strong className="text-sm font-display">{scientificCalc.bmr} kcal</strong>
            </div>
            <div className="rounded-xl bg-white border border-border p-2.5">
              <span className="text-muted-foreground block">GET (TDEE)</span>
              <strong className="text-sm font-display">{scientificCalc.tdee} kcal</strong>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
              <span className="text-emerald-800 block">Proteínas ({proteinPerKg}g/kg)</span>
              <strong className="text-sm font-display text-emerald-900">{scientificCalc.proteinG} g</strong>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-2.5">
              <span className="text-indigo-800 block">Carboidratos</span>
              <strong className="text-sm font-display text-indigo-900">{scientificCalc.carbG} g</strong>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5">
              <span className="text-amber-800 block">Gorduras ({fatPct}%)</span>
              <strong className="text-sm font-display text-amber-900">{scientificCalc.fatG} g</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Seletor de Plano Alimentar, Planejamento Semanal/Mensal, Cadastro de Novo Alimento, Progresso de Macros e Anexos */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {plans.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={selectedPlanId === p.id ? 'default' : 'outline'}
                onClick={() => setSelectedPlanId(p.id)}
                className={selectedPlanId === p.id ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
              >
                {p.name}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setNewPlanOpen(true)}
              className="gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Protocolo</span>
            </Button>
          </div>

          {activePlan && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCustomFoodOpen(true)}
                className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <Apple className="w-4 h-4 text-emerald-600" />
                <span>Cadastrar Novo Alimento</span>
              </Button>

              <MediaAttachmentPicker
                triggerLabel="Anexar Foto / Câmera"
                title="Anexar Foto de Refeição ou Guia Visual ao Plano"
                description="Envie fotos de montagem de prato, porções ou capture agora pela câmera ao vivo."
                onConfirmUpload={handleUploadDietAttachment}
              />

              <Button
                type="button"
                size="sm"
                onClick={() => setNewMealOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Refeição</span>
              </Button>
            </div>
          )}
        </CardHeader>

        {activePlan && (
          <CardContent className="space-y-4">
            {/* Painel de Planejamento da Dieta: Semana Inteira ou Mês Inteiro (4 Semanas) */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/30 p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-emerald-600 text-white gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Planejamento de Dieta Semanal ou Mensal</span>
                    </Badge>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-900">
                      Visualizando: {currentScopeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Monte um cardápio base para todos os dias ou personalize por dia da semana (Seg a Dom) e por semana do mês (Semanas 1 a 4).
                  </p>
                </div>

                {/* Alternador Semanal vs Mês Inteiro + Ações de Replicação */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={planningScope === 'weekly' ? 'default' : 'outline'}
                    onClick={() => handleChangePlanningScope('weekly')}
                    className={`h-8 text-xs gap-1.5 ${
                      planningScope === 'weekly' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Planejamento Semanal</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={planningScope === 'monthly' ? 'default' : 'outline'}
                    onClick={() => handleChangePlanningScope('monthly')}
                    className={`h-8 text-xs gap-1.5 ${
                      planningScope === 'monthly' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Mês Inteiro (4 Semanas)</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={replicatingSchedule || displayedMeals.length === 0}
                    onClick={handleReplicateToFullWeek}
                    className="h-8 text-xs gap-1"
                    title="Copia as refeições atuais para todos os dias da semana (Seg a Dom)"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Replicar p/ Semana Inteira</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={replicatingSchedule || displayedMeals.length === 0}
                    onClick={handleReplicateToFullMonth}
                    className="h-8 text-xs gap-1"
                    title="Copia as refeições atuais para as 4 semanas do mês"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Replicar p/ Mês Inteiro</span>
                  </Button>
                </div>
              </div>

              {/* Seletor de Semanas do Mês (quando Planejamento Mensal está ativo) */}
              {planningScope === 'monthly' && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-200/60">
                  <span className="text-xs font-semibold text-emerald-950 mr-1">Semana do Mês:</span>
                  {[1, 2, 3, 4].map((wk) => {
                    const weekMealCount = meals.filter((m) => (m.week_number ?? 1) === wk).length
                    return (
                      <Button
                        key={wk}
                        type="button"
                        size="sm"
                        variant={selectedWeek === wk ? 'default' : 'outline'}
                        onClick={() => setSelectedWeek(wk)}
                        className={`h-8 text-xs ${
                          selectedWeek === wk ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-white'
                        }`}
                      >
                        Semana {wk} ({weekMealCount || displayedMeals.length} ref.)
                      </Button>
                    )
                  })}
                </div>
              )}

              {/* Seletor de Dia da Semana (Cardápio Base + Seg..Dom) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedWeekday === null ? 'default' : 'outline'}
                  onClick={() => setSelectedWeekday(null)}
                  className={`h-8 text-xs ${
                    selectedWeekday === null
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-white'
                  }`}
                >
                  Cardápio Base (Todos os Dias)
                </Button>
                {WEEKDAYS.map((wd) => {
                  const customCount = meals.filter(
                    (m) => (m.week_number ?? 1) === selectedWeek && m.weekday === wd.id,
                  ).length
                  const isSel = selectedWeekday === wd.id
                  return (
                    <Button
                      key={wd.id}
                      type="button"
                      size="sm"
                      variant={isSel ? 'default' : customCount > 0 ? 'secondary' : 'outline'}
                      onClick={() => setSelectedWeekday(wd.id)}
                      className={`h-8 text-xs ${
                        isSel ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white'
                      }`}
                    >
                      <span>{wd.short}</span>
                      {customCount > 0 && (
                        <Badge className="ml-1 bg-emerald-100 text-emerald-900 px-1 py-0 text-[10px]">
                          {customCount}
                        </Badge>
                      )}
                    </Button>
                  )
                })}
              </div>

              {isInheritingFromBase && selectedWeekday !== null && (
                <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-amber-950">
                    Este dia (<strong>{WEEKDAYS.find((w) => w.id === selectedWeekday)?.full}</strong>) está seguindo o{' '}
                    <strong>Cardápio Base</strong>. Deseja criar variações exclusivas para este dia?
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={replicatingSchedule}
                    onClick={handleCustomizeCurrentDayFromBase}
                    className="h-7 text-xs border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                  >
                    Personalizar {WEEKDAYS.find((w) => w.id === selectedWeekday)?.short} a partir do Base
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Calorias Prescritas</span>
                <div className="font-display font-extrabold text-lg">
                  {totals.kcal} / {activePlan.kcal_target || 2400} kcal
                </div>
                <Progress
                  value={Math.min(100, (totals.kcal / (activePlan.kcal_target || 2400)) * 100)}
                  className="h-1.5"
                />
              </div>
              <div className="rounded-xl border border-border p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Proteínas (4 kcal/g)</span>
                <div className="font-display font-extrabold text-lg text-emerald-700">
                  {totals.p}g / {activePlan.protein_target_g || 180}g
                </div>
                <Progress
                  value={Math.min(100, (totals.p / (activePlan.protein_target_g || 180)) * 100)}
                  className="h-1.5"
                />
              </div>
              <div className="rounded-xl border border-border p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Carboidratos (4 kcal/g)</span>
                <div className="font-display font-extrabold text-lg text-indigo-700">
                  {totals.c}g / {activePlan.carb_target_g || 250}g
                </div>
                <Progress
                  value={Math.min(100, (totals.c / (activePlan.carb_target_g || 250)) * 100)}
                  className="h-1.5"
                />
              </div>
              <div className="rounded-xl border border-border p-3 space-y-1">
                <span className="text-xs text-muted-foreground">Gorduras (9 kcal/g)</span>
                <div className="font-display font-extrabold text-lg text-amber-700">
                  {totals.g}g / {activePlan.fat_target_g || 65}g
                </div>
                <Progress
                  value={Math.min(100, (totals.g / (activePlan.fat_target_g || 65)) * 100)}
                  className="h-1.5"
                />
              </div>
            </div>

            {/* Galeria de Fotos & Anexos da Dieta */}
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950">
                    Galeria de Fotos & Anexos da Dieta ({attachments.length})
                  </span>
                </div>
                <MediaAttachmentPicker
                  triggerLabel="+ Adicionar Foto ou Câmera"
                  triggerVariant="secondary"
                  onConfirmUpload={handleUploadDietAttachment}
                />
              </div>

              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma foto anexada ainda. Utilize o botão acima para enviar imagens de pratos, porções ou capturar com a câmera.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs flex flex-col justify-between"
                    >
                      <img src={att.url} alt={att.caption} className="h-36 w-full object-cover" />
                      <div className="p-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{att.caption}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteAttachment(att.id, att.storage_path)}
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Excluir foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 3. Cards de Refeições do Plano (Com Imagem Ilustrativa em cada Alimento + Fotos Postadas pelo Cliente) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayedMeals.map((meal) => {
          const mealTotals = (meal.diet_meal_items || []).reduce(
            (acc: any, it: any) => {
              if (!it.foods) return acc
              const m = calcFoodPortionMacros(it.foods, Number(it.grams))
              return { p: acc.p + m.p, c: acc.c + m.c, g: acc.g + m.g, kcal: acc.kcal + m.kcal }
            },
            { p: 0, c: 0, g: 0, kcal: 0 },
          )
          const clientPhotos = mealPhotoPostsByMealId[meal.id] || []

          return (
            <Card key={meal.id} className="rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-display text-base">{meal.name}</CardTitle>
                    {meal.meal_time && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {String(meal.meal_time).slice(0, 5)}
                      </Badge>
                    )}
                    {meal.weekday !== null && meal.weekday !== undefined && (
                      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-800">
                        {WEEKDAYS.find((w) => w.id === meal.weekday)?.short} • Sem {meal.week_number || 1}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {Math.round(mealTotals.kcal)} kcal • P: {mealTotals.p.toFixed(1)}g • C:{' '}
                    {mealTotals.c.toFixed(1)}g • G: {mealTotals.g.toFixed(1)}g
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTargetMealId(meal.id)
                      const usedIds = new Set((meal.diet_meal_items || []).map((x: any) => String(x.food_id)))
                      const firstAvailable = foods.find((f) => !usedIds.has(f.id))
                      if (firstAvailable) setSelectedFoodId(firstAvailable.id)
                      setAddFoodOpen(true)
                    }}
                    className="h-8 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Alimento TACO</span>
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteMeal(meal.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Remover refeição"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-2.5">
                {(meal.diet_meal_items || []).map((it: any) => {
                  const food = it.foods as FoodItemMacro | undefined
                  if (!food) return null
                  const mac = calcFoodPortionMacros(food, Number(it.grams))
                  return (
                    <div
                      key={it.id}
                      className="rounded-xl border border-border p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-[160px] flex-1">
                        <FoodThumb
                          name={food.name}
                          foodGroup={food.food_group}
                          imageUrl={food.image_url}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">{food.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {mac.kcal} kcal • P: {mac.p}g • C: {mac.c}g • G: {mac.g}g
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Diminuir porção de ${food.name}`}
                          onClick={() => handleUpdateGrams(it.id, Number(it.grams) - 10)}
                          className="h-7 w-7"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <div className="px-2 py-1 rounded-lg bg-muted font-bold min-w-[54px] text-center">
                          {Number(it.grams)}g
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={`Aumentar porção de ${food.name}`}
                          onClick={() => handleUpdateGrams(it.id, Number(it.grams) + 10)}
                          className="h-7 w-7"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover ${food.name} da refeição`}
                          onClick={() => handleRemoveFoodItem(it.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {/* Fotos postadas pelo cliente nesta refeição ao longo dos dias */}
                {clientPhotos.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                      <span className="flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-emerald-600" />
                        Fotos Postadas pelo Paciente ({clientPhotos.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {clientPhotos.slice(0, 6).map((cp) => (
                        <div
                          key={cp.id}
                          className="rounded-lg border border-border bg-white overflow-hidden shadow-2xs"
                        >
                          <img src={cp.url} alt={cp.caption} className="h-20 w-full object-cover" />
                          <div className="p-1.5">
                            <span className="text-[10px] font-bold text-emerald-700 block">
                              {cp.log_date}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {cp.caption}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Modal: Adicionar Alimento TACO (Com imagem ilustrativa em cada alimento) */}
      <Dialog open={addFoodOpen} onOpenChange={setAddFoodOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <DialogTitle className="font-display flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-600" />
                <span>Adicionar Alimento à Refeição</span>
              </DialogTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCustomFoodOpen(true)}
                className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Novo Alimento</span>
              </Button>
            </div>
            <DialogDescription>
              Alimentos já presentes nesta refeição ficam bloqueados para evitar duplicidade no mesmo card (você pode incluí-los normalmente em outras refeições).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <Input
                  placeholder="Buscar alimento (ex: Frango, Arroz, Aveia...)"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={foodGroupFilter} onValueChange={setFoodGroupFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Grupo alimentar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os grupos</SelectItem>
                  {Object.entries(FOOD_GROUP_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-border border border-border rounded-xl">
              {filteredFoods.map((f) => {
                const alreadyInThisMeal = existingFoodIdsInTargetMeal.has(f.id)
                const isSelected = selectedFoodObj?.id === f.id && !alreadyInThisMeal
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={alreadyInThisMeal}
                    onClick={() => {
                      if (!alreadyInThisMeal) setSelectedFoodId(f.id)
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-xs transition ${
                      alreadyInThisMeal
                        ? 'bg-muted/60 text-muted-foreground opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-emerald-50 font-semibold text-emerald-950'
                          : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FoodThumb
                        name={f.name}
                        foodGroup={f.food_group}
                        imageUrl={f.image_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {FOOD_GROUP_LABELS[f.food_group] || f.food_group} • Por 100g: P {f.protein_g}g | C{' '}
                          {f.carb_g}g | G {f.fat_g}g
                        </div>
                      </div>
                    </div>
                    {alreadyInThisMeal ? (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Já incluído neste card
                      </Badge>
                    ) : isSelected ? (
                      <Badge className="bg-emerald-600 text-white shrink-0">Selecionado</Badge>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {selectedFoodObj && (
              <div className="rounded-xl bg-muted/50 border border-border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Porção Prescrita (gramas)</Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setFoodGrams((g) => Math.max(5, g - 10))}
                    >
                      -10g
                    </Button>
                    <Input
                      type="number"
                      min={5}
                      max={1500}
                      value={foodGrams}
                      onChange={(e) => setFoodGrams(Number(e.target.value))}
                      className="w-24 font-bold text-center bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setFoodGrams((g) => g + 10)}
                    >
                      +10g
                    </Button>
                  </div>
                </div>

                {(() => {
                  const preview = calcFoodPortionMacros(selectedFoodObj, foodGrams)
                  return (
                    <div className="flex items-center gap-2.5 text-xs">
                      <FoodThumb
                        name={selectedFoodObj.name}
                        foodGroup={selectedFoodObj.food_group}
                        imageUrl={selectedFoodObj.image_url}
                        size="lg"
                      />
                      <div className="space-y-0.5">
                        <div className="font-bold text-foreground">
                          {selectedFoodObj.name} ({foodGrams}g)
                        </div>
                        <div className="text-emerald-700 font-semibold">
                          {preview.kcal} kcal • P: {preview.p}g • C: {preview.c}g • G: {preview.g}g
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddFoodOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selectedFoodObj || existingFoodIdsInTargetMeal.has(selectedFoodObj.id)}
              onClick={handleConfirmAddFood}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Incluir na Refeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Cadastrar Novo Alimento Personalizado pelo Nutricionista */}
      <Dialog open={customFoodOpen} onOpenChange={setCustomFoodOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white">Base Nutricional MyLabs</Badge>
              <Badge variant="outline">Porção de Referência: 100g</Badge>
            </div>
            <DialogTitle className="font-display flex items-center gap-2 mt-1">
              <Apple className="w-4 h-4 text-emerald-600" />
              <span>Cadastrar Novo Alimento</span>
            </DialogTitle>
            <DialogDescription>
              Informe a composição nutricional por 100g. O alimento terá imagem ilustrativa automática ou personalizada.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCustomFood} className="space-y-3.5">
            <div className="flex items-center gap-3">
              <FoodThumb
                name={newFoodName || 'Alimento'}
                foodGroup={newFoodGroup}
                imageUrl={newFoodImageUrl}
                size="lg"
              />
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="new-food-name">Nome do Alimento *</Label>
                <Input
                  id="new-food-name"
                  required
                  placeholder="Ex: Crepioca Proteica ou Queijo Minas Light"
                  value={newFoodName}
                  onChange={(e) => setNewFoodName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div className="space-y-1.5">
                <Label>Grupo Alimentar *</Label>
                <Select value={newFoodGroup} onValueChange={setNewFoodGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FOOD_GROUP_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-food-img">URL de Imagem (Opcional)</Label>
                <Input
                  id="new-food-img"
                  placeholder="https://... (ou automático)"
                  value={newFoodImageUrl}
                  onChange={(e) => setNewFoodImageUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Proteínas (g)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={newFoodProtein}
                  onChange={(e) => setNewFoodProtein(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Carboidratos (g)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={newFoodCarb}
                  onChange={(e) => setNewFoodCarb(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gorduras (g)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={newFoodFat}
                  onChange={(e) => setNewFoodFat(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fibras (g)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={newFoodFiber}
                  onChange={(e) => setNewFoodFiber(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center justify-between text-xs">
              <span className="text-emerald-950 font-medium">
                Energia calculada automaticamente (Atwater 4-4-9):
              </span>
              <strong className="font-display text-base text-emerald-700">
                {kcalFromMacros(newFoodProtein, newFoodCarb, newFoodFat)} kcal / 100g
              </strong>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCustomFoodOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingCustomFood}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {savingCustomFood ? 'Salvando...' : 'Salvar Novo Alimento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Nova Refeição (Com opção de adicionar ao Dia Atual, Semana Inteira ou Mês Inteiro) */}
      <Dialog open={newMealOpen} onOpenChange={setNewMealOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Nova Refeição</DialogTitle>
            <DialogDescription>
              Adicione uma refeição ao dia atual ({currentScopeLabel}), à semana inteira ou ao mês inteiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome da Refeição</Label>
              <Input value={newMealName} onChange={(e) => setNewMealName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div className="space-y-1">
                <Label>Horário Sugerido</Label>
                <Input type="time" value={newMealTime} onChange={(e) => setNewMealTime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Aplicar no Planejamento</Label>
                <Select value={newMealTargetScope} onValueChange={(v) => setNewMealTargetScope(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Visualização Atual ({currentScopeLabel})</SelectItem>
                    <SelectItem value="all_weekdays">Semana Inteira (Seg a Dom)</SelectItem>
                    <SelectItem value="full_month">Mês Inteiro (4 Semanas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Orientação Clínica</Label>
              <Textarea
                rows={2}
                value={newMealNotes}
                onChange={(e) => setNewMealNotes(e.target.value)}
                placeholder="Ex: Consumir 60 min antes do treino..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewMealOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddMeal} className="bg-emerald-600 text-white">
              Criar Refeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Novo Protocolo Alimentar */}
      <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Novo Protocolo Alimentar</DialogTitle>
            <DialogDescription>
              Escolha o tipo de protocolo e se o planejamento será semanal ou mensal (4 semanas).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome do Protocolo</Label>
              <Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div className="space-y-1">
                <Label>Tipo de Dia</Label>
                <Select value={newPlanKind} onValueChange={(v) => setNewPlanKind(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="training">Dia de Treino</SelectItem>
                    <SelectItem value="rest">Dia de Descanso</SelectItem>
                    <SelectItem value="standard">Protocolo Padrão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Horizonte de Planejamento</Label>
                <Select value={newPlanScope} onValueChange={(v) => setNewPlanScope(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Planejamento Semanal</SelectItem>
                    <SelectItem value="monthly">Mês Inteiro (4 Semanas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewPlanOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreatePlan} className="bg-emerald-600 text-white">
              Criar Protocolo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
