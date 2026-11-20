import { useMemo, useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

interface DatePickerFieldProps {
  id?: string
  value: string // YYYY-MM-DD
  onChange: (isoDate: string) => void
  placeholder?: string
  fromYear?: number
  toYear?: number
  className?: string
}

export function DatePickerField({
  id,
  value,
  onChange,
  placeholder = 'Selecionar data',
  fromYear = 1935,
  toYear = new Date().getFullYear() + 1,
  className,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false)

  const selectedDate = useMemo(() => {
    if (!value) return undefined
    const d = parseISO(value)
    return isValid(d) ? d : undefined
  }, [value])

  const [displayMonth, setDisplayMonth] = useState<Date>(
    () => selectedDate || new Date(1996, 4, 10),
  )

  const years = useMemo(() => {
    const list: number[] = []
    for (let y = toYear; y >= fromYear; y--) list.push(y)
    return list
  }, [fromYear, toYear])

  const formattedLabel = useMemo(() => {
    if (!selectedDate) return placeholder
    return format(selectedDate, "dd 'de' MMM. 'de' yyyy", { locale: ptBR })
  }, [selectedDate, placeholder])

  const handleSelectDate = (d: Date | undefined) => {
    if (!d) return
    onChange(format(d, 'yyyy-MM-dd'))
    setDisplayMonth(d)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-between text-left font-normal bg-white px-3 h-9 rounded-md shadow-xs',
            !selectedDate && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate text-xs sm:text-sm font-medium">{formattedLabel}</span>
          <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0 ml-1.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-3 rounded-2xl shadow-xl border-border space-y-2.5" align="start">
        {/* Barra rápida de Mês e Ano estilizada com shadcn Select */}
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={String(displayMonth.getMonth())}
            onValueChange={(m) => {
              const next = new Date(displayMonth.getFullYear(), Number(m), 1)
              setDisplayMonth(next)
            }}
          >
            <SelectTrigger className="h-8 text-xs font-semibold">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_PT.map((label, idx) => (
                <SelectItem key={label} value={String(idx)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(displayMonth.getFullYear())}
            onValueChange={(y) => {
              const next = new Date(Number(y), displayMonth.getMonth(), 1)
              setDisplayMonth(next)
            }}
          >
            <SelectTrigger className="h-8 text-xs font-semibold">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {years.map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Calendar
          mode="single"
          locale={ptBR}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          selected={selectedDate}
          onSelect={handleSelectDate}
          className="rounded-xl border border-border/60 p-2"
        />

        <div className="flex items-center justify-between pt-1 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date()
              handleSelectDate(today)
            }}
            className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
          >
            Selecionar Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 text-xs text-muted-foreground"
          >
            Fechar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
