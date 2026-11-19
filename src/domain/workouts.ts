export type MuscleGroupId =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'antebraco'
  | 'abdomen'
  | 'quadriceps'
  | 'posterior'
  | 'gluteos'
  | 'panturrilha'
  | 'cardio'
  | 'corpo_inteiro'

export interface MuscleGroupMeta {
  id: MuscleGroupId
  label: string
  shortLabel: string
  region: 'upper' | 'lower' | 'core'
}

export const MUSCLE_GROUPS: MuscleGroupMeta[] = [
  { id: 'peito', label: 'Peitoral', shortLabel: 'Peito', region: 'upper' },
  { id: 'costas', label: 'Costas & Dorsais', shortLabel: 'Costas', region: 'upper' },
  { id: 'ombros', label: 'Ombros & Deltoides', shortLabel: 'Ombros', region: 'upper' },
  { id: 'biceps', label: 'Bíceps', shortLabel: 'Bíceps', region: 'upper' },
  { id: 'triceps', label: 'Tríceps', shortLabel: 'Tríceps', region: 'upper' },
  { id: 'antebraco', label: 'Antebraço', shortLabel: 'Antebraço', region: 'upper' },
  { id: 'quadriceps', label: 'Quadríceps (Anterior Coxa)', shortLabel: 'Quadríceps', region: 'lower' },
  { id: 'posterior', label: 'Posterior de Coxa (Isquiotibiais)', shortLabel: 'Posterior', region: 'lower' },
  { id: 'gluteos', label: 'Glúteos', shortLabel: 'Glúteos', region: 'lower' },
  { id: 'panturrilha', label: 'Panturrilhas', shortLabel: 'Panturrilha', region: 'lower' },
  { id: 'abdomen', label: 'Abdômen & Core', shortLabel: 'Abdômen', region: 'core' },
  { id: 'cardio', label: 'Cardio & Condicionamento', shortLabel: 'Cardio', region: 'core' },
  { id: 'corpo_inteiro', label: 'Corpo Inteiro / Funcional', shortLabel: 'Full Body', region: 'core' },
]

export const MUSCLE_GROUP_LABEL: Record<string, string> = Object.fromEntries(
  MUSCLE_GROUPS.map((m) => [m.id, m.label]),
)

export const WEEKDAYS: { id: number; short: string; full: string }[] = [
  { id: 1, short: 'Seg', full: 'Segunda-feira' },
  { id: 2, short: 'Ter', full: 'Terça-feira' },
  { id: 3, short: 'Qua', full: 'Quarta-feira' },
  { id: 4, short: 'Qui', full: 'Quinta-feira' },
  { id: 5, short: 'Sex', full: 'Sexta-feira' },
  { id: 6, short: 'Sáb', full: 'Sábado' },
  { id: 0, short: 'Dom', full: 'Domingo' },
]

export const LEVEL_LABELS: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}
