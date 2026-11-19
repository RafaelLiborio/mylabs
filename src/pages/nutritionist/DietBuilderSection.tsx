import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getSignedOrPublicUrl } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { MediaAttachmentPicker, type CapturedMediaFile } from '@/components/shared/MediaAttachmentPicker'
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
  suggestMacros,
  tdee,
} from '@/domain/energy'
import { calcFoodPortionMacros, FOOD_GROUP_LABELS, type FoodItemMacro } from '@/domain/nutrition'
import {
  Calculator,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Minus,
  Plus,
  Search,
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

  // Add Food modal (TACO + Custom Food creation)
  const [addFoodOpen, setAddFoodOpen] = useState(false)
  const [targetMealId, setTargetMealId] = useState<string>('')
  const [foodSearch, setFoodSearch] = useState('')
  const [foodGroupFilter, setFoodGroupFilter] = useState('all')
  const [selectedFoodId, setSelectedFoodId] = useState<string>('')
  const [foodGrams, setFoodGrams] = useState<number>(120)

  // New Diet Plan modal
  const [newPlanOpen, setNewPlanOpen] = useState(false)
  const [newPlanName, setNewPlanName] = useState('Dia de Descanso / Low Carb')
  const [newPlanKind, setNewPlanKind] = useState<'training' | 'rest' | 'standard'>('rest')

  const loadPlansAndFoods = useCallback(async () => {
    if (!clientId) return
    const [{ data: fList }, { data: pList }] = await Promise.all([
      supabase.from('foods').select('id, name, food_group, protein_g, carb_g, fat_g, fiber_g').order('name'),
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

    setMeals(
      (mRows || []).map((m: any) => ({
        ...m,
        diet_meal_items: (m.diet_meal_items || []).sort((a: any, b: any) => a.position - b.position),
      })),
    )

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

  // Scientific calculation result
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
      toast.error('Erro ao aplicar metas científicas.')
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
        kcal_target: scientificCalc.kcal,
        protein_target_g: scientificCalc.proteinG,
        carb_target_g: scientificCalc.carbG,
        fat_target_g: scientificCalc.fatG,
        active: true,
      })
      .select('id')
      .single()

    if (error || !data) {
      toast.error(error?.message || 'Erro ao criar plano alimentar.')
      return
    }

    // Create 3 starter meals automatically
    await supabase.from('diet_meals').insert([
      { plan_id: data.id, name: 'Café da Manhã', meal_time: '07:30', position: 1 },
      { plan_id: data.id, name: 'Almoço', meal_time: '12:30', position: 2 },
      { plan_id: data.id, name: 'Jantar', meal_time: '20:00', position: 3 },
    ])

    toast.success('Novo plano alimentar criado!')
    setNewPlanOpen(false)
    await loadPlansAndFoods()
    setSelectedPlanId(data.id)
  }

  const handleAddMeal = async () => {
    if (!activePlan) return
    const { error } = await supabase.from('diet_meals').insert({
      plan_id: activePlan.id,
      name: newMealName.trim() || 'Refeição',
      meal_time: newMealTime || '12:00',
      position: meals.length + 1,
      notes: newMealNotes.trim() || null,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Refeição adicionada ao plano!')
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
    if (!targetMealId || !selectedFoodId) return
    const { error } = await supabase.from('diet_meal_items').insert({
      meal_id: targetMealId,
      food_id: selectedFoodId,
      grams: Math.max(5, foodGrams),
      position: 99,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Alimento incluído na refeição!')
    setAddFoodOpen(false)
    if (activePlan) loadMealsAndAttachments(activePlan.id)
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

  const totals = useMemo(() => {
    let p = 0
    let c = 0
    let g = 0
    let kcal = 0
    for (const m of meals) {
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
  }, [meals])

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
              <Label className="text-xs">Proteína Alvo (g/kg — ISSN)</Label>
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
              <Label className="text-xs">Lipídios (% kcal — DRI/IOM)</Label>
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

      {/* 2. Seletor de Plano Alimentar, Progresso de Macros e Anexos Visuais / Câmera */}
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
            {/* Comparativo Prescrito vs Meta */}
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

      {/* 3. Cards de Refeições do Plano */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meals.map((meal) => {
          const mealTotals = (meal.diet_meal_items || []).reduce(
            (acc: any, it: any) => {
              if (!it.foods) return acc
              const m = calcFoodPortionMacros(it.foods, Number(it.grams))
              return { p: acc.p + m.p, c: acc.c + m.c, g: acc.g + m.g, kcal: acc.kcal + m.kcal }
            },
            { p: 0, c: 0, g: 0, kcal: 0 },
          )

          return (
            <Card key={meal.id} className="rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-display text-base">{meal.name}</CardTitle>
                    {meal.meal_time && (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {String(meal.meal_time).slice(0, 5)}
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

              <CardContent className="space-y-2">
                {(meal.diet_meal_items || []).map((it: any) => {
                  const food = it.foods as FoodItemMacro | undefined
                  if (!food) return null
                  const mac = calcFoodPortionMacros(food, Number(it.grams))
                  return (
                    <div
                      key={it.id}
                      className="rounded-xl border border-border p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-[140px]">
                        <div className="font-semibold text-foreground">{food.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {mac.kcal} kcal • P: {mac.p}g • C: {mac.c}g • G: {mac.g}g
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
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
                          onClick={() => handleUpdateGrams(it.id, Number(it.grams) + 10)}
                          className="h-7 w-7"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveFoodItem(it.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Modal: Adicionar Alimento TACO */}
      <Dialog open={addFoodOpen} onOpenChange={setAddFoodOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-600" />
              <span>Adicionar Alimento da Tabela TACO</span>
            </DialogTitle>
            <DialogDescription>
              Pesquise entre os 62+ alimentos brasileiros padronizados por 100g e ajuste a porção.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
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
                const isSelected = selectedFoodObj?.id === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFoodId(f.id)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition ${
                      isSelected ? 'bg-emerald-50 font-semibold text-emerald-950' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div>
                      <div>{f.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {FOOD_GROUP_LABELS[f.food_group] || f.food_group} • Por 100g: P {f.protein_g}g | C{' '}
                        {f.carb_g}g | G {f.fat_g}g
                      </div>
                    </div>
                    {isSelected && <Badge className="bg-emerald-600 text-white">Selecionado</Badge>}
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
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-foreground">
                        {selectedFoodObj.name} ({foodGrams}g)
                      </div>
                      <div className="text-emerald-700 font-semibold">
                        {preview.kcal} kcal • P: {preview.p}g • C: {preview.c}g • G: {preview.g}g
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
              onClick={handleConfirmAddFood}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Incluir na Refeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Nova Refeição */}
      <Dialog open={newMealOpen} onOpenChange={setNewMealOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Nova Refeição</DialogTitle>
            <DialogDescription>Adicione um horário de refeição ao protocolo ativo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome da Refeição</Label>
              <Input value={newMealName} onChange={(e) => setNewMealName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Horário Sugerido</Label>
              <Input type="time" value={newMealTime} onChange={(e) => setNewMealTime(e.target.value)} />
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
              Crie variações como Dia de Treino, Dia de Descanso ou Carb Cycling.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome do Protocolo</Label>
              <Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} />
            </div>
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
