/**
 * Avaliador seguro de fórmulas clínicas personalizadas (recursive-descent parser, zero eval).
 * Permite ao nutricionista cadastrar novos tipos de cálculo (energético, composição corporal ou índice clínico).
 */

export interface FormulaVariableMeta {
  key: string
  label: string
  unit: string
  sampleValue: number
  description: string
}

export const FORMULA_VARIABLES: FormulaVariableMeta[] = [
  { key: 'peso', label: 'Peso Corporal', unit: 'kg', sampleValue: 78, description: 'Peso atual em quilogramas' },
  { key: 'altura', label: 'Estatura', unit: 'cm', sampleValue: 176, description: 'Altura em centímetros' },
  { key: 'idade', label: 'Idade', unit: 'anos', sampleValue: 29, description: 'Idade em anos completos' },
  { key: 'sexo', label: 'Sexo (1=M, 0=F)', unit: '0/1', sampleValue: 1, description: '1 para masculino, 0 para feminino' },
  { key: 'massa_magra', label: 'Massa Livre de Gordura', unit: 'kg', sampleValue: 65.5, description: 'Massa magra em kg' },
  { key: 'gordura_pct', label: '% de Gordura', unit: '%', sampleValue: 16, description: 'Percentual de gordura corporal' },
  { key: 'soma_dobras', label: 'Soma de Dobras', unit: 'mm', sampleValue: 68, description: 'Soma das dobras cutâneas em mm' },
  { key: 'cintura', label: 'Circunf. Cintura', unit: 'cm', sampleValue: 82, description: 'Perímetro da cintura em cm' },
  { key: 'quadril', label: 'Circunf. Quadril', unit: 'cm', sampleValue: 99, description: 'Perímetro do quadril em cm' },
  { key: 'pescoco', label: 'Circunf. Pescoço', unit: 'cm', sampleValue: 38, description: 'Perímetro do pescoço em cm' },
  { key: 'braco', label: 'Circunf. Braço', unit: 'cm', sampleValue: 36, description: 'Perímetro do braço direito em cm' },
  { key: 'coxa', label: 'Circunf. Coxa', unit: 'cm', sampleValue: 58, description: 'Perímetro da coxa medial em cm' },
  { key: 'imc', label: 'IMC', unit: 'kg/m²', sampleValue: 25.2, description: 'Índice de Massa Corporal' },
  { key: 'fator_atividade', label: 'Fator de Atividade', unit: 'x', sampleValue: 1.55, description: 'Multiplicador de atividade física' },
]

export const SAMPLE_VARIABLES: Record<string, number> = Object.fromEntries(
  FORMULA_VARIABLES.map((v) => [v.key, v.sampleValue]),
)

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = expr.trim()
  while (i < s.length) {
    const ch = s[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = ''
      while (i < s.length && /[0-9.]/.test(s[i])) {
        numStr += s[i++]
      }
      const val = Number(numStr)
      if (!Number.isFinite(val)) throw new Error(`Número inválido: ${numStr}`)
      tokens.push({ type: 'num', value: val })
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = ''
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        id += s[i++]
      }
      tokens.push({ type: 'id', value: id.toLowerCase() })
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }
    throw new Error(`Caractere não suportado na fórmula: "${ch}"`)
  }
  return tokens
}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: (x) => Math.sqrt(Math.max(0, x)),
  log10: (x) => Math.log10(Math.max(1e-9, x)),
  ln: (x) => Math.log(Math.max(1e-9, x)),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  min: (...xs) => Math.min(...xs),
  max: (...xs) => Math.max(...xs),
}

export function evaluateFormula(expression: string, vars: Record<string, number>): number {
  const tokens = tokenize(expression)
  if (tokens.length === 0) throw new Error('Informe uma expressão matemática')
  let pos = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }
  function consume(): Token {
    return tokens[pos++]
  }

  function parseExpr(): number {
    let left = parseTerm()
    while (true) {
      const t = peek()
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        consume()
        const right = parseTerm()
        left = t.value === '+' ? left + right : left - right
      } else break
    }
    return left
  }

  function parseTerm(): number {
    let left = parsePower()
    while (true) {
      const t = peek()
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        consume()
        const right = parsePower()
        if (t.value === '/' && right === 0) throw new Error('Divisão por zero na fórmula')
        left = t.value === '*' ? left * right : left / right
      } else break
    }
    return left
  }

  function parsePower(): number {
    let base = parseUnary()
    const t = peek()
    if (t && t.type === 'op' && t.value === '^') {
      consume()
      const exp = parsePower()
      base = Math.pow(base, exp)
    }
    return base
  }

  function parseUnary(): number {
    const t = peek()
    if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
      consume()
      const v = parseUnary()
      return t.value === '-' ? -v : v
    }
    return parsePrimary()
  }

  function parsePrimary(): number {
    const t = peek()
    if (!t) throw new Error('Expressão incompleta')
    if (t.type === 'num') {
      consume()
      return t.value
    }
    if (t.type === 'lparen') {
      consume()
      const val = parseExpr()
      const next = peek()
      if (!next || next.type !== 'rparen') throw new Error('Parêntese "(" não fechado')
      consume()
      return val
    }
    if (t.type === 'id') {
      consume()
      const next = peek()
      if (next && next.type === 'lparen') {
        consume()
        const fn = FUNCTIONS[t.value]
        if (!fn) throw new Error(`Função desconhecida: "${t.value}"`)
        const args: number[] = []
        if (peek()?.type !== 'rparen') {
          args.push(parseExpr())
          while (peek()?.type === 'comma') {
            consume()
            args.push(parseExpr())
          }
        }
        if (peek()?.type !== 'rparen') throw new Error(`Parêntese da função "${t.value}" não fechado`)
        consume()
        if (args.length === 0) throw new Error(`Função "${t.value}" requer argumentos`)
        return fn(...args)
      }
      if (!(t.value in vars)) {
        throw new Error(`Variável desconhecida: "${t.value}"`)
      }
      return Number(vars[t.value]) || 0
    }
    throw new Error('Sintaxe inválida na expressão')
  }

  const result = parseExpr()
  if (pos < tokens.length) {
    throw new Error('Expressão contém termos inesperados ao final')
  }
  if (!Number.isFinite(result)) {
    throw new Error('Resultado numérico inválido')
  }
  return +result.toFixed(2)
}
