import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Activity, FlaskConical, LogOut, ShieldCheck, Stethoscope, User } from 'lucide-react'

const ROLE_META: Record<string, { label: string; badgeClass: string; icon: React.ReactNode }> = {
  client: {
    label: 'Portal do Cliente',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <User className="w-3.5 h-3.5" />,
  },
  nutritionist: {
    label: 'Módulo Clínico • Nutricionista',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <Stethoscope className="w-3.5 h-3.5" />,
  },
  admin: {
    label: 'Suporte & Administração MyLabs',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
}

export function AppShell({
  children,
  headerActions,
}: {
  children: React.ReactNode
  headerActions?: React.ReactNode
}) {
  const { profile, signOut } = useAuth()
  const roleInfo = ROLE_META[profile?.role || 'client'] || ROLE_META.client
  const initials = (profile?.full_name || 'ML')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-border shadow-2xs no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Identidade Visual MyLabs */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-lg tracking-tight text-slate-900">
                  My<span className="text-emerald-600">Labs</span>
                </span>
                <Badge variant="outline" className={`gap-1 text-[11px] font-semibold ${roleInfo.badgeClass}`}>
                  {roleInfo.icon}
                  <span>{roleInfo.label}</span>
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden md:block">
                Plataforma Científica de Nutrição Clínica, Periodização de Treinos & Antropometria
              </p>
            </div>
          </div>

          {/* Ações contextuais do perfil logado */}
          <div className="flex items-center gap-2.5">
            {headerActions}

            {profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 pl-2 pr-3 rounded-xl gap-2.5">
                    <Avatar className="h-7 w-7">
                      {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
                      <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left hidden sm:block">
                      <span className="block text-xs font-bold leading-none text-foreground">
                        {profile.full_name}
                      </span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {profile.crn ? profile.crn : profile.email}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="font-semibold text-sm">{profile.full_name}</div>
                    <div className="text-xs text-muted-foreground font-normal">{profile.email}</div>
                    {profile.crn && (
                      <Badge variant="secondary" className="mt-1.5 text-[10px]">
                        {profile.crn}
                      </Badge>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da Conta</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6">{children}</main>

      <footer className="border-t border-border bg-white mt-12 py-4 px-4 sm:px-6 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-slate-800">MyLabs</span>
            <span>•</span>
            <span>Nutrição Baseada em Evidências, Treinos Periodizados & Suporte Integrado</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <Activity className="w-3.5 h-3.5" />
              Supabase Realtime & Base TACO 4ª Ed. Online
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
