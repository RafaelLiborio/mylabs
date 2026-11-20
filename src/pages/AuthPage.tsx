import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, invokeManageUsers, translateErrorPt } from '@/lib/supabase'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  FlaskConical,
  Lock,
  Mail,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

export type LoginRolePortal = 'client' | 'nutritionist' | 'admin'

interface PortalMeta {
  role: LoginRolePortal
  routePath: string
  title: string
  subtitle: string
  badgeLabel: string
  accentBtnClass: string
  headerBgClass: string
  demoEmail: string
  demoLabel: string
  icon: React.ReactNode
}

const PORTALS: Record<LoginRolePortal, PortalMeta> = {
  client: {
    role: 'client',
    routePath: '/login/cliente',
    title: 'Acesso do Cliente • MyLabs',
    subtitle: 'Rota exclusiva para pacientes acompanharem dieta, treinos com GIFs e evolução',
    badgeLabel: 'Rota Exclusiva • Cliente',
    accentBtnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    headerBgClass: 'bg-gradient-to-r from-slate-900 to-emerald-950',
    demoEmail: 'lucas@mylabs.app',
    demoLabel: 'Lucas Mendes (Cliente)',
    icon: <User className="w-4 h-4" />,
  },
  nutritionist: {
    role: 'nutritionist',
    routePath: '/login/nutri',
    title: 'Acesso do Nutricionista • MyLabs',
    subtitle: 'Rota exclusiva para nutricionistas credenciados pelo Suporte gerenciarem seus clientes',
    badgeLabel: 'Rota Exclusiva • Nutricionista',
    accentBtnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    headerBgClass: 'bg-gradient-to-r from-slate-900 to-indigo-950',
    demoEmail: 'camila@mylabs.app',
    demoLabel: 'Dra. Camila Rocha (Nutricionista)',
    icon: <Stethoscope className="w-4 h-4" />,
  },
  admin: {
    role: 'admin',
    routePath: '/login/suporte',
    title: 'Acesso do Suporte & Admin • MyLabs',
    subtitle: 'Rota restrita para administração do sistema, cadastro de nutricionistas e suporte',
    badgeLabel: 'Rota Exclusiva • Suporte / Admin',
    accentBtnClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    headerBgClass: 'bg-gradient-to-r from-slate-900 to-amber-950',
    demoEmail: 'suporte@mylabs.app',
    demoLabel: 'Rafael Libório (Suporte / Admin)',
    icon: <ShieldCheck className="w-4 h-4" />,
  },
}

const ROLE_NAME_PT: Record<string, string> = {
  client: 'Cliente (/login/cliente)',
  nutritionist: 'Nutricionista (/login/nutri)',
  admin: 'Suporte / Admin (/login/suporte)',
}

