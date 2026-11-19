import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, invokeManageUsers } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Award,
  Building2,
  CheckCircle2,
  FlaskConical,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
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

export function AuthPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'register-nutri'>('login')
  const [loading, setLoading] = useState(false)

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Detailed Nutritionist Registration state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [crn, setCrn] = useState('')
  const [crnRegion, setCrnRegion] = useState('CRN-3 (SP, MS)')
  const [specialty, setSpecialty] = useState(SPECIALTIES[0])
  const [clinicName, setClinicName] = useState('')
  const [cityState, setCityState] = useState('')
  const [bio, setBio] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      })
      if (error) throw error
      toast.success('Bem-vindo ao MyLabs!')
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || 'Credenciais inválidas. Verifique seu e-mail e senha.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (demoEmail: string, label: string) => {
    setLoading(true)
    try {
      await invokeManageUsers({ action: 'bootstrap_demo' }).catch(() => null)
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: 'Mylabs@2026',
      })
      if (error) throw error
      toast.success(`Sessão iniciada como ${label}`)
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || 'Falha no acesso rápido.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterNutritionist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) {
      toast.error('Informe seu WhatsApp profissional com DDD para receber os pedidos de suporte dos clientes.')
      return
    }
    setLoading(true)
    try {
      await invokeManageUsers({
        action: 'register_nutritionist',
        full_name: fullName,
        email,
        password,
        whatsapp,
        crn,
        crn_region: crnRegion,
        specialty,
        clinic_name: clinicName,
        city_state: cityState,
        bio,
      })

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInErr) throw signInErr

      toast.success('Cadastro profissional concluído! Seu WhatsApp de atendimento já está ativo.')
      navigate('/')
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível concluir o cadastro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-6xl w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-6">
        {/* Coluna Institucional / Destaques Científicos */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-900">
                My<span className="text-emerald-600">Labs</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Plataforma Clínica de Nutrição, Treinos & Antropometria
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Badge className="bg-emerald-600 text-white gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Arquitetura Clínica & Evidência Científica
            </Badge>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 leading-tight">
              Prescrição nutricional, periodização de treinos com GIFs em português e evolução antropométrica sem atrito.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Equações validadas (Mifflin-St Jeor, Harris-Benedict, Cunningham, Jackson & Pollock, Durnin & Womersley, Siri), laboratório de fórmulas personalizadas, relatórios automatizados e integração direta com WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-border bg-white/80 p-3.5 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Isolamento por Perfil</span>
              </div>
              <p className="text-muted-foreground">
                Clientes acessam exclusivamente seu portal de Dieta, Treino, Evolução e Assistência WhatsApp.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white/80 p-3.5 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp Duplo Integrado</span>
              </div>
              <p className="text-muted-foreground">
                Mensagens prontas para o WhatsApp do Nutricionista ou para o Suporte do Sistema.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Settings2 className="w-4 h-4 text-amber-700" />
                <span>Dono do Sistema • Configurar WhatsApp do Suporte</span>
              </div>
              <p className="text-[11px] text-amber-900/80">
                Tela externa para cadastrar o seu número de WhatsApp que receberá os chamados técnicos do sistema.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 bg-white border-amber-300 text-amber-950 hover:bg-amber-100">
              <Link to="/configurar-suporte">Configurar Número</Link>
            </Button>
          </div>
        </div>

        {/* Coluna de Login / Cadastro Detalhado de Nutricionista */}
        <div className="lg:col-span-7">
          <Card className="border-border shadow-xl rounded-3xl overflow-hidden pt-0">
            <CardHeader className="bg-slate-900 text-white pt-6 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-display text-xl">Acesso à Plataforma MyLabs</CardTitle>
                  <CardDescription className="text-slate-300 text-xs mt-1">
                    Entre com sua conta ou realize seu cadastro profissional completo como Nutricionista
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Supabase Auth & RLS
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register-nutri')}>
                <TabsList className="grid w-full grid-cols-2 mb-5">
                  <TabsTrigger value="login" className="gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Entrar na Conta</span>
                  </TabsTrigger>
                  <TabsTrigger value="register-nutri" className="gap-2">
                    <Stethoscope className="w-4 h-4" />
                    <span>Cadastro de Nutricionista</span>
                  </TabsTrigger>
                </TabsList>

                {/* ABA 1: LOGIN */}
                <TabsContent value="login" className="space-y-5">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email">E-mail de Acesso</Label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                        <Input
                          id="login-email"
                          type="email"
                          required
                          placeholder="seu.email@exemplo.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                        <Input
                          id="login-password"
                          type="password"
                          required
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {loading ? 'Autenticando...' : 'Entrar no MyLabs'}
                    </Button>
                  </form>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <Separator className="flex-1" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Acesso Rápido Homologado (1 Clique)
                      </span>
                      <Separator className="flex-1" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleQuickLogin('lucas@mylabs.app', 'Lucas Mendes (Cliente)')}
                        className="h-auto py-3 px-3 flex flex-col items-start gap-1 border-emerald-200 hover:bg-emerald-50/60"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <User className="w-3.5 h-3.5" />
                          <span>Entrar como Cliente</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">Lucas Mendes</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleQuickLogin('camila@mylabs.app', 'Dra. Camila Rocha (Nutricionista)')}
                        className="h-auto py-3 px-3 flex flex-col items-start gap-1 border-indigo-200 hover:bg-indigo-50/60"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Entrar como Nutri</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">Dra. Camila Rocha</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleQuickLogin('suporte@mylabs.app', 'Suporte & Admin MyLabs')}
                        className="h-auto py-3 px-3 flex flex-col items-start gap-1 border-amber-200 hover:bg-amber-50/60"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Suporte / Admin</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">Rafael Libório</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* ABA 2: CADASTRO DETALHADO DE NUTRICIONISTA */}
                <TabsContent value="register-nutri">
                  <form onSubmit={handleRegisterNutritionist} className="space-y-4">
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Integração Direta com seu WhatsApp:</strong> O número cadastrado abaixo receberá automaticamente as mensagens prontas de assistência enviadas pelos seus clientes no aplicativo.
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-name">Nome Completo Profissional *</Label>
                        <Input
                          id="nutri-name"
                          required
                          placeholder="Ex: Dra. Carolina Almeida"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-whatsapp">WhatsApp de Atendimento (com DDD) *</Label>
                        <Input
                          id="nutri-whatsapp"
                          required
                          placeholder="Ex: (11) 98888-7777"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-email">E-mail Profissional *</Label>
                        <Input
                          id="nutri-email"
                          type="email"
                          required
                          placeholder="carolina@clinica.com.br"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-password">Senha de Acesso (mín. 6 caracteres) *</Label>
                        <Input
                          id="nutri-password"
                          type="password"
                          required
                          minLength={6}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-crn">Número de Registro CRN *</Label>
                        <div className="relative">
                          <Award className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          <Input
                            id="nutri-crn"
                            required
                            placeholder="Ex: CRN-3 54321"
                            value={crn}
                            onChange={(e) => setCrn(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Região do Conselho (CRN) *</Label>
                        <Select value={crnRegion} onValueChange={setCrnRegion}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a região" />
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

                      <div className="space-y-1.5">
                        <Label>Especialidade Clínica Principal *</Label>
                        <Select value={specialty} onValueChange={setSpecialty}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a especialidade" />
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

                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-clinic">Nome da Clínica / Consultório</Label>
                        <div className="relative">
                          <Building2 className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          <Input
                            id="nutri-clinic"
                            placeholder="Ex: Instituto MyLabs Performance"
                            value={clinicName}
                            onChange={(e) => setClinicName(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="nutri-city">Cidade / UF</Label>
                        <Input
                          id="nutri-city"
                          placeholder="Ex: São Paulo, SP"
                          value={cityState}
                          onChange={(e) => setCityState(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <Label htmlFor="nutri-bio">Resumo Profissional & Abordagem Clínica</Label>
                        <Textarea
                          id="nutri-bio"
                          rows={2}
                          placeholder="Descreva sua formação, metodologia de atendimento e foco clínico..."
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      {loading ? 'Criando Conta Profissional...' : 'Concluir Cadastro de Nutricionista & Acessar'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
