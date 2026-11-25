import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, getSignedOrPublicUrl, translateErrorPt } from '@/lib/supabase'
import { AppShell } from '@/components/shared/AppShell'
import { ExercisePreview } from '@/components/shared/ExercisePreview'
import { FoodThumb } from '@/components/shared/FoodThumb'
import { MediaAttachmentPicker, type CapturedMediaFile } from '@/components/shared/MediaAttachmentPicker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  calcFoodPortionMacros,
  FOOD_GROUP_LABELS,
  getSmartFoodEquivalents,
  type FoodItemMacro,
} from '@/domain/nutrition'
import { MUSCLE_GROUP_LABEL, WEEKDAYS } from '@/domain/workouts'
import { CIRCUMFERENCE_FIELDS } from '@/domain/anthropometry'
import {
  buildReadyWhatsappMessage,
  buildWhatsappUrl,
  formatWhatsappDisplay,
  isValidWhatsapp,
  WHATSAPP_TEMPLATES,
} from '@/domain/whatsapp'
import {
  Activity,
  ArrowLeftRight,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Droplets,
  Dumbbell,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare,
  Minus,
  Plus,
  Scale,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingDown,
  Utensils,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

export interface ClientDiaryPhoto {
  id: string
  log_date: string
  storage_path: string
  caption: string
  url: string
}

export function ClientDashboardPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'diet' | 'workout' | 'progress' | 'whatsapp'>('diet')
  const [loading, setLoading] = useState(true)

  // Client & Nutritionist info
  const [clientRow, setClientRow] = useState<any>(null)
  const [nutritionistProfile, setNutritionistProfile] = useState<any>(null)
  const [systemWhatsapp, setSystemWhatsapp] = useState<string>('5511999990000')

  // Diet state
  const [foods, setFoods] = useState<FoodItemMacro[]>([])
  const [dietPlans, setDietPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [meals, setMeals] = useState<any[]>([])
  const [attachments, setAttachments] = useState<{ id: string; url: string; caption: string; file_name: string }[]>([])
  const [completedMealIds, setCompletedMealIds] = useState<Set<string>>(new Set())
  const [waterMl, setWaterMl] = useState<number>(0)

  // Diet Weekly / Monthly navigation for client
  const [dietWeek, setDietWeek] = useState<number>(1)
  const [dietWeekday, setDietWeekday] = useState<number | null>(() => new Date().getDay())

  // Client Meal Photo Posts (by meal_id across days)
  const [mealPhotosByMealId, setMealPhotosByMealId] = useState<Record<string, ClientDiaryPhoto[]>>({})

  // Swap modal state
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapItem, setSwapItem] = useState<{ id: string; grams: number; food: FoodItemMacro } | null>(null)

  // Workout state (by Week and Weekday — NO REST TIMER)
  const [workoutPlan, setWorkoutPlan] = useState<any>(null)
  const [workoutDays, setWorkoutDays] = useState<any[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [selectedWeekday, setSelectedWeekday] = useState<number>(1)
  const [workoutLogsByExId, setWorkoutLogsByExId] = useState<
    Record<string, { completed: boolean; load_kg: number; reps: number }>
  >({})
  const [workoutPhotosByDayId, setWorkoutPhotosByDayId] = useState<Record<string, ClientDiaryPhoto[]>>({})
  const [togglingAllExercises, setTogglingAllExercises] = useState(false)

  // Anthropometry & quick weight check-in state
  const [assessments, setAssessments] = useState<any[]>([])
  const [weightCheckins, setWeightCheckins] = useState<any[]>([])
  const [quickWeight, setQuickWeight] = useState<number>(78)
  const [savingWeight, setSavingWeight] = useState(false)

  // WhatsApp support state
  const [supportKind, setSupportKind] = useState<'nutritionist' | 'system'>('nutritionist')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('nutri_diet_swap')
  const [customMessage, setCustomMessage] = useState<string>(WHATSAPP_TEMPLATES[0].prompt)
  const [supportHistory, setSupportHistory] = useState<any[]>([])
  const [sendingSupport, setSendingSupport] = useState(false)

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const loadWorkoutDayPhotos = useCallback(async (dayIds: string[]) => {
    if (dayIds.length === 0) {
      setWorkoutPhotosByDayId({})
      return
    }
    const { data: rows } = await supabase
      .from('workout_day_photos')
      .select('*')
      .in('workout_day_id', dayIds)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })

    const grouped: Record<string, ClientDiaryPhoto[]> = {}
    for (const r of rows || []) {
      const url = await getSignedOrPublicUrl('client-diary-photos', r.storage_path)
      if (!url) continue
      if (!grouped[r.workout_day_id]) grouped[r.workout_day_id] = []
      grouped[r.workout_day_id].push({
        id: r.id,
        log_date: r.log_date,
        storage_path: r.storage_path,
        caption: r.caption || 'Foto do treino do dia',
        url,
      })
    }
    setWorkoutPhotosByDayId(grouped)
  }, [])

  const loadClientData = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [
        { data: cRow },
        { data: allFoods },
        { data: sysSet },
        { data: dPlans },
        { data: wLog },
        { data: mLogs },
        { data: wPlans },
        { data: assessList },
        { data: checkinsList },
        { data: supReqs },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', profile.id).maybeSingle(),
        supabase.from('foods').select('id, name, food_group, protein_g, carb_g, fat_g, fiber_g, image_url').order('name'),
        supabase.from('app_settings').select('key, value').eq('key', 'support_whatsapp').maybeSingle(),
        supabase.from('diet_plans').select('*').eq('client_id', profile.id).eq('active', true).order('created_at'),
        supabase.from('water_logs').select('ml').eq('client_id', profile.id).eq('log_date', todayIso).maybeSingle(),
        supabase.from('meal_logs').select('meal_id, completed').eq('client_id', profile.id).eq('log_date', todayIso),
        supabase
          .from('workout_plans')
          .select('*')
          .eq('client_id', profile.id)
          .eq('active', true)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('anthropometry_assessments')
          .select('*')
          .eq('client_id', profile.id)
          .order('assessed_at', { ascending: true }),
        supabase.from('weight_checkins').select('*').eq('client_id', profile.id).order('log_date', { ascending: true }),
        supabase
          .from('support_requests')
          .select('*')
          .eq('from_user', profile.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setClientRow(cRow)
      setFoods((allFoods as FoodItemMacro[]) || [])
      if (sysSet?.value && typeof sysSet.value === 'string') {
        setSystemWhatsapp(sysSet.value)
      }

      if (cRow?.nutritionist_id) {
        const { data: nProf } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', cRow.nutritionist_id)
          .maybeSingle()
        setNutritionistProfile(nProf)
      }

      setWaterMl(wLog?.ml ?? 0)
      setCompletedMealIds(new Set((mLogs || []).filter((m) => m.completed).map((m) => m.meal_id)))

      const plans = dPlans || []
      setDietPlans(plans)
      if (plans.length > 0) {
        setSelectedPlanId((prev) => (prev && plans.some((p) => p.id === prev) ? prev : plans[0].id))
      }

      const activeWp = wPlans?.[0] || null
      setWorkoutPlan(activeWp)
      if (activeWp) {
        const { data: days } = await supabase
          .from('workout_days')
          .select('*, workout_exercises(*, exercises(*))')
          .eq('plan_id', activeWp.id)
          .order('week')
          .order('weekday')

        const sortedDays = (days || []).map((d: any) => ({
          ...d,
          workout_exercises: (d.workout_exercises || []).sort((a: any, b: any) => a.position - b.position),
        }))
        setWorkoutDays(sortedDays)
        if (sortedDays.length > 0) {
          setSelectedWeek(sortedDays[0].week)
          setSelectedWeekday(sortedDays[0].weekday)
        }

        await loadWorkoutDayPhotos(sortedDays.map((d: any) => d.id))

        const { data: wLogs } = await supabase
          .from('workout_logs')
          .select('*')
          .eq('client_id', profile.id)
          .eq('log_date', todayIso)

        const logMap: Record<string, { completed: boolean; load_kg: number; reps: number }> = {}
        for (const l of wLogs || []) {
          logMap[l.workout_exercise_id] = {
            completed: l.completed,
            load_kg: Number(l.load_kg) || 0,
            reps: Number(l.reps) || 10,
          }
        }
        setWorkoutLogsByExId(logMap)
      }

      const aList = assessList || []
      const cList = checkinsList || []
      setAssessments(aList)
      setWeightCheckins(cList)
      const latestW =
        cList.length > 0
          ? Number(cList[cList.length - 1].weight_kg)
          : aList.length > 0
            ? Number(aList[aList.length - 1].weight_kg)
            : 78
      setQuickWeight(latestW || 78)
      setSupportHistory(supReqs || [])
    } finally {
      setLoading(false)
    }
  }, [profile?.id, todayIso, loadWorkoutDayPhotos])

  useEffect(() => {
    loadClientData()
  }, [loadClientData])

  // Load meals, attachments & meal photo posts when selectedPlanId changes
  const loadPlanDetails = useCallback(async (planId: string) => {
    if (!planId) {
      setMeals([])
      setAttachments([])
      setMealPhotosByMealId({})
      return
    }
    const [{ data: mealRows }, { data: attRows }] = await Promise.all([
      supabase
        .from('diet_meals')
        .select('*, diet_meal_items(*, foods(*))')
        .eq('plan_id', planId)
        .order('position'),
      supabase.from('diet_attachments').select('*').eq('plan_id', planId).order('created_at', { ascending: false }),
    ])

    const formattedMeals = (mealRows || []).map((m: any) => ({
      ...m,
      week_number: m.week_number ?? 1,
      weekday: m.weekday ?? null,
      diet_meal_items: (m.diet_meal_items || []).sort((a: any, b: any) => a.position - b.position),
    }))
    setMeals(formattedMeals)

    const mealIds = formattedMeals.map((m: any) => m.id)
    if (mealIds.length > 0) {
      const { data: photoRows } = await supabase
        .from('meal_photo_posts')
        .select('*')
        .in('meal_id', mealIds)
        .order('log_date', { ascending: false })
        .order('created_at', { ascending: false })

      const grouped: Record<string, ClientDiaryPhoto[]> = {}
      for (const r of photoRows || []) {
        const url = await getSignedOrPublicUrl('client-diary-photos', r.storage_path)
        if (!url) continue
        if (!grouped[r.meal_id]) grouped[r.meal_id] = []
        grouped[r.meal_id].push({
          id: r.id,
          log_date: r.log_date,
          storage_path: r.storage_path,
          caption: r.caption || 'Foto do que comi',
          url,
        })
      }
      setMealPhotosByMealId(grouped)
    } else {
      setMealPhotosByMealId({})
    }

    const resolvedAtts = await Promise.all(
      (attRows || []).map(async (a: any) => ({
        id: a.id,
        url: await getSignedOrPublicUrl('diet-attachments', a.storage_path),
        caption: a.caption || a.file_name,
        file_name: a.file_name,
      })),
    )
    setAttachments(resolvedAtts.filter((a) => a.url))
  }, [])

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanDetails(selectedPlanId)
    }
  }, [selectedPlanId, loadPlanDetails])

  const activeDietPlan = useMemo(
    () => dietPlans.find((p) => p.id === selectedPlanId) || dietPlans[0],
    [dietPlans, selectedPlanId],
  )

  const hasMonthlyMeals = useMemo(
    () => activeDietPlan?.planning_scope === 'monthly' || meals.some((m) => (m.week_number ?? 1) > 1),
    [activeDietPlan, meals],
  )

  // Displayed meals for the client's currently selected (dietWeek, dietWeekday)
  const displayedMeals = useMemo(() => {
    if (dietWeekday !== null) {
      const exactDayMeals = meals.filter(
        (m) => (m.week_number ?? 1) === dietWeek && m.weekday === dietWeekday,
      )
      if (exactDayMeals.length > 0) return exactDayMeals
    }
    const weekBaseMeals = meals.filter(
      (m) => (m.week_number ?? 1) === dietWeek && (m.weekday === null || m.weekday === undefined),
    )
    if (weekBaseMeals.length > 0) return weekBaseMeals

    const week1BaseMeals = meals.filter(
      (m) => (m.week_number ?? 1) === 1 && (m.weekday === null || m.weekday === undefined),
    )
    return week1BaseMeals.length > 0 ? week1BaseMeals : meals
  }, [meals, dietWeek, dietWeekday])

  const completedDisplayedMealsCount = useMemo(
    () => displayedMeals.filter((m) => completedMealIds.has(m.id)).length,
    [displayedMeals, completedMealIds],
  )

  const allDisplayedMealsDone = useMemo(
    () => displayedMeals.length > 0 && completedDisplayedMealsCount === displayedMeals.length,
    [displayedMeals, completedDisplayedMealsCount],
  )

  const dietTotals = useMemo(() => {
    let p = 0
    let c = 0
    let g = 0
    let kcal = 0
    for (const meal of displayedMeals) {
      for (const item of meal.diet_meal_items || []) {
        if (item.foods) {
          const m = calcFoodPortionMacros(item.foods, Number(item.grams))
          p += m.p
          c += m.c
          g += m.g
          kcal += m.kcal
        }
      }
    }
    return { p: Math.round(p), c: Math.round(c), g: Math.round(g), kcal: Math.round(kcal) }
  }, [displayedMeals])

  const handleAddWater = async (deltaMl: number) => {
    if (!profile?.id) return
    const nextMl = Math.max(0, Math.min(10000, waterMl + deltaMl))
    setWaterMl(nextMl)
    const { error } = await supabase.from('water_logs').upsert({
      client_id: profile.id,
      log_date: todayIso,
      ml: nextMl,
    })
    if (error) {
      toast.error('Erro ao atualizar hidratação.')
    } else if (deltaMl > 0) {
      toast.success(`+${deltaMl} mL de água registrados!`)
    }
  }

  const handleToggleMeal = async (mealId: string) => {
    if (!profile?.id) return
    const isDone = completedMealIds.has(mealId)
    const nextSet = new Set(completedMealIds)
    if (isDone) nextSet.delete(mealId)
    else nextSet.add(mealId)
    setCompletedMealIds(nextSet)

    const { error } = await supabase.from('meal_logs').upsert(
      {
        meal_id: mealId,
        client_id: profile.id,
        log_date: todayIso,
        completed: !isDone,
      },
      { onConflict: 'meal_id,log_date' },
    )
    if (error) {
      toast.error('Não foi possível registrar a refeição.')
    } else {
      toast.success(!isDone ? 'Refeição marcada no checklist do dia!' : 'Refeição desmarcada.')
    }
  }

  const handleToggleAllMealsOfDay = async () => {
    if (!profile?.id || displayedMeals.length === 0) return
    const targetCompleted = !allDisplayedMealsDone
    const nextSet = new Set(completedMealIds)
    for (const m of displayedMeals) {
      if (targetCompleted) nextSet.add(m.id)
      else nextSet.delete(m.id)
    }
    setCompletedMealIds(nextSet)

    const payload = displayedMeals.map((m) => ({
      meal_id: m.id,
      client_id: profile.id,
      log_date: todayIso,
      completed: targetCompleted,
    }))

    const { error } = await supabase
      .from('meal_logs')
      .upsert(payload, { onConflict: 'meal_id,log_date' })

    if (error) {
      toast.error('Erro ao atualizar o checklist de refeições.')
      return
    }
    toast.success(
      targetCompleted
        ? 'Todas as refeições do dia foram marcadas como concluídas!'
        : 'Checklist de refeições do dia desmarcado.',
    )
  }

  const handleUploadMealPhoto = async (meal: any, captured: CapturedMediaFile) => {
    if (!profile?.id) return
    const ext = captured.file.name.split('.').pop() || 'jpg'
    const storagePath = `${profile.id}/meals/${meal.id}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('client-diary-photos')
      .upload(storagePath, captured.file, { upsert: true, contentType: captured.file.type })

    if (upErr) throw upErr

    const { data: inserted, error: dbErr } = await supabase
      .from('meal_photo_posts')
      .insert({
        client_id: profile.id,
        meal_id: meal.id,
        log_date: todayIso,
        storage_path: storagePath,
        caption: captured.caption || `Registro de ${meal.name} (${todayIso})`,
      })
      .select('*')
      .single()

    if (dbErr) throw dbErr

    const url = await getSignedOrPublicUrl('client-diary-photos', storagePath)
    setMealPhotosByMealId((prev) => ({
      ...prev,
      [meal.id]: [
        {
          id: inserted.id,
          log_date: inserted.log_date,
          storage_path: inserted.storage_path,
          caption: inserted.caption || `Foto de ${meal.name}`,
          url,
        },
        ...(prev[meal.id] || []),
      ],
    }))
    toast.success(`Foto publicada em "${meal.name}"!`)
  }

  const handleDeleteMealPhoto = async (mealId: string, photo: ClientDiaryPhoto) => {
    await supabase.storage.from('client-diary-photos').remove([photo.storage_path]).catch(() => null)
    await supabase.from('meal_photo_posts').delete().eq('id', photo.id)
    setMealPhotosByMealId((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] || []).filter((p) => p.id !== photo.id),
    }))
    toast.info('Foto da refeição removida.')
  }

  const handleApplyFoodSwap = async (newFoodId: string, newGrams: number) => {
    if (!swapItem) return
    const { error } = await supabase
      .from('diet_meal_items')
      .update({ food_id: newFoodId, grams: newGrams })
      .eq('id', swapItem.id)
    if (error) {
      toast.error(error.message || 'Erro ao aplicar substituição.')
      return
    }
    toast.success('Alimento substituído com equivalência nutricional!')
    setSwapOpen(false)
    setSwapItem(null)
    if (selectedPlanId) loadPlanDetails(selectedPlanId)
  }

  const activeWorkoutDay = useMemo(
    () =>
      workoutDays.find((d) => d.week === selectedWeek && d.weekday === selectedWeekday) ||
      workoutDays.find((d) => d.week === selectedWeek) ||
      null,
    [workoutDays, selectedWeek, selectedWeekday],
  )

  const activeDayExercises = useMemo(
    () => activeWorkoutDay?.workout_exercises || [],
    [activeWorkoutDay],
  )

  const completedDayExercisesCount = useMemo(
    () => activeDayExercises.filter((we: any) => workoutLogsByExId[we.id]?.completed).length,
    [activeDayExercises, workoutLogsByExId],
  )

  const allDayExercisesCompleted = useMemo(
    () => activeDayExercises.length > 0 && completedDayExercisesCount === activeDayExercises.length,
    [activeDayExercises, completedDayExercisesCount],
  )

  const handleToggleExercise = async (we: any, customLoad?: number, customReps?: number) => {
    if (!profile?.id) return
    const current = workoutLogsByExId[we.id]
    const nextCompleted =
      customLoad !== undefined || customReps !== undefined
        ? (current?.completed ?? true)
        : !current?.completed
    const loadKg = customLoad ?? current?.load_kg ?? Number(we.load_kg || 0)
    const repsVal = customReps ?? current?.reps ?? (parseInt(String(we.reps), 10) || 10)

    setWorkoutLogsByExId((prev) => ({
      ...prev,
      [we.id]: { completed: nextCompleted, load_kg: loadKg, reps: repsVal },
    }))

    const { error } = await supabase.from('workout_logs').upsert(
      {
        client_id: profile.id,
        workout_exercise_id: we.id,
        log_date: todayIso,
        completed: nextCompleted,
        load_kg: loadKg,
        reps: repsVal,
      },
      { onConflict: 'workout_exercise_id,log_date' },
    )
    if (error) {
      toast.error('Erro ao salvar execução do exercício.')
    } else if (customLoad === undefined && customReps === undefined && nextCompleted) {
      toast.success(`Exercício concluído: ${we.exercises?.name_pt}`)
    }
  }

  const handleCompleteAllExercisesOfDay = async () => {
    if (!profile?.id || !activeWorkoutDay || activeDayExercises.length === 0) return
    const nextCompleted = !allDayExercisesCompleted
    setTogglingAllExercises(true)
    try {
      const nextMap = { ...workoutLogsByExId }
      const payload = activeDayExercises.map((we: any) => {
        const current = workoutLogsByExId[we.id]
        const loadKg = current?.load_kg ?? Number(we.load_kg || 0)
        const repsVal = current?.reps ?? (parseInt(String(we.reps), 10) || 10)
        nextMap[we.id] = { completed: nextCompleted, load_kg: loadKg, reps: repsVal }
        return {
          client_id: profile.id,
          workout_exercise_id: we.id,
          log_date: todayIso,
          completed: nextCompleted,
          load_kg: loadKg,
          reps: repsVal,
        }
      })

      setWorkoutLogsByExId(nextMap)
      const { error } = await supabase
        .from('workout_logs')
        .upsert(payload, { onConflict: 'workout_exercise_id,log_date' })

      if (error) throw error
      toast.success(
        nextCompleted
          ? `Parabéns! Todos os ${activeDayExercises.length} exercícios do dia foram marcados como concluídos!`
          : 'Exercícios do dia desmarcados.',
      )
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setTogglingAllExercises(false)
    }
  }

  const handleUploadWorkoutDayPhoto = async (day: any, captured: CapturedMediaFile) => {
    if (!profile?.id || !day?.id) return
    const ext = captured.file.name.split('.').pop() || 'jpg'
    const storagePath = `${profile.id}/workouts/${day.id}/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('client-diary-photos')
      .upload(storagePath, captured.file, { upsert: true, contentType: captured.file.type })

    if (upErr) throw upErr

    const { data: inserted, error: dbErr } = await supabase
      .from('workout_day_photos')
      .insert({
        client_id: profile.id,
        workout_day_id: day.id,
        log_date: todayIso,
        storage_path: storagePath,
        caption: captured.caption || `Treino concluído — ${day.title} (${todayIso})`,
      })
      .select('*')
      .single()

    if (dbErr) throw dbErr

    const url = await getSignedOrPublicUrl('client-diary-photos', storagePath)
    setWorkoutPhotosByDayId((prev) => ({
      ...prev,
      [day.id]: [
        {
          id: inserted.id,
          log_date: inserted.log_date,
          storage_path: inserted.storage_path,
          caption: inserted.caption || 'Foto do treino do dia',
          url,
        },
        ...(prev[day.id] || []),
      ],
    }))
    toast.success(`Foto do treino publicada em "${day.title}"!`)
  }

  const handleDeleteWorkoutDayPhoto = async (dayId: string, photo: ClientDiaryPhoto) => {
    await supabase.storage.from('client-diary-photos').remove([photo.storage_path]).catch(() => null)
    await supabase.from('workout_day_photos').delete().eq('id', photo.id)
    setWorkoutPhotosByDayId((prev) => ({
      ...prev,
      [dayId]: (prev[dayId] || []).filter((p) => p.id !== photo.id),
    }))
    toast.info('Foto do treino removida.')
  }

  const handleQuickWeightCheckin = async () => {
    if (!profile?.id) return
    setSavingWeight(true)
    try {
      const { error } = await supabase.from('weight_checkins').upsert({
        client_id: profile.id,
        log_date: todayIso,
        weight_kg: quickWeight,
      })
      if (error) throw error
      toast.success(`Peso de hoje (${quickWeight.toFixed(1)} kg) registrado na sua evolução!`)
      loadClientData()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar peso.')
    } finally {
      setSavingWeight(false)
    }
  }

  const latestAssessment = assessments.length > 0 ? assessments[assessments.length - 1] : null
  const initialAssessment = assessments.length > 0 ? assessments[0] : null

  const chartSeries = useMemo(() => {
    const pts: { date: string; peso: number; gordura?: number }[] = []
    for (const a of assessments) {
      pts.push({
        date: a.assessed_at.slice(5),
        peso: Number(a.weight_kg) || 0,
        gordura: a.results?.bodyFatPct ? Number(a.results.bodyFatPct) : undefined,
      })
    }
    for (const c of weightCheckins) {
      if (!pts.some((p) => p.date === c.log_date.slice(5))) {
        pts.push({
          date: c.log_date.slice(5),
          peso: Number(c.weight_kg),
        })
      }
    }
    return pts
  }, [assessments, weightCheckins])

  // WhatsApp ready message
  const filteredTemplates = useMemo(
    () => WHATSAPP_TEMPLATES.filter((t) => t.kind === supportKind),
    [supportKind],
  )
  const activeTemplate = useMemo(
    () => filteredTemplates.find((t) => t.id === selectedTemplateId) || filteredTemplates[0],
    [filteredTemplates, selectedTemplateId],
  )

  const targetPhone =
    supportKind === 'nutritionist'
      ? nutritionistProfile?.whatsapp || ''
      : systemWhatsapp || ''

  const readyWhatsappText = useMemo(
    () =>
      buildReadyWhatsappMessage({
        kind: supportKind,
        clientName: profile?.full_name || 'Cliente MyLabs',
        clientEmail: profile?.email,
        nutritionistName: nutritionistProfile?.full_name,
        category: activeTemplate?.category || 'Atendimento',
        customMessage,
        goal: clientRow?.goal,
      }),
    [supportKind, profile, nutritionistProfile, activeTemplate, customMessage, clientRow],
  )

  const handleSendWhatsappSupport = async () => {
    if (!profile?.id) return
    if (!customMessage.trim()) {
      toast.error('Escreva ou selecione uma mensagem antes de enviar.')
      return
    }
    setSendingSupport(true)
    try {
      await supabase.from('support_requests').insert({
        kind: supportKind,
        from_user: profile.id,
        to_user: supportKind === 'nutritionist' ? nutritionistProfile?.id || null : null,
        category: activeTemplate?.category || 'Geral',
        message: customMessage.trim(),
        whatsapp_to: targetPhone || null,
        status: 'sent',
      })

      if (isValidWhatsapp(targetPhone)) {
        const url = buildWhatsappUrl(targetPhone, readyWhatsappText)
        window.open(url, '_blank', 'noopener,noreferrer')
        toast.success('Solicitação registrada e aberta no WhatsApp!')
      } else {
        await navigator.clipboard?.writeText(readyWhatsappText).catch(() => null)
        toast.info('Pedido registrado no sistema e mensagem copiada!')
      }
      loadClientData()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar pedido.')
    } finally {
      setSendingSupport(false)
    }
  }

  const waterGoal = clientRow?.water_goal_ml || 3000
  const waterPct = Math.min(100, Math.round((waterMl / waterGoal) * 100))

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Cabeçalho de Boas-vindas do Cliente */}
        <Card className="rounded-3xl border-border bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white shadow-md overflow-hidden">
          <CardContent className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Plano {clientRow?.plan || 'Pro'}
                </Badge>
                {nutritionistProfile && (
                  <Badge variant="outline" className="border-slate-700 text-slate-300 gap-1">
                    <Stethoscope className="w-3 h-3 text-emerald-400" />
                    <span>Acompanhamento: {nutritionistProfile.full_name}</span>
                  </Badge>
                )}
              </div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl">
                Olá, {profile?.full_name || 'Cliente'}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Objetivo Clínico: <strong className="text-emerald-300">{clientRow?.goal || 'Saúde & Performance'}</strong>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2.5">
                <span className="text-[11px] text-slate-300 block">Refeições Hoje</span>
                <strong className="font-display text-lg text-emerald-400">
                  {completedDisplayedMealsCount}/{displayedMeals.length || 0}
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2.5">
                <span className="text-[11px] text-slate-300 block">Água Hoje</span>
                <strong className="font-display text-lg text-sky-300">
                  {(waterMl / 1000).toFixed(2)} L
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2.5">
                <span className="text-[11px] text-slate-300 block">Peso Atual</span>
                <strong className="font-display text-lg text-white">
                  {quickWeight.toFixed(1)} kg
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navegação Principal do Cliente (Sem acesso a módulos de Nutri ou Suporte) */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1.5 rounded-2xl bg-muted">
            <TabsTrigger value="diet" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <Utensils className="w-4 h-4 text-emerald-600" />
              <span>Minha Dieta</span>
            </TabsTrigger>
            <TabsTrigger value="workout" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <Dumbbell className="w-4 h-4 text-indigo-600" />
              <span>Meu Treino</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <Activity className="w-4 h-4 text-amber-600" />
              <span>Minha Evolução</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Assistência WhatsApp</span>
            </TabsTrigger>
          </TabsList>

          {/* ==================== ABA 1: MINHA DIETA ==================== */}
          <TabsContent value="diet" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Resumo de Macros, Seletor de Plano e Navegação Semanal/Mensal */}
              <Card className="lg:col-span-8 rounded-2xl">
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-display text-base">
                        {activeDietPlan?.name || 'Plano Alimentar Prescrito'}
                      </CardTitle>
                      <Badge variant="outline" className="text-[11px] border-emerald-300 text-emerald-800 gap-1">
                        <CalendarDays className="w-3 h-3" />
                        <span>
                          {hasMonthlyMeals ? 'Planejamento Mensal (4 Semanas)' : 'Planejamento Semanal'}
                        </span>
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      {activeDietPlan?.notes ||
                        'Siga as porções em gramas, marque o checklist diário e poste a foto das suas refeições.'}
                    </CardDescription>
                  </div>
                  {dietPlans.length > 1 && (
                    <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                      <SelectTrigger className="w-full sm:w-56">
                        <SelectValue placeholder="Selecionar protocolo" />
                      </SelectTrigger>
                      <SelectContent>
                        {dietPlans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Filtro de Semana (1..4) e Dia da Semana (Seg..Dom) */}
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-2.5 space-y-2">
                    {hasMonthlyMeals && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-emerald-950 mr-1">Semana do Mês:</span>
                        {[1, 2, 3, 4].map((wk) => (
                          <Button
                            key={wk}
                            type="button"
                            size="sm"
                            variant={dietWeek === wk ? 'default' : 'outline'}
                            onClick={() => setDietWeek(wk)}
                            className={`h-7 px-2.5 text-xs ${
                              dietWeek === wk ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white'
                            }`}
                          >
                            Semana {wk}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-950 mr-1">Dia do Cardápio:</span>
                      <Button
                        type="button"
                        size="sm"
                        variant={dietWeekday === null ? 'default' : 'outline'}
                        onClick={() => setDietWeekday(null)}
                        className={`h-7 px-2.5 text-xs ${
                          dietWeekday === null ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white'
                        }`}
                      >
                        Cardápio Base
                      </Button>
                      {WEEKDAYS.map((wd) => (
                        <Button
                          key={wd.id}
                          type="button"
                          size="sm"
                          variant={dietWeekday === wd.id ? 'default' : 'outline'}
                          onClick={() => setDietWeekday(wd.id)}
                          className={`h-7 px-2.5 text-xs ${
                            dietWeekday === wd.id ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white'
                          }`}
                        >
                          {wd.short}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                      <span className="text-xs text-muted-foreground">Calorias do Plano</span>
                      <div className="font-display font-extrabold text-lg">
                        {dietTotals.kcal}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {activeDietPlan?.kcal_target || 2400} kcal
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (dietTotals.kcal / (activeDietPlan?.kcal_target || 2400)) * 100)}
                        className="h-1.5"
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                      <span className="text-xs text-muted-foreground">Proteínas</span>
                      <div className="font-display font-extrabold text-lg text-emerald-700">
                        {dietTotals.p}g{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {activeDietPlan?.protein_target_g || 180}g
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (dietTotals.p / (activeDietPlan?.protein_target_g || 180)) * 100)}
                        className="h-1.5"
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                      <span className="text-xs text-muted-foreground">Carboidratos</span>
                      <div className="font-display font-extrabold text-lg text-indigo-700">
                        {dietTotals.c}g{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {activeDietPlan?.carb_target_g || 250}g
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (dietTotals.c / (activeDietPlan?.carb_target_g || 250)) * 100)}
                        className="h-1.5"
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                      <span className="text-xs text-muted-foreground">Gorduras</span>
                      <div className="font-display font-extrabold text-lg text-amber-700">
                        {dietTotals.g}g{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          / {activeDietPlan?.fat_target_g || 65}g
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (dietTotals.g / (activeDietPlan?.fat_target_g || 65)) * 100)}
                        className="h-1.5"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rastreador de Hidratação */}
              <Card className="lg:col-span-4 rounded-2xl border-sky-200/80 bg-gradient-to-b from-sky-50/60 to-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-base flex items-center gap-2 text-sky-950">
                      <Droplets className="w-4 h-4 text-sky-600" />
                      <span>Hidratação Diária</span>
                    </CardTitle>
                    <Badge className="bg-sky-600 text-white">{waterPct}%</Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Meta científica individualizada: {waterGoal} mL/dia
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-extrabold text-2xl text-sky-900">{waterMl} mL</span>
                    <span className="text-xs text-muted-foreground">Faltam {Math.max(0, waterGoal - waterMl)} mL</span>
                  </div>
                  <Progress value={waterPct} className="h-2.5" />
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddWater(-250)}
                      className="text-xs"
                    >
                      -250 mL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddWater(250)}
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs"
                    >
                      +250 mL
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddWater(500)}
                      className="bg-sky-700 hover:bg-sky-800 text-white text-xs"
                    >
                      +500 mL
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CHECKLIST DE REFEIÇÕES DO DIA (Requisito 1) */}
            <Card className="rounded-2xl border-emerald-300 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/40 shadow-2xs">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-display text-base flex items-center gap-2 text-emerald-950">
                      <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                      <span>Checklist de Refeições Concluídas no Dia</span>
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white">
                      {completedDisplayedMealsCount} de {displayedMeals.length} concluídas
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Marque abaixo cada refeição que você realizou hoje ({todayIso}) para manter seu acompanhamento clínico em dia.
                  </CardDescription>
                </div>

                {displayedMeals.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant={allDisplayedMealsDone ? 'outline' : 'default'}
                    onClick={handleToggleAllMealsOfDay}
                    className={`gap-1.5 shrink-0 ${
                      allDisplayedMealsDone
                        ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {allDisplayedMealsDone
                        ? 'Desmarcar Todas do Dia'
                        : 'Marcar Todas as Refeições do Dia'}
                    </span>
                  </Button>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                <Progress
                  value={
                    displayedMeals.length > 0
                      ? Math.round((completedDisplayedMealsCount / displayedMeals.length) * 100)
                      : 0
                  }
                  className="h-2"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {displayedMeals.map((meal) => {
                    const isDone = completedMealIds.has(meal.id)
                    const photoCount = (mealPhotosByMealId[meal.id] || []).length
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => handleToggleMeal(meal.id)}
                        className={`text-left rounded-xl border p-3 flex items-center justify-between gap-2.5 transition-all ${
                          isDone
                            ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-2xs'
                            : 'border-border bg-white hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-xs font-bold truncate ${
                                isDone ? 'line-through text-emerald-900' : 'text-foreground'
                              }`}
                            >
                              {meal.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              {meal.meal_time && <span>{String(meal.meal_time).slice(0, 5)}</span>}
                              {photoCount > 0 && (
                                <span className="text-emerald-700 font-semibold">
                                  • 📷 {photoCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={isDone ? 'default' : 'outline'}
                          className={`text-[10px] shrink-0 ${isDone ? 'bg-emerald-600 text-white' : ''}`}
                        >
                          {isDone ? 'Feita ✓' : 'Marcar'}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Galeria de Fotos & Anexos da Dieta enviados pelo Nutricionista (se houver) */}
            {attachments.length > 0 && (
              <Card className="rounded-2xl border-emerald-200 bg-emerald-50/20">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Fotos & Guias Visuais Anexados pelo Nutricionista</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs flex flex-col"
                    >
                      <img src={att.url} alt={att.caption} className="h-40 w-full object-cover" />
                      <div className="p-2.5 text-xs font-medium text-foreground">{att.caption}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Lista de Cards de Refeições (Com imagem ilustrativa em cada alimento + campo de foto em cada refeição!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedMeals.map((meal) => {
                const isDone = completedMealIds.has(meal.id)
                const mealPhotos = mealPhotosByMealId[meal.id] || []
                const mealMacros = (meal.diet_meal_items || []).reduce(
                  (acc: any, it: any) => {
                    if (!it.foods) return acc
                    const m = calcFoodPortionMacros(it.foods, Number(it.grams))
                    return {
                      p: acc.p + m.p,
                      c: acc.c + m.c,
                      g: acc.g + m.g,
                      kcal: acc.kcal + m.kcal,
                    }
                  },
                  { p: 0, c: 0, g: 0, kcal: 0 },
                )

                return (
                  <Card
                    key={meal.id}
                    className={`rounded-2xl transition-all ${
                      isDone ? 'border-emerald-300 bg-emerald-50/20' : 'border-border'
                    }`}
                  >
                    <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Button
                          type="button"
                          size="icon"
                          variant={isDone ? 'default' : 'outline'}
                          onClick={() => handleToggleMeal(meal.id)}
                          className={`h-8 w-8 rounded-xl shrink-0 ${
                            isDone ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                          }`}
                          title={isDone ? 'Refeição concluída' : 'Marcar refeição como concluída'}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="font-display text-base">{meal.name}</CardTitle>
                            {meal.meal_time && (
                              <Badge variant="secondary" className="text-[11px]">
                                {String(meal.meal_time).slice(0, 5)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Math.round(mealMacros.kcal)} kcal • P: {mealMacros.p.toFixed(0)}g • C:{' '}
                            {mealMacros.c.toFixed(0)}g • G: {mealMacros.g.toFixed(0)}g
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant={isDone ? 'default' : 'outline'}
                        onClick={() => handleToggleMeal(meal.id)}
                        className={`h-8 text-xs gap-1 ${
                          isDone
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isDone ? 'Concluída' : 'Marcar Feita'}</span>
                      </Button>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Itens Alimentares com Imagem Ilustrativa (<FoodThumb />) */}
                      <div className="space-y-2">
                        {(meal.diet_meal_items || []).map((item: any) => {
                          const food = item.foods as FoodItemMacro | undefined
                          if (!food) return null
                          const m = calcFoodPortionMacros(food, Number(item.grams))
                          return (
                            <div
                              key={item.id}
                              className="rounded-xl border border-border bg-white p-2.5 flex items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <FoodThumb
                                  name={food.name}
                                  foodGroup={food.food_group}
                                  imageUrl={food.image_url}
                                  size="md"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-foreground truncate">
                                    {food.name}{' '}
                                    <span className="text-emerald-700 font-bold">({Number(item.grams)}g)</span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {m.kcal} kcal • P: {m.p}g • C: {m.c}g • G: {m.g}g
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSwapItem({ id: item.id, grams: Number(item.grams), food })
                                  setSwapOpen(true)
                                }}
                                className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 gap-1 shrink-0"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                <span>Trocar</span>
                              </Button>
                            </div>
                          )
                        })}
                      </div>

                      {meal.notes && (
                        <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                          💡 {meal.notes}
                        </p>
                      )}

                      {/* CAMPO DE FOTO DO QUE O CLIENTE COMEU NESTA REFEIÇÃO (POSTAGEM AO LONGO DOS DIAS) */}
                      <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/40 p-3 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Camera className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-950">
                              Diário Fotográfico — {meal.name} ({mealPhotos.length})
                            </span>
                          </div>
                          <MediaAttachmentPicker
                            triggerLabel="Postar Foto do que Comi"
                            title={`Postar Foto — ${meal.name}`}
                            description="Registre a foto do seu prato nesta refeição para acompanhar sua evolução ao longo dos dias."
                            onConfirmUpload={(captured) => handleUploadMealPhoto(meal, captured)}
                          />
                        </div>

                        {mealPhotos.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            Nenhuma foto postada ainda em <strong>{meal.name}</strong>. Clique em &ldquo;Postar Foto do que Comi&rdquo; para iniciar seu mural diário!
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {mealPhotos.map((photo) => (
                              <div
                                key={photo.id}
                                className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs flex flex-col justify-between"
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.caption}
                                  className="h-24 w-full object-cover"
                                />
                                <div className="p-2 flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-800"
                                    >
                                      {photo.log_date === todayIso ? `Hoje (${photo.log_date})` : photo.log_date}
                                    </Badge>
                                    <p className="text-[11px] text-foreground font-medium truncate mt-0.5">
                                      {photo.caption}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteMealPhoto(meal.id, photo)}
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                    title="Remover foto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* ==================== ABA 2: MEU TREINO (SEM CRONÔMETRO DE DESCANSO!) ==================== */}
          <TabsContent value="workout" className="space-y-5">
            {!workoutPlan ? (
              <Card className="rounded-2xl p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma ficha de treino ativa no momento. Solicite ao seu nutricionista via WhatsApp.
                </p>
              </Card>
            ) : (
              <>
                <Card className="rounded-2xl">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-indigo-600 text-white">Periodização por Semana & Dia</Badge>
                          <Badge variant="outline">{workoutPlan.weeks} Semanas</Badge>
                        </div>
                        <CardTitle className="font-display text-lg mt-1.5">{workoutPlan.name}</CardTitle>
                        <CardDescription className="text-xs">{workoutPlan.notes}</CardDescription>
                      </div>

                      {/* Seletor de Semana */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {Array.from({ length: workoutPlan.weeks || 4 }, (_, i) => i + 1).map((wk) => (
                          <Button
                            key={wk}
                            type="button"
                            size="sm"
                            variant={selectedWeek === wk ? 'default' : 'outline'}
                            onClick={() => setSelectedWeek(wk)}
                            className={selectedWeek === wk ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}
                          >
                            Semana {wk}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Seletor de Dia da Semana */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {WEEKDAYS.map((wd) => {
                        const dayObj = workoutDays.find(
                          (d) => d.week === selectedWeek && d.weekday === wd.id,
                        )
                        const active = selectedWeekday === wd.id
                        return (
                          <Button
                            key={wd.id}
                            type="button"
                            variant={active ? 'default' : dayObj ? 'secondary' : 'outline'}
                            onClick={() => setSelectedWeekday(wd.id)}
                            className={`h-auto py-2 flex flex-col items-center gap-0.5 rounded-xl ${
                              active ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
                            }`}
                          >
                            <span className="text-xs font-bold">{wd.short}</span>
                            <span className="text-[10px] opacity-80">
                              {dayObj ? `${dayObj.workout_exercises?.length || 0} ex.` : 'Livre'}
                            </span>
                          </Button>
                        )
                      })}
                    </div>

                    {activeWorkoutDay ? (
                      <div className="space-y-3">
                        {/* Cabeçalho do Dia de Treino + BOTÃO CONCLUIR TODOS OS EXERCÍCIOS DO DIA (Requisito 5) */}
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-600" />
                              <h3 className="font-display font-bold text-base text-slate-900">
                                {activeWorkoutDay.title}
                              </h3>
                              <Badge
                                className={
                                  allDayExercisesCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-100 text-indigo-900'
                                }
                              >
                                {completedDayExercisesCount}/{activeDayExercises.length} exercícios concluídos
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">Agrupamentos Musculares:</span>
                              {(activeWorkoutDay.muscle_groups || []).map((mg: string) => (
                                <Badge key={mg} className="bg-indigo-600 text-white text-[11px]">
                                  {MUSCLE_GROUP_LABEL[mg] || mg}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {activeDayExercises.length > 0 && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={togglingAllExercises}
                                onClick={handleCompleteAllExercisesOfDay}
                                className={`gap-1.5 font-semibold ${
                                  allDayExercisesCompleted
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>
                                  {allDayExercisesCompleted
                                    ? 'Treino do Dia Concluído ✓ (Desmarcar Todos)'
                                    : 'Concluir Todos os Exercícios do Dia'}
                                </span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* DIÁRIO FOTOGRÁFICO DO DIA DE TREINO (POR DIA DE TREINO, NÃO POR EXERCÍCIO — Requisito 4) */}
                        <div className="rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/30 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Camera className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs sm:text-sm font-bold text-indigo-950">
                                  Fotos do Meu Treino do Dia — {activeWorkoutDay.title} (
                                  {(workoutPhotosByDayId[activeWorkoutDay.id] || []).length})
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Poste uma foto registrando seu treino concluído neste dia (mural por dia de treino ao longo das datas).
                              </p>
                            </div>

                            <MediaAttachmentPicker
                              triggerLabel="Postar Foto do Treino do Dia"
                              title={`Registrar Foto — ${activeWorkoutDay.title}`}
                              description="Envie ou capture uma foto do seu treino deste dia para acompanhar sua evolução."
                              onConfirmUpload={(captured) =>
                                handleUploadWorkoutDayPhoto(activeWorkoutDay, captured)
                              }
                            />
                          </div>

                          {(workoutPhotosByDayId[activeWorkoutDay.id] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Nenhuma foto postada para este dia de treino ainda. Clique em &ldquo;Postar Foto do Treino do Dia&rdquo; após finalizar sua sessão!
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {(workoutPhotosByDayId[activeWorkoutDay.id] || []).map((photo) => (
                                <div
                                  key={photo.id}
                                  className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs flex flex-col justify-between"
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.caption}
                                    className="h-32 w-full object-cover"
                                  />
                                  <div className="p-2.5 flex items-start justify-between gap-1.5">
                                    <div className="min-w-0">
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-800"
                                      >
                                        {photo.log_date === todayIso ? `Hoje (${photo.log_date})` : photo.log_date}
                                      </Badge>
                                      <p className="text-xs font-medium text-foreground truncate mt-0.5">
                                        {photo.caption}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        handleDeleteWorkoutDayPhoto(activeWorkoutDay.id, photo)
                                      }
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                      title="Excluir foto do treino"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                        Dia de descanso ou recuperação ativa nesta semana.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lista de Exercícios do Dia com GIF em Português (Sem Cronômetro de Descanso) */}
                {activeWorkoutDay && (
                  <div className="space-y-3">
                    {(activeWorkoutDay.workout_exercises || []).map((we: any, idx: number) => {
                      const ex = we.exercises
                      if (!ex) return null
                      const log = workoutLogsByExId[we.id]
                      const isDone = log?.completed ?? false
                      const loadVal = log?.load_kg ?? Number(we.load_kg || 0)
                      const repsVal = log?.reps ?? (parseInt(String(we.reps), 10) || 10)

                      return (
                        <Card
                          key={we.id}
                          className={`rounded-2xl transition-all ${
                            isDone ? 'border-indigo-300 bg-indigo-50/20' : 'border-border'
                          }`}
                        >
                          <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5">
                              {/* Componente de GIF / Animação em Português */}
                              <ExercisePreview
                                namePt={ex.name_pt}
                                muscleGroup={ex.muscle_group}
                                secondaryMuscles={ex.secondary_muscles || []}
                                equipment={ex.equipment}
                                level={ex.level}
                                instructionsPt={ex.instructions_pt || []}
                                frameUrls={ex.frame_urls || []}
                                gifUrl={ex.gif_url}
                              />

                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className="text-xs font-bold text-indigo-700">
                                    #{idx + 1}
                                  </Badge>
                                  <h4
                                    className={`font-display font-bold text-base ${
                                      isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                                    }`}
                                  >
                                    {ex.name_pt}
                                  </h4>
                                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
                                    {MUSCLE_GROUP_LABEL[ex.muscle_group] || ex.muscle_group}
                                  </Badge>
                                  <Badge variant="outline" className="text-[11px]">
                                    {ex.equipment}
                                  </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>
                                    <strong className="text-foreground">{we.sets}</strong> séries
                                  </span>
                                  <span>•</span>
                                  <span>
                                    <strong className="text-foreground">{we.reps}</strong> repetições
                                  </span>
                                </div>

                                {we.notes && (
                                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1 inline-block mt-1">
                                    💡 {we.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Controles de Repetições Executadas e Conclusão (Sem Cronômetro e Sem Campo de Carga) */}
                            <div className="flex flex-wrap items-end gap-2.5">
                              <div className="space-y-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">Reps Feitas</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={repsVal}
                                  onChange={(e) => handleToggleExercise(we, loadVal, Number(e.target.value))}
                                  className="w-24 h-9 font-bold"
                                />
                              </div>
                              <Button
                                type="button"
                                variant={isDone ? 'default' : 'outline'}
                                onClick={() => handleToggleExercise(we)}
                                className={`h-9 gap-1.5 ${
                                  isDone ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{isDone ? 'Concluído' : 'Marcar Feito'}</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ==================== ABA 3: MINHA EVOLUÇÃO (SEM DIGITAÇÃO EXCESSIVA) ==================== */}
          <TabsContent value="progress" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Check-in Rápido de Peso com Slider + Stepper */}
              <Card className="lg:col-span-5 rounded-2xl border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-600 text-white gap-1">
                      <Sparkles className="w-3 h-3" />
                      Zero Digitação
                    </Badge>
                    <Scale className="w-5 h-5 text-emerald-600" />
                  </div>
                  <CardTitle className="font-display text-base mt-1">
                    Check-in Rápido de Peso Corporal
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Deslize ou toque nos botões de ajuste fino para registrar seu peso de hoje em 1 segundo
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-white border border-emerald-200 p-4 text-center space-y-3">
                    <div className="font-display font-extrabold text-4xl text-slate-900">
                      {quickWeight.toFixed(1)} <span className="text-base font-normal text-muted-foreground">kg</span>
                    </div>

                    <Slider
                      value={[quickWeight]}
                      min={35}
                      max={180}
                      step={0.1}
                      onValueChange={(v) => setQuickWeight(+v[0].toFixed(1))}
                      className="py-2"
                    />

                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickWeight((w) => +(w - 0.5).toFixed(1))}
                      >
                        -0,5 kg
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Diminuir peso em 0,1 kg"
                        onClick={() => setQuickWeight((w) => +(w - 0.1).toFixed(1))}
                        className="gap-0.5"
                      >
                        <Minus className="w-3 h-3" />
                        0,1
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Aumentar peso em 0,1 kg"
                        onClick={() => setQuickWeight((w) => +(w + 0.1).toFixed(1))}
                        className="gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        0,1
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickWeight((w) => +(w + 0.5).toFixed(1))}
                      >
                        +0,5 kg
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={savingWeight}
                    onClick={handleQuickWeightCheckin}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {savingWeight ? 'Salvando...' : `Registrar ${quickWeight.toFixed(1)} kg Hoje`}
                  </Button>
                </CardContent>
              </Card>

              {/* Indicadores Clínicos da Última Avaliação Antropométrica */}
              <Card className="lg:col-span-7 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base">
                    Composição Corporal & Índices Clínicos
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Resultados calculados pelo seu nutricionista na última avaliação antropométrica
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {latestAssessment ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <span className="text-xs text-muted-foreground">% de Gordura</span>
                          <div className="font-display font-extrabold text-xl text-emerald-700">
                            {latestAssessment.results?.bodyFatPct ?? '—'}%
                          </div>
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {latestAssessment.results?.bodyFatCategory || 'Avaliado'}
                          </Badge>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <span className="text-xs text-muted-foreground">Massa Livre de Gordura</span>
                          <div className="font-display font-extrabold text-xl text-indigo-700">
                            {latestAssessment.results?.leanMassKg ?? '—'} kg
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            FFMI: {latestAssessment.results?.ffmi ?? '—'} kg/m²
                          </span>
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <span className="text-xs text-muted-foreground">Massa Gorda</span>
                          <div className="font-display font-extrabold text-xl text-amber-700">
                            {latestAssessment.results?.fatMassKg ?? '—'} kg
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            RCQ: {latestAssessment.results?.whr ?? '—'} ({latestAssessment.results?.whrRisk || 'Normal'})
                          </span>
                        </div>
                      </div>

                      <div className="h-56 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                            <RechartsTooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="peso"
                              name="Peso (kg)"
                              stroke="#059669"
                              strokeWidth={2.5}
                              dot={{ r: 4 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="gordura"
                              name="% Gordura"
                              stroke="#4F46E5"
                              strokeWidth={2.5}
                              dot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sua primeira avaliação antropométrica detalhada aparecerá aqui assim que registrada pelo nutricionista.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Comparativo de Perimetria (Início vs Atual) */}
            {latestAssessment?.circumferences && initialAssessment?.circumferences && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-emerald-600" />
                    <span>Evolução de Circunferências Corporais (Início vs Atual)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {CIRCUMFERENCE_FIELDS.filter((f) => latestAssessment.circumferences[f.key] != null).map((field) => {
                    const initVal = Number(
                      initialAssessment.circumferences[field.key] ?? latestAssessment.circumferences[field.key],
                    )
                    const currVal = Number(latestAssessment.circumferences[field.key])
                    const diff = +(currVal - initVal).toFixed(1)
                    const good = field.betterDown ? diff <= 0 : diff >= 0
                    return (
                      <div key={field.key} className="rounded-xl border border-border p-3 space-y-1">
                        <span className="text-xs font-semibold text-foreground">{field.label}</span>
                        <div className="flex items-baseline justify-between">
                          <strong className="font-display text-lg">{currVal.toFixed(1)} cm</strong>
                          <Badge
                            variant="secondary"
                            className={`text-[11px] ${
                              good ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff} cm
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground block">
                          Inicial: {initVal.toFixed(1)} cm
                        </span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== ABA 4: ASSISTÊNCIA WHATSAPP (NUTRI & SUPORTE DO SISTEMA) ==================== */}
          <TabsContent value="whatsapp" className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Seletor de Canal & Mensagem Pronta */}
              <Card className="lg:col-span-7 rounded-2xl">
                <CardHeader>
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-600" />
                    <span>Central de Assistência Integrada ao WhatsApp</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Escolha se deseja falar com seu Nutricionista (dúvidas sobre dieta, treino e evolução) ou com o Suporte Técnico do Sistema MyLabs.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Escolha do Destinatário */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSupportKind('nutritionist')
                        const first = WHATSAPP_TEMPLATES.find((t) => t.kind === 'nutritionist')!
                        setSelectedTemplateId(first.id)
                        setCustomMessage(first.prompt)
                      }}
                      className={`text-left rounded-2xl border p-4 transition-all space-y-1.5 ${
                        supportKind === 'nutritionist'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-border bg-card hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-600 text-white">Canal Clínico</Badge>
                        <Stethoscope className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="font-display font-bold text-sm text-foreground">
                        Falar com Meu Nutricionista
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {nutritionistProfile?.full_name || 'Dra. Camila Rocha'} •{' '}
                        {formatWhatsappDisplay(nutritionistProfile?.whatsapp)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSupportKind('system')
                        const first = WHATSAPP_TEMPLATES.find((t) => t.kind === 'system')!
                        setSelectedTemplateId(first.id)
                        setCustomMessage(first.prompt)
                      }}
                      className={`text-left rounded-2xl border p-4 transition-all space-y-1.5 ${
                        supportKind === 'system'
                          ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-border bg-card hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge className="bg-amber-600 text-white">Suporte do Sistema</Badge>
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="font-display font-bold text-sm text-foreground">
                        Problema Técnico no Sistema MyLabs
                      </div>
                      <p className="text-xs text-muted-foreground">
                        WhatsApp do Suporte: {formatWhatsappDisplay(systemWhatsapp)}
                      </p>
                    </button>
                  </div>

                  {/* Modelos de Mensagem Pronta */}
                  <div className="space-y-2">
                    <Label>Selecione o Motivo (Mensagem Pronta de Assistência)</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={(val) => {
                        setSelectedTemplateId(val)
                        const tpl = WHATSAPP_TEMPLATES.find((t) => t.id === val)
                        if (tpl) setCustomMessage(tpl.prompt)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um modelo pronto" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTemplates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id}>
                            {tpl.label} ({tpl.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp-custom-msg">Personalizar Detalhes do Pedido</Label>
                    <Textarea
                      id="whatsapp-custom-msg"
                      rows={3}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      disabled={sendingSupport}
                      onClick={handleSendWhatsappSupport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>
                        {supportKind === 'nutritionist'
                          ? 'Enviar para o WhatsApp do Nutricionista'
                          : 'Enviar para o WhatsApp do Suporte do Sistema'}
                      </span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard?.writeText(readyWhatsappText)
                        toast.success('Mensagem pronta copiada para a área de transferência!')
                      }}
                      className="gap-1.5"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copiar Mensagem</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Pré-visualização da Mensagem Pronta & Histórico */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-display text-sm">
                      Pré-visualização da Mensagem Pronta no WhatsApp
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Destino: <strong>{formatWhatsappDisplay(targetPhone)}</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs whitespace-pre-wrap font-sans bg-white border border-emerald-200 rounded-xl p-3.5 text-slate-800 leading-relaxed shadow-2xs">
                      {readyWhatsappText}
                    </pre>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-display text-sm">Meus Pedidos Recentes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {supportHistory.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum pedido enviado ainda.
                      </p>
                    ) : (
                      supportHistory.map((req) => (
                        <div
                          key={req.id}
                          className="rounded-xl border border-border p-2.5 text-xs flex items-start justify-between gap-2"
                        >
                          <div>
                            <div className="font-semibold text-foreground">
                              {req.kind === 'nutritionist' ? '🩺 Nutricionista' : '🛠️ Suporte Sistema'} •{' '}
                              {req.category}
                            </div>
                            <p className="text-muted-foreground line-clamp-2 mt-0.5">{req.message}</p>
                          </div>
                          <Badge variant={req.status === 'resolved' ? 'default' : 'secondary'}>
                            {req.status === 'resolved' ? 'Atendido' : 'Enviado'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Substituição Equivalente TACO (Com imagem ilustrativa em cada alimento) */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Substituição Equivalente (Tabela TACO)
            </DialogTitle>
            <DialogDescription>
              {swapItem && (
                <>
                  Substituindo <strong>{swapItem.food.name}</strong> ({swapItem.grams}g) preservando o grupo alimentar (
                  {FOOD_GROUP_LABELS[swapItem.food.food_group] || swapItem.food.food_group}).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {swapItem &&
              getSmartFoodEquivalents(swapItem.food, swapItem.grams, foods).map((eq) => (
                <div
                  key={eq.food.id}
                  className="rounded-xl border border-border p-3 flex items-center justify-between gap-3 hover:border-emerald-400 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FoodThumb
                      name={eq.food.name}
                      foodGroup={eq.food.food_group}
                      imageUrl={eq.food.image_url}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">
                        {eq.food.name}{' '}
                        <span className="text-emerald-700">({eq.grams}g)</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {eq.macros.kcal} kcal • P: {eq.macros.p}g • C: {eq.macros.c}g • G: {eq.macros.g}g
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleApplyFoodSwap(eq.food.id, eq.grams)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    Escolher
                  </Button>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-xs px-3 py-2 rounded-xl shadow-lg">
          Sincronizando dados clínicos...
        </div>
      )}
    </AppShell>
  )
}
