import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/shared/AppShell'
import { ClientRegisterDialog } from './ClientRegisterDialog'
import { DietBuilderSection } from './DietBuilderSection'
import { WorkoutBuilderSection } from './WorkoutBuilderSection'
import { AnthropometrySection } from './AnthropometrySection'
import { ReportsAndWhatsappSection } from './ReportsAndWhatsappSection'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityLevel } from '@/domain/energy'
import { formatWhatsappDisplay } from '@/domain/whatsapp'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Dumbbell,
  FileText,
  LayoutGrid,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Stethoscope,
  Target,
  Users,
  Utensils,
} from 'lucide-react'

export function NutritionistDashboardPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'diet' | 'workout' | 'anthropometry' | 'reports' | 'whatsapp'>('diet')
  const [clients, setClients] = useState<any[]>([])
  const [latestAssessmentsByClient, setLatestAssessmentsByClient] = useState<Record<string, any>>({})

  // null = Módulo de Controle de Clientes; string = Prontuário aberto do cliente clicado
  const [openedClientId, setOpenedClientId] = useState<string | null>(null)
  const [showProfilePanelInControl, setShowProfilePanelInControl] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [unreadReports, setUnreadReports] = useState<number>(0)

  const loadClients = useCallback(async () => {
    if (!profile?.id) return

    // Somente os clientes cadastrados/vinculados a esta nutricionista
    let query = supabase
      .from('clients')
      .select('*, profiles!clients_id_fkey(id, full_name, email, whatsapp, avatar_url)')
      .order('created_at', { ascending: true })

    if (profile.role === 'nutritionist') {
      query = query.eq('nutritionist_id', profile.id)
    }

    const { data: cRows } = await query
    const list = cRows || []
    setClients(list)

    if (list.length > 0) {
      const ids = list.map((c) => c.id)
      const { data: allAssess } = await supabase
        .from('anthropometry_assessments')
        .select('*')
        .in('client_id', ids)
        .order('assessed_at', { ascending: false })

      const byClient: Record<string, any> = {}
      for (const a of allAssess || []) {
        if (!byClient[a.client_id]) {
          byClient[a.client_id] = a
        }
      }
      setLatestAssessmentsByClient(byClient)
    }
  }, [profile?.id, profile?.role])

  useEffect(() => {
    loadClients()
  }, [loadClients])

  const loadClientAssessment = useCallback(async (cid: string) => {
    if (!cid) return
    const { data } = await supabase
      .from('anthropometry_assessments')
      .select('*')
      .eq('client_id', cid)
      .order('assessed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setLatestAssessmentsByClient((prev) => ({ ...prev, [cid]: data }))
    }
  }, [])

  const activeClient = useMemo(
    () => (openedClientId ? clients.find((c) => c.id === openedClientId) || null : null),
    [clients, openedClientId],
  )

  const latestAssessment = activeClient ? latestAssessmentsByClient[activeClient.id] || null : null

  const clientMeta = useMemo(() => {
    const sex = (activeClient?.sex === 'female' ? 'female' : 'male') as 'male' | 'female'
    const birthYear = activeClient?.birth_date
      ? new Date(activeClient.birth_date).getFullYear()
      : 1996
    const age = Math.max(16, Math.min(90, new Date().getFullYear() - birthYear))
    const heightCm = Number(activeClient?.height_cm) || 175
    const weightKg = Number(latestAssessment?.weight_kg) || 78
    const leanMassKg = Number(latestAssessment?.results?.leanMassKg) || +(weightKg * 0.83).toFixed(1)
    const activityLevel = (activeClient?.activity_level || 'moderate') as ActivityLevel
    return { sex, age, heightCm, weightKg, leanMassKg, activityLevel }
  }, [activeClient, latestAssessment])

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const name = (c.profiles?.full_name || '').toLowerCase()
      const email = (c.profiles?.email || '').toLowerCase()
      const goal = (c.goal || '').toLowerCase()
      return name.includes(q) || email.includes(q) || goal.includes(q)
    })
  }, [clients, clientSearch])

  return (
    <AppShell
      headerActions={
        <div className="flex items-center gap-2">
          {openedClientId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenedClientId(null)}
              className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Meus Clientes ({clients.length})</span>
            </Button>
          )}
          <ClientRegisterDialog
            onClientCreated={async (newId) => {
              await loadClients()
              setOpenedClientId(newId)
              setActiveTab('diet')
            }}
          />
        </div>
      }
    >
      {/* ==================== VISÃO 1: MÓDULO DE CONTROLE DE CLIENTES DA NUTRICIONISTA ==================== */}
      {!activeClient ? (
        <div className="space-y-6">
          {/* Banner Superior do Módulo de Controle */}
          <Card className="rounded-3xl border-border bg-slate-900 text-white shadow-md">
            <CardContent className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>Módulo de Controle da Nutricionista</span>
                  </Badge>
                  {profile?.crn && (
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      {profile.crn}
                    </Badge>
                  )}
                  {profile?.city_state && (
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      {profile.city_state}
                    </Badge>
                  )}
                </div>
                <h1 className="font-display font-extrabold text-xl sm:text-2xl">
                  Controle de Clientes - {profile?.full_name || 'Nutricionista'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  Aqui estão listados exclusivamente os clientes cadastrados por você. Clique em qualquer cliente abaixo para abrir o prontuário completo de Dieta, Treinos, Antropometria e Relatórios.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2.5 text-center">
                  <span className="text-[11px] text-slate-300 block">Meus Clientes</span>
                  <strong className="font-display text-xl text-emerald-400">{clients.length}</strong>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowProfilePanelInControl((v) => !v)}
                  className="gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>{showProfilePanelInControl ? 'Ver Lista de Clientes' : 'Meu Perfil & WhatsApp'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {showProfilePanelInControl ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-base">
                  Configuração do Meu Perfil Profissional, UF & Fila de WhatsApp
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProfilePanelInControl(false)}
                  className="gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Meus Clientes</span>
                </Button>
              </div>
              <ReportsAndWhatsappSection
                clientId={clients[0]?.id || ''}
                clientName={clients[0]?.profiles?.full_name || 'Cliente'}
                clientWhatsapp={clients[0]?.profiles?.whatsapp}
                mode="whatsapp"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Barra de Busca de Clientes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                  <Input
                    placeholder="Buscar cliente cadastrado por nome, e-mail ou objetivo..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  Exibindo <strong>{filteredClients.length}</strong> de <strong>{clients.length}</strong> clientes sob sua responsabilidade
                </span>
              </div>

              {/* Grid de Cards dos Clientes Cadastrados pela Nutricionista */}
              {filteredClients.length === 0 ? (
                <Card className="rounded-2xl p-10 text-center space-y-3">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-base">
                      Nenhum cliente encontrado
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Utilize o botão "Cadastrar Cliente & Criar Login" no topo para cadastrar um novo paciente e liberar seu acesso ao aplicativo.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClients.map((c) => {
                    const cProf = c.profiles
                    const assess = latestAssessmentsByClient[c.id]
                    const initials = (cProf?.full_name || 'CL')
                      .split(' ')
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                    const birthYear = c.birth_date ? new Date(c.birth_date).getFullYear() : 1996
                    const age = Math.max(16, Math.min(90, new Date().getFullYear() - birthYear))
                    const weight = assess?.weight_kg ? `${Number(assess.weight_kg).toFixed(1)} kg` : '-'
                    const bf = assess?.results?.bodyFatPct ? `${assess.results.bodyFatPct}%` : '-'

                    return (
                      <Card
                        key={c.id}
                        onClick={() => {
                          setOpenedClientId(c.id)
                          setActiveTab('diet')
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setOpenedClientId(c.id)
                            setActiveTab('diet')
                          }
                        }}
                        className="rounded-2xl border-border hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-11 w-11 border border-emerald-200">
                                <AvatarFallback className="bg-emerald-100 text-emerald-800 font-display font-bold text-sm">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="font-display text-base group-hover:text-emerald-700 transition-colors">
                                  {cProf?.full_name || 'Cliente'}
                                </CardTitle>
                                <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                                  <span>{age} anos</span>
                                  <span>•</span>
                                  <span>{c.height_cm || 170} cm</span>
                                </CardDescription>
                              </div>
                            </div>
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              Plano {c.plan || 'Pro'}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3.5">
                          <div className="rounded-xl bg-muted/50 border border-border p-2.5 space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <Target className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{c.goal || 'Saúde & Performance'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{cProf?.email || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatWhatsappDisplay(cProf?.whatsapp)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-xl border border-border p-2">
                              <span className="text-[10px] text-muted-foreground block">Peso</span>
                              <strong className="font-display text-sm">{weight}</strong>
                            </div>
                            <div className="rounded-xl border border-border p-2">
                              <span className="text-[10px] text-muted-foreground block">% Gordura</span>
                              <strong className="font-display text-sm text-emerald-700">{bf}</strong>
                            </div>
                            <div className="rounded-xl border border-border p-2">
                              <span className="text-[10px] text-muted-foreground block">Meta Água</span>
                              <strong className="font-display text-sm text-sky-700">
                                {((c.water_goal_ml || 2500) / 1000).toFixed(1)}L
                              </strong>
                            </div>
                          </div>

                          <Button
                            type="button"
                            className="w-full bg-slate-900 group-hover:bg-emerald-600 text-white font-semibold gap-2 transition-colors"
                          >
                            <span>Abrir Prontuário Clínico</span>
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ==================== VISÃO 2: TELA CLÍNICA DO CLIENTE SELECIONADO (PÁGINAS 7 & 8 DO PDF) ==================== */
        <div className="space-y-6">
          {/* Barra Superior do Paciente Ativo + Botão Voltar ao Módulo de Controle (Organizada em 2 linhas alinhadas) */}
          <Card className="rounded-3xl border-border bg-slate-900 text-white shadow-md">
            <CardContent className="p-5 sm:p-6 space-y-4">
              {/* Linha 1: Navegação e Troca Rápida de Paciente */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setOpenedClientId(null)}
                    className="h-9 px-3.5 rounded-xl gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 font-semibold"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar aos Meus Clientes</span>
                  </Button>

                  <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 gap-1.5 py-1 px-2.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Paciente em Atendimento Clínico ({clients.length} vinculados)</span>
                  </Badge>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <span className="text-xs text-slate-300 whitespace-nowrap hidden md:inline">
                    Paciente ativo:
                  </span>
                  <Select value={openedClientId || ''} onValueChange={(id) => setOpenedClientId(id)}>
                    <SelectTrigger className="w-full sm:w-64 bg-white/10 border-white/20 text-white font-display font-bold h-9 rounded-xl">
                      <SelectValue placeholder="Selecione um paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.profiles?.full_name || 'Cliente'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linha 2: Identificação Clínica Alinhada + 3 KPIs Horizontais Uniformes */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <Avatar className="h-12 w-12 border-2 border-emerald-400/40 shrink-0">
                    <AvatarFallback className="bg-emerald-500/20 text-emerald-300 font-display font-extrabold text-sm">
                      {(activeClient.profiles?.full_name || 'CL')
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display font-extrabold text-lg sm:text-xl text-white truncate">
                        {activeClient.profiles?.full_name || 'Cliente'}
                      </h2>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                        Plano {activeClient.plan || 'Pro'}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700 text-slate-200">
                        {clientMeta.age} anos • {clientMeta.heightCm} cm • {clientMeta.weightKg} kg
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                      <span>
                        Objetivo: <strong className="text-emerald-300">{activeClient.goal}</strong>
                      </span>
                      <span className="hidden sm:inline text-slate-600">•</span>
                      <span>
                        E-mail: <strong className="text-white">{activeClient.profiles?.email}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:min-w-[360px] shrink-0">
                  <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2.5 flex flex-col justify-center">
                    <span className="text-[11px] text-slate-300 whitespace-nowrap">Peso Atual</span>
                    <strong className="font-display font-extrabold text-lg sm:text-xl text-white whitespace-nowrap mt-0.5">
                      {clientMeta.weightKg} kg
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2.5 flex flex-col justify-center">
                    <span className="text-[11px] text-slate-300 whitespace-nowrap">% Gordura</span>
                    <strong className="font-display font-extrabold text-lg sm:text-xl text-emerald-400 whitespace-nowrap mt-0.5">
                      {latestAssessment?.results?.bodyFatPct ?? '16.0'}%
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2.5 flex flex-col justify-center">
                    <span className="text-[11px] text-slate-300 whitespace-nowrap">Massa Magra</span>
                    <strong className="font-display font-extrabold text-lg sm:text-xl text-indigo-300 whitespace-nowrap mt-0.5">
                      {clientMeta.leanMassKg} kg
                    </strong>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Abas Clínicas do Prontuário do Cliente */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-5">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1.5 rounded-2xl bg-muted no-print">
              <TabsTrigger value="diet" className="py-2.5 rounded-xl gap-1.5 text-xs font-semibold">
                <Utensils className="w-4 h-4 text-emerald-600" />
                <span>Dieta & Fotos</span>
              </TabsTrigger>
              <TabsTrigger value="workout" className="py-2.5 rounded-xl gap-1.5 text-xs font-semibold">
                <Dumbbell className="w-4 h-4 text-indigo-600" />
                <span>Treinos & GIFs</span>
              </TabsTrigger>
              <TabsTrigger value="anthropometry" className="py-2.5 rounded-xl gap-1.5 text-xs font-semibold">
                <Activity className="w-4 h-4 text-amber-600" />
                <span>Antropometria & Cálculos</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="py-2.5 rounded-xl gap-1.5 text-xs font-semibold">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Relatórios</span>
                {unreadReports > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold">
                    {unreadReports}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="py-2.5 rounded-xl gap-1.5 text-xs font-semibold">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp & Perfil</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="diet">
              <DietBuilderSection
                clientId={activeClient.id}
                clientName={activeClient.profiles?.full_name || 'Cliente'}
                clientMeta={clientMeta}
              />
            </TabsContent>

            <TabsContent value="workout">
              <WorkoutBuilderSection
                clientId={activeClient.id}
                clientName={activeClient.profiles?.full_name || 'Cliente'}
              />
            </TabsContent>

            <TabsContent value="anthropometry">
              <AnthropometrySection
                clientId={activeClient.id}
                clientName={activeClient.profiles?.full_name || 'Cliente'}
                clientMeta={clientMeta}
                onAssessmentSaved={() => loadClientAssessment(activeClient.id)}
              />
            </TabsContent>

            <TabsContent value="reports">
              <ReportsAndWhatsappSection
                clientId={activeClient.id}
                clientName={activeClient.profiles?.full_name || 'Cliente'}
                clientWhatsapp={activeClient.profiles?.whatsapp}
                mode="reports"
                onUnreadCountChange={setUnreadReports}
              />
            </TabsContent>

            <TabsContent value="whatsapp">
              <ReportsAndWhatsappSection
                clientId={activeClient.id}
                clientName={activeClient.profiles?.full_name || 'Cliente'}
                clientWhatsapp={activeClient.profiles?.whatsapp}
                mode="whatsapp"
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  )
}
