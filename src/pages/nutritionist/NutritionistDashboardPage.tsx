import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/shared/AppShell'
import { ClientRegisterDialog } from './ClientRegisterDialog'
import { DietBuilderSection } from './DietBuilderSection'
import { WorkoutBuilderSection } from './WorkoutBuilderSection'
import { AnthropometrySection } from './AnthropometrySection'
import { ReportsAndWhatsappSection } from './ReportsAndWhatsappSection'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityLevel } from '@/domain/energy'
import {
  Activity,
  Dumbbell,
  FileText,
  MessageSquare,
  Users,
  Utensils,
} from 'lucide-react'

export function NutritionistDashboardPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'diet' | 'workout' | 'anthropometry' | 'reports' | 'whatsapp'>('diet')
  const [clients, setClients] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [latestAssessment, setLatestAssessment] = useState<any>(null)
  const [unreadReports, setUnreadReports] = useState<number>(0)

  const loadClients = useCallback(async () => {
    if (!profile?.id) return
    const { data: cRows } = await supabase
      .from('clients')
      .select('*, profiles!clients_id_fkey(id, full_name, email, whatsapp, avatar_url)')
      .order('created_at', { ascending: true })

    const list = cRows || []
    setClients(list)
    if (list.length > 0) {
      setSelectedClientId((prev) =>
        prev && list.some((c) => c.id === prev) ? prev : list[0].id,
      )
    }
  }, [profile?.id])

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
    setLatestAssessment(data)
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      loadClientAssessment(selectedClientId)
    }
  }, [selectedClientId, loadClientAssessment])

  const activeClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || clients[0] || null,
    [clients, selectedClientId],
  )

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

  return (
    <AppShell
      headerActions={
        <ClientRegisterDialog
          onClientCreated={async (newId) => {
            await loadClients()
            setSelectedClientId(newId)
          }}
        />
      }
    >
      <div className="space-y-6">
        {/* Barra Superior de Seleção de Paciente Ativo */}
        <Card className="rounded-3xl border-border bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white shadow-md">
          <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  <span>Paciente em Atendimento Clínico ({clients.length} vinculados)</span>
                </div>

                {clients.length > 0 ? (
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="w-full sm:w-72 bg-white/10 border-white/20 text-white font-display font-bold">
                      <SelectValue placeholder="Selecione um paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.profiles?.full_name || 'Cliente'} ({c.goal || 'Clínico'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-slate-300">
                    Cadastre seu primeiro cliente no botão superior direito.
                  </p>
                )}
              </div>

              {activeClient && (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      Plano {activeClient.plan || 'Pro'}
                    </Badge>
                    <Badge variant="outline" className="border-slate-700 text-slate-200">
                      {clientMeta.age} anos • {clientMeta.heightCm} cm • {clientMeta.weightKg} kg
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300">
                    Objetivo: <strong className="text-white">{activeClient.goal}</strong> • E-mail:{' '}
                    {activeClient.profiles?.email}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2">
                <span className="text-[11px] text-slate-300 block">Peso Atual</span>
                <strong className="font-display text-lg text-white">
                  {clientMeta.weightKg} kg
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2">
                <span className="text-[11px] text-slate-300 block">% Gordura</span>
                <strong className="font-display text-lg text-emerald-400">
                  {latestAssessment?.results?.bodyFatPct ?? '16.0'}%
                </strong>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-3.5 py-2">
                <span className="text-[11px] text-slate-300 block">Massa Magra</span>
                <strong className="font-display text-lg text-indigo-300">
                  {clientMeta.leanMassKg} kg
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abas Clínicas do Nutricionista */}
        {activeClient && (
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
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
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
        )}
      </div>
    </AppShell>
  )
}
