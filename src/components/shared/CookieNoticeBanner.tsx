import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'

const STORAGE_KEY = 'mylabs_cookie_notice_v1'

/**
 * Aviso discreto sobre armazenamento local estritamente necessário.
 * O MyLabs não utiliza cookies de publicidade, analytics ou rastreamento de terceiros.
 */
export function CookieNoticeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setVisible(true)
      }
    } catch {
      setVisible(false)
    }
  }, [])

  if (!visible) return null

  const handleAcknowledge = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'ack')
    } catch {
      // ignore storage quota errors
    }
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies e armazenamento local"
      className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-40 rounded-xl border border-border bg-white/95 backdrop-blur-md p-3.5 shadow-lg no-print"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="space-y-2 text-xs text-slate-700">
          <p className="leading-relaxed">
            O MyLabs usa apenas armazenamento local estritamente necessário para manter sua sessão autenticada. Não usamos cookies de publicidade ou rastreamento.{' '}
            <Link
              to="/privacidade"
              className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
            >
              Saiba mais
            </Link>
            .
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleAcknowledge}
              className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Entendi
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
