import { useState } from 'react'
import { cn } from '@/lib/utils'

interface FoodVisualTheme {
  emoji: string
  bg: string
  border: string
  label: string
}

const GROUP_DEFAULT_VISUAL: Record<string, FoodVisualTheme> = {
  protein: {
    emoji: '🍗',
    bg: 'from-rose-100 via-orange-50 to-amber-100',
    border: 'border-rose-200',
    label: 'Proteína',
  },
  carb: {
    emoji: '🍚',
    bg: 'from-amber-100 via-yellow-50 to-orange-100',
    border: 'border-amber-200',
    label: 'Carboidrato',
  },
  legume: {
    emoji: '🫘',
    bg: 'from-stone-200 via-amber-50 to-orange-100',
    border: 'border-stone-300',
    label: 'Leguminosa',
  },
  vegetable: {
    emoji: '🥦',
    bg: 'from-emerald-100 via-green-50 to-teal-100',
    border: 'border-emerald-200',
    label: 'Vegetal',
  },
  fruit: {
    emoji: '🍎',
    bg: 'from-pink-100 via-rose-50 to-amber-100',
    border: 'border-pink-200',
    label: 'Fruta',
  },
  fat: {
    emoji: '🥑',
    bg: 'from-lime-100 via-amber-50 to-yellow-100',
    border: 'border-lime-200',
    label: 'Gordura Boa',
  },
  dairy: {
    emoji: '🥛',
    bg: 'from-sky-100 via-blue-50 to-indigo-100',
    border: 'border-sky-200',
    label: 'Laticínio',
  },
  other: {
    emoji: '🍯',
    bg: 'from-amber-100 via-orange-50 to-yellow-100',
    border: 'border-amber-200',
    label: 'Alimento',
  },
}

