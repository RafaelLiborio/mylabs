import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Minus, Plus } from 'lucide-react'

export type BodyRegionFilter = 'all' | 'trunk' | 'upper_limb' | 'lower_limb'

export function BodyMapSvg({
  activeRegion,
  onSelectRegion,
  bodyFatPct,
  leanMassKg,
  fatMassKg,
}: {
  activeRegion: BodyRegionFilter
  onSelectRegion: (r: BodyRegionFilter) => void
  bodyFatPct: number
  leanMassKg: number
  fatMassKg: number
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-slate-900 to-slate-950 text-white p-4 flex flex-col items-center justify-between gap-3">
      <div className="w-full flex items-center justify-between text-xs">
        <span className="font-display font-bold text-slate-200">Mapa Anatômico Interativo</span>
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
          Clique na região
        </Badge>
      </div>

      <svg
        viewBox="0 0 180 280"
        className="w-40 h-56 select-none"
        aria-label="Silhueta anatômica interativa"
      >
        {/* Cabeça */}
        <circle cx="90" cy="28" r="16" fill="#334155" stroke="#64748B" strokeWidth="1.5" />

        {/* Tronco (Pescoço, Ombros, Peitoral, Cintura, Abdômen, Subescapular, Supra-ilíaca) */}
        <g
          onClick={() => onSelectRegion(activeRegion === 'trunk' ? 'all' : 'trunk')}
          className="cursor-pointer transition-opacity hover:opacity-90"
        >
          <path
            d="M66 52 Q90 46 114 52 L110 144 Q90 150 70 144 Z"
            fill={activeRegion === 'trunk' || activeRegion === 'all' ? '#10B981' : '#334155'}
            fillOpacity={activeRegion === 'trunk' ? '0.85' : '0.45'}
            stroke="#34D399"
            strokeWidth="1.8"
          />
          <circle cx="77" cy="74" r="3.2" fill="#A7F3D0" />
          <circle cx="96" cy="116" r="3.2" fill="#A7F3D0" />
          <circle cx="107" cy="126" r="3.2" fill="#A7F3D0" />
        </g>

        {/* Membros Superiores (Bíceps, Tríceps, Braço, Antebraço) */}
        <g
          onClick={() => onSelectRegion(activeRegion === 'upper_limb' ? 'all' : 'upper_limb')}
          className="cursor-pointer transition-opacity hover:opacity-90"
        >
          <path
            d="M48 56 L64 54 L58 142 L44 140 Z"
            fill={activeRegion === 'upper_limb' || activeRegion === 'all' ? '#6366F1' : '#334155'}
            fillOpacity={activeRegion === 'upper_limb' ? '0.85' : '0.45'}
            stroke="#818CF8"
            strokeWidth="1.8"
          />
          <path
            d="M116 54 L132 56 L136 140 L122 142 Z"
            fill={activeRegion === 'upper_limb' || activeRegion === 'all' ? '#6366F1' : '#334155'}
            fillOpacity={activeRegion === 'upper_limb' ? '0.85' : '0.45'}
            stroke="#818CF8"
            strokeWidth="1.8"
          />
          <circle cx="54" cy="90" r="3.2" fill="#C7D2FE" />
          <circle cx="126" cy="90" r="3.2" fill="#C7D2FE" />
        </g>

        {/* Membros Inferiores & Quadril (Quadril, Coxa Medial, Panturrilha) */}
        <g
          onClick={() => onSelectRegion(activeRegion === 'lower_limb' ? 'all' : 'lower_limb')}
          className="cursor-pointer transition-opacity hover:opacity-90"
        >
          <path
            d="M68 146 L90 148 L86 262 L66 262 Z"
            fill={activeRegion === 'lower_limb' || activeRegion === 'all' ? '#F59E0B' : '#334155'}
            fillOpacity={activeRegion === 'lower_limb' ? '0.85' : '0.45'}
            stroke="#FBBF24"
            strokeWidth="1.8"
          />
          <path
            d="M90 148 L112 146 L114 262 L94 262 Z"
            fill={activeRegion === 'lower_limb' || activeRegion === 'all' ? '#F59E0B' : '#334155'}
            fillOpacity={activeRegion === 'lower_limb' ? '0.85' : '0.45'}
            stroke="#FBBF24"
            strokeWidth="1.8"
          />
          <circle cx="77" cy="192" r="3.2" fill="#FDE68A" />
          <circle cx="103" cy="192" r="3.2" fill="#FDE68A" />
        </g>
      </svg>

      <div className="w-full grid grid-cols-3 gap-1.5 text-center text-[11px]">
        <div className="rounded-xl bg-slate-800/90 p-2 border border-slate-700/70">
          <span className="block text-slate-400">% Gordura</span>
          <strong className="text-sm text-emerald-400">{bodyFatPct}%</strong>
        </div>
        <div className="rounded-xl bg-slate-800/90 p-2 border border-slate-700/70">
          <span className="block text-slate-400">M. Magra</span>
          <strong className="text-sm text-indigo-300">{leanMassKg} kg</strong>
        </div>
        <div className="rounded-xl bg-slate-800/90 p-2 border border-slate-700/70">
          <span className="block text-slate-400">M. Gorda</span>
          <strong className="text-sm text-amber-300">{fatMassKg} kg</strong>
        </div>
      </div>
    </div>
  )
}

