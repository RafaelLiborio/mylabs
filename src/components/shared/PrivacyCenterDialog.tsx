import { useCallback, useEffect, useState } from 'react'
import { supabase, translateErrorPt } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LegalLinks } from '@/components/shared/LegalLinks'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { CONSENT_LABELS, type ConsentDocumentId } from '@/domain/legal'
import { CheckCircle2, Download, Loader2, Send, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

const REQUEST_TYPES: { id: string; label: string; hint: string }[] = [
  { id: 'correcao', label: 'Correção de dados', hint: 'Indique qual dado está incorreto ou desatualizado.' },
  {
    id: 'eliminacao',
    label: 'Eliminação de dados / encerramento da conta',
    hint: 'Solicite a exclusão da conta e dos dados, quando permitido por lei.',
  },
  { id: 'portabilidade', label: 'Portabilidade dos dados', hint: 'Solicite a entrega dos dados em formato estruturado.' },
  {
    id: 'revogacao',
    label: 'Revogação de consentimento',
    hint: 'Revogar o consentimento pode impedir o uso de funcionalidades que dependam dos dados.',
  },
  {
    id: 'informacao',
    label: 'Informações sobre tratamento e compartilhamento',
    hint: 'Pergunte com quem e para que seus dados são tratados.',
  },
  { id: 'outro', label: 'Outra solicitação de privacidade', hint: 'Descreva sua solicitação.' },
]

/** Tabelas e coluna-dono usadas para montar a cópia dos dados do próprio usuário (RLS filtra o restante). */
const EXPORT_SOURCES: { table: string; ownerColumn: string }[] = [
  { table: 'profiles', ownerColumn: 'id' },
  { table: 'clients', ownerColumn: 'id' },
  { table: 'legal_acceptances', ownerColumn: 'user_id' },
  { table: 'anthropometry_assessments', ownerColumn: 'client_id' },
  { table: 'weight_checkins', ownerColumn: 'client_id' },
  { table: 'water_logs', ownerColumn: 'client_id' },
  { table: 'meal_logs', ownerColumn: 'client_id' },
  { table: 'workout_logs', ownerColumn: 'client_id' },
  { table: 'meal_photo_posts', ownerColumn: 'client_id' },
  { table: 'workout_day_photos', ownerColumn: 'client_id' },
  { table: 'diet_plans', ownerColumn: 'client_id' },
  { table: 'workout_plans', ownerColumn: 'client_id' },
  { table: 'support_requests', ownerColumn: 'from_user' },
  { table: 'custom_formulas', ownerColumn: 'owner_id' },
]

interface AcceptanceRow {
  document: string
  version: string
  accepted_at: string
}

export function PrivacyCenterDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user, profile } = useAuth()
  const [acceptances, setAcceptances] = useState<AcceptanceRow[]>([])
  const [exporting, setExporting] = useState(false)
  const [requestType, setRequestType] = useState<string>('informacao')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)

  const loadAcceptances = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('legal_acceptances')
      .select('document, version, accepted_at')
      .eq('user_id', user.id)
      .order('accepted_at', { ascending: false })
    setAcceptances((data as AcceptanceRow[]) || [])
  }, [user?.id])

  useEffect(() => {
    if (open) loadAcceptances()
  }, [open, loadAcceptances])

  const handleExport = async () => {
    if (!user?.id) return
    setExporting(true)
    try {
      const result: Record<string, unknown> = {
        gerado_em: new Date().toISOString(),
        titular: { id: user.id, email: user.email },
        observacao:
          'Cópia dos dados pessoais associados à sua conta no MyLabs (LGPD, art. 18, II e V). Arquivos de fotos são referenciados pelo caminho de armazenamento.',
      }
      for (const src of EXPORT_SOURCES) {
        const { data, error } = await (supabase as any)
          .from(src.table)
          .select('*')
          .eq(src.ownerColumn, user.id)
        if (!error && data && data.length > 0) result[src.table] = data
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mylabs-meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Cópia dos seus dados baixada com sucesso.')
    } catch (err: any) {
      toast.error(translateErrorPt(err, 'Não foi possível gerar a cópia dos dados.'))
    } finally {
      setExporting(false)
    }
  }

  const handleSendRequest = async () => {
    if (!user?.id) return
    const type = REQUEST_TYPES.find((t) => t.id === requestType) || REQUEST_TYPES[0]
    setSending(true)
    try {
      const message = `[Solicitação LGPD] ${type.label}. ${details.trim().slice(0, 1500)}`.trim()
      const { error } = await supabase.from('support_requests').insert({
        kind: 'system',
        from_user: user.id,
        to_user: null,
        category: `LGPD: ${type.label}`.slice(0, 120),
        message,
        status: 'sent',
      })
      if (error) throw error
      toast.success('Solicitação registrada. O Suporte responderá nos prazos da LGPD.')
      setDetails('')
    } catch (err: any) {
      toast.error(translateErrorPt(err, 'Não foi possível registrar a solicitação.'))
    } finally {
      setSending(false)
    }
  }

  const activeType = REQUEST_TYPES.find((t) => t.id === requestType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="font-display">Privacidade e Meus Dados</DialogTitle>
          </div>
          <DialogDescription>
            Exerça seus direitos de titular (LGPD, art. 18): acesse seus dados, peça correção, eliminação ou revogue o consentimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <LegalLinks newTab className="text-xs text-emerald-800" />

          <div className="rounded-xl border border-border p-3.5 space-y-2">
            <span className="text-xs font-bold text-slate-900 block">Seus aceites registrados</span>
            {acceptances.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum aceite registrado ainda.</p>
            ) : (
              <ul className="space-y-1">
                {acceptances.map((a) => (
                  <li
                    key={`${a.document}-${a.version}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {CONSENT_LABELS[a.document as ConsentDocumentId]?.title || a.document}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      v{a.version} • {new Date(a.accepted_at).toLocaleString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border p-3.5 space-y-2">
            <span className="text-xs font-bold text-slate-900 block">Acesso e portabilidade</span>
            <p className="text-xs text-muted-foreground">
              Baixe uma cópia estruturada (JSON) dos dados associados à sua conta.
              {profile?.role === 'nutritionist' &&
                ' Os dados clínicos dos seus clientes pertencem a eles e não estão incluídos.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={handleExport}
              className="gap-1.5"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Baixar meus dados</span>
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Registrar solicitação ao Suporte</span>
              <Badge variant="secondary" className="text-[10px]">
                resposta em até 15 dias
              </Badge>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de solicitação</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeType && <p className="text-[11px] text-muted-foreground">{activeType.hint}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="privacy-details" className="text-xs">
                Detalhes (opcional)
              </Label>
              <Textarea
                id="privacy-details"
                rows={3}
                maxLength={1500}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Descreva sua solicitação. Não inclua senhas."
              />
            </div>
            <Button
              type="button"
              disabled={sending}
              onClick={handleSendRequest}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Enviar solicitação</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
