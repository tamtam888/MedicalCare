import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function requireApiKey(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return null;
  }
  return apiKey;
}

function buildChatPayload({ model, system, user, temperature = 0.3, max_tokens = 1200 }) {
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
    max_tokens,
  };
}

async function callOpenAI({ apiKey, payload }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(errText || "OpenAI request failed");
  }

  const json = await response.json();
  const content = String(json?.choices?.[0]?.message?.content || "").trim();
  if (!content) throw new Error("Empty model response");
  return content;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function normalizeKpi(kpi, context) {
  const selectedCount = Number(context?.selectedCount || 0);
  const totalHistoryCount = Number(context?.totalHistoryCount || 0);

  const k = kpi && typeof kpi === "object" ? kpi : {};

  const goals = k.goals && typeof k.goals === "object" ? k.goals : {};
  const totalGoals = clampInt(goals.total ?? 0, 0, 999);
  const achieved = clampInt(goals.achieved ?? 0, 0, 999);
  const inProgress = clampInt(goals.inProgress ?? 0, 0, 999);
  const notAchieved = clampInt(goals.notAchieved ?? 0, 0, 999);

  const sessionsSelected = clampInt(k.sessionsSelected ?? selectedCount, 0, 9999);
  const sessionsTotal = clampInt(k.sessionsTotal ?? totalHistoryCount, 0, 9999);

  const functionalProgressScore = clampInt(k.functionalProgressScore ?? 5, 0, 10);
  const trendRaw = String(k.overallTrend || "").trim();
  const overallTrend =
    trendRaw === "Improving" || trendRaw === "Stable" || trendRaw === "Declining" ? trendRaw : "Stable";

  const reportingPeriod = String(k.reportingPeriod || "").trim();

  return {
    reportingPeriod,
    sessionsSelected,
    sessionsTotal,
    goals: {
      total: totalGoals,
      achieved: achieved,
      inProgress: inProgress,
      notAchieved: notAchieved,
    },
    functionalProgressScore,
    overallTrend,
  };
}

app.post("/api/ai/treatment-report", async (req, res) => {
  try {
    const apiKey = requireApiKey(req, res);
    if (!apiKey) return;

    const visits = Array.isArray(req.body?.visits) ? req.body.visits : [];
    if (!visits.length) return res.status(400).json({ error: "Missing visits" });

    const carePlan = req.body?.carePlan && typeof req.body.carePlan === "object" ? req.body.carePlan : null;

    const safeVisits = visits.slice(0, 30).map((v) => ({
      visitNo: Number(v?.visitNo || 0),
      type: String(v?.type || "other").slice(0, 40),
      date: String(v?.date || "").slice(0, 20),
      title: String(v?.title || "").slice(0, 160),
      summary: String(v?.summary || "").slice(0, 2200),
      hasAudio: Boolean(v?.hasAudio),
    }));

    const safeCarePlan = carePlan
      ? {
          goals: Array.isArray(carePlan?.goals)
            ? carePlan.goals
                .map((g) => ({
                  title: String(g?.title || "").slice(0, 180),
                  status: String(g?.status || "").slice(0, 60),
                  target: String(g?.target || "").slice(0, 40),
                  notes: String(g?.notes || "").slice(0, 500),
                }))
                .slice(0, 30)
            : [],
          exercises: Array.isArray(carePlan?.exercises)
            ? carePlan.exercises
                .map((ex) => ({
                  name: String(ex?.name || "").slice(0, 160),
                  instructions: String(ex?.instructions || "").slice(0, 700),
                  dosage: String(ex?.dosage || "").slice(0, 120),
                }))
                .slice(0, 60)
            : [],
        }
      : null;

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system = [
      "You write physical therapy clinical reports.",
      "Return ONLY valid JSON. No markdown. No code fences.",
      "Language: English only.",
      "Do not include any patient identifying details.",
      "Do not invent personal information.",
      "Use only the provided input.",
      "If information is missing, write 'Not specified'.",
      "",
      "Output JSON shape exactly:",
      "{",
      '  "kpi": {',
      '    "reportingPeriod": "string",',
      '    "sessionsSelected": number,',
      '    "sessionsTotal": number,',
      '    "goals": { "total": number, "achieved": number, "inProgress": number, "notAchieved": number },',
      '    "functionalProgressScore": number,',
      '    "overallTrend": "Improving|Stable|Declining"',
      "  },",
      '  "reportText": "string"',
      "}",
      "",
      "KPI rules:",
      "- functionalProgressScore must be 0-10 (integer).",
      "- overallTrend must be one of: Improving, Stable, Declining.",
      "- Goals should be functional when possible.",
    ].join("\n");

    const user = [
      "Create a structured treatment report based on selected visits.",
      "Include these sections in reportText with clear headings:",
      "1) Reason for treatment / Primary complaint",
      "2) Treatment goals (functional, measurable when possible)",
      "3) Interventions performed (include exercises if mentioned)",
      "4) Progress and response to treatment (strengths, difficulties)",
      "5) Goal attainment status (achieved / in progress / not achieved)",
      "6) Risks / red flags (if any; otherwise 'None noted')",
      "7) Plan and recommendations for next sessions",
      "",
      "Also produce KPI summary in 'kpi'.",
      "If care plan goals exist, align goals and statuses with them.",
      "",
      "Care plan context JSON (may be null):",
      JSON.stringify(safeCarePlan, null, 2),
      "",
      "Selected visits JSON:",
      JSON.stringify(safeVisits, null, 2),
    ].join("\n");

    const payload = buildChatPayload({ model, system, user, temperature: 0.2, max_tokens: 1400 });
    const raw = await callOpenAI({ apiKey, payload });

    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") {
      return res.json({
        kpi: normalizeKpi(null, { selectedCount: safeVisits.length, totalHistoryCount: 0 }),
        reportText: String(raw || "").trim(),
      });
    }

    const reportText = String(parsed?.reportText || "").trim();
    const kpi = normalizeKpi(parsed?.kpi, {
      selectedCount: safeVisits.length,
      totalHistoryCount: Number(req.body?.totalHistoryCount || 0),
    });

    if (!reportText) {
      return res.json({
        kpi,
        reportText: "Not specified.",
      });
    }

    return res.json({ kpi, reportText });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/ai/improve-visit", async (req, res) => {
  try {
    const apiKey = requireApiKey(req, res);
    if (!apiKey) return;

    const input = String(req.body?.text || "").trim();
    if (!input) return res.status(400).json({ error: "Missing text" });

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const system = [
      "You improve clinical visit summaries written by a clinician.",
      "Language: English only.",
      "Preserve meaning. Do not add invented facts.",
      "Return a professional, clear, structured note.",
      "Use headings if helpful.",
    ].join(" ");

    const user = [
      "Rewrite the following visit summary to be more professional and clear.",
      "Do not add new clinical facts.",
      "",
      "Text:",
      input,
    ].join("\n");

    const payload = buildChatPayload({ model, system, user, temperature: 0.2, max_tokens: 700 });
    const improved = await callOpenAI({ apiKey, payload });

    return res.json({ text: improved });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`AI proxy listening on http://localhost:${port}`);
});
