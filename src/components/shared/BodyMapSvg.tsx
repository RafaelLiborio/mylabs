import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Minus, Plus } from 'lucide-react'
import { AnatomicalBody3D } from './AnatomicalBody3D'
import type { CircumferencesMap, SkinfoldKey, SkinfoldsMap } from '@/domain/anthropometry'

export type BodyRegionFilter = 'all' | 'trunk' | 'upper_limb' | 'lower_limb'

export function BodyMapSvg({
  activeRegion,
  onSelectRegion,
  sex = 'male',
  bodyFatPct,
  leanMassKg,
  fatMassKg,
  skinfolds,
  circumferences,
  requiredSkinfolds,
}: {
  activeRegion: BodyRegionFilter
  onSelectRegion: (r: BodyRegionFilter) => void
  sex?: 'male' | 'female'
  bodyFatPct: number
  leanMassKg: number
  fatMassKg: number
  skinfolds?: SkinfoldsMap
  circumferences?: CircumferencesMap
  requiredSkinfolds?: SkinfoldKey[]
}) {
  return (
    <AnatomicalBody3D
      activeRegion={activeRegion}
      onSelectRegion={onSelectRegion}
      sex={sex}
      bodyFatPct={bodyFatPct}
      leanMassKg={leanMassKg}
      fatMassKg={fatMassKg}
      skinfolds={skinfolds}
      circumferences={circumferences}
      requiredSkinfolds={requiredSkinfolds}
    />
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
