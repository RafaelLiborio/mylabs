import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getSignedOrPublicUrl, translateErrorPt } from '@/lib/supabase'
import { sanitizeHttpUrl } from '@/lib/fileValidation'
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
import { Calendar, Camera, Copy, Dumbbell, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
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
  const [dayPhotosByDayId, setDayPhotosByDayId] = useState<
    Record<string, { id: string; log_date: string; caption: string; url: string }[]>
  >({})

  // Week & Weekday navigation
  const [selectedWeek, setSelectedWeek] = useState<number>(1)
  const [selectedWeekday, setSelectedWeekday] = useState<number>(1)
  const lastDayKeyRef = useRef<string>('')

  // Day metadata form
  const [dayTitle, setDayTitle] = useState('Treino A - Peitoral, Ombros & Tríceps')
  const [dayMuscleGroups, setDayMuscleGroups] = useState<string[]>(['peito', 'ombros', 'triceps'])

  // Exercise filter & prescription form (NO load_kg field, and preserves muscleFilter on save!)
  const [muscleFilter, setMuscleFilter] = useState<string>('peito')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('')
  const [sets, setSets] = useState<number>(4)
  const [reps, setReps] = useState<string>('10-12')
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

    setExercises(exCatalog || [])

    let activeWp = wPlans?.[0] || null
    if (!activeWp && profile?.id) {
      const { data: createdWp } = await supabase
        .from('workout_plans')
        .insert({
          client_id: clientId,
          nutritionist_id: profile.id,
          name: `Periodização de Treino - ${clientName}`,
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

      const dayIds = sorted.map((d: any) => d.id)
      if (dayIds.length > 0) {
        const { data: photoRows } = await supabase
          .from('workout_day_photos')
          .select('*')
          .in('workout_day_id', dayIds)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false })

        const grouped: Record<string, { id: string; log_date: string; caption: string; url: string }[]> = {}
        for (const r of photoRows || []) {
          const url = await getSignedOrPublicUrl('client-diary-photos', r.storage_path)
          if (!url) continue
          if (!grouped[r.workout_day_id]) grouped[r.workout_day_id] = []
          grouped[r.workout_day_id].push({
            id: r.id,
            log_date: r.log_date,
            caption: r.caption || 'Foto do treino do dia',
            url,
          })
        }
        setDayPhotosByDayId(grouped)
      } else {
        setDayPhotosByDayId({})
      }
    }
  }, [clientId, clientName, profile?.id])

  useEffect(() => {
    lastDayKeyRef.current = ''
    loadWorkoutData()
  }, [loadWorkoutData])

  const activeDay = useMemo(
    () => days.find((d) => d.week === selectedWeek && d.weekday === selectedWeekday) || null,
    [days, selectedWeek, selectedWeekday],
  )

  // Sync dayTitle and dayMuscleGroups ONLY when the user switches (clientId, selectedWeek, selectedWeekday)
  // NEVER reset muscleFilter when adding an exercise to the current day!
  useEffect(() => {
    const key = `${clientId}:${selectedWeek}:${selectedWeekday}:${activeDay?.id || 'empty'}`
    if (lastDayKeyRef.current === key) return
    const switchedDayOrWeek = !lastDayKeyRef.current.startsWith(`${clientId}:${selectedWeek}:${selectedWeekday}:`)
    lastDayKeyRef.current = key

    if (activeDay) {
      setDayTitle(activeDay.title)
      setDayMuscleGroups(activeDay.muscle_groups || [])
      if (switchedDayOrWeek && activeDay.muscle_groups?.length > 0) {
        setMuscleFilter(activeDay.muscle_groups[0])
      }
    } else {
      const wdName = WEEKDAYS.find((w) => w.id === selectedWeekday)?.full || 'Dia'
      setDayTitle(`Treino de ${wdName} (Semana ${selectedWeek})`)
    }
  }, [clientId, activeDay, selectedWeekday, selectedWeek])

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
    const currentMuscle = selectedExerciseObj?.muscle_group
    const updatedGroups =
      currentMuscle && !dayMuscleGroups.includes(currentMuscle)
        ? [...dayMuscleGroups, currentMuscle]
        : dayMuscleGroups

    if (updatedGroups !== dayMuscleGroups) {
      setDayMuscleGroups(updatedGroups)
    }

    if (activeDay) {
      await supabase
        .from('workout_days')
        .update({ title: dayTitle, muscle_groups: updatedGroups })
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
        muscle_groups: updatedGroups,
      })
      .select('id')
      .single()
    if (error || !data) {
      toast.error(translateErrorPt(error))
      return null
    }
    return data.id
  }

  const handlePrescribeExercise = async () => {
    if (!selectedExerciseObj) {
      toast.error('Selecione um exercício do catálogo.')
      return
    }
    const preservedFilter = muscleFilter
    const preservedExerciseId = selectedExerciseObj.id

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
      load_kg: null,
      notes: exNotes.trim() || null,
    })

    if (error) {
      toast.error(translateErrorPt(error))
      return
    }
    toast.success(`"${selectedExerciseObj.name_pt}" prescrito para Semana ${selectedWeek}!`)
    await loadWorkoutData()
    // Explicitly preserve active filter and selected exercise
    setMuscleFilter(preservedFilter)
    setSelectedExerciseId(preservedExerciseId)
  }

  const handleRemovePrescribedExercise = async (weId: string) => {
    const preservedFilter = muscleFilter
    await supabase.from('workout_exercises').delete().eq('id', weId)
    toast.info('Exercício removido do dia.')
    await loadWorkoutData()
    setMuscleFilter(preservedFilter)
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
    const rawGifUrl = customExGifUrl.trim()
    const safeGifUrl = rawGifUrl ? sanitizeHttpUrl(rawGifUrl) : null
    if (rawGifUrl && !safeGifUrl) {
      toast.error('URL da demonstração inválida. Use um endereço HTTPS válido.')
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
        gif_url: safeGifUrl,
        frame_urls: safeGifUrl ? [safeGifUrl] : [],
        owner_id: profile.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      toast.error(translateErrorPt(error))
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
              {plan?.name || `Periodização de Treino - ${clientName}`}
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
              onClick={() => {
                setCustomExMuscle((muscleFilter !== 'all' ? muscleFilter : 'peito') as MuscleGroupId)
                setCustomExOpen(true)
              }}
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

      {/* 2. TOPO (Largura Total): Prescrever Exercício por Agrupamento (em cima da Ficha do Dia para maior espaço!) */}
      <Card className="rounded-2xl border-indigo-200/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-indigo-600" />
                <span>Prescrever Exercício por Agrupamento Muscular</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione o grupamento muscular específico, visualize o GIF animado em português e adicione à ficha abaixo (o filtro selecionado é mantido após adicionar).
              </CardDescription>
            </div>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">
              Filtro ativo: {muscleFilter === 'all' ? 'Todos os Agrupamentos' : MUSCLE_GROUP_LABEL[muscleFilter] || muscleFilter}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Esquerda do Card Superior: Filtros + Lista Espaçosa do Catálogo */}
            <div className="lg:col-span-7 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                  <Input
                    placeholder="Buscar exercício em PT-BR..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-border border border-border rounded-xl bg-white">
                {filteredCatalog.map((ex) => {
                  const isSelected = selectedExerciseObj?.id === ex.id
                  return (
                    <div
                      key={ex.id}
                      className={`p-3 flex items-center justify-between gap-3 text-xs transition ${
                        isSelected ? 'bg-indigo-50/90 font-semibold' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
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
                          <div className="font-bold text-sm text-foreground">{ex.name_pt}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {MUSCLE_GROUP_LABEL[ex.muscle_group] || ex.muscle_group} • {ex.equipment}
                          </div>
                        </button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => setSelectedExerciseId(ex.id)}
                        className={`h-8 px-3 text-xs shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : ''
                        }`}
                      >
                        {isSelected ? 'Selecionado' : 'Selecionar'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Direita do Card Superior: Exercício Selecionado + Séries & Repetições (Sem campo de Carga!) */}
            <div className="lg:col-span-5">
              {selectedExerciseObj ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <ExercisePreview
                      namePt={selectedExerciseObj.name_pt}
                      muscleGroup={selectedExerciseObj.muscle_group}
                      secondaryMuscles={selectedExerciseObj.secondary_muscles || []}
                      equipment={selectedExerciseObj.equipment}
                      level={selectedExerciseObj.level}
                      instructionsPt={selectedExerciseObj.instructions_pt || []}
                      frameUrls={selectedExerciseObj.frame_urls || []}
                      gifUrl={selectedExerciseObj.gif_url}
                    />
                    <div className="space-y-1">
                      <Badge className="bg-indigo-600 text-white text-[10px]">
                        {MUSCLE_GROUP_LABEL[selectedExerciseObj.muscle_group] || selectedExerciseObj.muscle_group}
                      </Badge>
                      <div className="font-display font-bold text-base text-indigo-950">
                        {selectedExerciseObj.name_pt}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {selectedExerciseObj.instructions_pt?.[0] ||
                          'Clique no GIF para ver o passo a passo completo em português.'}
                      </p>
                    </div>
                  </div>

                  {/* Apenas Séries e Repetições (Campo de Carga removido conforme solicitado) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Séries</Label>
                      <Input
                        type="number"
                        min={1}
                        max={15}
                        value={sets}
                        onChange={(e) => setSets(Number(e.target.value))}
                        className="bg-white h-9 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Repetições / Tempo</Label>
                      <Input
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        placeholder="Ex: 10-12 ou 45s"
                        className="bg-white h-9 font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Observação Biomecânica / Cadência</Label>
                    <Input
                      value={exNotes}
                      onChange={(e) => setExNotes(e.target.value)}
                      className="bg-white h-9 text-xs"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handlePrescribeExercise}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 h-10"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Incluir na {WEEKDAYS.find((w) => w.id === selectedWeekday)?.full} (Semana {selectedWeek})
                    </span>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Selecione um exercício ao lado para configurar séries e repetições.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. EMBAIXO (Largura Total): Ficha do Dia para Visualização Ampla dos Itens */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
          {dayMuscleGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {dayMuscleGroups.map((mg) => (
                <Badge key={mg} variant="secondary" className="text-xs">
                  {MUSCLE_GROUP_LABEL[mg] || mg}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {!activeDay || (activeDay.workout_exercises || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">Nenhum exercício prescrito para este dia</p>
              <p className="text-xs text-muted-foreground">
                Selecione um exercício com GIF no painel acima e clique em "Incluir" para montar a ficha deste dia.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(activeDay.workout_exercises || []).map((we: any, idx: number) => {
                const ex = we.exercises
                if (!ex) return null
                return (
                  <div
                    key={we.id}
                    className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3.5 hover:border-indigo-300 transition shadow-2xs"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
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

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs font-bold text-indigo-700">
                            #{idx + 1}
                          </Badge>
                          <h4 className="font-display font-bold text-base text-foreground">
                            {ex.name_pt}
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px]">
                            {MUSCLE_GROUP_LABEL[ex.muscle_group] || ex.muscle_group}
                          </Badge>
                          <Badge variant="outline" className="text-[11px]">
                            {ex.equipment}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                          <span>
                            <strong className="text-foreground">{we.sets}</strong> séries
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-foreground">{we.reps}</strong> repetições
                          </span>
                        </div>

                        {we.notes && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1">
                            Obs.: {we.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remover ${ex.name_pt} da ficha`}
                      onClick={() => handleRemovePrescribedExercise(we.id)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Remover exercício"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Fotos do Treino do Dia postadas pelo paciente */}
          {activeDay && (dayPhotosByDayId[activeDay.id] || []).length > 0 && (
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>
                  Fotos Postadas pelo Paciente neste Dia de Treino ({(dayPhotosByDayId[activeDay.id] || []).length})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(dayPhotosByDayId[activeDay.id] || []).map((photo) => (
                  <div
                    key={photo.id}
                    className="rounded-xl border border-border bg-white overflow-hidden shadow-2xs"
                  >
                    <img src={photo.url} alt={photo.caption} className="h-28 w-full object-cover" />
                    <div className="p-2">
                      <span className="text-[10px] font-bold text-indigo-700 block">
                        {photo.log_date}
                      </span>
                      <span className="text-xs text-foreground truncate block">
                        {photo.caption}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
