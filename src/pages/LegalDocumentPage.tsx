import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LEGAL_CONFIG, LEGAL_DOCUMENTS, type LegalBlock, type LegalDocumentId } from '@/domain/legal'
import { ArrowLeft, FileText, FlaskConical, Printer, ShieldCheck } from 'lucide-react'

function renderBlock(block: LegalBlock, idx: number) {
  if (block.type === 'ul') {
    return (
      <ul key={idx} className="list-disc pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
        {block.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    )
  }
  if (block.type === 'note') {
    return (
      <div
        key={idx}
        className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-950 leading-relaxed"
      >
        {block.text}
      </div>
    )
  }
  return (
    <p key={idx} className="text-sm text-slate-700 leading-relaxed">
      {block.text}
    </p>
  )
}

export function LegalDocumentPage({ docId }: { docId: LegalDocumentId }) {
  const navigate = useNavigate()
  const doc = LEGAL_DOCUMENTS[docId]
  const other = LEGAL_DOCUMENTS[docId === 'terms' ? 'privacy' : 'terms']
  const otherPath = docId === 'terms' ? '/privacidade' : '/termos'

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border no-print">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shrink-0">
              <FlaskConical className="w-4.5 h-4.5" />
            </div>
            <span className="font-display font-extrabold text-lg tracking-tight text-slate-900">
              My<span className="text-emerald-600">Labs</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={goBack} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 hidden sm:inline-flex"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sumário */}
        <aside className="lg:col-span-3 no-print">
          <div className="lg:sticky lg:top-20 space-y-3">
            <Card className="rounded-2xl">
              <CardContent className="p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Neste documento
                </span>
                <nav aria-label="Sumário" className="flex flex-col gap-0.5">
                  {doc.sections.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollTo(s.id)}
                      className="text-left text-xs text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md px-2 py-1.5 transition"
                    >
                      {s.title}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>

            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to={otherPath}>
                {docId === 'terms' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <FileText className="w-4 h-4 text-emerald-600" />
                )}
                <span>Ler {other.title}</span>
              </Link>
            </Button>
          </div>
        </aside>

        {/* Documento */}
        <article className="lg:col-span-9 space-y-6">
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-6 sm:p-8 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                Versão {doc.version}
              </Badge>
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                Atualizado em {LEGAL_CONFIG.lastUpdatedLabel}
              </Badge>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl">{doc.title}</h1>
            <p className="text-sm text-slate-300 max-w-2xl">{doc.subtitle}</p>
          </div>

          {doc.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-20 rounded-2xl border border-border bg-white p-5 sm:p-6 space-y-3 shadow-2xs"
            >
              <h2 className="font-display font-bold text-lg text-slate-900">{section.title}</h2>
              {section.blocks.map((b, i) => renderBlock(b, i))}
            </section>
          ))}

          <p className="text-xs text-muted-foreground text-center pb-6">
            {LEGAL_CONFIG.productName} • {doc.title} • versão {doc.version}
          </p>
        </article>
      </main>
    </div>
  )
}
