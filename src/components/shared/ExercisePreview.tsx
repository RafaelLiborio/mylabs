import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MUSCLE_GROUP_LABEL, LEVEL_LABELS } from '@/domain/workouts'
import { Dumbbell, Eye, Pause, Play, Sparkles } from 'lucide-react'

export interface ExercisePreviewProps {
  namePt: string
  muscleGroup: string
  secondaryMuscles?: string[]
  equipment?: string
  level?: string
  instructionsPt?: string[]
  frameUrls?: string[]
  gifUrl?: string | null
  compact?: boolean
}

export function ExerciseAnimationBox({
  namePt,
  gifUrl,
  frameUrls = [],
  className = 'w-20 h-20',
  showControls = false,
}: {
  namePt: string
  gifUrl?: string | null
  frameUrls?: string[]
  className?: string
  showControls?: boolean
}) {
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [imgError, setImgError] = useState(false)

  const sources = gifUrl ? [gifUrl] : frameUrls

  useEffect(() => {
    if (sources.length <= 1 || !playing) return
    const timer = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % sources.length)
    }, 900)
    return () => window.clearInterval(timer)
  }, [sources.length, playing])

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-slate-900/5 flex items-center justify-center shrink-0 group ${className}`}
    >
      {sources.length > 0 && !imgError ? (
        sources.map((src, idx) => (
          <img
            key={src}
            src={src}
            alt={`Demonstração animada: ${namePt} (${idx + 1})`}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              idx === frameIdx % sources.length ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
        ))
      ) : (
        <div className="flex flex-col items-center justify-center text-muted-foreground p-2 text-center">
          <Dumbbell className="w-6 h-6 text-emerald-600 mb-1" />
          <span className="text-[10px] font-medium leading-tight">Ver GIF</span>
        </div>
      )}

      <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-slate-900/85 text-white text-[9px] font-bold tracking-wider uppercase flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
        Ver GIF
      </span>

      {showControls && sources.length > 1 && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={playing ? 'Pausar animação do exercício' : 'Reproduzir animação do exercício'}
          onClick={(e) => {
            e.stopPropagation()
            setPlaying((p) => !p)
          }}
          className="absolute bottom-2 right-2 z-10 h-7 w-7 rounded-lg bg-slate-900/80 text-white hover:bg-slate-900"
          title={playing ? 'Pausar animação' : 'Reproduzir animação'}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>
      )}
    </div>
  )
}

export function ExercisePreview({
  namePt,
  muscleGroup,
  secondaryMuscles = [],
  equipment = 'Peso corporal',
  level = 'intermediario',
  instructionsPt = [],
  frameUrls = [],
  gifUrl,
  compact = false,
}: ExercisePreviewProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Ver GIF e instruções em português de ${namePt}`}
          className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl shrink-0"
          title={`Ver GIF e execução em português: ${namePt}`}
        >
          <div className="relative">
            <ExerciseAnimationBox
              namePt={namePt}
              gifUrl={gifUrl}
              frameUrls={frameUrls}
              className={compact ? 'w-16 h-16' : 'w-20 h-20 sm:w-24 sm:h-24'}
            />
            <div className="absolute inset-0 z-10 rounded-xl bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="px-2 py-1 rounded-lg bg-white/95 text-slate-900 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                <Eye className="w-3 h-3 text-emerald-600" />
                Ver GIF
              </span>
            </div>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
              {MUSCLE_GROUP_LABEL[muscleGroup] || muscleGroup}
            </Badge>
            <Badge variant="outline">{equipment}</Badge>
            <Badge variant="secondary">{LEVEL_LABELS[level] || level}</Badge>
          </div>
          <DialogTitle className="text-lg font-display">{namePt}</DialogTitle>
          <DialogDescription>
            Demonstração animada do movimento e instruções biomecânicas em português
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ExerciseAnimationBox
            namePt={namePt}
            gifUrl={gifUrl}
            frameUrls={frameUrls}
            className="w-full h-64 sm:h-72 bg-slate-100"
            showControls
          />

          {secondaryMuscles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">Músculos sinergistas:</span>
              {secondaryMuscles.map((m) => (
                <Badge key={m} variant="secondary" className="text-xs">
                  {MUSCLE_GROUP_LABEL[m] || m}
                </Badge>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Passo a Passo da Execução (PT-BR)</span>
            </div>
            {instructionsPt.length > 0 ? (
              <ol className="space-y-2 text-xs sm:text-sm text-foreground">
                {instructionsPt.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mantenha a postura alinhada, controle a fase excêntrica do movimento e respire de forma contínua.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
