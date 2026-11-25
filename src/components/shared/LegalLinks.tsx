import { Link } from 'react-router-dom'

/** Links discretos para os documentos legais (rodapés, tela de login). */
export function LegalLinks({
  className = '',
  newTab = false,
}: {
  className?: string
  newTab?: boolean
}) {
  const extra = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <nav aria-label="Documentos legais" className={`inline-flex items-center gap-2 ${className}`}>
      <Link to="/termos" className="underline underline-offset-2 hover:text-foreground" {...extra}>
        Termos de Uso
      </Link>
      <span aria-hidden="true">•</span>
      <Link to="/privacidade" className="underline underline-offset-2 hover:text-foreground" {...extra}>
        Política de Privacidade
      </Link>
    </nav>
  )
}