const KEYWORD_VISUALS: { match: RegExp; emoji: string; bg: string; border: string }[] = [
  { match: /frango/i, emoji: '🍗', bg: 'from-amber-100 via-orange-50 to-yellow-100', border: 'border-amber-200' },
  { match: /til[aá]pia|salm[aã]o|atum|peixe/i, emoji: '🐟', bg: 'from-sky-100 via-cyan-50 to-teal-100', border: 'border-sky-200' },
  { match: /ovo|clara/i, emoji: '🥚', bg: 'from-amber-100 via-yellow-50 to-orange-50', border: 'border-amber-200' },
  { match: /carne|patinho|alcatra|bife/i, emoji: '🥩', bg: 'from-rose-100 via-red-50 to-orange-100', border: 'border-rose-200' },
  { match: /porco|lombo/i, emoji: '🍖', bg: 'from-orange-100 via-rose-50 to-amber-100', border: 'border-orange-200' },
  { match: /whey|prote[ií]na|suplemento/i, emoji: '🥤', bg: 'from-indigo-100 via-purple-50 to-sky-100', border: 'border-indigo-200' },
  { match: /arroz/i, emoji: '🍚', bg: 'from-slate-100 via-amber-50 to-stone-100', border: 'border-slate-200' },
  { match: /batata-doce|batata doce/i, emoji: '🍠', bg: 'from-orange-100 via-amber-50 to-rose-100', border: 'border-orange-200' },
  { match: /batata|mandioca|inhame/i, emoji: '🥔', bg: 'from-amber-100 via-yellow-50 to-stone-100', border: 'border-amber-200' },
  { match: /macarr[aã]o|massa/i, emoji: '🍝', bg: 'from-amber-100 via-orange-50 to-yellow-100', border: 'border-amber-200' },
  { match: /p[aã]o|torrada|crepioca|tapioca/i, emoji: '🍞', bg: 'from-amber-100 via-orange-50 to-stone-100', border: 'border-amber-200' },
  { match: /aveia|granola|cereal/i, emoji: '🥣', bg: 'from-amber-100 via-stone-50 to-yellow-100', border: 'border-amber-200' },
  { match: /milho/i, emoji: '🌽', bg: 'from-yellow-100 via-amber-50 to-lime-100', border: 'border-yellow-300' },
  { match: /feij[aã]o|lentilha|gr[aã]o-de-bico/i, emoji: '🍲', bg: 'from-amber-100 via-stone-100 to-orange-100', border: 'border-amber-200' },
  { match: /br[oó]colis/i, emoji: '🥦', bg: 'from-emerald-100 via-green-50 to-lime-100', border: 'border-emerald-200' },
  { match: /cenoura|beterraba/i, emoji: '🥕', bg: 'from-orange-100 via-amber-50 to-rose-100', border: 'border-orange-200' },
  { match: /alface|couve|salada|r[uú]cula|espinafre/i, emoji: '🥬', bg: 'from-emerald-100 via-green-50 to-teal-100', border: 'border-emerald-200' },
  { match: /tomate/i, emoji: '🍅', bg: 'from-red-100 via-rose-50 to-orange-100', border: 'border-red-200' },
  { match: /pepino|abobrinha/i, emoji: '🥒', bg: 'from-lime-100 via-emerald-50 to-green-100', border: 'border-lime-200' },
  { match: /banana/i, emoji: '🍌', bg: 'from-yellow-100 via-amber-50 to-orange-50', border: 'border-yellow-300' },
  { match: /ma[cç][aã]/i, emoji: '🍎', bg: 'from-rose-100 via-red-50 to-pink-100', border: 'border-rose-200' },
  { match: /mam[aã]o|manga/i, emoji: '🥭', bg: 'from-orange-100 via-amber-50 to-yellow-100', border: 'border-orange-200' },
  { match: /laranja|tangerina/i, emoji: '🍊', bg: 'from-orange-100 via-amber-50 to-yellow-100', border: 'border-orange-200' },
  { match: /morango/i, emoji: '🍓', bg: 'from-rose-100 via-pink-50 to-red-100', border: 'border-rose-200' },
  { match: /abacaxi/i, emoji: '🍍', bg: 'from-yellow-100 via-lime-50 to-amber-100', border: 'border-yellow-300' },
  { match: /uva/i, emoji: '🍇', bg: 'from-purple-100 via-violet-50 to-fuchsia-100', border: 'border-purple-200' },
  { match: /melancia/i, emoji: '🍉', bg: 'from-rose-100 via-emerald-50 to-pink-100', border: 'border-rose-200' },
  { match: /abacate/i, emoji: '🥑', bg: 'from-lime-100 via-emerald-50 to-green-100', border: 'border-lime-200' },
  { match: /kiwi/i, emoji: '🥝', bg: 'from-lime-100 via-green-50 to-amber-100', border: 'border-lime-200' },
  { match: /azeite|[oó]leo/i, emoji: '🫒', bg: 'from-lime-100 via-yellow-50 to-emerald-100', border: 'border-lime-200' },
  { match: /castanha|amendoim|nozes|pasta de amendoim/i, emoji: '🥜', bg: 'from-amber-100 via-orange-50 to-stone-100', border: 'border-amber-200' },
  { match: /manteiga/i, emoji: '🧈', bg: 'from-yellow-100 via-amber-50 to-orange-50', border: 'border-yellow-200' },
  { match: /iogurte|leite/i, emoji: '🥛', bg: 'from-sky-100 via-blue-50 to-indigo-50', border: 'border-sky-200' },
  { match: /queijo|cottage|ricota|mussarela|minas/i, emoji: '🧀', bg: 'from-yellow-100 via-amber-50 to-orange-100', border: 'border-yellow-300' },
  { match: /mel/i, emoji: '🍯', bg: 'from-amber-100 via-yellow-50 to-orange-100', border: 'border-amber-200' },
]

export function getFoodVisual(name: string, foodGroup = 'other') {
  for (const kw of KEYWORD_VISUALS) {
    if (kw.match.test(name)) {
      return kw
    }
  }
  return GROUP_DEFAULT_VISUAL[foodGroup] || GROUP_DEFAULT_VISUAL.other
}

export function FoodThumb({
  name,
  foodGroup = 'other',
  imageUrl,
  size = 'md',
  className,
}: {
  name: string
  foodGroup?: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [imgError, setImgError] = useState(false)
  const visual = getFoodVisual(name, foodGroup)

  const sizeClasses =
    size === 'sm'
      ? 'w-9 h-9 text-base rounded-lg'
      : size === 'lg'
        ? 'w-14 h-14 text-2xl rounded-2xl'
        : 'w-11 h-11 text-xl rounded-xl'

  return (
    <div
      className={cn(
        `relative overflow-hidden border bg-gradient-to-br flex items-center justify-center shrink-0 shadow-2xs select-none`,
        visual.bg,
        visual.border,
        sizeClasses,
        className,
      )}
      title={`Ilustração nutricional: ${name}`}
      aria-label={`Imagem ilustrativa de ${name}`}
    >
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="drop-shadow-2xs leading-none" role="img" aria-hidden="true">
          {visual.emoji}
        </span>
      )}
    </div>
  )
}