/**
 * Controle ergonômico com Slider + Stepper (-0.5 / -0.1 / +0.1 / +0.5) para eliminar digitação manual repetitiva.
 */
export function QuickMeasurementControl({
  label,
  hint,
  unit,
  value,
  previousValue,
  min,
  max,
  step = 0.5,
  betterDown = true,
  highlighted = false,
  onChange,
}: {
  label: string
  hint?: string
  unit: string
  value: number
  previousValue?: number
  min: number
  max: number
  step?: number
  betterDown?: boolean
  highlighted?: boolean
  onChange: (next: number) => void
}) {
  const clamp = (v: number) => +Math.max(min, Math.min(max, v)).toFixed(1)
  const delta = previousValue != null ? +(value - previousValue).toFixed(1) : null

  return (
    <div
      className={`rounded-xl border p-3.5 transition-all space-y-2.5 ${
        highlighted
          ? 'border-emerald-300 bg-emerald-50/40 shadow-2xs'
          : 'border-border bg-card hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {highlighted && (
              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">Protocolo</Badge>
            )}
          </div>
          {hint && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{hint}</p>}
        </div>

        <div className="text-right shrink-0">
          <div className="text-base font-display font-extrabold text-foreground">
            {value.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
          </div>
          {delta !== null && delta !== 0 && (
            <span
              className={`text-[11px] font-bold ${
                (betterDown ? delta < 0 : delta > 0) ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {delta > 0 ? `+${delta}` : delta} {unit} vs ant.
            </span>
          )}
        </div>
      </div>

      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(clamp(vals[0]))}
        className="py-1"
      />

      <div className="flex items-center justify-between gap-1 pt-0.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Diminuir ${label} em 1 ${unit}`}
            onClick={() => onChange(clamp(value - 1))}
            className="h-7 px-2 text-xs font-semibold"
          >
            -1
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Diminuir ${label} em ${step} ${unit}`}
            onClick={() => onChange(clamp(value - step))}
            className="h-7 px-2 text-xs font-semibold gap-0.5"
          >
            <Minus className="w-3 h-3" />
            {step}
          </Button>
        </div>

        <span className="text-[10px] text-muted-foreground">
          {min}–{max} {unit}
        </span>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Aumentar ${label} em ${step} ${unit}`}
            onClick={() => onChange(clamp(value + step))}
            className="h-7 px-2 text-xs font-semibold gap-0.5"
          >
            <Plus className="w-3 h-3" />
            {step}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Aumentar ${label} em 1 ${unit}`}
            onClick={() => onChange(clamp(value + 1))}
            className="h-7 px-2 text-xs font-semibold"
          >
            +1
          </Button>
        </div>
      </div>
    </div>
  )
}
