import React, { useState } from 'react'
import { invokeManageUsers, translateErrorPt } from '@/lib/supabase'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ACTIVITY_FACTORS, type ActivityLevel, waterGoalMl } from '@/domain/energy'
import { buildWhatsappUrl, isValidWhatsapp } from '@/domain/whatsapp'
import { CheckCircle2, Copy, ExternalLink, KeyRound, Sparkles, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

interface ClientRegisterDialogProps {
  onClientCreated: (newClientId: string) => void
}

export function ClientRegisterDialog({ onClientCreated }: ClientRegisterDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<{
    id: string
    name: string
    email: string
    password: string
    whatsapp: string
  } | null>(null)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('Mylabs@2026')
  const [whatsapp, setWhatsapp] = useState('')
  const [birthDate, setBirthDate] = useState('1996-05-10')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [heightCm, setHeightCm] = useState(175)
  const [weightKg, setWeightKg] = useState(76)
  const [goal, setGoal] = useState('Hipertrofia & Recomposição Corporal')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [plan] = useState('Pro')
  const [reportIntervalDays, setReportIntervalDays] = useState(15)
  const [restrictions, setRestrictions] = useState('')
  const [clinicalNotes, setClinicalNotes] = useState('')

  const autoWater = waterGoalMl(weightKg, 35)

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setPassword('Mylabs@2026')
    setWhatsapp('')
    setRestrictions('')
    setClinicalNotes('')
    setCreatedCredentials(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await invokeManageUsers<{ ok: boolean; client_id: string; email: string }>({
        action: 'create_client',
        full_name: fullName,
        email,
        password,
        whatsapp,
        birth_date: birthDate,
        sex,
        height_cm: heightCm,
        weight_kg: weightKg,
        goal,
        activity_level: activityLevel,
        restrictions,
        clinical_notes: clinicalNotes,
        water_goal_ml: autoWater,
        plan,
        report_interval_days: reportIntervalDays,
      })

      setCreatedCredentials({
        id: res.client_id,
        name: fullName,
        email: res.email,
        password,
        whatsapp,
      })
      toast.success(`Cliente ${fullName} cadastrado com usuário e login ativos!`)
      onClientCreated(res.client_id)
    } catch (err: any) {
      toast.error(translateErrorPt(err))
    } finally {
      setSubmitting(false)
    }
  }

  const welcomeWhatsappText = createdCredentials
    ? [
        `Olá, *${createdCredentials.name}*! Bem-vindo(a) ao *MyLabs*! 🧬`,
        `Seu acesso exclusivo para acompanhar sua Dieta, Treinos com GIFs e Evolução já está liberado:`,
        '',
        `🔗 *Rota Exclusiva de Acesso:* /login/cliente`,
        `📧 *Login (E-mail):* ${createdCredentials.email}`,
        `🔑 *Senha de Acesso:* ${createdCredentials.password}`,
        '',
        `Qualquer dúvida clínica você pode me chamar diretamente pelo botão de Assistência dentro do app!`,
      ].join('\n')
    : ''

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs">
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Cliente & Criar Login</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white">Prontuário + Conta Auth</Badge>
            <Badge variant="outline">Rota: /login/cliente</Badge>
          </div>
          <DialogTitle className="font-display text-lg">
            Cadastro Completo de Cliente (Criação Automática de Usuário e Login)
          </DialogTitle>
          <DialogDescription>
            Ao salvar, o MyLabs cria a conta de autenticação do cliente, vincula exclusivamente ao seu controle e agenda o envio periódico do relatório profissional.
          </DialogDescription>
        </DialogHeader>

        {!createdCredentials ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bloco 1: Credenciais de Acesso & Contato */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <KeyRound className="w-3.5 h-3.5" />
                <span>1. Dados de Acesso (Login do Cliente) & WhatsApp</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="client-fullname">Nome Completo do Cliente *</Label>
                  <Input
                    id="client-fullname"
                    required
                    placeholder="Ex: Gabriel Ferreira"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-whatsapp">WhatsApp do Cliente (com DDD)</Label>
                  <Input
                    id="client-whatsapp"
                    placeholder="Ex: (11) 97777-8888"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-email">E-mail de Login do Cliente *</Label>
                  <Input
                    id="client-email"
                    type="email"
                    required
                    placeholder="gabriel@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-password">Senha Inicial de Acesso *</Label>
                  <PasswordInput
                    id="client-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Bloco 2: Parâmetros Antropométricos & Clínicos */}
            <div className="rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  2. Perfil Biológico, Objetivo & Frequência de Relatório
                </span>
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Meta hídrica calculada: {autoWater} mL/dia
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Sexo Biológico</Label>
                  <Select value={sex} onValueChange={(v) => setSex(v as 'male' | 'female')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-birth">Data de Nascimento</Label>
                  <DatePickerField
                    id="client-birth"
                    value={birthDate}
                    onChange={setBirthDate}
                    fromYear={1935}
                    toYear={new Date().getFullYear()}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-height">Estatura (cm)</Label>
                  <Input
                    id="client-height"
                    type="number"
                    min={100}
                    max={230}
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-weight">Peso Inicial (kg)</Label>
                  <Input
                    id="client-weight"
                    type="number"
                    min={30}
                    max={250}
                    step={0.1}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="client-goal">Objetivo Clínico</Label>
                  <Input
                    id="client-goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Nível de Atividade Física</Label>
                  <Select value={activityLevel} onValueChange={(v) => setActivityLevel(v as ActivityLevel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTIVITY_FACTORS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label} ({v.factor}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Ciclo do Relatório Automático</Label>
                  <Select
                    value={String(reportIntervalDays)}
                    onValueChange={(v) => setReportIntervalDays(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">A cada 7 dias (Semanal)</SelectItem>
                      <SelectItem value="14">A cada 14 dias (Quinzenal)</SelectItem>
                      <SelectItem value="15">A cada 15 dias (Padrão)</SelectItem>
                      <SelectItem value="30">A cada 30 dias (Mensal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-restrictions">Restrições Alimentares / Alergias</Label>
                  <Textarea
                    id="client-restrictions"
                    rows={2}
                    placeholder="Ex: Intolerância à lactose, alergia a crustáceos..."
                    value={restrictions}
                    onChange={(e) => setRestrictions(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client-notes">Anamnese & Observações Clínicas</Label>
                  <Textarea
                    id="client-notes"
                    rows={2}
                    placeholder="Rotina de sono, horários de treino, histórico..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 pb-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Criando Usuário & Prontuário...' : 'Criar Conta e Cadastrar Cliente'}</span>
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-display font-bold text-base">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Conta e Login Criados com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-900/80">
                O cliente <strong>{createdCredentials.name}</strong> já pode entrar pela rota exclusiva <code>/login/cliente</code> com as credenciais abaixo:
              </p>
              <div className="rounded-xl bg-white border border-emerald-200 p-3.5 space-y-1 text-xs font-mono">
                <div>
                  <strong>Rota Exclusiva:</strong> /login/cliente
                </div>
                <div>
                  <strong>E-mail (Login):</strong> {createdCredentials.email}
                </div>
                <div>
                  <strong>Senha:</strong> {createdCredentials.password}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(welcomeWhatsappText)
                    toast.success('Credenciais copiadas!')
                  }}
                  className="gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copiar Acesso</span>
                </Button>

                {isValidWhatsapp(createdCredentials.whatsapp) && (
                  <Button
                    type="button"
                    asChild
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <a
                      href={buildWhatsappUrl(createdCredentials.whatsapp, welcomeWhatsappText)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Enviar Login por WhatsApp ao Cliente</span>
                    </a>
                  </Button>
                )}
              </div>

              <Button type="button" onClick={() => setOpen(false)}>
                Abrir Prontuário do Cliente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
