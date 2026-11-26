import { useCallback, useEffect, useState } from 'react'
import { supabase, translateErrorPt } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LegalLinks } from '@/components/shared/LegalLinks'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CONSENT_LABELS,
  LEGAL_VERSIONS,
  requiredConsentsForRole,
  type ConsentDocumentId,
} from '@/domain/legal'
import { FlaskConical, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

type GateState = 'loading' | 'ok' | 'needed' | 'error'

const ROLE_SUMMARY: Record<string, string[]> = {
  client: [
    'Seu nutricionista acessa seus dados de saúde, avaliações, registros e fotos para acompanhar você.',
    'Suas fotos ficam em armazenamento privado, visíveis só para você e para o seu nutricionista.',
    'Não vendemos seus dados e não há publicidade.',
    'Você pode baixar seus dados, pedir correção ou exclusão e revogar o consentimento a qualquer momento em “Privacidade e Meus Dados”.',
  ],
  nutritionist: [
    'Você é o controlador dos dados clínicos dos seus clientes; o MyLabs atua como operador da infraestrutura.',
    'Use os dados apenas para o acompanhamento nutricional e respeite o sigilo profissional (Código de Ética do CFN) e a LGPD.',
    'Você acessa apenas os clientes vinculados a você.',
  ],
  admin: [
    'O acesso administrativo é restrito a administração de contas, suporte técnico e atendimento de solicitações de privacidade.',
    'Dados de saúde só devem ser acessados quando estritamente necessário para o suporte.',
  ],
}

/**
 * Bloqueia o acesso às áreas autenticadas até que o usuário registre o aceite da versão vigente dos
 * Termos de Uso, da Política de Privacidade e do consentimento específico do seu perfil.
 * O aceite é gravado de forma imutável em public.legal_acceptances.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const [state, setState] = useState<GateState>('loading')
  const [missing, setMissing] = useState<ConsentDocumentId[]>([])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const role = profile?.role
  const userId = user?.id

  const check = useCallback(async () => {
    if (!userId || !role) return
    setState('loading')
    const { data, error } = await supabase
      .from('legal_acceptances')
      .select('document, version')
      .eq('user_id', userId)
    if (error) {
      setState('error')
      return
    }
    const accepted = new Set((data || []).map((r) => `${r.document}@${r.version}`))
    const pending = requiredConsentsForRole(role).filter(
      (d) => !accepted.has(`${d}@${LEGAL_VERSIONS[d]}`),
    )
    setMissing(pending)
    setChecked({})
    setState(pending.length > 0 ? 'needed' : 'ok')
  }, [userId, role])

  useEffect(() => {
    check()
  }, [check])

  const allChecked = missing.length > 0 && missing.every((d) => checked[d])

  const handleAccept = async () => {
    if (!userId || !allChecked) return
    setSaving(true)
    try {
      const rows = missing.map((d) => ({
        document: d,
        version: LEGAL_VERSIONS[d],
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
      }))
      const { error } = await supabase.from('legal_acceptances').insert(rows)
      // 23505 = aceite já registrado (ex.: duplo clique), tratado como sucesso
      if (error && error.code !== '23505') throw error
      toast.success('Aceite registrado. Obrigado!')
      setState('ok')
    } catch (err: any) {
      toast.error(translateErrorPt(err, 'Não foi possível registrar o aceite. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  if (state === 'ok') return <>{children}</>

  const isFirstTime = missing.length === requiredConsentsForRole(role).length
  const summary = ROLE_SUMMARY[role || 'client'] || ROLE_SUMMARY.client

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 flex items-center justify-center p-4">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
            <FlaskConical className="w-6 h-6" />
          </div>
          <span className="text-xs font-semibold">Verificando termos e privacidade...</span>
        </div>
      )}

      {state === 'error' && (
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm text-slate-700">
            Não foi possível verificar o seu aceite dos Termos e da Política de Privacidade. Verifique sua conexão e tente novamente.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Button type="button" onClick={check} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Tentar novamente
            </Button>
            <Button type="button" variant="outline" onClick={signOut}>
              Sair
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={state === 'needed'}>
        <AlertDialogContent className="sm:max-w-xl max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden gap-4">
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="font-display">
                {isFirstTime ? 'Antes de começar: sua privacidade' : 'Atualizamos nossos documentos'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              {isFirstTime
                ? 'O MyLabs trata dados pessoais e dados de saúde. Leia os documentos e registre o seu aceite para continuar.'
                : 'Os Termos de Uso e/ou a Política de Privacidade foram atualizados. Revise e registre um novo aceite para continuar.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="min-h-0 max-h-[46vh] overflow-y-auto pr-2 -mr-2" data-testid="consent-scroll">
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-1.5">
                <span className="text-xs font-bold text-emerald-900 block">Em resumo</span>
                <ul className="list-disc pl-4 space-y-1 text-xs text-emerald-950 leading-relaxed">
                  {summary.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <LegalLinks newTab className="text-xs text-emerald-800 pt-1" />
              </div>

              <div className="space-y-2.5">
                {missing.map((doc) => (
                  <label
                    key={doc}
                    htmlFor={`consent-${doc}`}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                      checked[doc] ? 'border-emerald-400 bg-emerald-50/50' : 'border-border bg-white'
                    }`}
                  >
                    <Checkbox
                      id={`consent-${doc}`}
                      checked={!!checked[doc]}
                      onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [doc]: v === true }))}
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900 block">
                        {CONSENT_LABELS[doc].title}
                      </span>
                      <span className="text-xs text-slate-600 leading-relaxed block">
                        {CONSENT_LABELS[doc].text}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={signOut} disabled={saving}>
              Recusar e sair
            </Button>
            <Button
              type="button"
              disabled={!allChecked || saving}
              onClick={handleAccept}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Aceitar e continuar</span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
