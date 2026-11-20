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

function translateAuthErrorPt(msg?: string): string {
  if (!msg) return "Não foi possível concluir a operação.";
  const m = msg.toLowerCase();
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) {
    return "Este e-mail já está cadastrado na plataforma MyLabs.";
  }
  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Verifique seus dados e tente novamente.";
  }
  if (m.includes("password should be at least")) {
    return "A senha deve possuir no mínimo 6 caracteres.";
  }
  if (m.includes("invalid format") || m.includes("unable to validate email")) {
    return "O formato do e-mail informado é inválido.";
  }
  return msg;
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

    // 1. BOOTSTRAP DEMO DATA (idempotent) + deduplicate any meal items
    if (action === "bootstrap_demo") {
      // Deduplicate any existing (meal_id, food_id) duplicates
      const { data: allItems } = await admin
        .from("diet_meal_items")
        .select("id, meal_id, food_id")
        .order("position", { ascending: true });
      if (allItems && allItems.length > 0) {
        const seen = new Set<string>();
        const dupIds: string[] = [];
        for (const it of allItems) {
          const key = `${it.meal_id}:${it.food_id}`;
          if (seen.has(key)) dupIds.push(it.id);
          else seen.add(key);
        }
        if (dupIds.length > 0) {
          await admin.from("diet_meal_items").delete().in("id", dupIds);
        }
      }

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
        crn_region: "CRN-3 (SP, MS)",
        specialty: "Nutrição Esportiva & Composição Corporal",
        clinic_name: "MyLabs Performance Clinic",
        city_state: "São Paulo - SP",
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

    // 2. EXTERNAL SYSTEM SUPPORT WHATSAPP SETUP ("tela de cadastro por fora")
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

    // 3. AUTHENTICATED ACTIONS
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sessão expirada ou usuário não autenticado." }), {
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
      return new Response(JSON.stringify({ error: "Sessão inválida. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("id, role, active")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !callerProfile.active) {
      return new Response(JSON.stringify({ error: "Perfil inativo ou não encontrado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3A. REGISTER NUTRITIONIST — EXCLUSIVO DO SUPORTE / ADMIN
    if (action === "register_nutritionist") {
      if (callerProfile.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Apenas a equipe de Suporte / Admin pode cadastrar novos nutricionistas." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

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
          JSON.stringify({ error: translateAuthErrorPt(createErr?.message) }),
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
        created_by: callerProfile.id,
      });

      return new Response(
        JSON.stringify({ ok: true, user_id: uid, email: String(email).trim().toLowerCase() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3B. CREATE CLIENT — Nutricionista ou Admin
    if (action === "create_client") {
      if (!["nutritionist", "admin"].includes(callerProfile.role)) {
        return new Response(
          JSON.stringify({ error: "Apenas nutricionistas ou administradores podem cadastrar clientes." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

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
          JSON.stringify({ error: translateAuthErrorPt(createErr?.message) }),
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
        return new Response(JSON.stringify({ error: translateAuthErrorPt(clientInsertErr.message) }), {
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

    return new Response(JSON.stringify({ error: "Ação desconhecida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: translateAuthErrorPt(err?.message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
