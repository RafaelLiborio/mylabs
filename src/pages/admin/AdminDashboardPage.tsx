import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, invokeManageUsers } from '@/lib/supabase'
import { AppShell } from '@/components/shared/AppShell'
import { ClientRegisterDialog } from '@/pages/nutritionist/ClientRegisterDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  buildWhatsappUrl,
  formatWhatsappDisplay,
  isValidWhatsapp,
} from '@/domain/whatsapp'
import {
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Phone,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

export function AdminDashboardPage() {
  const [supportWhatsapp, setSupportWhatsapp] = useState('')
  const [supportDefaultMsg, setSupportDefaultMsg] = useState(
    'Olá! Preciso de ajuda técnica com o sistema MyLabs.',
  )
  const [savingSettings, setSavingSettings] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  const loadAdminData = useCallback(async () => {
    const [{ data: sets }, { data: reqs }, { data: profs }] = await Promise.all([
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
    ])

    const num = sets?.find((s) => s.key === 'support_whatsapp')?.value
    const msg = sets?.find((s) => s.key === 'support_whatsapp_message')?.value
    if (num && typeof num === 'string') setSupportWhatsapp(num)
    if (msg && typeof msg === 'string') setSupportDefaultMsg(msg)
    setRequests(reqs || [])
    setUsers(profs || [])
  }, [])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

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
      toast.error(err?.message || 'Erro ao salvar.')
    } finally {
      setSavingSettings(false)
    }
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

  return (
    <AppShell
      headerActions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/configurar-suporte">
              <Settings2 className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Tela Externa WhatsApp</span>
            </Link>
          </Button>
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
                Painel de Operações, Usuários & Suporte WhatsApp do Sistema
              </Badge>
              <h1 className="font-display font-extrabold text-xl">
                Central de Suporte & Governança MyLabs
              </h1>
              <p className="text-xs text-slate-300">
                WhatsApp ativo do Suporte Técnico: <strong className="text-amber-300">{formatWhatsappDisplay(supportWhatsapp)}</strong>
              </p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-center">
                <span className="text-[11px] text-slate-300 block">Usuários Ativos</span>
                <strong className="font-display text-lg">{users.length}</strong>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-2 text-center">
                <span className="text-[11px] text-slate-300 block">Chamados WhatsApp</span>
                <strong className="font-display text-lg text-amber-300">{requests.length}</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="whatsapp-support" className="space-y-5">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 h-auto p-1.5 rounded-2xl bg-muted">
            <TabsTrigger value="whatsapp-support" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Configuração WhatsApp do Suporte & Chamados</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="py-2.5 rounded-xl gap-2 text-xs sm:text-sm font-semibold">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Usuários da Plataforma & Credenciamento CRN ({users.length})</span>
            </TabsTrigger>
          </TabsList>

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
                  <div className="space-y-1">
                    <Label>Seu Número de WhatsApp (com DDD) *</Label>
                    <Input
                      required
                      value={supportWhatsapp}
                      onChange={(e) => setSupportWhatsapp(e.target.value)}
                      placeholder="(11) 99999-0000"
                      className="font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
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

          <TabsContent value="users">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Contas Cadastradas na Plataforma MyLabs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>CRN / Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-semibold">{u.full_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatWhatsappDisplay(u.whatsapp)}</TableCell>
                        <TableCell>
                          {u.role === 'nutritionist' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono">{u.crn || '—'}</span>
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
                                <Badge className="bg-emerald-600 text-white text-[10px]">Aprovado</Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Verificado
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
