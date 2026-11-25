import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, getSignedOrPublicUrl } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  BodyMapSvg,
  type BodyRegionFilter,
  QuickMeasurementControl,
} from '@/components/shared/BodyMapSvg'
import { MediaAttachmentPicker, type CapturedMediaFile } from '@/components/shared/MediaAttachmentPicker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ANTHROPOMETRY_PROTOCOLS,
  type AnthropometryProtocolId,
  CIRCUMFERENCE_FIELDS,
  type CircumferencesMap,
  computeAnthropometry,
  SKINFOLD_FIELDS,
  type SkinfoldsMap,
} from '@/domain/anthropometry'
import {
  ACTIVITY_FACTORS,
  type ActivityLevel,
  computeBmr,
  ENERGY_EQUATIONS,
  tdee,
} from '@/domain/energy'
import { evaluateFormula, FORMULA_VARIABLES } from '@/domain/formula'
import {
  Activity,
  BookOpen,
  Calculator,
  CheckCircle2,
  FlaskConical,
  History,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
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

interface AnthropometrySectionProps {
  clientId: string
  clientName: string
  clientMeta: {
    sex: 'male' | 'female'
    age: number
    heightCm: number
    weightKg: number
    activityLevel: ActivityLevel
  }
  onAssessmentSaved?: () => void
}

export function AnthropometrySection({
  clientId,
  clientName,
  clientMeta,
  onAssessmentSaved,
}: AnthropometrySectionProps) {
  const { profile } = useAuth()
  const [assessments, setAssessments] = useState<any[]>([])
  const [customFormulas, setCustomFormulas] = useState<any[]>([])

  // Guided interactive assessment state (pre-filled from last assessment!)
  const [protocol, setProtocol] = useState<AnthropometryProtocolId>('jackson_pollock_3')
  const [weightKg, setWeightKg] = useState<number>(clientMeta.weightKg || 78)
  const [heightCm, setHeightCm] = useState<number>(clientMeta.heightCm || 175)
  const [directBfPct, setDirectBfPct] = useState<number>(16.5)
  const [regionFilter, setRegionFilter] = useState<BodyRegionFilter>('all')
  const [onlyProtocolFields, setOnlyProtocolFields] = useState<boolean>(true)
  const [skinfolds, setSkinfolds] = useState<SkinfoldsMap>({
    chest: 10,
    midaxillary: 11,
    triceps: 10,
    biceps: 6,
    subscapular: 13,
    abdomen: 18,
    suprailiac: 14,
    thigh: 14,
  })
  const [circumferences, setCircumferences] = useState<CircumferencesMap>({
    neck: 39,
    shoulders: 120,
    chest: 103,
    waist: 83.5,
    abdomen: 85.5,
    hip: 99.5,
    armRight: 38.4,
    armLeft: 38.2,
    forearmRight: 29,
    thighRight: 59.2,
    thighLeft: 59.0,
    calfRight: 39.2,
  })
  const [photoPaths, setPhotoPaths] = useState<string[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [clinicalNotes, setClinicalNotes] = useState<string>('')
  const [savingAssessment, setSavingAssessment] = useState(false)

  // Custom Formula Builder state
  const [formulaName, setFormulaName] = useState('')
  const [formulaCategory, setFormulaCategory] = useState<'energy' | 'body_composition' | 'other'>('energy')
  const [formulaExpr, setFormulaExpr] = useState('500 + 22 * massa_magra + 1.5 * peso')
  const [formulaUnit, setFormulaUnit] = useState('kcal/dia')
  const [formulaRef, setFormulaRef] = useState('Protocolo Clínico Personalizado')
  const [formulaDesc, setFormulaDesc] = useState('')
  const [savingFormula, setSavingFormula] = useState(false)

  const loadData = useCallback(async () => {
    if (!clientId) return
    const [{ data: aRows }, { data: fRows }] = await Promise.all([
      supabase
        .from('anthropometry_assessments')
        .select('*')
        .eq('client_id', clientId)
        .order('assessed_at', { ascending: true }),
      supabase.from('custom_formulas').select('*').order('created_at', { ascending: false }),
    ])

    const list = aRows || []
    setAssessments(list)
    setCustomFormulas(fRows || [])

    if (list.length > 0) {
      const latest = list[list.length - 1] as any
      if (latest.weight_kg) setWeightKg(Number(latest.weight_kg))
      if (latest.height_cm) setHeightCm(Number(latest.height_cm))
      if (latest.protocol) setProtocol(latest.protocol as AnthropometryProtocolId)
      if (latest.skinfolds && typeof latest.skinfolds === 'object') {
        setSkinfolds((prev) => ({ ...prev, ...(latest.skinfolds as Record<string, number>) }))
      }
      if (latest.circumferences && typeof latest.circumferences === 'object') {
        setCircumferences((prev) => ({ ...prev, ...(latest.circumferences as Record<string, number>) }))
      }
      if (latest.results?.bodyFatPct) {
        setDirectBfPct(Number(latest.results.bodyFatPct))
      }
      if (latest.notes) {
        setClinicalNotes(latest.notes)
      }
      if (latest.photo_paths?.length > 0) {
        setPhotoPaths(latest.photo_paths)
        const urls = await Promise.all(
          latest.photo_paths.map((p: string) => getSignedOrPublicUrl('progress-photos', p)),
        )
        setPhotoUrls(urls.filter(Boolean))
      } else {
        setPhotoPaths([])
        setPhotoUrls([])
      }
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const previousAssessment = assessments.length > 0 ? assessments[assessments.length - 1] : null
  const initialAssessment = assessments.length > 0 ? assessments[0] : null

  const activeProtocolMeta = useMemo(
    () => ANTHROPOMETRY_PROTOCOLS.find((p) => p.id === protocol) || ANTHROPOMETRY_PROTOCOLS[0],
    [protocol],
  )

  const requiredSkinfolds = useMemo(
    () => activeProtocolMeta.requiredSkinfolds(clientMeta.sex),
    [activeProtocolMeta, clientMeta.sex],
  )

  const requiredCircumferences = useMemo(
    () => activeProtocolMeta.requiredCircumferences(clientMeta.sex),
    [activeProtocolMeta, clientMeta.sex],
  )

  const liveResults = useMemo(
    () =>
      computeAnthropometry({
        protocol,
        sex: clientMeta.sex,
        age: clientMeta.age,
        weightKg,
        heightCm,
        skinfolds,
        circumferences,
        directBodyFatPct: directBfPct,
      }),
    [protocol, clientMeta.sex, clientMeta.age, weightKg, heightCm, skinfolds, circumferences, directBfPct],
  )

  const visibleSkinfoldFields = useMemo(() => {
    return SKINFOLD_FIELDS.filter((f) => {
      const regionMatch = regionFilter === 'all' || f.region === regionFilter
      const protocolMatch = !onlyProtocolFields || requiredSkinfolds.includes(f.key)
      return regionMatch && protocolMatch
    })
  }, [regionFilter, onlyProtocolFields, requiredSkinfolds])

  const visibleCircumferenceFields = useMemo(() => {
    return CIRCUMFERENCE_FIELDS.filter((f) => {
      const regionMatch = regionFilter === 'all' || f.region === regionFilter
      const protocolMatch = !onlyProtocolFields || requiredCircumferences.includes(f.key)
      return regionMatch && protocolMatch
    })
  }, [regionFilter, onlyProtocolFields, requiredCircumferences])

  const handleUploadProgressPhoto = async (captured: CapturedMediaFile) => {
    const ext = captured.file.name.split('.').pop() || 'jpg'
    const path = `${clientId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('progress-photos')
      .upload(path, captured.file, { upsert: true, contentType: captured.file.type })
    if (error) throw error
    const url = await getSignedOrPublicUrl('progress-photos', path)
    setPhotoPaths((prev) => [...prev, path])
    if (url) setPhotoUrls((prev) => [...prev, url])
    toast.success('Foto de evolução anexada à avaliação!')
  }

  const handleSaveAssessment = async () => {
    if (!profile?.id || !clientId) return
    setSavingAssessment(true)
    try {
      const { error } = await supabase.from('anthropometry_assessments').insert({
        client_id: clientId,
        assessed_by: profile.id,
        weight_kg: weightKg,
        height_cm: heightCm,
        protocol,
        skinfolds: skinfolds as any,
        circumferences: circumferences as any,
        results: liveResults as any,
        photo_paths: photoPaths,
        notes: clinicalNotes.trim() || null,
      })
      if (error) throw error

      await supabase
        .from('clients')
        .update({ height_cm: heightCm, clinical_notes: clinicalNotes.trim() || null })
        .eq('id', clientId)

      toast.success('Avaliação antropométrica registrada com sucesso!')
      await loadData()
      onAssessmentSaved?.()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar avaliação.')
    } finally {
      setSavingAssessment(false)
    }
  }

  // Variables map for custom formulas on the active client
  const currentClientVars = useMemo<Record<string, number>>(
    () => ({
      peso: weightKg,
      altura: heightCm,
      idade: clientMeta.age,
      sexo: clientMeta.sex === 'male' ? 1 : 0,
      massa_magra: liveResults.leanMassKg,
      gordura_pct: liveResults.bodyFatPct,
      soma_dobras: liveResults.sumSkinfoldsMm,
      cintura: Number(circumferences.waist) || 82,
      quadril: Number(circumferences.hip) || 99,
      pescoco: Number(circumferences.neck) || 38,
      braco: Number(circumferences.armRight) || 36,
      coxa: Number(circumferences.thighRight) || 58,
      imc: liveResults.bmi,
      fator_atividade: ACTIVITY_FACTORS[clientMeta.activityLevel]?.factor || 1.55,
    }),
    [weightKg, heightCm, clientMeta, liveResults, circumferences],
  )

  const formulaPreview = useMemo(() => {
    try {
      const val = evaluateFormula(formulaExpr, currentClientVars)
      return { ok: true as const, value: val }
    } catch (err: any) {
      return { ok: false as const, error: err?.message || 'Expressão inválida' }
    }
  }, [formulaExpr, currentClientVars])

  const handleSaveCustomFormula = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    if (!formulaName.trim()) {
      toast.error('Dê um nome ao cálculo personalizado.')
      return
    }
    if (!formulaPreview.ok) {
      toast.error(`Corrija a fórmula antes de salvar: ${formulaPreview.error}`)
      return
    }
    setSavingFormula(true)
    try {
      const { error } = await supabase.from('custom_formulas').insert({
        owner_id: profile.id,
        name: formulaName.trim(),
        category: formulaCategory,
        expression: formulaExpr.trim(),
        unit: formulaUnit.trim() || 'kcal',
        reference: formulaRef.trim() || null,
        description: formulaDesc.trim() || null,
      })
      if (error) throw error
      toast.success(`Novo cálculo "${formulaName}" cadastrado com sucesso!`)
      setFormulaName('')
      setFormulaDesc('')
      loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cadastrar cálculo.')
    } finally {
      setSavingFormula(false)
    }
  }

  const handleDeleteCustomFormula = async (id: string) => {
    await supabase.from('custom_formulas').delete().eq('id', id)
    toast.info('Fórmula personalizada removida.')
    loadData()
  }

  const chartData = useMemo(() => {
    const rows = assessments.map((a) => ({
      data: a.assessed_at.slice(5),
      peso: Number(a.weight_kg) || 0,
      gordura: Number(a.results?.bodyFatPct) || 0,
      massaMagra: Number(a.results?.leanMassKg) || 0,
    }))
    // Append live preview point
    rows.push({
      data: 'Hoje (Preview)',
      peso: weightKg,
      gordura: liveResults.bodyFatPct,
      massaMagra: liveResults.leanMassKg,
    })
    return rows
  }, [assessments, weightKg, liveResults])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="guided-assessment" className="space-y-5">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 h-auto p-1.5 rounded-2xl bg-muted">
          <TabsTrigger value="guided-assessment" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Avaliação Antropométrica Guiada</span>
          </TabsTrigger>
          <TabsTrigger value="scientific-lab" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
            <FlaskConical className="w-4 h-4 text-indigo-600" />
            <span>Cálculos Científicos & Novas Fórmulas</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================== SUB-ABA 1: AVALIAÇÃO ANTROPOMÉTRICA GUIADA ==================== */}
        <TabsContent value="guided-assessment" className="space-y-5">
          {/* Barra Superior: Seleção de Protocolo Científico e Pré-preenchimento */}
          <Card className="rounded-2xl border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50">
            <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-600 text-white gap-1">
                    <Sparkles className="w-3 h-3" />
                    Pré-preenchido com a Última Avaliação
                  </Badge>
                  <Badge variant="outline">{activeProtocolMeta.reference}</Badge>
                </div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Evolução Antropométrica Profissional — {clientName}
                </h3>
                <p className="text-xs text-muted-foreground">{activeProtocolMeta.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-64">
                  <Label className="text-[11px] text-muted-foreground">Protocolo de Composição Corporal</Label>
                  <Select value={protocol} onValueChange={(v) => setProtocol(v as AnthropometryProtocolId)}>
                    <SelectTrigger className="bg-white font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANTHROPOMETRY_PROTOCOLS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 mt-4">
                  <Switch
                    id="only-protocol-switch"
                    checked={onlyProtocolFields}
                    onCheckedChange={setOnlyProtocolFields}
                  />
                  <Label htmlFor="only-protocol-switch" className="text-xs cursor-pointer">
                    Focar medidas do protocolo
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Coluna Esquerda: Mapa Anatômico SVG Interativo + Peso/Altura */}
            <div className="lg:col-span-4 space-y-4">
              <BodyMapSvg
                activeRegion={regionFilter}
                onSelectRegion={setRegionFilter}
                sex={clientMeta.sex}
                bodyFatPct={liveResults.bodyFatPct}
                leanMassKg={liveResults.leanMassKg}
                fatMassKg={liveResults.fatMassKg}
                skinfolds={skinfolds}
                circumferences={circumferences}
                requiredSkinfolds={requiredSkinfolds}
              />

              {/* Filtro Rápido por Região Corporal */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'all', label: 'Corpo Todo' },
                  { id: 'trunk', label: 'Tronco' },
                  { id: 'upper_limb', label: 'Braços' },
                  { id: 'lower_limb', label: 'Pernas' },
                ].map((r) => (
                  <Button
                    key={r.id}
                    type="button"
                    size="sm"
                    variant={regionFilter === r.id ? 'default' : 'outline'}
                    onClick={() => setRegionFilter(r.id as BodyRegionFilter)}
                    className={`text-xs h-8 ${
                      regionFilter === r.id ? 'bg-slate-900 text-white' : ''
                    }`}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>

              <QuickMeasurementControl
                label="Peso Corporal Atual"
                unit="kg"
                value={weightKg}
                previousValue={previousAssessment?.weight_kg ? Number(previousAssessment.weight_kg) : undefined}
                min={35}
                max={200}
                step={0.2}
                betterDown
                highlighted
                onChange={setWeightKg}
              />

              <QuickMeasurementControl
                label="Estatura"
                unit="cm"
                value={heightCm}
                min={120}
                max={220}
                step={0.5}
                betterDown={false}
                onChange={setHeightCm}
              />

              {protocol === 'bioimpedance' && (
                <QuickMeasurementControl
                  label="% de Gordura (Bioimpedância Direta)"
                  hint="Valor obtido na balança octapolar (InBody / Tanita)"
                  unit="%"
                  value={directBfPct}
                  min={4}
                  max={55}
                  step={0.2}
                  betterDown
                  highlighted
                  onChange={setDirectBfPct}
                />
              )}
            </div>

            {/* Coluna Central e Direita: Controles Deslizantes de Dobras e Circunferências (Sem Digitação!) */}
            <div className="lg:col-span-8 space-y-5">
              {/* Resultados Clínicos Calculados ao Vivo */}
              <Card className="rounded-2xl border-border">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-base">
                      Laudo Antropométrico Calculado em Tempo Real
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Qualquer ajuste nos controles abaixo recalcula instantaneamente a densidade corporal (Siri) e os índices da OMS
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    className="gap-1.5 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Última</span>
                  </Button>
                </CardHeader>

                <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <span className="text-muted-foreground block">% Gordura</span>
                    <strong className="font-display text-lg text-emerald-700">
                      {liveResults.bodyFatPct}%
                    </strong>
                    <span className="text-[10px] text-emerald-800 block mt-0.5">
                      {liveResults.bodyFatCategory}
                    </span>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                    <span className="text-muted-foreground block">Massa Magra</span>
                    <strong className="font-display text-lg text-indigo-700">
                      {liveResults.leanMassKg} kg
                    </strong>
                    <span className="text-[10px] text-indigo-800 block mt-0.5">
                      FFMI: {liveResults.ffmi} kg/m²
                    </span>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <span className="text-muted-foreground block">Massa Gorda</span>
                    <strong className="font-display text-lg text-amber-800">
                      {liveResults.fatMassKg} kg
                    </strong>
                    <span className="text-[10px] text-amber-900 block mt-0.5">
                      Σ Dobras: {liveResults.sumSkinfoldsMm} mm
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <span className="text-muted-foreground block">IMC (OMS)</span>
                    <strong className="font-display text-lg">{liveResults.bmi}</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {liveResults.bmiCategory}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <span className="text-muted-foreground block">RCQ (Cint/Quad)</span>
                    <strong className="font-display text-lg">{liveResults.whr ?? '—'}</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {liveResults.whrRisk}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <span className="text-muted-foreground block">RCEst (Cint/Est)</span>
                    <strong className="font-display text-lg">{liveResults.whtr ?? '—'}</strong>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {liveResults.whtr && liveResults.whtr < 0.5 ? 'Saudável (<0.5)' : 'Atenção (≥0.5)'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Dobras Cutâneas (mm) — Somente se o protocolo utilizar dobras */}
              {visibleSkinfoldFields.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-bold text-sm text-slate-900">
                      Dobras Cutâneas (mm) — Deslize ou ajuste em 1 toque
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      Soma atual: {liveResults.sumSkinfoldsMm} mm
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleSkinfoldFields.map((field) => (
                      <QuickMeasurementControl
                        key={field.key}
                        label={`Dobra ${field.label}`}
                        hint={field.anatomicalHint}
                        unit="mm"
                        value={Number(skinfolds[field.key] ?? field.defaultVal)}
                        previousValue={
                          previousAssessment?.skinfolds?.[field.key] != null
                            ? Number(previousAssessment.skinfolds[field.key])
                            : undefined
                        }
                        min={field.min}
                        max={field.max}
                        step={0.5}
                        betterDown
                        highlighted={requiredSkinfolds.includes(field.key)}
                        onChange={(val) =>
                          setSkinfolds((prev) => ({ ...prev, [field.key]: val }))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Perimetria / Circunferências (cm) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-sm text-slate-900">
                    Perimetria & Circunferências Corporais (cm)
                  </h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOnlyProtocolFields((v) => !v)}
                    className="h-7 text-xs text-emerald-700"
                  >
                    {onlyProtocolFields ? 'Mostrar todas as 12 circunferências' : 'Resumir medidas'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleCircumferenceFields.map((field) => (
                    <QuickMeasurementControl
                      key={field.key}
                      label={field.label}
                      hint={field.anatomicalHint}
                      unit="cm"
                      value={Number(circumferences[field.key] ?? field.defaultVal)}
                      previousValue={
                        previousAssessment?.circumferences?.[field.key] != null
                          ? Number(previousAssessment.circumferences[field.key])
                          : undefined
                      }
                      min={field.min}
                      max={field.max}
                      step={0.5}
                      betterDown={field.betterDown}
                      highlighted={requiredCircumferences.includes(field.key)}
                      onChange={(val) =>
                        setCircumferences((prev) => ({ ...prev, [field.key]: val }))
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Fotos de Evolução (Upload + Câmera) & Notas Clínicas */}
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-display font-bold text-sm">
                        Fotos Comparativas de Evolução & Parecer Clínico
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Anexe fotos padronizadas (frente, perfil, costas) ou capture agora com a câmera
                      </p>
                    </div>
                    <MediaAttachmentPicker
                      triggerLabel="Anexar Foto de Evolução / Câmera"
                      onConfirmUpload={handleUploadProgressPhoto}
                    />
                  </div>

                  {photoUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {photoUrls.map((u, i) => (
                        <img
                          key={i}
                          src={u}
                          alt={`Evolução ${i + 1}`}
                          className="h-28 w-full object-cover rounded-xl border border-border"
                        />
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="assess-clinical-notes">Parecer Clínico do Prontuário</Label>
                    <Textarea
                      id="assess-clinical-notes"
                      rows={2}
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Registre a interpretação clínica desta avaliação antropométrica..."
                    />
                  </div>

                  <Button
                    type="button"
                    disabled={savingAssessment}
                    onClick={handleSaveAssessment}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {savingAssessment
                        ? 'Salvando Avaliação no Prontuário...'
                        : `Salvar Avaliação Antropométrica (${weightKg.toFixed(1)} kg • ${liveResults.bodyFatPct}% G)`}
                    </span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Gráfico Clínico de Evolução e Histórico Comparativo */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <span>Curva Longitudinal de Composição Corporal ({assessments.length} avaliações)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Evolução de Peso Total (kg), Massa Livre de Gordura (kg) e Percentual de Gordura (%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="peso"
                      name="Peso Total (kg)"
                      stroke="#059669"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="massaMagra"
                      name="Massa Magra (kg)"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="gordura"
                      name="% Gordura"
                      stroke="#D97706"
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {initialAssessment && previousAssessment && (
                <div className="rounded-xl bg-muted/40 border border-border p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Delta Peso Total</span>
                    <strong className="text-sm font-display">
                      {(weightKg - Number(initialAssessment.weight_kg)).toFixed(1)} kg desde o início
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Delta % Gordura</span>
                    <strong className="text-sm font-display text-emerald-700">
                      {(liveResults.bodyFatPct - Number(initialAssessment.results?.bodyFatPct || liveResults.bodyFatPct)).toFixed(1)}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Delta Cintura</span>
                    <strong className="text-sm font-display text-emerald-700">
                      {(
                        Number(circumferences.waist || 0) -
                        Number(initialAssessment.circumferences?.waist || circumferences.waist || 0)
                      ).toFixed(1)}{' '}
                      cm
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Delta Braço Direito</span>
                    <strong className="text-sm font-display text-indigo-700">
                      {(
                        Number(circumferences.armRight || 0) -
                        Number(initialAssessment.circumferences?.armRight || circumferences.armRight || 0)
                      ).toFixed(1)}{' '}
                      cm
                    </strong>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SUB-ABA 2: LABORATÓRIO DE CÁLCULOS CIENTÍFICOS & NOVAS FÓRMULAS ==================== */}
        <TabsContent value="scientific-lab" className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Comparativo de Equações Científicas */}
            <Card className="lg:col-span-6 rounded-2xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white">Literatura Científica</Badge>
                  <Badge variant="outline">Fator Atividade: {ACTIVITY_FACTORS[clientMeta.activityLevel]?.factor}x</Badge>
                </div>
                <CardTitle className="font-display text-base mt-1 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>Equações Científicas Consagradas — {clientName}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Comparativo simultâneo das equações preditivas aplicadas aos dados atuais do paciente ({weightKg} kg, {heightCm} cm, {clientMeta.age} anos, MLG {liveResults.leanMassKg} kg)
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2.5">
                {ENERGY_EQUATIONS.map((eq) => {
                  const bmr = Math.round(
                    computeBmr(eq.id, {
                      sex: clientMeta.sex,
                      weightKg,
                      heightCm,
                      age: clientMeta.age,
                      leanMassKg: liveResults.leanMassKg,
                    }),
                  )
                  const getVal = Math.round(
                    tdee(bmr, ACTIVITY_FACTORS[clientMeta.activityLevel]?.factor || 1.55),
                  )
                  return (
                    <div
                      key={eq.id}
                      className="rounded-xl border border-border p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-display font-bold text-sm text-foreground">{eq.label}</div>
                        <div className="text-[11px] text-emerald-700 font-medium">{eq.reference}</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{eq.note}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">
                          TMB: <strong className="text-foreground">{bmr} kcal</strong>
                        </div>
                        <div className="text-sm font-display font-extrabold text-emerald-700">
                          GET: {getVal} kcal
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Construtor de Novo Tipo de Cálculo Personalizado */}
            <Card className="lg:col-span-6 rounded-2xl border-indigo-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white">Laboratório MyLabs</Badge>
                  <Badge variant="outline">Parser Matemático Seguro</Badge>
                </div>
                <CardTitle className="font-display text-base mt-1 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  <span>Cadastrar Novo Tipo de Cálculo Clínico</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Crie suas próprias equações preditivas clicando nas variáveis clínicas abaixo e valide o resultado em tempo real para o paciente ativo.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <form onSubmit={handleSaveCustomFormula} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2 space-y-1">
                      <Label>Nome do Novo Cálculo *</Label>
                      <Input
                        required
                        placeholder="Ex: TMB Atleta Hipertrofia (Owen Modificada)"
                        value={formulaName}
                        onChange={(e) => setFormulaName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Categoria</Label>
                      <Select value={formulaCategory} onValueChange={(v) => setFormulaCategory(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="energy">Gasto Energético</SelectItem>
                          <SelectItem value="body_composition">Composição Corporal</SelectItem>
                          <SelectItem value="other">Índice Clínico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Pílulas de Variáveis Clínicas Clicáveis */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Clique em uma variável para inserir na fórmula (valores atuais de {clientName}):
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {FORMULA_VARIABLES.map((v) => (
                        <Button
                          key={v.key}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFormulaExpr((prev) => `${prev} + ${v.key}`)}
                          className="h-7 px-2 text-[11px] font-mono bg-muted/40 hover:bg-indigo-50 hover:border-indigo-300"
                          title={`${v.label} (${v.unit})`}
                        >
                          {v.key}={currentClientVars[v.key]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Expressão Matemática (suporta +, -, *, /, ^, sqrt, log10, ln, round) *</Label>
                    <Input
                      required
                      value={formulaExpr}
                      onChange={(e) => setFormulaExpr(e.target.value)}
                      className="font-mono text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label>Unidade do Resultado</Label>
                      <Input
                        placeholder="Ex: kcal/dia, %, kg"
                        value={formulaUnit}
                        onChange={(e) => setFormulaUnit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Referência Científica / Autor</Label>
                      <Input
                        placeholder="Ex: Owen et al., 1987"
                        value={formulaRef}
                        onChange={(e) => setFormulaRef(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Resultado em Tempo Real */}
                  <div
                    className={`rounded-xl border p-3 flex items-center justify-between ${
                      formulaPreview.ok
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : 'border-destructive/40 bg-destructive/10'
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      {formulaPreview.ok
                        ? `Resultado ao vivo para ${clientName}:`
                        : `Erro na expressão: ${formulaPreview.error}`}
                    </span>
                    {formulaPreview.ok && (
                      <strong className="font-display font-extrabold text-lg text-emerald-800">
                        {formulaPreview.value} {formulaUnit}
                      </strong>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={savingFormula || !formulaPreview.ok}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{savingFormula ? 'Salvando Fórmula...' : 'Cadastrar Novo Tipo de Cálculo'}</span>
                  </Button>
                </form>

                {/* Lista de Cálculos Cadastrados pelo Nutricionista */}
                {customFormulas.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Meus Cálculos Personalizados Cadastrados ({customFormulas.length})
                    </span>
                    {customFormulas.map((cf) => {
                      let val: string | number = '—'
                      try {
                        val = evaluateFormula(cf.expression, currentClientVars)
                      } catch {
                        val = 'Erro'
                      }
                      return (
                        <div
                          key={cf.id}
                          className="rounded-xl border border-border p-3 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-foreground">{cf.name}</div>
                            <code className="text-[11px] text-indigo-700">{cf.expression}</code>
                            {cf.reference && (
                              <span className="block text-[10px] text-muted-foreground">{cf.reference}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white text-xs">
                              {val} {cf.unit}
                            </Badge>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Excluir cálculo ${cf.name}`}
                              onClick={() => handleDeleteCustomFormula(cf.id)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
