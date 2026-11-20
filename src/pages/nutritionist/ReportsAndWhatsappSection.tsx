import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildWhatsappUrl,
  formatWhatsappDisplay,
  isValidWhatsapp,
  sanitizeWhatsappDigits,
} from '@/domain/whatsapp'
import { BRAZIL_STATES, joinCityState, splitCityState } from '@/domain/brazilStates'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Droplets,
  Dumbbell,
  ExternalLink,
  FileText,
  FlaskConical,
  MessageSquare,
  Phone,
  Printer,
  RefreshCw,
  Scale,
  Sparkles,
  Stethoscope,
  Utensils,
} from 'lucide-react'
import { toast } from 'sonner'

interface ReportsAndWhatsappSectionProps {
  clientId: string
  clientName: string
  clientWhatsapp?: string | null
  mode: 'reports' | 'whatsapp'
  onUnreadCountChange?: (count: number) => void
}

export function ReportsAndWhatsappSection({
  clientId,
  clientName,
  clientWhatsapp,
  mode,
  onUnreadCountChange,
}: ReportsAndWhatsappSectionProps) {
  const { profile, refreshProfile } = useAuth()

  // Schedule & Reports state
  const [intervalDays, setIntervalDays] = useState<number>(15)
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(true)
  const [nextRunOn, setNextRunOn] = useState<string>('')
  const [reports, setReports] = useState<any[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string>('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Nutritionist detailed profile & WhatsApp state
  const initialCityState = splitCityState(profile?.city_state)
  const [nutriName, setNutriName] = useState(profile?.full_name || '')
  const [nutriWhatsapp, setNutriWhatsapp] = useState(profile?.whatsapp || '')
  const [nutriCrn, setNutriCrn] = useState(profile?.crn || '')
  const [nutriCrnRegion, setNutriCrnRegion] = useState(profile?.crn_region || 'CRN-3 (SP, MS)')
  const [nutriSpecialty, setNutriSpecialty] = useState(
    profile?.specialty || 'Nutrição Esportiva & Composição Corporal',
  )
  const [nutriClinic, setNutriClinic] = useState(profile?.clinic_name || '')
  const [nutriCity, setNutriCity] = useState(initialCityState.city)
  const [nutriUf, setNutriUf] = useState(initialCityState.uf)
  const [nutriBio, setNutriBio] = useState(profile?.bio || '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [clientRequests, setClientRequests] = useState<any[]>([])

  useEffect(() => {
    if (profile) {
      const parsed = splitCityState(profile.city_state)
      setNutriName(profile.full_name || '')
      setNutriWhatsapp(profile.whatsapp || '')
      setNutriCrn(profile.crn || '')
      setNutriCrnRegion(profile.crn_region || 'CRN-3 (SP, MS)')
      setNutriSpecialty(profile.specialty || 'Nutrição Esportiva & Composição Corporal')
      setNutriClinic(profile.clinic_name || '')
      setNutriCity(parsed.city)
      setNutriUf(parsed.uf)
      setNutriBio(profile.bio || '')
    }
  }, [profile])

  const loadReportsData = useCallback(async () => {
    if (!clientId) return
    const [{ data: sched }, { data: repRows }, { data: reqRows }] = await Promise.all([
      supabase.from('report_schedules').select('*').eq('client_id', clientId).maybeSingle(),
      supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('support_requests')
        .select('*, profiles!support_requests_from_user_fkey(full_name, email, whatsapp)')
        .eq('kind', 'nutritionist')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (sched) {
      setIntervalDays(sched.interval_days)
      setScheduleEnabled(sched.enabled)
      setNextRunOn(sched.next_run_on)
    } else {
      const next = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
      setIntervalDays(15)
      setScheduleEnabled(true)
      setNextRunOn(next)
    }

    const rList = repRows || []
    setReports(rList)
    if (rList.length > 0) {
      setSelectedReportId((prev) =>
        prev && rList.some((r) => r.id === prev) ? prev : rList[0].id,
      )
    }
    const unread = rList.filter((r) => !r.read_at).length
    onUnreadCountChange?.(unread)
    setClientRequests(reqRows || [])
  }, [clientId, onUnreadCountChange])

  useEffect(() => {
    loadReportsData()
  }, [loadReportsData])

  const handleSaveSchedule = async () => {
    if (!clientId || !profile?.id) return
    setSavingSchedule(true)
    try {
      const days = Math.max(1, Math.min(365, intervalDays))
      const nextDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
      const { error } = await supabase.from('report_schedules').upsert({
        client_id: clientId,
        nutritionist_id: profile.id,
        interval_days: days,
        enabled: scheduleEnabled,
        next_run_on: nextDate,
      })
      if (error) throw error
      setNextRunOn(nextDate)
      toast.success(
        `Relatório automático programado a cada ${days} dias para ${clientName}!`,
      )
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar agendamento.')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleGenerateReportNow = async () => {
    if (!clientId) return
    setGeneratingReport(true)
    try {
      const { data: repId, error } = await supabase.rpc('generate_client_report', {
        p_client: clientId,
        p_days: intervalDays,
      })
      if (error) throw error
      toast.success(`Relatório profissional completo de ${clientName} gerado com sucesso!`)
      await loadReportsData()
      if (repId) setSelectedReportId(repId)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar relatório.')
    } finally {
      setGeneratingReport(false)
    }
  }

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null

  const handleMarkReportRead = async (rep: any) => {
    setSelectedReportId(rep.id)
    if (!rep.read_at) {
      await supabase.from('reports').update({ read_at: new Date().toISOString() }).eq('id', rep.id)
      loadReportsData()
    }
  }

  const handleSaveNutritionistProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    if (!isValidWhatsapp(nutriWhatsapp)) {
      toast.error('Informe um número de WhatsApp válido com DDD.')
      return
    }
    setSavingProfile(true)
    try {
      const cleanPhone = sanitizeWhatsappDigits(nutriWhatsapp)
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: nutriName.trim(),
          whatsapp: cleanPhone,
          crn: nutriCrn.trim() || null,
          crn_region: nutriCrnRegion || null,
          specialty: nutriSpecialty || null,
          clinic_name: nutriClinic.trim() || null,
          city_state: joinCityState(nutriCity, nutriUf),
          bio: nutriBio.trim() || null,
        })
        .eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Perfil profissional e WhatsApp de atendimento atualizados!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleResolveRequest = async (reqId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'resolved' ? 'sent' : 'resolved'
    await supabase.from('support_requests').update({ status: nextStatus }).eq('id', reqId)
    toast.success(nextStatus === 'resolved' ? 'Atendimento marcado como concluído!' : 'Reaberto.')
    loadReportsData()
  }

  // ==================== MODO 1: RELATÓRIOS PROFISSIONAIS ====================
  if (mode === 'reports') {
    const repData = activeReport?.data || null
    const reportWhatsappSummary = repData
      ? [
          `Olá, *${clientName}*! Segue o resumo do seu *Relatório Clínico MyLabs* (${activeReport.period_start} a ${activeReport.period_end}):`,
          `✅ *Adesão à Dieta:* ${repData.diet?.adherence_pct ?? 0}%`,
          `🏋️ *Execução dos Treinos:* ${repData.workout?.completion_pct ?? 0}%`,
          `💧 *Hidratação Média:* ${repData.water?.avg_ml ?? 0} mL/dia (Meta: ${repData.water?.goal_ml ?? 3000} mL)`,
          `⚖️ *Peso Atual:* ${repData.weight?.end ?? '—'} kg (Variação: ${repData.weight?.delta ?? 0} kg)`,
          repData.assessment?.results?.bodyFatPct
            ? `🧬 *Composição Corporal:* ${repData.assessment.results.bodyFatPct}% de gordura (${repData.assessment.results.leanMassKg} kg de massa magra)`
            : '',
          '',
          `Continue firme no protocolo! Qualquer dúvida estou à disposição.`,
        ]
          .filter(Boolean)
          .join('\n')
      : ''

    return (
      <div className="space-y-5">
        {/* Configuração do Ciclo Automático de Envio do Relatório */}
        <Card className="rounded-2xl border-emerald-200 bg-gradient-to-r from-emerald-50/60 via-white to-slate-50 no-print">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="font-display text-base">
                    Programação de Envio do Relatório Profissional — {clientName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    A partir do tempo estipulado abaixo, o sistema compila automaticamente todas as métricas de dieta, treino, água e antropometria e envia para sua caixa de relatórios.
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                disabled={generatingReport}
                onClick={handleGenerateReportNow}
                className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  {generatingReport ? 'Compilando Laudo...' : 'Gerar Relatório Completo Agora'}
                </span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end flex-1">
              <div className="space-y-1">
                <Label className="text-xs">Período Estipulado pelo Nutricionista</Label>
                <Select
                  value={String(intervalDays)}
                  onValueChange={(v) => setIntervalDays(Number(v))}
                >
                  <SelectTrigger className="bg-white font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">A cada 7 dias (Semanal)</SelectItem>
                    <SelectItem value="14">A cada 14 dias (Quinzenal)</SelectItem>
                    <SelectItem value="15">A cada 15 dias (Padrão Clínico)</SelectItem>
                    <SelectItem value="21">A cada 21 dias (3 Semanas)</SelectItem>
                    <SelectItem value="30">A cada 30 dias (Mensal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Ou Dias Personalizados</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className="bg-white font-bold"
                />
              </div>

              <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 h-9 self-end">
                <Switch
                  id="sched-enabled"
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                />
                <Label htmlFor="sched-enabled" className="text-xs cursor-pointer">
                  Envio Automático Ativo ({nextRunOn || 'Agendado'})
                </Label>
              </div>
            </div>

            <Button
              type="button"
              disabled={savingSchedule}
              onClick={handleSaveSchedule}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{savingSchedule ? 'Salvando...' : 'Salvar Período Estipulado'}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Lista de Relatórios & Visualizador do Laudo Profissional */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Caixa de Entrada de Relatórios */}
          <Card className="lg:col-span-4 rounded-2xl no-print">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-sm flex items-center justify-between">
                <span>Relatórios Recebidos ({reports.length})</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={loadReportsData}
                  className="h-7 w-7"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reports.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum relatório emitido ainda. Clique em "Gerar Relatório Completo Agora".
                </p>
              ) : (
                reports.map((rep) => {
                  const active = activeReport?.id === rep.id
                  return (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => handleMarkReportRead(rep)}
                      className={`w-full text-left rounded-xl border p-3 transition space-y-1 ${
                        active
                          ? 'border-emerald-500 bg-emerald-50/70'
                          : 'border-border bg-card hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={rep.generated_by === 'schedule' ? 'default' : 'secondary'}
                          className={
                            rep.generated_by === 'schedule' ? 'bg-emerald-600 text-white text-[10px]' : 'text-[10px]'
                          }
                        >
                          {rep.generated_by === 'schedule' ? 'Automático (Ciclo)' : 'Sob Demanda'}
                        </Badge>
                        {!rep.read_at && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                            Novo
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-foreground">
                        Período: {rep.period_start} a {rep.period_end}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Adesão Dieta: {rep.data?.diet?.adherence_pct ?? 0}% • Treinos:{' '}
                        {rep.data?.workout?.completion_pct ?? 0}%
                      </div>
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Visualizador do Relatório Clínico Completo */}
          <Card className="lg:col-span-8 rounded-2xl print-page overflow-hidden pt-0">
            {!activeReport || !repData ? (
              <CardContent className="p-8 text-center text-xs text-muted-foreground">
                Selecione ou gere um relatório ao lado para visualizar o dossiê completo de evolução do cliente.
              </CardContent>
            ) : (
              <>
                <CardHeader className="border-b border-border bg-slate-900 text-white pt-6 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
                        <FlaskConical className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-lg">
                            Relatório Clínico de Acompanhamento MyLabs
                          </CardTitle>
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            {repData.period?.days || intervalDays} dias avaliados
                          </Badge>
                        </div>
                        <CardDescription className="text-slate-300 text-xs">
                          Paciente: <strong>{repData.client?.name || clientName}</strong> • Objetivo:{' '}
                          {repData.client?.goal || 'Performance & Saúde'} • Período: {activeReport.period_start} até{' '}
                          {activeReport.period_end}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => window.print()}
                        className="gap-1.5 text-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir / PDF</span>
                      </Button>

                      {isValidWhatsapp(clientWhatsapp) && (
                        <Button
                          type="button"
                          size="sm"
                          asChild
                          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs"
                        >
                          <a
                            href={buildWhatsappUrl(clientWhatsapp!, reportWhatsappSummary)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Enviar no WhatsApp</span>
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* KPIs Principais do Relatório */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-emerald-800">
                        <span>Adesão à Dieta</span>
                        <Utensils className="w-3.5 h-3.5" />
                      </div>
                      <strong className="font-display font-extrabold text-2xl text-emerald-700">
                        {repData.diet?.adherence_pct ?? 0}%
                      </strong>
                      <span className="text-[11px] text-muted-foreground block">
                        Refeições registradas no período
                      </span>
                    </div>

                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-indigo-800">
                        <span>Execução Treinos</span>
                        <Dumbbell className="w-3.5 h-3.5" />
                      </div>
                      <strong className="font-display font-extrabold text-2xl text-indigo-700">
                        {repData.workout?.completion_pct ?? 0}%
                      </strong>
                      <span className="text-[11px] text-muted-foreground block">
                        {repData.workout?.planned_sessions ?? 0} sessões planejadas
                      </span>
                    </div>

                    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-sky-800">
                        <span>Hidratação Média</span>
                        <Droplets className="w-3.5 h-3.5" />
                      </div>
                      <strong className="font-display font-extrabold text-2xl text-sky-700">
                        {repData.water?.avg_ml ?? 0} mL
                      </strong>
                      <span className="text-[11px] text-muted-foreground block">
                        Meta: {repData.water?.goal_ml ?? 3000} mL ({repData.water?.days_goal_met ?? 0} dias batidos)
                      </span>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Evolução Ponderal</span>
                        <Scale className="w-3.5 h-3.5" />
                      </div>
                      <strong className="font-display font-extrabold text-2xl text-foreground">
                        {repData.weight?.end ?? '—'} kg
                      </strong>
                      <span className="text-[11px] text-emerald-700 font-semibold block">
                        Delta: {repData.weight?.delta > 0 ? `+${repData.weight.delta}` : repData.weight?.delta ?? 0}{' '}
                        kg
                      </span>
                    </div>
                  </div>

                  {/* Alertas Clínicos Automáticos */}
                  {repData.alerts && repData.alerts.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Pontos de Atenção Detectados no Período:</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-amber-900 space-y-0.5">
                        {repData.alerts.map((al: string, idx: number) => (
                          <li key={idx}>{al}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Composição Corporal e Progressão de Força */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <h4 className="font-display font-bold text-sm flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Síntese de Composição Corporal</span>
                      </h4>
                      {repData.assessment?.results ? (
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Percentual de Gordura:</span>
                            <strong>
                              {repData.assessment.results.bodyFatPct}% (
                              {repData.assessment.results.bodyFatCategory})
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Massa Livre de Gordura:</span>
                            <strong>{repData.assessment.results.leanMassKg} kg</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Massa Gorda:</span>
                            <strong>{repData.assessment.results.fatMassKg} kg</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Relação Cintura-Quadril (RCQ):</span>
                            <strong>{repData.assessment.results.whr ?? '—'}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Sem avaliação antropométrica registrada neste intervalo.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-border p-4 space-y-2">
                      <h4 className="font-display font-bold text-sm flex items-center gap-1.5">
                        <Dumbbell className="w-4 h-4 text-indigo-600" />
                        <span>Progressão de Carga nos Exercícios</span>
                      </h4>
                      {repData.workout?.load_progress?.length > 0 ? (
                        <div className="space-y-1.5 text-xs">
                          {repData.workout.load_progress.map((lp: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="truncate max-w-[180px]">{lp.exercise}</span>
                              <span className="font-semibold">
                                {lp.first_kg}kg → {lp.last_kg}kg{' '}
                                <Badge variant="secondary" className="text-[10px] text-emerald-700">
                                  {lp.delta >= 0 ? `+${lp.delta}` : lp.delta}kg
                                </Badge>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Engajamento ativo em {repData.engagement?.active_days ?? 0} dias (
                          {repData.engagement?.pct ?? 0}% do período).
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    )
  }

  // ==================== MODO 2: INTEGRAÇÃO WHATSAPP & CADASTRO DETALHADO DO NUTRICIONISTA ====================
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Formulário Detalhado do Nutricionista + Número de WhatsApp de Atendimento */}
      <Card className="lg:col-span-6 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-600 text-white gap-1">
              <Stethoscope className="w-3.5 h-3.5" />
              Cadastro Profissional & WhatsApp do Nutri
            </Badge>
            <Badge variant="outline">
              {formatWhatsappDisplay(nutriWhatsapp)}
            </Badge>
          </div>
          <CardTitle className="font-display text-base mt-1">
            Configuração do WhatsApp e Perfil Clínico do Nutricionista
          </CardTitle>
          <CardDescription className="text-xs">
            O número de WhatsApp cadastrado aqui recebe diretamente os pedidos de suporte e dúvidas clínicas enviados pelos seus clientes no aplicativo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSaveNutritionistProfile} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome Profissional Completo *</Label>
                <Input
                  required
                  value={nutriName}
                  onChange={(e) => setNutriName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Seu WhatsApp de Atendimento (com DDD) *</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-600 absolute left-3 top-3" />
                  <Input
                    required
                    value={nutriWhatsapp}
                    onChange={(e) => setNutriWhatsapp(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="pl-9 font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Registro CRN</Label>
                <Input
                  value={nutriCrn}
                  onChange={(e) => setNutriCrn(e.target.value)}
                  placeholder="CRN-3 48291"
                />
              </div>

              <div className="space-y-1">
                <Label>Região do CRN</Label>
                <Input
                  value={nutriCrnRegion}
                  onChange={(e) => setNutriCrnRegion(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Especialidade Clínica</Label>
                <Input
                  value={nutriSpecialty}
                  onChange={(e) => setNutriSpecialty(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Clínica / Consultório</Label>
                <Input
                  value={nutriClinic}
                  onChange={(e) => setNutriClinic(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Cidade</Label>
                <Input
                  placeholder="Ex: São Paulo"
                  value={nutriCity}
                  onChange={(e) => setNutriCity(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Estado (UF) *</Label>
                <Select value={nutriUf} onValueChange={setNutriUf}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZIL_STATES.map((st) => (
                      <SelectItem key={st.uf} value={st.uf}>
                        {st.uf} — {st.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Apresentação Profissional & Metodologia</Label>
              <Textarea
                rows={2}
                value={nutriBio}
                onChange={(e) => setNutriBio(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={savingProfile}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {savingProfile ? 'Salvando...' : 'Salvar Cadastro Profissional & WhatsApp do Nutricionista'}
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Fila de Chamados de Assistência Recebidos via WhatsApp dos Clientes */}
      <Card className="lg:col-span-6 rounded-2xl">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Pedidos de Assistência Enviados pelos Clientes ({clientRequests.length})</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico de solicitações disparadas pelos clientes no app para o seu WhatsApp profissional
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {clientRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Nenhum pedido de assistência pendente no momento.
            </div>
          ) : (
            clientRequests.map((req) => {
              const sender = req.profiles
              const senderPhone = sender?.whatsapp || clientWhatsapp || ''
              const replyText = `Olá, *${sender?.full_name || 'Cliente'}*! Recebi seu pedido de assistência pelo *MyLabs* sobre *${req.category}* e já vou te orientar:`
              return (
                <div
                  key={req.id}
                  className="rounded-2xl border border-border p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        {sender?.full_name || 'Cliente'}
                      </span>
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {req.category}
                      </Badge>
                    </div>
                    <Badge
                      variant={req.status === 'resolved' ? 'default' : 'secondary'}
                      className={req.status === 'resolved' ? 'bg-emerald-600 text-white' : ''}
                    >
                      {req.status === 'resolved' ? 'Atendido' : 'Aguardando'}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-2.5">
                    {req.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isValidWhatsapp(senderPhone) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700"
                      >
                        <a
                          href={buildWhatsappUrl(senderPhone, replyText)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Responder no WhatsApp</span>
                        </a>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResolveRequest(req.id, req.status)}
                      className="h-7 text-xs"
                    >
                      {req.status === 'resolved' ? 'Reabrir' : 'Marcar como Atendido'}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
