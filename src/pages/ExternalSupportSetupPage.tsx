import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, invokeManageUsers } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  buildReadyWhatsappMessage,
  buildWhatsappUrl,
  formatWhatsappDisplay,
  isValidWhatsapp,
} from '@/domain/whatsapp'
import { ArrowLeft, CheckCircle2, ExternalLink, FlaskConical, MessageSquare, Phone, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export function ExternalSupportSetupPage() {
  const [whatsapp, setWhatsapp] = useState('')
  const [defaultMessage, setDefaultMessage] = useState(
    'Olá! Preciso de suporte técnico referente ao sistema MyLabs.',
  )
  const [saving, setSaving] = useState(false)
  const [savedNumber, setSavedNumber] = useState('')

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['support_whatsapp', 'support_whatsapp_message'])
      .then(({ data }) => {
        if (!data) return
        const num = data.find((r) => r.key === 'support_whatsapp')?.value
        const msg = data.find((r) => r.key === 'support_whatsapp_message')?.value
        if (num && typeof num === 'string') {
          setWhatsapp(num)
          setSavedNumber(num)
        }
        if (msg && typeof msg === 'string') {
          setDefaultMessage(msg)
        }
      })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidWhatsapp(whatsapp)) {
      toast.error('Informe um número de WhatsApp válido com DDD (ex: 11 99999-0000).')
      return
    }
    setSaving(true)
    try {
      const res = await invokeManageUsers<{ ok: boolean; support_whatsapp: string }>({
        action: 'save_system_whatsapp',
        whatsapp,
        default_message: defaultMessage,
      })
      setSavedNumber(res.support_whatsapp)
      setWhatsapp(res.support_whatsapp)
      toast.success('Número de WhatsApp do Suporte do Sistema salvo com sucesso!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar configuração.')
    } finally {
      setSaving(false)
    }
  }

  const samplePreview = buildReadyWhatsappMessage({
    kind: 'system',
    clientName: 'Lucas Mendes',
    clientEmail: 'lucas@mylabs.app',
    nutritionistName: 'Dra. Camila Rocha',
    category: 'Erro Técnico no Sistema',
    customMessage: defaultMessage,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/20 to-slate-100 p-4 sm:p-8 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-extrabold text-lg text-slate-900">
                My<span className="text-emerald-600">Labs</span>
              </span>
              <p className="text-xs text-muted-foreground">Configuração Externa do Canal de Suporte do Sistema</p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao App</span>
            </Link>
          </Button>
        </div>

        <Card className="rounded-3xl border-border shadow-lg overflow-hidden pt-0">
          <CardHeader className="bg-slate-900 text-white pt-6 pb-5">
            <div className="flex items-center justify-between gap-2">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Cadastro do WhatsApp do Dono / Suporte Técnico
              </Badge>
              {savedNumber && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  Ativo: {formatWhatsappDisplay(savedNumber)}
                </Badge>
              )}
            </div>
            <CardTitle className="font-display text-xl mt-2">
              Configurar Número de WhatsApp para Suporte do Sistema
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              Sempre que um cliente ou nutricionista tiver algum problema técnico no sistema MyLabs, a mensagem pronta será enviada diretamente para o WhatsApp configurado abaixo.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sys-whatsapp">Seu Número de WhatsApp (com DDD / DDI) *</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    id="sys-whatsapp"
                    required
                    placeholder="Ex: (11) 99999-0000 ou 5511999990000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="pl-9 font-semibold"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Formatado automaticamente para: <strong>{formatWhatsappDisplay(whatsapp)}</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sys-default-msg">Mensagem Padrão de Abertura do Chamado Técnico</Label>
                <Textarea
                  id="sys-default-msg"
                  rows={3}
                  value={defaultMessage}
                  onChange={(e) => setDefaultMessage(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{saving ? 'Salvando no Banco...' : 'Salvar Número do Suporte do Sistema'}</span>
                </Button>

                {isValidWhatsapp(whatsapp) && (
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    className="gap-1.5"
                  >
                    <a
                      href={buildWhatsappUrl(whatsapp, samplePreview)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-600" />
                      <span>Testar Envio no WhatsApp</span>
                    </a>
                  </Button>
                )}
              </div>
            </form>

            <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Pré-visualização da Mensagem Pronta que Chegará no Seu WhatsApp:</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-sans bg-white border border-border rounded-xl p-3 text-slate-800 leading-relaxed">
                {samplePreview}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
