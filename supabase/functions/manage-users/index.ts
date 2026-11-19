import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sanitizeWhatsapp(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.slice(0, 15);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = body.action as string;

    // 1. BOOTSTRAP DEMO DATA (idempotent)
    if (action === "bootstrap_demo") {
      const { data: existingProfiles } = await admin.from("profiles").select("id, email, role");
      const byEmail = new Map((existingProfiles || []).map((p: any) => [p.email.toLowerCase(), p]));

      async function ensureAuthUser(params: {
        email: string;
        password: string;
        role: "admin" | "nutritionist" | "client";
        full_name: string;
        whatsapp: string;
        crn?: string;
        crn_region?: string;
        specialty?: string;
        clinic_name?: string;
        city_state?: string;
        bio?: string;
      }) {
        const found = byEmail.get(params.email.toLowerCase());
        let uid = found?.id;
        if (!uid) {
          const { data: created, error } = await admin.auth.admin.createUser({
            email: params.email,
            password: params.password,
            email_confirm: true,
            app_metadata: { role: params.role },
            user_metadata: { full_name: params.full_name, crn: params.crn || null },
          });
          if (error) {
            const { data: list } = await admin.auth.admin.listUsers();
            const u = list?.users?.find((x) => x.email?.toLowerCase() === params.email.toLowerCase());
            if (!u) throw error;
            uid = u.id;
          } else {
            uid = created.user.id;
          }
        }

        await admin.from("profiles").upsert({
          id: uid,
          role: params.role,
          full_name: params.full_name,
          email: params.email.toLowerCase(),
          whatsapp: sanitizeWhatsapp(params.whatsapp),
          crn: params.crn || null,
          crn_region: params.crn_region || null,
          crn_status: "approved",
          specialty: params.specialty || null,
          clinic_name: params.clinic_name || null,
          city_state: params.city_state || null,
          bio: params.bio || null,
          active: true,
        });
        return uid!;
      }

      await ensureAuthUser({
        email: "suporte@mylabs.app",
        password: "Mylabs@2026",
        role: "admin",
        full_name: "Rafael Libório (Suporte MyLabs)",
        whatsapp: "5511999990000",
      });

      const nutriId = await ensureAuthUser({
        email: "camila@mylabs.app",
        password: "Mylabs@2026",
        role: "nutritionist",
        full_name: "Dra. Camila Rocha",
        whatsapp: "5511988887777",
        crn: "CRN-3 48291",
        crn_region: "CRN-3 (SP/MS)",
        specialty: "Nutrição Esportiva & Composição Corporal",
        clinic_name: "MyLabs Performance Clinic",
        city_state: "São Paulo, SP",
        bio: "Nutricionista especialista em hipertrofia, recomposição corporal e periodização nutricional baseada em evidências.",
      });

      const lucasId = await ensureAuthUser({
        email: "lucas@mylabs.app",
        password: "Mylabs@2026",
        role: "client",
        full_name: "Lucas Mendes",
        whatsapp: "5511977776666",
      });

      const marianaId = await ensureAuthUser({
        email: "mariana@mylabs.app",
        password: "Mylabs@2026",
        role: "client",
        full_name: "Mariana Silva",
        whatsapp: "5511966665555",
      });

      const { data: sw } = await admin.from("app_settings").select("value").eq("key", "support_whatsapp").maybeSingle();
      if (!sw || !sw.value || sw.value === "") {
        await admin.from("app_settings").upsert({
          key: "support_whatsapp",
          value: "5511999990000",
        });
      }

      await admin.from("clients").upsert([
        {
          id: lucasId,
          nutritionist_id: nutriId,
          birth_date: "1997-04-15",
          sex: "male",
          height_cm: 178,
          goal: "Hipertrofia & Recomposição Corporal",
          activity_level: "moderate",
          restrictions: "Sem alergias. Preferência por refeições práticas no pré-treino.",
          clinical_notes:
            "Excelente resposta ao protocolo de 2.0 g/kg de proteína. Manter superávit controlado nos dias de treino.",
          water_goal_ml: 3000,
          plan: "Pro",
        },
        {
          id: marianaId,
          nutritionist_id: nutriId,
          birth_date: "1992-08-22",
          sex: "female",
          height_cm: 165,
          goal: "Emagrecimento & Saúde Metabólica",
          activity_level: "light",
          restrictions: "Intolerância leve à lactose (prefere iogurte desnatado/zero lactose).",
          clinical_notes: "Foco em saciedade no período vespertino e meta de 2.500 mL de água por dia.",
          water_goal_ml: 2500,
          plan: "Clinic",
        },
      ]);

      const { count: dietCount } = await admin
        .from("diet_plans")
        .select("id", { count: "exact", head: true })
        .eq("client_id", lucasId);

      if (!dietCount || dietCount === 0) {
        const { data: foods } = await admin.from("foods").select("id, name");
        const findFood = (kw: string) => foods?.find((f: any) => f.name.toLowerCase().includes(kw.toLowerCase()))?.id;

        const { data: planTrain } = await admin
          .from("diet_plans")
          .insert({
            client_id: lucasId,
            nutritionist_id: nutriId,
            name: "Protocolo Hipertrofia — Dia de Treino",
            kind: "training",
            kcal_target: 2450,
            protein_target_g: 185,
            carb_target_g: 275,
            fat_target_g: 66,
            notes: "Priorizar carboidratos complexos 90 min antes do treino e hidratação fracionada.",
            active: true,
          })
          .select("id")
          .single();

        if (planTrain) {
          const mealsData = [
            {
              name: "Café da Manhã",
              meal_time: "07:30",
              position: 1,
              notes: "Ovos mexidos com aveia e fruta",
              items: [
                { foodId: findFood("Ovo de galinha"), grams: 150 },
                { foodId: findFood("Aveia"), grams: 50 },
                { foodId: findFood("Banana"), grams: 100 },
                { foodId: findFood("Iogurte natural desnatado"), grams: 170 },
              ],
            },
            {
              name: "Almoço Clínico",
              meal_time: "12:30",
              position: 2,
              notes: "Prato principal rico em proteína magra",
              items: [
                { foodId: findFood("Peito de frango grelhado"), grams: 180 },
                { foodId: findFood("Arroz integral"), grams: 220 },
                { foodId: findFood("Feijão carioca"), grams: 100 },
                { foodId: findFood("Azeite"), grams: 10 },
              ],
            },
            {
              name: "Lanche Pré-Treino",
              meal_time: "16:30",
              position: 3,
              notes: "60 a 90 minutos antes do treino",
              items: [
                { foodId: findFood("Whey protein"), grams: 35 },
                { foodId: findFood("Banana"), grams: 120 },
                { foodId: findFood("Pasta de amendoim"), grams: 15 },
              ],
            },
            {
              name: "Jantar Pós-Treino",
              meal_time: "20:30",
              position: 4,
              notes: "Refeição de recuperação glicogênica e muscular",
              items: [
                { foodId: findFood("Filé de tilápia"), grams: 190 },
                { foodId: findFood("Batata-doce"), grams: 260 },
                { foodId: findFood("Brócolis"), grams: 100 },
                { foodId: findFood("Azeite"), grams: 10 },
              ],
            },
          ];

          for (const m of mealsData) {
            const { data: mealRow } = await admin
              .from("diet_meals")
              .insert({
                plan_id: planTrain.id,
                name: m.name,
                meal_time: m.meal_time,
                position: m.position,
                notes: m.notes,
              })
              .select("id")
              .single();

            if (mealRow) {
              const validItems = m.items
                .filter((it) => it.foodId)
                .map((it, idx) => ({
                  meal_id: mealRow.id,
                  food_id: it.foodId!,
                  grams: it.grams,
                  position: idx + 1,
                }));
              if (validItems.length > 0) {
                await admin.from("diet_meal_items").insert(validItems);
              }
            }
          }
        }
      }

      const { count: wpCount } = await admin
        .from("workout_plans")
        .select("id", { count: "exact", head: true })
        .eq("client_id", lucasId);

      if (!wpCount || wpCount === 0) {
        const { data: exList } = await admin.from("exercises").select("id, slug, name_pt, muscle_group");
        const bySlug = (slug: string) => exList?.find((e: any) => e.slug === slug)?.id;

        const { data: wp } = await admin
          .from("workout_plans")
          .insert({
            client_id: lucasId,
            nutritionist_id: nutriId,
            name: "Periodização Hipertrofia ABC — 4 Semanas",
            weeks: 4,
            notes: "Progressão de carga semanal mantendo execução controlada e cadência 3:1:1.",
            active: true,
          })
          .select("id")
          .single();

        if (wp) {
          const scheduleTemplate = [
            {
              weekday: 1,
              title: "Treino A — Peitoral, Ombros & Tríceps",
              muscle_groups: ["peito", "ombros", "triceps"],
              exercises: [
                { slug: "Incline_Dumbbell_Press", sets: 4, reps: "8-10", load_kg: 28, notes: "Escápulas retraídas e descida controlada." },
                { slug: "Barbell_Bench_Press_-_Medium_Grip", sets: 4, reps: "8-10", load_kg: 70, notes: "Pés firmes no solo." },
                { slug: "Dumbbell_Shoulder_Press", sets: 3, reps: "10-12", load_kg: 20, notes: "Amplitude completa sem arquear a lombar." },
                { slug: "Side_Lateral_Raise", sets: 4, reps: "12-15", load_kg: 12, notes: "Cotovelos levemente flexionados." },
                { slug: "Triceps_Pushdown_-_Rope_Attachment", sets: 4, reps: "12", load_kg: 25, notes: "Abrir a corda no final da extensão." },
              ],
            },
            {
              weekday: 2,
              title: "Treino B — Costas, Bíceps & Abdômen",
              muscle_groups: ["costas", "biceps", "abdomen"],
              exercises: [
                { slug: "Wide-Grip_Lat_Pulldown", sets: 4, reps: "10-12", load_kg: 65, notes: "Deprimir as escápulas antes de puxar." },
                { slug: "Bent_Over_Barbell_Row", sets: 4, reps: "8-10", load_kg: 60, notes: "Tronco firme a 45 graus." },
                { slug: "Seated_Cable_Rows", sets: 3, reps: "12", load_kg: 55, notes: "Segurar 1s na contração máxima." },
                { slug: "Barbell_Curl", sets: 3, reps: "10-12", load_kg: 30, notes: "Cotovelos fixos ao lado do tronco." },
                { slug: "Plank", sets: 3, reps: "45s", load_kg: 0, notes: "Contração máxima do core." },
              ],
            },
            {
              weekday: 3,
              title: "Treino C — Quadríceps, Posterior, Glúteos & Panturrilha",
              muscle_groups: ["quadriceps", "posterior", "gluteos", "panturrilha"],
              exercises: [
                { slug: "Barbell_Squat", sets: 4, reps: "8-10", load_kg: 90, notes: "Joelhos alinhados à ponta dos pés." },
                { slug: "Leg_Press", sets: 4, reps: "12", load_kg: 180, notes: "Amplitude segura sem tirar a lombar do encosto." },
                { slug: "Romanian_Deadlift", sets: 4, reps: "10", load_kg: 75, notes: "Ênfase no alongamento dos isquiotibiais." },
                { slug: "Barbell_Hip_Thrust", sets: 3, reps: "12", load_kg: 80, notes: "Pausa de 1s no topo." },
                { slug: "Standing_Calf_Raises", sets: 4, reps: "15", load_kg: 70, notes: "Alongar bem na descida." },
              ],
            },
            {
              weekday: 4,
              title: "Treino D — Superiores Completo (Peito, Costas & Ombros)",
              muscle_groups: ["peito", "costas", "ombros"],
              exercises: [
                { slug: "Dumbbell_Bench_Press", sets: 4, reps: "10", load_kg: 30, notes: "Controle total na fase excêntrica." },
                { slug: "One-Arm_Dumbbell_Row", sets: 4, reps: "10", load_kg: 32, notes: "Puxar em direção ao quadril." },
                { slug: "Face_Pull", sets: 3, reps: "15", load_kg: 20, notes: "Foco em deltoide posterior e manguito." },
                { slug: "Hammer_Curls", sets: 3, reps: "12", load_kg: 16, notes: "Pegada neutra firme." },
              ],
            },
            {
              weekday: 5,
              title: "Treino E — Inferiores & Core",
              muscle_groups: ["quadriceps", "posterior", "gluteos", "abdomen"],
              exercises: [
                { slug: "Hack_Squat", sets: 4, reps: "10", load_kg: 100, notes: "Descer até 90 graus." },
                { slug: "Lying_Leg_Curls", sets: 4, reps: "12", load_kg: 45, notes: "Sem elevar o quadril." },
                { slug: "Leg_Extensions", sets: 3, reps: "12-15", load_kg: 55, notes: "Segurar 1s no topo." },
                { slug: "Cable_Crunch", sets: 4, reps: "15", load_kg: 35, notes: "Flexionar a coluna vertebral." },
              ],
            },
          ];

          for (let week = 1; week <= 2; week++) {
            for (const dayTpl of scheduleTemplate) {
              const { data: dayRow } = await admin
                .from("workout_days")
                .insert({
                  plan_id: wp.id,
                  week,
                  weekday: dayTpl.weekday,
                  title: dayTpl.title,
                  muscle_groups: dayTpl.muscle_groups,
                  notes: `Semana ${week} — foco em execução limpa`,
                })
                .select("id")
                .single();

              if (dayRow) {
                const exRows = dayTpl.exercises
                  .map((ex, idx) => {
                    const eid = bySlug(ex.slug);
                    if (!eid) return null;
                    return {
                      day_id: dayRow.id,
                      exercise_id: eid,
                      position: idx + 1,
                      sets: ex.sets,
                      reps: ex.reps,
                      rest_sec: 75,
                      load_kg: ex.load_kg + (week - 1) * 2,
                      notes: ex.notes,
                    };
                  })
                  .filter(Boolean);
                if (exRows.length > 0) {
                  await admin.from("workout_exercises").insert(exRows);
                }
              }
            }
          }
        }
      }

      const { count: assessCount } = await admin
        .from("anthropometry_assessments")
        .select("id", { count: "exact", head: true })
        .eq("client_id", lucasId);

      if (!assessCount || assessCount === 0) {
        const history = [
          {
            daysAgo: 45,
            weight: 84.2,
            bf: 18.2,
            waist: 88.0,
            hip: 101.0,
            armRight: 37.2,
            thighRight: 58.5,
            chestSf: 13,
            abdomenSf: 23,
            thighSf: 17,
            notes: "Avaliação inicial — início do protocolo de recomposição corporal.",
          },
          {
            daysAgo: 30,
            weight: 82.8,
            bf: 17.1,
            waist: 86.0,
            hip: 100.2,
            armRight: 37.7,
            thighRight: 58.8,
            chestSf: 12,
            abdomenSf: 21,
            thighSf: 16,
            notes: "Redução consistente de perímetro abdominal com ganho de circunferência de braço.",
          },
          {
            daysAgo: 15,
            weight: 81.6,
            bf: 16.3,
            waist: 84.5,
            hip: 99.8,
            armRight: 38.1,
            thighRight: 59.0,
            chestSf: 11,
            abdomenSf: 19,
            thighSf: 15,
            notes: "Ótima preservação e ganho de massa magra.",
          },
          {
            daysAgo: 1,
            weight: 80.8,
            bf: 15.6,
            waist: 83.5,
            hip: 99.5,
            armRight: 38.4,
            thighRight: 59.2,
            chestSf: 10,
            abdomenSf: 18,
            thighSf: 14,
            notes: "Paciente atingiu 15,6% de gordura corporal com +1,2 cm de braço direito.",
          },
        ];

        for (const h of history) {
          const dt = new Date(Date.now() - h.daysAgo * 86400000).toISOString().slice(0, 10);
          const fatMassKg = +((h.weight * h.bf) / 100).toFixed(1);
          const leanMassKg = +(h.weight - fatMassKg).toFixed(1);
          await admin.from("anthropometry_assessments").insert({
            client_id: lucasId,
            assessed_by: nutriId,
            assessed_at: dt,
            weight_kg: h.weight,
            height_cm: 178,
            protocol: "jackson_pollock_3",
            skinfolds: {
              chest: h.chestSf,
              abdomen: h.abdomenSf,
              thigh: h.thighSf,
              triceps: 10,
              subscapular: 13,
              suprailiac: 14,
              midaxillary: 11,
            },
            circumferences: {
              neck: 39,
              shoulders: 121,
              chest: 104,
              waist: h.waist,
              abdomen: h.waist + 2,
              hip: h.hip,
              armRight: h.armRight,
              armLeft: +(h.armRight - 0.2).toFixed(1),
              thighRight: h.thighRight,
              thighLeft: +(h.thighRight - 0.2).toFixed(1),
              calfRight: 39.2,
            },
            results: {
              bmi: +(h.weight / (1.78 * 1.78)).toFixed(1),
              bmiCategory: "Sobrepeso",
              bodyFatPct: h.bf,
              bodyFatCategory: "Fitness / Ótimo",
              fatMassKg,
              leanMassKg,
              ffmi: +(leanMassKg / (1.78 * 1.78)).toFixed(1),
              whr: +(h.waist / h.hip).toFixed(2),
              whrRisk: "Baixo risco",
              whtr: +(h.waist / 178).toFixed(2),
              sumSkinfoldsMm: h.chestSf + h.abdomenSf + h.thighSf,
            },
            notes: h.notes,
          });
        }
      }

      await admin.from("report_schedules").upsert({
        client_id: lucasId,
        nutritionist_id: nutriId,
        interval_days: 15,
        enabled: true,
        last_run_on: new Date().toISOString().slice(0, 10),
        next_run_on: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      });

      const { count: repCount } = await admin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("client_id", lucasId);

      if (!repCount || repCount === 0) {
        const today = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        await admin.from("water_logs").upsert({ client_id: lucasId, log_date: today, ml: 2450 });
        await admin.from("reports").insert({
          client_id: lucasId,
          nutritionist_id: nutriId,
          period_start: start,
          period_end: today,
          generated_by: "schedule",
          data: {
            client: {
              id: lucasId,
              name: "Lucas Mendes",
              goal: "Hipertrofia & Recomposição Corporal",
              sex: "male",
              height_cm: 178,
              age: 29,
              water_goal_ml: 3000,
            },
            period: { start, end: today, days: 15 },
            weight: {
              series: [
                { date: start, kg: 81.6 },
                { date: today, kg: 80.8 },
              ],
              start: 81.6,
              end: 80.8,
              delta: -0.8,
            },
            diet: { adherence_pct: 92 },
            workout: {
              planned_sessions: 10,
              completion_pct: 90,
              load_progress: [
                { exercise: "Supino inclinado com halteres", first_kg: 26, last_kg: 28, delta: 2 },
                { exercise: "Agachamento livre com barra", first_kg: 86, last_kg: 90, delta: 4 },
              ],
            },
            water: { avg_ml: 2850, goal_ml: 3000, days_goal_met: 12 },
            engagement: { active_days: 14, pct: 93 },
            assessment: {
              assessed_at: today,
              weight_kg: 80.8,
              results: {
                bmi: 25.5,
                bodyFatPct: 15.6,
                bodyFatCategory: "Fitness / Ótimo",
                leanMassKg: 68.2,
                fatMassKg: 12.6,
                whr: 0.84,
              },
            },
            alerts: [],
            generated_at: new Date().toISOString(),
          },
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          accounts: {
            nutritionist: "camila@mylabs.app",
            client: "lucas@mylabs.app",
            admin: "suporte@mylabs.app",
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. PUBLIC REGISTRATION OF NUTRITIONIST (Detailed Form)
    if (action === "register_nutritionist") {
      const {
        full_name,
        email,
        password,
        whatsapp,
        crn,
        crn_region,
        specialty,
        clinic_name,
        city_state,
        bio,
      } = body;

      if (!full_name || !email || !password || String(password).length < 6) {
        return new Response(
          JSON.stringify({ error: "Preencha nome completo, e-mail e senha (mínimo 6 caracteres)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        email_confirm: true,
        app_metadata: { role: "nutritionist" },
        user_metadata: { full_name: String(full_name).trim(), crn: crn || null },
      });

      if (createErr || !created?.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message || "Erro ao registrar nutricionista." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const uid = created.user.id;
      await admin.from("profiles").upsert({
        id: uid,
        role: "nutritionist",
        full_name: String(full_name).trim(),
        email: String(email).trim().toLowerCase(),
        whatsapp: sanitizeWhatsapp(whatsapp),
        crn: crn ? String(crn).trim() : null,
        crn_region: crn_region || null,
        crn_status: "approved",
        specialty: specialty || null,
        clinic_name: clinic_name || null,
        city_state: city_state || null,
        bio: bio || null,
        active: true,
      });

      return new Response(
        JSON.stringify({ ok: true, user_id: uid, email: String(email).trim().toLowerCase() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. EXTERNAL SYSTEM SUPPORT WHATSAPP SETUP ("tela de cadastro por fora")
    if (action === "save_system_whatsapp") {
      const { whatsapp, default_message } = body;
      const clean = sanitizeWhatsapp(whatsapp);
      if (!clean || clean.length < 10) {
        return new Response(
          JSON.stringify({ error: "Informe um número de WhatsApp válido com DDD." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      await admin.from("app_settings").upsert([
        { key: "support_whatsapp", value: clean },
        ...(default_message
          ? [{ key: "support_whatsapp_message", value: String(default_message) }]
          : []),
      ]);
      return new Response(JSON.stringify({ ok: true, support_whatsapp: clean }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. AUTHENTICATED ACTIONS: create_client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("id, role, active")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !callerProfile.active || !["nutritionist", "admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Apenas nutricionistas ou administradores podem cadastrar clientes." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_client") {
      const {
        full_name,
        email,
        password,
        whatsapp,
        birth_date,
        sex,
        height_cm,
        weight_kg,
        goal,
        activity_level,
        restrictions,
        clinical_notes,
        water_goal_ml,
        plan,
        report_interval_days,
        nutritionist_id,
      } = body;

      if (!full_name || !email || !password || String(password).length < 6) {
        return new Response(
          JSON.stringify({ error: "Informe nome completo, e-mail válido e senha com no mínimo 6 caracteres." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const targetNutriId =
        callerProfile.role === "admin" && nutritionist_id ? nutritionist_id : callerProfile.id;

      const { data: createdAuth, error: createErr } = await admin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        email_confirm: true,
        app_metadata: { role: "client" },
        user_metadata: { full_name: String(full_name).trim() },
      });

      if (createErr || !createdAuth?.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message || "Não foi possível criar o login do cliente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const clientId = createdAuth.user.id;

      await admin.from("profiles").upsert({
        id: clientId,
        role: "client",
        full_name: String(full_name).trim(),
        email: String(email).trim().toLowerCase(),
        whatsapp: sanitizeWhatsapp(whatsapp),
        crn_status: "approved",
        active: true,
        created_by: targetNutriId,
      });

      const { error: clientInsertErr } = await admin.from("clients").upsert({
        id: clientId,
        nutritionist_id: targetNutriId,
        birth_date: birth_date || null,
        sex: sex || "male",
        height_cm: height_cm ? Number(height_cm) : 170,
        goal: goal || "Saúde & Composição Corporal",
        activity_level: activity_level || "moderate",
        restrictions: restrictions || null,
        clinical_notes: clinical_notes || null,
        water_goal_ml: water_goal_ml ? Number(water_goal_ml) : 2500,
        plan: plan || "Pro",
      });

      if (clientInsertErr) {
        return new Response(JSON.stringify({ error: clientInsertErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (weight_kg && Number(weight_kg) >= 20) {
        const w = Number(weight_kg);
        const h = height_cm ? Number(height_cm) : 170;
        const bmi = +(w / ((h / 100) * (h / 100))).toFixed(1);
        await admin.from("anthropometry_assessments").insert({
          client_id: clientId,
          assessed_by: targetNutriId,
          weight_kg: w,
          height_cm: h,
          protocol: "bioimpedance",
          results: {
            bmi,
            bmiCategory: bmi < 25 ? "Eutrofia (Normal)" : "Sobrepeso",
            bodyFatPct: 18,
            bodyFatCategory: "Aceitável",
            fatMassKg: +((w * 18) / 100).toFixed(1),
            leanMassKg: +(w * 0.82).toFixed(1),
            ffmi: +((w * 0.82) / ((h / 100) * (h / 100))).toFixed(1),
          },
          notes: "Cadastro inicial do cliente.",
        });
      }

      const interval = report_interval_days ? Math.max(1, Number(report_interval_days)) : 15;
      const nextDate = new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10);
      await admin.from("report_schedules").upsert({
        client_id: clientId,
        nutritionist_id: targetNutriId,
        interval_days: interval,
        enabled: true,
        next_run_on: nextDate,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          client_id: clientId,
          email: String(email).trim().toLowerCase(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Ação desconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro interno na Edge Function" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