export function AuthPage({ portalRole = 'client' }: { portalRole?: LoginRolePortal }) {
  const navigate = useNavigate()
  const portal = PORTALS[portalRole] || PORTALS.client

  const [loading, setLoading] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const verifyUserRoleMatchesPortal = async (userId: string) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('role, full_name, active')
      .eq('id', userId)
      .maybeSingle()

    if (!prof || !prof.active) {
      await supabase.auth.signOut()
      throw new Error('Sua conta está inativa ou não foi encontrada.')
    }

    if (prof.role !== portal.role) {
      await supabase.auth.signOut()
      throw new Error(
        `Esta rota (${portal.routePath}) é exclusiva para ${
          portal.role === 'client'
            ? 'Clientes'
            : portal.role === 'nutritionist'
              ? 'Nutricionistas'
              : 'Suporte / Admin'
        }. Sua conta possui perfil de ${ROLE_NAME_PT[prof.role] || prof.role}.`,
      )
    }
    return prof
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      })
      if (error || !data?.user) {
        throw error || new Error('E-mail ou senha incorretos.')
      }

      const prof = await verifyUserRoleMatchesPortal(data.user.id)
      toast.success(`Bem-vindo(a) ao MyLabs, ${prof.full_name || 'Usuário'}!`)
      navigate(
        portal.role === 'client'
          ? '/cliente'
          : portal.role === 'nutritionist'
            ? '/nutri'
            : '/suporte',
      )
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async () => {
    setLoading(true)
    try {
      await invokeManageUsers({ action: 'bootstrap_demo' }).catch(() => null)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: portal.demoEmail,
        password: 'Mylabs@2026',
      })
      if (error || !data?.user) throw error
      await verifyUserRoleMatchesPortal(data.user.id)
      toast.success(`Sessão iniciada como ${portal.demoLabel}`)
      navigate(
        portal.role === 'client'
          ? '/cliente'
          : portal.role === 'nutritionist'
            ? '/nutri'
            : '/suporte',
      )
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-6xl w-full mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-6">
        {/* Coluna Institucional */}
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
              Rotas de Acesso Exclusivas por Perfil
            </Badge>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 leading-tight">
              Prescrição nutricional, periodização de treinos com GIFs em português e evolução antropométrica sem atrito.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cada perfil possui sua própria rota de entrada autenticada. O credenciamento e cadastro de novos nutricionistas é realizado exclusivamente pelo módulo de Suporte.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-border bg-white/80 p-3.5 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Isolamento por Rota & RLS</span>
              </div>
              <p className="text-muted-foreground">
                Clientes entram em <code>/login/cliente</code>, Nutricionistas em <code>/login/nutri</code> e Suporte em <code>/login/suporte</code>.
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
            <Button
              asChild
              variant="outline"
              size="sm"
              className="shrink-0 bg-white border-amber-300 text-amber-950 hover:bg-amber-100"
            >
              <Link to="/configurar-suporte">Configurar Número</Link>
            </Button>
          </div>
        </div>

        {/* Coluna de Login por Rota Específica (Sem cadastro público de nutricionista) */}
        <div className="lg:col-span-7">
          <Card className="border-border shadow-xl rounded-3xl overflow-hidden pt-0">
            <CardHeader className={`${portal.headerBgClass} text-white pt-6 pb-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-display text-xl">{portal.title}</CardTitle>
                  <CardDescription className="text-slate-300 text-xs mt-1">
                    {portal.subtitle}
                  </CardDescription>
                </div>
                <Badge className="bg-white/15 text-white border-white/25">
                  {portal.badgeLabel}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Seletor das 3 Rotas Específicas de Login */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Selecione a Rota de Entrada do Seu Perfil
                </span>
                <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-muted">
                  {(['client', 'nutritionist', 'admin'] as LoginRolePortal[]).map((rKey) => {
                    const p = PORTALS[rKey]
                    const isActive = portalRole === rKey
                    return (
                      <Button
                        key={rKey}
                        type="button"
                        variant={isActive ? 'default' : 'ghost'}
                        onClick={() => navigate(p.routePath)}
                        className={`h-10 rounded-xl gap-1.5 text-xs font-semibold ${
                          isActive ? p.accentBtnClass : 'text-muted-foreground'
                        }`}
                      >
                        {p.icon}
                        <span>
                          {rKey === 'client'
                            ? 'Sou Cliente'
                            : rKey === 'nutritionist'
                              ? 'Sou Nutricionista'
                              : 'Suporte / Admin'}
                        </span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-mail de Acesso ({portal.routePath})</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
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
                  <PasswordInput
                    id="login-password"
                    withLockIcon
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className={`w-full font-semibold gap-2 ${portal.accentBtnClass}`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{loading ? 'Autenticando...' : `Entrar em ${portal.title}`}</span>
                </Button>
              </form>

              {portalRole === 'nutritionist' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-950">
                  <strong>Credenciamento de Nutricionistas:</strong> O cadastro de novos nutricionistas é realizado exclusivamente pela equipe de <strong>Suporte / Admin</strong>. Solicite suas credenciais ao administrador da plataforma.
                </div>
              )}

              {portalRole === 'client' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950">
                  <strong>Acesso do Paciente:</strong> Utilize o e-mail e a senha gerados pelo seu nutricionista no momento do seu cadastro clínico.
                </div>
              )}

              {/* Acesso Rápido da Rota Atual */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Demonstração Homologada desta Rota (1 Clique)
                  </span>
                  <Separator className="flex-1" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={handleQuickLogin}
                  className="w-full py-3 flex items-center justify-between px-4 border-border hover:bg-muted/60"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    {portal.icon}
                    <span>Entrar agora como {portal.demoLabel}</span>
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-mono">
                    {portal.demoEmail}
                  </Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
