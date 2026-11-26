import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, invokeManageUsers, translateErrorPt } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/shared/AppShell'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { ClientRegisterDialog } from '@/pages/nutritionist/ClientRegisterDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ACTIVITY_FACTORS, type ActivityLevel } from '@/domain/energy'
import { BRAZIL_STATES, joinCityState, splitCityState } from '@/domain/brazilStates'
import {
  buildWhatsappUrl,
  formatWhatsappDisplay,
  isValidWhatsapp,
} from '@/domain/whatsapp'
import {
  Award,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  MessageSquare,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

const CRN_REGIONS = [
  'CRN-1 (DF, GO, MT, TO)',
  'CRN-2 (RS)',
  'CRN-3 (SP, MS)',
  'CRN-4 (RJ, ES)',
  'CRN-5 (BA, SE)',
  'CRN-6 (AL, CE, MA, PB, PE, PI, RN)',
  'CRN-7 (AC, AM, AP, PA, RO, RR)',
  'CRN-8 (PR)',
  'CRN-9 (MG)',
  'CRN-10 (SC)',
  'CRN-11 (CE, MA, PI)',
]

const SPECIALTIES = [
  'Nutrição Esportiva & Composição Corporal',
  'Emagrecimento, Obesidade & Saúde Metabólica',
  'Nutrição Clínica Funcional & Integrativa',
  'Performance, Triatlo & Endurance',
  'Saúde da Mulher & Estética Clínica',
  'Hipertrofia & Fisiculturismo',
]

export function AdminDashboardPage() {
  const { profile: currentAdmin } = useAuth()
  const [supportWhatsapp, setSupportWhatsapp] = useState('')
  const [supportDefaultMsg, setSupportDefaultMsg] = useState(
    'Olá! Preciso de ajuda técnica com o sistema MyLabs.',
  )
  const [savingSettings, setSavingSettings] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [clientsMap, setClientsMap] = useState<Record<string, any>>({})
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'nutritionist' | 'admin'>('all')
  const [userSearch, setUserSearch] = useState('')

  // Nutritionist registration state (Exclusive to Support / Admin)
  const [nutriModalOpen, setNutriModalOpen] = useState(false)
  const [registeringNutri, setRegisteringNutri] = useState(false)
  const [nutriFullName, setNutriFullName] = useState('')
  const [nutriEmail, setNutriEmail] = useState('')
  const [nutriPassword, setNutriPassword] = useState('Mylabs@2026')
  const [nutriWhatsapp, setNutriWhatsapp] = useState('')
  const [nutriCrn, setNutriCrn] = useState('')
  const [nutriCrnRegion, setNutriCrnRegion] = useState('CRN-3 (SP, MS)')
  const [nutriSpecialty, setNutriSpecialty] = useState(SPECIALTIES[0])
  const [nutriClinic, setNutriClinic] = useState('')
  const [nutriCity, setNutriCity] = useState('São Paulo')
  const [nutriUf, setNutriUf] = useState('SP')
  const [nutriBio, setNutriBio] = useState('')
  const [createdNutriCreds, setCreatedNutriCreds] = useState<{
    name: string
    email: string
    password: string
    whatsapp: string
  } | null>(null)

  // Edit User Login & Client Record Modal state
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editNewPassword, setEditNewPassword] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editActive, setEditActive] = useState(true)
  // Nutritionist fields in edit
  const [editCrn, setEditCrn] = useState('')
  const [editCrnRegion, setEditCrnRegion] = useState('CRN-3 (SP, MS)')
  const [editSpecialty, setEditSpecialty] = useState(SPECIALTIES[0])
  const [editClinic, setEditClinic] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editUf, setEditUf] = useState('SP')
  const [editBio, setEditBio] = useState('')
  // Client clinical record fields in edit
  const [editNutriId, setEditNutriId] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('1996-05-10')
  const [editSex, setEditSex] = useState<'male' | 'female'>('male')
  const [editHeightCm, setEditHeightCm] = useState(175)
  const [editGoal, setEditGoal] = useState('')
  const [editActivityLevel, setEditActivityLevel] = useState<ActivityLevel>('moderate')
  const [editWaterGoalMl, setEditWaterGoalMl] = useState(2500)
  const [editPlan, setEditPlan] = useState('Pro')
  const [editRestrictions, setEditRestrictions] = useState('')
  const [editClinicalNotes, setEditClinicalNotes] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [resettingRecords, setResettingRecords] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deletingUser, setDeletingUser] = useState(false)

  const loadAdminData = useCallback(async () => {
    const [{ data: sets }, { data: reqs }, { data: profs }, { data: cliRows }] = await Promise.all([
      supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['support_whatsapp', 'support_whatsapp_message']),
      supabase
        .from('support_requests')
        .select('*, profiles!support_requests_from_user_fkey(full_name, email, whatsapp, role)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*'),
    ])

    const num = sets?.find((s) => s.key === 'support_whatsapp')?.value
    const msg = sets?.find((s) => s.key === 'support_whatsapp_message')?.value
    if (num && typeof num === 'string') setSupportWhatsapp(num)
    if (msg && typeof msg === 'string') setSupportDefaultMsg(msg)
    setRequests(reqs || [])
    setUsers(profs || [])

    const cMap: Record<string, any> = {}
    for (const c of cliRows || []) {
      cMap[c.id] = c
    }
    setClientsMap(cMap)
  }, [])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  const nutritionistsList = useMemo(
    () => users.filter((u) => u.role === 'nutritionist'),
    [users],
  )

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const q = userSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      return matchRole && matchSearch
    })
  }, [users, roleFilter, userSearch])

  const handleOpenEditModal = (u: any) => {
    setEditingUser(u)
    setEditFullName(u.full_name || '')
    setEditEmail(u.email || '')
    setEditNewPassword('')
    setEditWhatsapp(u.whatsapp || '')
    setEditActive(u.active ?? true)

    const parsedCity = splitCityState(u.city_state)
    setEditCrn(u.crn || '')
    setEditCrnRegion(u.crn_region || 'CRN-3 (SP, MS)')
    setEditSpecialty(u.specialty || SPECIALTIES[0])
    setEditClinic(u.clinic_name || '')
    setEditCity(parsedCity.city)
    setEditUf(parsedCity.uf)
    setEditBio(u.bio || '')

    const cli = clientsMap[u.id]
    if (cli) {
      setEditNutriId(cli.nutritionist_id || nutritionistsList[0]?.id || '')
      setEditBirthDate(cli.birth_date || '1996-05-10')
      setEditSex(cli.sex === 'female' ? 'female' : 'male')
      setEditHeightCm(Number(cli.height_cm) || 170)
      setEditGoal(cli.goal || 'Saúde & Performance')
      setEditActivityLevel((cli.activity_level || 'moderate') as ActivityLevel)
      setEditWaterGoalMl(Number(cli.water_goal_ml) || 2500)
      setEditPlan(cli.plan || 'Pro')
      setEditRestrictions(cli.restrictions || '')
      setEditClinicalNotes(cli.clinical_notes || '')
    }
    setEditOpen(true)
  }

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setSavingEdit(true)
    try {
      await invokeManageUsers({
        action: 'update_user_and_client',
        user_id: editingUser.id,
        full_name: editFullName,
        email: editEmail,
        new_password: editNewPassword.trim() || undefined,
        whatsapp: editWhatsapp,
        active: editActive,
        crn: editingUser.role === 'nutritionist' ? editCrn : undefined,
        crn_region: editingUser.role === 'nutritionist' ? editCrnRegion : undefined,
        specialty: editingUser.role === 'nutritionist' ? editSpecialty : undefined,
        clinic_name: editingUser.role === 'nutritionist' ? editClinic : undefined,
        city_state: editingUser.role === 'nutritionist' ? joinCityState(editCity, editUf) : undefined,
        bio: editingUser.role === 'nutritionist' ? editBio : undefined,
        client_record:
          editingUser.role === 'client'
            ? {
                nutritionist_id: editNutriId || undefined,
                birth_date: editBirthDate,
                sex: editSex,
                height_cm: editHeightCm,
                goal: editGoal,
                activity_level: editActivityLevel,
                water_goal_ml: editWaterGoalMl,
                plan: editPlan,
                restrictions: editRestrictions,
                clinical_notes: editClinicalNotes,
              }
            : undefined,
      })

      toast.success(`Login e registros de ${editFullName} atualizados com sucesso!`)
      setEditOpen(false)
      loadAdminData()
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleResetClientRecords = async () => {
    if (!editingUser || editingUser.role !== 'client') return
    setResettingRecords(true)
    try {
      await invokeManageUsers({
        action: 'reset_client_records',
        client_id: editingUser.id,
      })
      toast.success(`Histórico clínico (dietas, treinos, avaliações e logs) de ${editingUser.full_name} limpo com sucesso!`)
      loadAdminData()
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setResettingRecords(false)
    }
  }

  const handleConfirmDeleteUser = async () => {
    if (!deleteTarget) return
    setDeletingUser(true)
    try {
      await invokeManageUsers({
        action: 'delete_user_and_records',
        user_id: deleteTarget.id,
      })
      toast.success(`Usuário e todos os registros de ${deleteTarget.full_name} foram excluídos!`)
      setDeleteTarget(null)
      loadAdminData()
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setDeletingUser(false)
    }
  }

  const handleSaveSupportWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidWhatsapp(supportWhatsapp)) {
      toast.error('Informe um número de WhatsApp válido com DDD.')
      return
    }
    setSavingSettings(true)
    try {
      const res = await invokeManageUsers<{ ok: boolean; support_whatsapp: string }>({
        action: 'save_system_whatsapp',
        whatsapp: supportWhatsapp,
        default_message: supportDefaultMsg,
      })
      setSupportWhatsapp(res.support_whatsapp)
      toast.success('WhatsApp do Suporte Técnico MyLabs atualizado!')
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRegisterNutritionist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidWhatsapp(nutriWhatsapp)) {
      toast.error('Informe o WhatsApp profissional do nutricionista com DDD.')
      return
    }
    setRegisteringNutri(true)
    try {
      const res = await invokeManageUsers<{ ok: boolean; email: string }>({
        action: 'register_nutritionist',
        full_name: nutriFullName,
        email: nutriEmail,
        password: nutriPassword,
        whatsapp: nutriWhatsapp,
        crn: nutriCrn,
        crn_region: nutriCrnRegion,
        specialty: nutriSpecialty,
        clinic_name: nutriClinic,
        city_state: joinCityState(nutriCity, nutriUf),
        bio: nutriBio,
      })
      setCreatedNutriCreds({
        name: nutriFullName,
        email: res.email,
        password: nutriPassword,
        whatsapp: nutriWhatsapp,
      })
      toast.success(`Nutricionista ${nutriFullName} cadastrado(a) com sucesso!`)
      loadAdminData()
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setRegisteringNutri(false)
    }
  }

  const resetNutriForm = () => {
    setNutriFullName('')
    setNutriEmail('')
    setNutriPassword('Mylabs@2026')
    setNutriWhatsapp('')
    setNutriCrn('')
    setNutriClinic('')
    setNutriBio('')
    setCreatedNutriCreds(null)
  }

  const handleToggleRequestStatus = async (id: string, current: string) => {
    const next = current === 'resolved' ? 'sent' : 'resolved'
    await supabase.from('support_requests').update({ status: next }).eq('id', id)
    toast.success(next === 'resolved' ? 'Chamado resolvido!' : 'Chamado reaberto.')
    loadAdminData()
  }

  const handleApproveCrn = async (userId: string) => {
    await supabase.from('profiles').update({ crn_status: 'approved' }).eq('id', userId)
    toast.success('Registro CRN aprovado com sucesso!')
    loadAdminData()
  }

  const nutriWelcomeMsg = createdNutriCreds
    ? [
        `Olá, *${createdNutriCreds.name}*! Seu credenciamento como Nutricionista no *MyLabs* foi concluído pelo Suporte!`,
        '',
        `*Rota Exclusiva de Acesso:* /login/nutri`,
        `*E-mail:* ${createdNutriCreds.email}`,
        `*Senha Inicial:* ${createdNutriCreds.password}`,
      ].join('\n')
    : ''

  return (
    <AppShell
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/configurar-suporte">
              <Settings2 className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Tela Externa WhatsApp</span>
            </Link>
          </Button>

          {/* Cadastro de Nutricionista - Exclusivo do Suporte / Admin */}
          <Dialog
            open={nutriModalOpen}
            onOpenChange={(next) => {
              setNutriModalOpen(next)
              if (!next) resetNutriForm()
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-sky-700 hover:bg-sky-800 text-white gap-2 shadow-xs">
                <Stethoscope className="w-4 h-4" />
                <span>Cadastrar Nutricionista</span>
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white">Exclusivo Suporte / Admin</Badge>
                  <Badge variant="outline">Rota de Acesso: /login/nutri</Badge>
                </div>
                <DialogTitle className="font-display text-lg">
                  Cadastrar Novo Nutricionista & Liberar Acesso Clínico
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados profissionais, CRN, estado (UF) e o WhatsApp que receberá as mensagens de assistência dos clientes desse nutricionista.
                </DialogDescription>
              </DialogHeader>

              {!createdNutriCreds ? (
                <form onSubmit={handleRegisterNutritionist} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-name">Nome Completo Profissional *</Label>
                      <Input
                        id="admin-nutri-name"
                        required
                        placeholder="Ex: Dra. Carolina Almeida"
                        value={nutriFullName}
                        onChange={(e) => setNutriFullName(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-whatsapp">WhatsApp de Atendimento (com DDD) *</Label>
                      <Input
                        id="admin-nutri-whatsapp"
                        required
                        placeholder="Ex: (11) 98888-7777"
                        value={nutriWhatsapp}
                        onChange={(e) => setNutriWhatsapp(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-email">E-mail Profissional (Login) *</Label>
                      <Input
                        id="admin-nutri-email"
                        type="email"
                        required
                        placeholder="carolina@clinica.com.br"
                        value={nutriEmail}
                        onChange={(e) => setNutriEmail(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-password">Senha Inicial (mín. 6 caracteres) *</Label>
                      <PasswordInput
                        id="admin-nutri-password"
                        required
                        minLength={6}
                        value={nutriPassword}
                        onChange={(e) => setNutriPassword(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-crn">Número de Registro CRN *</Label>
                      <div className="relative">
                        <Award className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          id="admin-nutri-crn"
                          required
                          placeholder="Ex: CRN-3 54321"
                          value={nutriCrn}
                          onChange={(e) => setNutriCrn(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Região do Conselho (CRN) *</Label>
                      <Select value={nutriCrnRegion} onValueChange={setNutriCrnRegion}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRN_REGIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Especialidade Clínica Principal *</Label>
                      <Select value={nutriSpecialty} onValueChange={setNutriSpecialty}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIALTIES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-clinic">Nome da Clínica / Consultório</Label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                        <Input
                          id="admin-nutri-clinic"
                          placeholder="Ex: Instituto MyLabs Performance"
                          value={nutriClinic}
                          onChange={(e) => setNutriClinic(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cidade + Select de UF 100% Alinhados na Mesma Linha */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label htmlFor="admin-nutri-city">Cidade</Label>
                      <Input
                        id="admin-nutri-city"
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
                              {st.uf} - {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="admin-nutri-bio">Resumo Profissional & Abordagem Clínica</Label>
                    <Textarea
                      id="admin-nutri-bio"
                      rows={2}
                      placeholder="Formação, metodologia de atendimento e foco clínico..."
                      value={nutriBio}
                      onChange={(e) => setNutriBio(e.target.value)}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2">
                    LGPD: coletamos apenas os dados profissionais necessários para habilitação do CRN e autenticação na plataforma.
                  </p>

                  <DialogFooter className="pt-2">
                    <Button type="button" variant="outline" onClick={() => setNutriModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={registeringNutri}
                      className="bg-sky-700 hover:bg-sky-800 text-white gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {registeringNutri ? 'Criando Conta...' : 'Concluir Cadastro de Nutricionista'}
                      </span>
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-2">
                    <div className="font-display font-bold text-indigo-950 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                      <span>Nutricionista Credenciado com Sucesso!</span>
                    </div>
                    <div className="rounded-xl bg-white border border-indigo-200 p-3 text-xs font-mono space-y-1">
                      <div>
                        <strong>Rota de Entrada:</strong> /login/nutri
                      </div>
                      <div>
                        <strong>E-mail:</strong> {createdNutriCreds.email}
                      </div>
                      <div>
                        <strong>Senha:</strong> {createdNutriCreds.password}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard?.writeText(nutriWelcomeMsg)
                          toast.success('Credenciais copiadas!')
                        }}
                        className="gap-1.5"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Copiar Credenciais</span>
                      </Button>

                      {isValidWhatsapp(createdNutriCreds.whatsapp) && (
                        <Button
                          type="button"
                          asChild
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <a
                            href={buildWhatsappUrl(createdNutriCreds.whatsapp, nutriWelcomeMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Enviar Acesso via WhatsApp</span>
                          </a>
                        </Button>
                      )}
                    </div>
                    <Button type="button" onClick={() => setNutriModalOpen(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <ClientRegisterDialog onClientCreated={() => loadAdminData()} />
        </div>
      }
    >
      <div className="space-y-6">
        <Card className="rounded-3xl border-border bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950 text-white shadow-md">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Painel de Operações, Gestão de Logins/Registros & Suporte WhatsApp
              </Badge>
              <h1 className="font-display font-extrabold text-xl">
                Central de Suporte & Governança MyLabs
              </h1>
              <p className="text-xs text-slate-300">
                WhatsApp ativo do Suporte Técnico:{' '}
                <strong className="text-amber-300">{formatWhatsappDisplay(supportWhatsapp)}</strong>
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-center">
                <span className="text-[11px] text-slate-300 block">Contas Cadastradas</span>
                <strong className="font-display text-lg">{users.length}</strong>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-center">
                <span className="text-[11px] text-slate-300 block">Chamados WhatsApp</span>
                <strong className="font-display text-lg text-amber-300">{requests.length}</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="users" className="space-y-5">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 h-auto p-1.5 rounded-2xl bg-muted">
            <TabsTrigger value="users" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Gestão de Clientes, Logins & Nutricionistas ({users.length})</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp-support" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Configuração WhatsApp do Suporte & Chamados</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="rounded-2xl">
              <CardHeader className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-base">
                      Gestão Completa de Logins e Registros de Clientes & Nutricionistas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Edite e-mail de login, redefina senhas, altere dados clínicos, limpe registros ou exclua contas de clientes e nutricionistas.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setNutriModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shrink-0"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>+ Novo Nutricionista</span>
                  </Button>
                </div>

                {/* Filtros de Perfil + Busca */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'all', label: `Todos (${users.length})` },
                      {
                        id: 'client',
                        label: `Clientes (${users.filter((u) => u.role === 'client').length})`,
                      },
                      {
                        id: 'nutritionist',
                        label: `Nutricionistas (${users.filter((u) => u.role === 'nutritionist').length})`,
                      },
                      {
                        id: 'admin',
                        label: `Suporte (${users.filter((u) => u.role === 'admin').length})`,
                      },
                    ].map((f) => (
                      <Button
                        key={f.id}
                        type="button"
                        size="sm"
                        variant={roleFilter === f.id ? 'default' : 'outline'}
                        onClick={() => setRoleFilter(f.id as any)}
                        className={`h-8 text-xs ${
                          roleFilter === f.id ? 'bg-slate-900 text-white' : ''
                        }`}
                      >
                        {f.label}
                      </Button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                    <Input
                      placeholder="Buscar por nome ou e-mail de login..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail de Login</TableHead>
                      <TableHead>Perfil / Rota</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Status / CRN</TableHead>
                      <TableHead className="text-right">Ações do Suporte</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const cli = clientsMap[u.id]
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-semibold text-sm">{u.full_name}</div>
                            {u.role === 'client' && cli?.goal && (
                              <div className="text-[11px] text-muted-foreground">
                                Objetivo: {cli.goal}
                              </div>
                            )}
                            {u.role === 'nutritionist' && u.city_state && (
                              <div className="text-[11px] text-muted-foreground">
                                {u.city_state}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {u.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {u.role === 'client'
                                ? 'Cliente (/login/cliente)'
                                : u.role === 'nutritionist'
                                  ? 'Nutri (/login/nutri)'
                                  : 'Suporte (/login/suporte)'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatWhatsappDisplay(u.whatsapp)}</TableCell>
                          <TableCell>
                            {u.role === 'nutritionist' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono">{u.crn || '-'}</span>
                                {u.crn_status !== 'approved' ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleApproveCrn(u.id)}
                                    className="h-7 text-xs bg-emerald-600 text-white"
                                  >
                                    Aprovar CRN
                                  </Button>
                                ) : (
                                  <Badge className="bg-emerald-600 text-white text-[10px]">
                                    Aprovado
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <Badge
                                variant={u.active ? 'secondary' : 'destructive'}
                                className="text-[10px]"
                              >
                                {u.active ? 'Ativo' : 'Bloqueado'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditModal(u)}
                                className="h-8 text-xs gap-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Editar Login / Registro</span>
                              </Button>

                              {u.id !== currentAdmin?.id && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Excluir login e registros de ${u.full_name}`}
                                  onClick={() => setDeleteTarget(u)}
                                  className="h-8 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp-support" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Card className="lg:col-span-5 rounded-2xl">
              <CardHeader>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>Número de WhatsApp do Suporte do Sistema</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Quando o cliente tiver problema no sistema, a mensagem pronta será direcionada para este número. Também disponível na rota externa <code>/configurar-suporte</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSupportWhatsapp} className="space-y-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label>Seu Número de WhatsApp (com DDD) *</Label>
                    <Input
                      required
                      value={supportWhatsapp}
                      onChange={(e) => setSupportWhatsapp(e.target.value)}
                      placeholder="(11) 99999-0000"
                      className="font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Mensagem Padrão de Abertura</Label>
                    <Textarea
                      rows={3}
                      value={supportDefaultMsg}
                      onChange={(e) => setSupportDefaultMsg(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{savingSettings ? 'Salvando...' : 'Salvar WhatsApp do Suporte'}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 rounded-2xl">
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Chamados Disparados via WhatsApp ({requests.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Acompanhe os pedidos enviados para o Suporte do Sistema e para os Nutricionistas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {requests.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum chamado registrado ainda.</p>
                ) : (
                  requests.map((req) => {
                    const sender = req.profiles
                    const phone = sender?.whatsapp || ''
                    const reply = `Olá, *${sender?.full_name || 'Usuário'}*! Aqui é o Suporte MyLabs referente ao seu chamado de *${req.category}*.`
                    return (
                      <div key={req.id} className="rounded-xl border border-border p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                req.kind === 'system'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-emerald-600 text-white'
                              }
                            >
                              {req.kind === 'system' ? 'Suporte Sistema' : 'Nutricionista'}
                            </Badge>
                            <strong>{sender?.full_name || 'Usuário'}</strong>
                            <span className="text-muted-foreground">({req.category})</span>
                          </div>
                          <Badge variant={req.status === 'resolved' ? 'default' : 'secondary'}>
                            {req.status === 'resolved' ? 'Resolvido' : 'Aberto'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground bg-muted/40 rounded-lg p-2">{req.message}</p>
                        <div className="flex justify-end gap-2">
                          {isValidWhatsapp(phone) && (
                            <Button type="button" size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
                              <a href={buildWhatsappUrl(phone, reply)} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3" />
                                <span>Responder no WhatsApp</span>
                              </a>
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleRequestStatus(req.id, req.status)}
                            className="h-7 text-xs"
                          >
                            {req.status === 'resolved' ? 'Reabrir' : 'Concluir'}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal do Suporte: Editar Login & Registros do Cliente / Usuário */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-600 text-white">Gestão do Suporte / Admin</Badge>
              {editingUser && (
                <Badge variant="outline">
                  Perfil: {editingUser.role === 'client' ? 'Cliente' : editingUser.role === 'nutritionist' ? 'Nutricionista' : 'Admin'}
                </Badge>
              )}
            </div>
            <DialogTitle className="font-display text-lg">
              Editar Login e Registros - {editingUser?.full_name}
            </DialogTitle>
            <DialogDescription>
              Atualize credenciais de acesso (e-mail e senha), dados de contato e registros clínicos vinculados.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <form onSubmit={handleSaveEditUser} className="space-y-4">
              {/* Bloco 1: Credenciais de Login & Status */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>1. Credenciais de Login & Contato</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="edit-user-active"
                      checked={editActive}
                      onCheckedChange={setEditActive}
                    />
                    <Label htmlFor="edit-user-active" className="text-xs cursor-pointer">
                      {editActive ? 'Login Ativo' : 'Login Bloqueado'}
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                  <div className="flex flex-col gap-1.5">
                    <Label>Nome Completo *</Label>
                    <Input
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>WhatsApp (com DDD)</Label>
                    <Input
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      placeholder="(11) 98888-7777"
                      className="bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>E-mail de Acesso (Login) *</Label>
                    <Input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="bg-white font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Redefinir Senha (deixe em branco p/ manter)</Label>
                    <PasswordInput
                      placeholder="Nova senha (mín. 6 caracteres)"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bloco 2A: Registros Clínicos do Cliente */}
              {editingUser.role === 'client' && (
                <div className="rounded-2xl border border-border p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      2. Registros Clínicos do Cliente
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resettingRecords}
                      onClick={handleResetClientRecords}
                      className="h-7 text-xs gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {resettingRecords ? 'Limpando...' : 'Zerar Histórico de Dietas/Treinos/Logs'}
                      </span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                    <div className="flex flex-col gap-1.5">
                      <Label>Nutricionista Responsável</Label>
                      <Select value={editNutriId} onValueChange={setEditNutriId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nutricionista" />
                        </SelectTrigger>
                        <SelectContent>
                          {nutritionistsList.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Data de Nascimento</Label>
                      <DatePickerField
                        value={editBirthDate}
                        onChange={setEditBirthDate}
                        fromYear={1935}
                        toYear={new Date().getFullYear()}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Sexo Biológico</Label>
                      <Select value={editSex} onValueChange={(v) => setEditSex(v as 'male' | 'female')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 items-start">
                    <div className="flex flex-col gap-1.5">
                      <Label>Estatura (cm)</Label>
                      <Input
                        type="number"
                        min={100}
                        max={230}
                        value={editHeightCm}
                        onChange={(e) => setEditHeightCm(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Meta de Água (mL)</Label>
                      <Input
                        type="number"
                        min={500}
                        max={10000}
                        step={100}
                        value={editWaterGoalMl}
                        onChange={(e) => setEditWaterGoalMl(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Plano</Label>
                      <Select value={editPlan} onValueChange={setEditPlan}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pro">Plano Pro</SelectItem>
                          <SelectItem value="Clinic">Plano Clinic</SelectItem>
                          <SelectItem value="Standard">Plano Standard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Atividade Física</Label>
                      <Select
                        value={editActivityLevel}
                        onValueChange={(v) => setEditActivityLevel(v as ActivityLevel)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Objetivo Clínico</Label>
                    <Input value={editGoal} onChange={(e) => setEditGoal(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1.5">
                      <Label>Restrições Alimentares</Label>
                      <Textarea
                        rows={2}
                        value={editRestrictions}
                        onChange={(e) => setEditRestrictions(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Observações do Prontuário</Label>
                      <Textarea
                        rows={2}
                        value={editClinicalNotes}
                        onChange={(e) => setEditClinicalNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Bloco 2B: Dados Profissionais do Nutricionista */}
              {editingUser.role === 'nutritionist' && (
                <div className="rounded-2xl border border-border p-4 space-y-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    2. Dados Profissionais do Nutricionista
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                    <div className="flex flex-col gap-1.5">
                      <Label>Número CRN</Label>
                      <Input value={editCrn} onChange={(e) => setEditCrn(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Região do CRN</Label>
                      <Select value={editCrnRegion} onValueChange={setEditCrnRegion}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CRN_REGIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Especialidade Clínica</Label>
                      <Select value={editSpecialty} onValueChange={setEditSpecialty}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SPECIALTIES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Clínica / Consultório</Label>
                      <Input value={editClinic} onChange={(e) => setEditClinic(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <Label>Cidade</Label>
                      <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Estado (UF)</Label>
                      <Select value={editUf} onValueChange={setEditUf}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZIL_STATES.map((st) => (
                            <SelectItem key={st.uf} value={st.uf}>
                              {st.uf} - {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingEdit ? 'Salvando Alterações...' : 'Salvar Login e Registros'}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão de Login e Registros do Cliente/Usuário */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Excluir Login e Todos os Registros de {deleteTarget?.full_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente a conta de acesso (<code>{deleteTarget?.email}</code>), o prontuário, planos alimentares, fichas de treino, avaliações antropométricas e relatórios vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUser}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingUser}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDeleteUser()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingUser ? 'Excluindo...' : 'Confirmar Exclusão Permanente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
