import {
  Apple,
  Banana,
  Bean,
  Beef,
  Carrot,
  Cherry,
  Citrus,
  Cookie,
  Croissant,
  CupSoda,
  Droplet,
  Egg,
  Fish,
  Flame,
  Grape,
  Milk,
  Nut,
  Salad,
  Sandwich,
  Soup,
  Sprout,
  Utensils,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { sanitizeHttpUrl } from '@/lib/fileValidation'

interface FoodVisual {
  icon: LucideIcon
  bg: string
  border: string
  text: string
  label: string
}

const KEYWORD_VISUALS: Array<{ match: RegExp; visual: FoodVisual }> = [
  {
    match: /(frango|peito de frango|peru|ave)/i,
    visual: { icon: DrumstickIcon, bg: 'from-amber-100 to-orange-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Aves' },
  },
  {
    match: /(salm[aã]o|til[aá]pia|atum|sardinha|peixe|bacalhau|camar[aã]o)/i,
    visual: { icon: Fish, bg: 'from-sky-100 to-cyan-50', border: 'border-sky-200', text: 'text-sky-700', label: 'Pescados' },
  },
  {
    match: /(ovo|clara|omelete)/i,
    visual: { icon: Egg, bg: 'from-yellow-100 to-amber-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Ovos' },
  },
  {
    match: /(carne|patinho|alcatra|bife|ac[eé]m|fil[eé]|porco|lombo|cox[aã]o|m[uú]sculo)/i,
    visual: { icon: Beef, bg: 'from-rose-100 to-red-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Carnes' },
  },
  {
    match: /(whey|prote[ií]na|suplemento|albumina|case[ií]na|creatina)/i,
    visual: { icon: CupSoda, bg: 'from-slate-100 to-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Suplemento' },
  },
  {
    match: /(arroz|tapioca|cuscuz|macarr[aã]o|massa)/i,
    visual: { icon: Soup, bg: 'from-amber-50 to-stone-100', border: 'border-amber-200', text: 'text-amber-800', label: 'Cereais' },
  },
  {
    match: /(aveia|granola|quinoa|chia|linha[cç]a|trigo)/i,
    visual: { icon: Wheat, bg: 'from-yellow-100 to-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Grãos' },
  },
  {
    match: /(p[aã]o|torrada|croissant|biscoito|bolacha)/i,
    visual: { icon: Croissant, bg: 'from-orange-100 to-amber-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Panificados' },
  },
  {
    match: /(sandu[ií]che|wrap|lanche)/i,
    visual: { icon: Sandwich, bg: 'from-orange-100 to-amber-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Lanche' },
  },
  {
    match: /(batata|mandioca|aipim|inhame|car[aá])/i,
    visual: { icon: Sprout, bg: 'from-amber-100 to-orange-50', border: 'border-amber-200', text: 'text-amber-800', label: 'Raízes' },
  },
  {
    match: /(feij[aã]o|lentilha|gr[aã]o de bico|soja|ervilha)/i,
    visual: { icon: Bean, bg: 'from-stone-100 to-amber-50', border: 'border-stone-200', text: 'text-stone-700', label: 'Leguminosas' },
  },
  {
    match: /(banana)/i,
    visual: { icon: Banana, bg: 'from-yellow-100 to-amber-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Fruta' },
  },
  {
    match: /(ma[cç][aã]|pera)/i,
    visual: { icon: Apple, bg: 'from-red-100 to-rose-50', border: 'border-red-200', text: 'text-red-700', label: 'Fruta' },
  },
  {
    match: /(morango|framboesa|cereja|amora)/i,
    visual: { icon: Cherry, bg: 'from-rose-100 to-pink-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Fruta' },
  },
  {
    match: /(uva|a[cç]a[ií]|blueberry|mirtilo)/i,
    visual: { icon: Grape, bg: 'from-sky-100 to-slate-50', border: 'border-sky-200', text: 'text-sky-800', label: 'Fruta' },
  },
  {
    match: /(laranja|lim[aã]o|mexerica|tangerina|abacaxi|mam[aã]o|melancia|manga|kiwi)/i,
    visual: { icon: Citrus, bg: 'from-orange-100 to-yellow-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Fruta' },
  },
  {
    match: /(abacate)/i,
    visual: { icon: Sprout, bg: 'from-emerald-100 to-lime-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Fruta' },
  },
  {
    match: /(cenoura|ab[oó]bora|beterraba)/i,
    visual: { icon: Carrot, bg: 'from-orange-100 to-amber-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Legume' },
  },
  {
    match: /(br[oó]colis|espinafre|couve|alface|r[uú]cula|salada|legumes|tomate|pepino|abobrinha)/i,
    visual: { icon: Salad, bg: 'from-emerald-100 to-green-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Vegetal' },
  },
  {
    match: /(leite|iogurte|kefir|requeij[aã]o|queijo|ricota|cottage)/i,
    visual: { icon: Milk, bg: 'from-sky-50 to-slate-100', border: 'border-sky-200', text: 'text-sky-700', label: 'Laticínio' },
  },
  {
    match: /(azeite|[oó]leo|manteiga)/i,
    visual: { icon: Droplet, bg: 'from-lime-100 to-yellow-50', border: 'border-lime-200', text: 'text-lime-700', label: 'Óleos' },
  },
  {
    match: /(castanha|amendoim|am[eê]ndoa|nozes|pasta de amendoim)/i,
    visual: { icon: Nut, bg: 'from-amber-100 to-stone-50', border: 'border-amber-200', text: 'text-amber-800', label: 'Oleaginosas' },
  },
  {
    match: /(mel|chocolate|cacau|doce)/i,
    visual: { icon: Cookie, bg: 'from-amber-100 to-orange-50', border: 'border-amber-200', text: 'text-amber-800', label: 'Doce' },
  },
]

// Helper alias because lucide-react exports Drumstick
import { Drumstick as DrumstickIcon } from 'lucide-react'

const GROUP_VISUALS: Record<string, FoodVisual> = {
  Proteínas: { icon: Flame, bg: 'from-rose-100 to-orange-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Proteínas' },
  Carboidratos: { icon: Wheat, bg: 'from-amber-100 to-yellow-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Carboidratos' },
  Frutas: { icon: Apple, bg: 'from-orange-100 to-emerald-50', border: 'border-orange-200', text: 'text-orange-700', label: 'Frutas' },
  Vegetais: { icon: Salad, bg: 'from-emerald-100 to-green-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Vegetais' },
  Leguminosas: { icon: Bean, bg: 'from-stone-100 to-amber-50', border: 'border-stone-200', text: 'text-stone-700', label: 'Leguminosas' },
  Laticínios: { icon: Milk, bg: 'from-sky-50 to-slate-100', border: 'border-sky-200', text: 'text-sky-700', label: 'Laticínios' },
  Gorduras: { icon: Droplet, bg: 'from-yellow-100 to-lime-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Gorduras' },
  Suplementos: { icon: CupSoda, bg: 'from-slate-100 to-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Suplementos' },
}

export function getFoodVisual(name: string, foodGroup?: string | null): FoodVisual {
  const n = name || ''
  for (const rule of KEYWORD_VISUALS) {
    if (rule.match.test(n)) return rule.visual
  }
  if (foodGroup && GROUP_VISUALS[foodGroup]) {
    return GROUP_VISUALS[foodGroup]
  }
  return { icon: Utensils, bg: 'from-emerald-100 to-slate-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Alimento' }
}

/**
 * Miniatura ilustrativa para cada alimento: exibe a foto oficial se houver,
 * ou um ícone clínico temático de alta legibilidade baseado no alimento e grupo.
 */
export function FoodThumb({
  name,
  foodGroup,
  imageUrl,
  size = 'md',
}: {
  name: string
  foodGroup?: string | null
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const safeImageUrl = imageUrl ? sanitizeHttpUrl(imageUrl) : null
  const visual = getFoodVisual(name, foodGroup)
  const Icon = visual.icon
  const dims =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'lg'
        ? 'w-14 h-14 rounded-2xl'
        : 'w-11 h-11 rounded-xl'
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'

  if (safeImageUrl) {
    return (
      <img
        src={safeImageUrl}
        alt={name}
        className={`${dims} object-cover border border-border bg-muted shrink-0`}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={`${dims} bg-gradient-to-br ${visual.bg} border ${visual.border} flex items-center justify-center shrink-0 select-none shadow-xs`}
      title={name}
      aria-hidden="true"
    >
      <Icon className={`${iconSize} ${visual.text}`} strokeWidth={2} />
    </div>
  )
}
