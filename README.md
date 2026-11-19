# MyLabs — Plataforma Científica de Nutrição Clínica, Periodização de Treinos & Antropometria

Aplicação full-stack construída em arquitetura modular (**Clean Code**) com **React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (Radix UI)** e backend completo no **Supabase** (PostgreSQL + Auth + Row Level Security + Storage + Edge Functions + `pg_cron`).

## Arquitetura do Projeto

- `src/domain/` — Camada de domínio pura e testada (`vitest`):
  - `energy.ts` — Equações científicas de Taxa Metabólica Basal e Gasto Energético Total: **Mifflin-St Jeor (1990)**, **Harris-Benedict Revisada (Roza & Shizgal, 1984)**, **FAO/OMS/UNU (Schofield, 1985)**, **Cunningham (1980)** e **Katch-McArdle (2010)**, além de distribuição de macronutrientes (ISSN/DRI) e meta hídrica.
  - `anthropometry.ts` — Protocolos científicos de composição corporal: **Jackson & Pollock 3 e 7 dobras (1978/1980)**, **Durnin & Womersley 4 dobras (1974)**, **Faulkner 4 dobras (1968)**, **Marinha dos EUA (Hodgdon & Beckett, 1984)**, **Equação de Siri (1961)**, **IMC**, **RCQ (OMS)**, **RCEst** e **FFMI (Schutz et al., 2002)**.
  - `formula.ts` — Parser matemático seguro (recursive-descent, sem `eval`) para cadastro de novos cálculos personalizados pelo nutricionista.
  - `nutrition.ts` — Cálculo de porções e equivalência nutricional inteligente baseada na Tabela TACO (4ª ed.).
  - `whatsapp.ts` — Formatação de números com DDI/DDD e geração de mensagens prontas para WhatsApp (canal do Nutricionista e canal do Suporte Técnico do Sistema).
  - `workouts.ts` — Mapeamento de agrupamentos musculares e dias da semana em português.
- `src/components/ui/` — 33 componentes acessíveis e estilizados com **shadcn/ui + Radix UI**.
- `src/components/shared/` — Componentes clínicos compartilhados:
  - `ExercisePreview.tsx` — Visualizador de GIFs animados e instruções passo a passo de exercícios em português.
  - `MediaAttachmentPicker.tsx` — Componente estilizado de upload (drag-and-drop) e captura de câmera ao vivo (WebRTC) para fotos de dieta, evolução e mídia de exercícios.
  - `BodyMapSvg.tsx` — Mapa anatômico SVG interativo e controles deslizantes (`Slider` + `Stepper`) para avaliação antropométrica sem digitação repetitiva.
  - `AppShell.tsx` — Layout responsivo com isolamento estrito por perfil (`client`, `nutritionist`, `admin`).
- `src/pages/` — Módulos isolados por perfil (`AuthPage`, `ExternalSupportSetupPage`, `client/ClientDashboardPage`, `nutritionist/*`, `admin/AdminDashboardPage`).
- `supabase/migrations/` — 9 migrações SQL (schema, RLS, Storage buckets, catálogo TACO, catálogo de 91+ exercícios em português, funções de relatório e `pg_cron`).
- `supabase/functions/manage-users/` — Edge Function para criação automática do login e prontuário do cliente pelo nutricionista, cadastro detalhado de nutricionista e configuração externa do WhatsApp de suporte.

## Comandos

```bash
npm install
npm run dev      # Servidor de desenvolvimento
npm test         # Testes unitários da camada de domínio (Vitest)
npm run build    # Verificação de tipos TypeScript + build de produção
```
