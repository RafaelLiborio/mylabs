import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getSignedOrPublicUrl } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ExercisePreview } from '@/components/shared/ExercisePreview'
import { MediaAttachmentPicker, type CapturedMediaFile } from '@/components/shared/MediaAttachmentPicker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { MUSCLE_GROUP_LABEL, MUSCLE_GROUPS, type MuscleGroupId, WEEKDAYS } from '@/domain/workouts'
import { Calendar, Copy, Dumbbell, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface WorkoutBuilderSectionProps {
  clientId: string
  clientName: string
}

export function WorkoutBuilderSection({ clientId, clientName }: WorkoutBuilderSectionProps) {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState<any[]>([])
  const [plan, setPlan] = useState<any>(null)
  const [days, setDays] = useState<any[]>([])

  // Week & Weekday navigation
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [selectedWeekday, setSelectedWeekday] = useState<number>(1)

  // Day metadata form
  const [dayTitle, setDayTitle] = useState('Treino A — Peitoral, Ombros & Tríceps')
  const [dayMuscleGroups, setDayMuscleGroups] = useState<string[]>(['peito', 'ombros', 'triceps'])

  // Exercise filter & prescription form
  const [muscleFilter, setMuscleFilter] = useState<string>('peito')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [sets, setSets] = useState<number>(4)
  const [reps, setReps] = useState<string>('10-12')
  const [loadKg, setLoadKg] = useState<number>(25)
  const [exNotes, setExNotes] = useState<string>('Execução controlada com ênfase na fase excêntrica.')

  // Create custom exercise with GIF in Portuguese
  const [customExOpen, setCustomExOpen] = useState(false)
  const [customExName, setCustomExName] = useState('')
  const [customExMuscle, setCustomExMuscle] = useState<MuscleGroupId>('peito')
  const [customExEquipment, setCustomExEquipment] = useState('Halteres')
  const [customExGifUrl, setCustomExGifUrl] = useState('')
  const [customExInstructions, setCustomExInstructions] = useState(
    'Posicione-se com a coluna alinhada.\nExecute a fase concêntrica de forma firme.\nRetorne controlando o peso.',
  )

  const loadWorkoutData = useCallback(async () => {
    if (!clientId) return
    const [{ data: exCatalog }, { data: wPlans }] = await Promise.all([
      supabase.from('exercises').select('*').order('name_pt'),
      supabase
        .from('workout_plans')
        .select('*')
        .eq('client_id', clientId)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

    const allEx = exCatalog || []
    setExercises(allEx)

    let activeWp = wPlans?.[0] || null
    if (!activeWp && profile?.id) {
      const { data: createdWp } = await supabase
        .from('workout_plans')
        .insert({
          client_id: clientId,
          nutritionist_id: profile.id,
          name: `Periodização de Treino — ${clientName}`,
          weeks: 4,
          notes: 'Treino estruturado por semana, dia e agrupamentos musculares.',
          active: true,
        })
        .select('*')
        .single()
      activeWp = createdWp
    }

    setPlan(activeWp)
    if (activeWp) {
      const { data: dRows } = await supabase
        .from('workout_days')
        .select('*, workout_exercises(*, exercises(*))')
        .eq('plan_id', activeWp.id)
        .order('week')
        .order('weekday')

      const sorted = (dRows || []).map((d: any) => ({
        ...d,
        workout_exercises: (d.workout_exercises || []).sort((a: any, b: any) => a.position - b.position),
      }))
      setDays(sorted)
    }
  }, [clientId, clientName, profile?.id])

  useEffect(() => {
    loadWorkoutData()
  }, [loadWorkoutData])

  const activeDay = useMemo(
    () => days.find((d) => d.week === selectedWeek && d.weekday === selectedWeekday) || null,
    [days, selectedWeek, selectedWeekday],
  )

  useEffect(() => {
    if (activeDay) {
      setDayTitle(activeDay.title)
      setDayMuscleGroups(activeDay.muscle_groups || [])
      if (activeDay.muscle_groups?.length > 0) {
        setMuscleFilter(activeDay.muscle_groups[0])
      }
    } else {
      const wdName = WEEKDAYS.find((w) => w.id === selectedWeekday)?.full || 'Dia'
      setDayTitle(`Treino de ${wdName} (Semana ${selectedWeek})`)
    }
  }, [activeDay, selectedWeekday, selectedWeek])

  const filteredCatalog = useMemo(() => {
    return exercises.filter((ex) => {
      const matchMuscle = muscleFilter === 'all' || ex.muscle_group === muscleFilter
      const matchSearch =
        !searchQuery || ex.name_pt.toLowerCase().includes(searchQuery.toLowerCase())
      return matchMuscle && matchSearch
    })
  }, [exercises, muscleFilter, searchQuery])

  useEffect(() => {
    if (filteredCatalog.length > 0 && !filteredCatalog.some((e) => e.id === selectedExerciseId)) {
      setSelectedExerciseId(filteredCatalog[0].id)
    }
  }, [filteredCatalog, selectedExerciseId])

  const selectedExerciseObj = useMemo(
    () => exercises.find((e) => e.id === selectedExerciseId) || filteredCatalog[0] || null,
    [exercises, selectedExerciseId, filteredCatalog],
  )

  const handleToggleDayMuscleGroup = async (mgId: string) => {
    const exists = dayMuscleGroups.includes(mgId)
    const next = exists ? dayMuscleGroups.filter((x) => x !== mgId) : [...dayMuscleGroups, mgId]
    setDayMuscleGroups(next)
    setMuscleFilter(mgId)

    if (activeDay) {
      await supabase
        .from('workout_days')
        .update({ muscle_groups: next, title: dayTitle })
        .eq('id', activeDay.id)
      loadWorkoutData()
    }
  }

  const ensureActiveDayRow = async (): Promise<string | null> => {
    if (activeDay) {
      await supabase
        .from('workout_days')
        .update({ title: dayTitle, muscle_groups: dayMuscleGroups })
        .eq('id', activeDay.id)
      return activeDay.id
    }
    if (!plan) return null
    const { data, error } = await supabase
      .from('workout_days')
      .insert({
        plan_id: plan.id,
        week: selectedWeek,
        weekday: selectedWeekday,
        title: dayTitle.trim() || `Treino Semana ${selectedWeek}`,
        muscle_groups: dayMuscleGroups,
      })
      .select('id')
      .single()
    if (error || !data) {
      toast.error(error?.message || 'Erro ao criar dia de treino.')
      return null
    }
    return data.id
  }

  const handlePrescribeExercise = async () => {
    if (!selectedExerciseObj) {
      toast.error('Selecione um exercício do catálogo.')
      return
    }
    const dayId = await ensureActiveDayRow()
    if (!dayId) return

    const currentCount = activeDay?.workout_exercises?.length || 0
    const { error } = await supabase.from('workout_exercises').insert({
      day_id: dayId,
      exercise_id: selectedExerciseObj.id,
      position: currentCount + 1,
      sets: Math.max(1, sets),
      reps: reps.trim() || '10',
      rest_sec: 60,
      load_kg: loadKg,
      notes: exNotes.trim() || null,
    })

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`"${selectedExerciseObj.name_pt}" prescrito para Semana ${selectedWeek}!`)
    loadWorkoutData()
  }

  const handleRemovePrescribedExercise = async (weId: string) => {
    await supabase.from('workout_exercises').delete().eq('id', weId)
    toast.info('Exercício removido do dia.')
    loadWorkoutData()
  }

  const handleCopyWeekToNext = async () => {
    if (!plan) return
    const nextWeek = selectedWeek < (plan.weeks || 4) ? selectedWeek + 1 : 1
    const sourceDays = days.filter((d) => d.week === selectedWeek)
    if (sourceDays.length === 0) {
      toast.error('Esta semana ainda não possui treinos para copiar.')
      return
    }

    for (const sd of sourceDays) {
      // Remove existing day on target week if present
      await supabase
        .from('workout_days')
        .delete()
        .eq('plan_id', plan.id)
        .eq('week', nextWeek)
        .eq('weekday', sd.weekday)

      const { data: newDay } = await supabase
        .from('workout_days')
        .insert({
          plan_id: plan.id,
          week: nextWeek,
          weekday: sd.weekday,
          title: sd.title,
          muscle_groups: sd.muscle_groups,
          notes: `Progressão da Semana ${selectedWeek}`,
        })
        .select('id')
        .single()

      if (newDay && sd.workout_exercises?.length > 0) {
        const items = sd.workout_exercises.map((we: any, idx: number) => ({
          day_id: newDay.id,
          exercise_id: we.exercise_id,
          position: idx + 1,
          sets: we.sets,
          reps: we.reps,
          rest_sec: we.rest_sec || 60,
          load_kg: we.load_kg,
          notes: we.notes,
        }))
        await supabase.from('workout_exercises').insert(items)
      }
    }

    toast.success(`Treinos da Semana ${selectedWeek} replicados para a Semana ${nextWeek}!`)
    setSelectedWeek(nextWeek)
    loadWorkoutData()
  }

  const handleUploadCustomExerciseGif = async (captured: CapturedMediaFile) => {
    if (!profile?.id) return
    const ext = captured.file.name.split('.').pop() || 'gif'
    const path = `${profile.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('exercise-media')
      .upload(path, captured.file, { upsert: true, contentType: captured.file.type })
    if (error) throw error
    const publicUrl = await getSignedOrPublicUrl('exercise-media', path)
    setCustomExGifUrl(publicUrl)
    toast.success('GIF/Imagem do exercício enviado com sucesso!')
  }

  const handleCreateCustomExercise = async () => {
    if (!customExName.trim() || !profile?.id) {
      toast.error('Informe o nome do exercício em português.')
      return
    }
    const steps = customExInstructions
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const { data, error } = await supabase
      .from('exercises')
      .insert({
        name_pt: customExName.trim(),
        muscle_group: customExMuscle,
        equipment: customExEquipment.trim() || 'Livre',
        level: 'intermediario',
        instructions_pt: steps,
        gif_url: customExGifUrl.trim() || null,
        frame_urls: customExGifUrl.trim() ? [customExGifUrl.trim()] : [],
        owner_id: profile.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      toast.error(error?.message || 'Erro ao cadastrar exercício.')
      return
    }
    toast.success(`Exercício "${customExName}" cadastrado no catálogo em português!`)
    setCustomExOpen(false)
    setCustomExName('')
    setCustomExGifUrl('')
    await loadWorkoutData()
    setMuscleFilter(customExMuscle)
    setSelectedExerciseId(data.id)
  }

  return (
    <div className="space-y-5">
      {/* 1. Navegador de Semanas e Dias da Semana */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white">Periodização por Semana & Dia</Badge>
              <Badge variant="outline">91+ Exercícios com GIF em Português</Badge>
            </div>
            <CardTitle className="font-display text-lg mt-1">
              {plan?.name || `Periodização de Treino — ${clientName}`}
            </CardTitle>
            <CardDescription className="text-xs">
              Separe os treinos por semana e dia da semana, defina os agrupamentos musculares do dia e prescreva exercícios com demonstração animada em português.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyWeekToNext}
              className="gap-1.5 text-xs"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              <span>Replicar Semana {selectedWeek}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCustomExOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Cadastrar Exercício + GIF</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Abas de Semana */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: plan?.weeks || 4 }, (_, i) => i + 1).map((wk) => (
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
            <span className="text-xs text-muted-foreground">
              Editando: <strong>Semana {selectedWeek}</strong> •{' '}
              <strong>{WEEKDAYS.find((w) => w.id === selectedWeekday)?.full}</strong>
            </span>
          </div>

          {/* Seletor dos 7 Dias da Semana */}
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((wd) => {
              const dayObj = days.find((d) => d.week === selectedWeek && d.weekday === wd.id)
              const isSelected = selectedWeekday === wd.id
              return (
                <Button
                  key={wd.id}
                  type="button"
                  variant={isSelected ? 'default' : dayObj ? 'secondary' : 'outline'}
                  onClick={() => setSelectedWeekday(wd.id)}
                  className={`h-auto py-2.5 flex flex-col items-center gap-0.5 rounded-xl ${
                    isSelected ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
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

          {/* Título do Dia & Seleção de Agrupamentos Musculares do Dia */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-indigo-950">
                  Título do Treino deste Dia (Semana {selectedWeek} •{' '}
                  {WEEKDAYS.find((w) => w.id === selectedWeekday)?.full})
                </Label>
                <Input
                  value={dayTitle}
                  onChange={(e) => setDayTitle(e.target.value)}
                  onBlur={async () => {
                    if (activeDay) {
                      await supabase.from('workout_days').update({ title: dayTitle }).eq('id', activeDay.id)
                      loadWorkoutData()
                    }
                  }}
                  className="bg-white font-semibold"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Clique nos agrupamentos musculares abaixo para definir o foco do dia e filtrar o catálogo de exercícios:
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {MUSCLE_GROUPS.map((mg) => {
                const active = dayMuscleGroups.includes(mg.id)
                return (
                  <Button
                    key={mg.id}
                    type="button"
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => handleToggleDayMuscleGroup(mg.id)}
                    className={`h-7 text-xs rounded-lg ${
                      active
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-white hover:border-indigo-300'
                    }`}
                  >
                    {mg.shortLabel}
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Construtor: Catálogo de Exercícios com GIF PT-BR (Esquerda) + Ficha do Dia (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna Esquerda: Catálogo de Exercícios por Agrupamento Muscular com GIF em Português */}
        <Card className="lg:col-span-5 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-indigo-600" />
              <span>Prescrever Exercício por Agrupamento</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Selecione o grupamento muscular específico e visualize o GIF animado em português
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select value={muscleFilter} onValueChange={setMuscleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Agrupamento muscular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Agrupamentos</SelectItem>
                  {MUSCLE_GROUPS.map((mg) => (
                    <SelectItem key={mg.id} value={mg.id}>
                      {mg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <Input
                  placeholder="Buscar exercício em PT-BR..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Lista de Exercícios com Mini-GIF (sem botões aninhados) */}
            <div className="max-h-60 overflow-y-auto divide-y divide-border border border-border rounded-xl">
              {filteredCatalog.map((ex) => {
                const isSelected = selectedExerciseObj?.id === ex.id
                return (
                  <div
                    key={ex.id}
                    className={`p-2.5 flex items-center justify-between gap-2.5 text-xs transition ${
                      isSelected ? 'bg-indigo-50/80 font-semibold' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <ExercisePreview
                        namePt={ex.name_pt}
                        muscleGroup={ex.muscle_group}
                        secondaryMuscles={ex.secondary_muscles || []}
                        equipment={ex.equipment}
                        level={ex.level}
                        instructionsPt={ex.instructions_pt || []}
                        frameUrls={ex.frame_urls || []}
                        gifUrl={ex.gif_url}
                        compact
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedExerciseId(ex.id)}
                        className="text-left flex-1 min-w-0 focus:outline-none"
                      >
                        <div className="font-bold text-foreground truncate">{ex.name_pt}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {MUSCLE_GROUP_LABEL[ex.muscle_group] || ex.muscle_group} • {ex.equipment}
                        </div>
                      </button>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedExerciseId(ex.id)}
                      className={`h-7 px-2.5 text-[11px] shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : ''
                      }`}
                    >
                      {isSelected ? 'Ativo' : 'Selecionar'}
                    </Button>
                  </div>
                )
              })}
            </div>

            {/* Preview do Exercício Selecionado + Parâmetros */}
            {selectedExerciseObj && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <ExercisePreview
                    namePt={selectedExerciseObj.name_pt}
                    muscleGroup={selectedExerciseObj.muscle_group}
                    secondaryMuscles={selectedExerciseObj.secondary_muscles || []}
                    equipment={selectedExerciseObj.equipment}
                    level={selectedExerciseObj.level}
                    instructionsPt={selectedExerciseObj.instructions_pt || []}
                    frameUrls={selectedExerciseObj.frame_urls || []}
                    gifUrl={selectedExerciseObj.gif_url}
                    compact
                  />
                  <div>
                    <div className="text-xs font-bold text-indigo-950">{selectedExerciseObj.name_pt}</div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {selectedExerciseObj.instructions_pt?.[0] || 'Clique no GIF para ver o passo a passo completo.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Séries</Label>
                    <Input
                      type="number"
                      min={1}
                      max={15}
                      value={sets}
                      onChange={(e) => setSets(Number(e.target.value))}
                      className="bg-white h-8 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Repetições</Label>
                    <Input
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      className="bg-white h-8 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Carga Alvo (kg)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={500}
                      value={loadKg}
                      onChange={(e) => setLoadKg(Number(e.target.value))}
                      className="bg-white h-8 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px]">Observação Biomecânica / Cadência</Label>
                  <Input
                    value={exNotes}
                    onChange={(e) => setExNotes(e.target.value)}
                    className="bg-white h-8 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handlePrescribeExercise}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Incluir na {WEEKDAYS.find((w) => w.id === selectedWeekday)?.full} (Semana {selectedWeek})
                  </span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna Direita: Exercícios Prescritos no Dia/Semana Selecionado */}
        <Card className="lg:col-span-7 rounded-2xl">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>
                  Ficha do Dia: {WEEKDAYS.find((w) => w.id === selectedWeekday)?.full} (Semana {selectedWeek})
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {activeDay?.title || dayTitle} • {activeDay?.workout_exercises?.length || 0} exercícios prescritos
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {!activeDay || (activeDay.workout_exercises || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold">Nenhum exercício prescrito para este dia</p>
                <p className="text-xs text-muted-foreground">
                  Selecione um exercício com GIF ao lado e clique em "Incluir" para montar o treino deste dia.
                </p>
              </div>
            ) : (
              (activeDay.workout_exercises || []).map((we: any, idx: number) => {
                const ex = we.exercises
                if (!ex) return null
                return (
                  <div
                    key={we.id}
                    className="rounded-2xl border border-border bg-card p-3.5 flex items-start justify-between gap-3 hover:border-indigo-200 transition"
                  >
                    <div className="flex items-start gap-3">
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs font-bold text-indigo-700">
                            #{idx + 1}
                          </Badge>
                          <h4 className="font-display font-bold text-sm sm:text-base text-foreground">
                            {ex.name_pt}
                          </h4>
                          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]">
                            {MUSCLE_GROUP_LABEL[ex.muscle_group] || ex.muscle_group}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            <strong className="text-foreground">{we.sets}</strong> séries
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-foreground">{we.reps}</strong> reps
                          </span>
                          <span>•</span>
                          <span>
                            Carga: <strong className="text-foreground">{we.load_kg || 0} kg</strong>
                          </span>
                        </div>

                        {we.notes && (
                          <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1">
                            💡 {we.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemovePrescribedExercise(we.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Remover exercício"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Cadastrar Novo Exercício em Português com GIF */}
      <Dialog open={customExOpen} onOpenChange={setCustomExOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Cadastrar Novo Exercício com GIF (PT-BR)</span>
            </DialogTitle>
            <DialogDescription>
              Adicione um exercício personalizado ao catálogo com GIF animado (envie arquivo ou cole a URL) e instruções em português.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome do Exercício (em Português) *</Label>
              <Input
                placeholder="Ex: Elevação Lateral na Polia Baixa"
                value={customExName}
                onChange={(e) => setCustomExName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Agrupamento Muscular *</Label>
                <Select value={customExMuscle} onValueChange={(v) => setCustomExMuscle(v as MuscleGroupId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((mg) => (
                      <SelectItem key={mg.id} value={mg.id}>
                        {mg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Equipamento</Label>
                <Input
                  value={customExEquipment}
                  onChange={(e) => setCustomExEquipment(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>GIF Animado de Exemplo (URL ou Upload)</Label>
                <MediaAttachmentPicker
                  triggerLabel="Enviar GIF / Câmera"
                  accept="image/gif,image/webp,image/png,image/jpeg"
                  onConfirmUpload={handleUploadCustomExerciseGif}
                />
              </div>
              <Input
                placeholder="https://exemplo.com/exercicio.gif"
                value={customExGifUrl}
                onChange={(e) => setCustomExGifUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Instruções Passo a Passo em Português (1 por linha)</Label>
              <Textarea
                rows={3}
                value={customExInstructions}
                onChange={(e) => setCustomExInstructions(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCustomExOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateCustomExercise}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Salvar Exercício no Catálogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
