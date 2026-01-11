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

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function buildChatPayload({ model, system, user, temperature = 0.2, max_tokens = 1200 }) {
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

function clampString(value, maxLen) {
  return String(value || "").slice(0, maxLen);
}

function sanitizeVisits(visits) {
  const arr = Array.isArray(visits) ? visits : [];
  return arr.slice(0, 30).map((v, idx) => ({
    visitNo: Number(v?.visitNo || idx + 1),
    type: clampString(v?.type || "other", 40),
    date: clampString(v?.date || "", 20),
    title: clampString(v?.title || "", 160),
    summary: clampString(v?.summary || "", 2400),
    hasAudio: Boolean(v?.hasAudio),
  }));
}

function sanitizeCarePlan(carePlan) {
  if (!carePlan || typeof carePlan !== "object") return null;

  const goalsRaw = Array.isArray(carePlan?.goals) ? carePlan.goals : [];
  const exercisesRaw = Array.isArray(carePlan?.exercises) ? carePlan.exercises : [];

  const goals = goalsRaw.slice(0, 30).map((g) => ({
    title: clampString(g?.title || g?.name || g?.goal || "", 220),
    status: clampString(g?.status || g?.state || "", 60),
    target: clampString(g?.target || g?.targetDate || "", 80),
    notes: clampString(g?.notes || g?.description || "", 500),
  }));

  const exercises = exercisesRaw.slice(0, 60).map((ex) => ({
    name: clampString(ex?.name || ex?.title || ex?.exercise || "", 160),
    instructions: clampString(ex?.instructions || ex?.description || "", 700),
    dosage: clampString(ex?.dosage || ex?.frequency || ex?.reps || "", 120),
  }));

  const hasAny = goals.some((g) => g.title || g.notes) || exercises.some((e) => e.name || e.instructions);
  if (!hasAny) return null;

  return { goals, exercises };
}

function buildStructuredReportPrompt({ visits, carePlan }) {
  const carePlanBlock = carePlan
    ? [
        "Care plan context (de-identified):",
        JSON.stringify(carePlan, null, 2),
        "",
      ].join("\n")
    : "Care plan context (de-identified): none provided\n";

  const visitsBlock = [
    "Selected visits (de-identified):",
    JSON.stringify(visits, null, 2),
  ].join("\n");

  const instructions = [
    "Write a structured clinical TREATMENT REPORT in English only.",
    "Do NOT include patient identifying details (names, IDs, addresses, phone, email, exact DOB).",
    "Do NOT invent personal data, diagnoses, test results, medications, or outcomes not present in the input.",
    "Use clear section headings and bullet points.",
    "Focus on FUNCTIONAL goals (real-life activities).",
    "Where possible, assign goal status: Achieved / Partially Achieved / Not Achieved.",
    "If goal status is unclear, mark as Partially Achieved and explain uncertainty briefly.",
    "Extract exercises/interventions from input. If carePlan includes exercises, include them.",
    "Summarize each selected visit with: what was done, response/difficulty/strengths, and plan/home program if mentioned.",
    "Include a concise Progress Over Time section.",
    "Include a Goal Attainment Summary with counts if possible.",
    "End with Recommendations / Next Steps.",
    "",
    "Output format:",
    "TREATMENT PURPOSE / PRIMARY GOAL",
    "FUNCTIONAL GOALS (with status and evidence)",
    "INTERVENTIONS & EXERCISES PERFORMED",
    "SESSION SUMMARIES (Selected Visits)",
    "PROGRESS OVER TIME",
    "GOAL ATTAINMENT SUMMARY",
    "RECOMMENDATIONS / NEXT STEPS",
    "ADDITIONAL NOTES (Optional)",
  ].join("\n");

  return [
    instructions,
    "",
    carePlanBlock,
    visitsBlock,
  ].join("\n");
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/ai/treatment-report", async (req, res) => {
  try {
    const apiKey = requireApiKey(req, res);
    if (!apiKey) return;

    const visits = sanitizeVisits(req.body?.visits);
    if (!visits.length) return res.status(400).json({ error: "Missing visits" });

    const carePlan = sanitizeCarePlan(req.body?.carePlan);
    const model = getModel();

    const system = [
      "You are a clinical documentation assistant.",
      "You produce structured treatment reports for clinicians.",
      "English only.",
      "Never include patient identifying information.",
      "Never invent facts not present in the input.",
      "Be concise, clinically useful, and clearly structured.",
    ].join(" ");

    const user = buildStructuredReportPrompt({ visits, carePlan });

    const payload = buildChatPayload({
      model,
      system,
      user,
      temperature: 0.2,
      max_tokens: 1400,
    });

    const text = await callOpenAI({ apiKey, payload });

    return res.json({ text, markdown: text });
  } catch (e) {
    const msg = String(e?.message || "Server error");
    return res.status(500).json({ error: "Server error", details: msg.slice(0, 2000) });
  }
});

app.post("/api/ai/improve-visit", async (req, res) => {
  try {
    const apiKey = requireApiKey(req, res);
    if (!apiKey) return;

    const input = String(req.body?.text || "").trim();
    if (!input) return res.status(400).json({ error: "Missing text" });

    const model = getModel();

    const system = [
      "You improve clinical visit summaries written by a clinician.",
      "English only.",
      "Preserve meaning. Do not add invented facts.",
      "Return a professional, clear, structured note.",
      "Do not introduce patient identifying details unless already present in the provided text.",
    ].join(" ");

    const user = [
      "Rewrite the following visit summary to be more professional and clear.",
      "Use headings and bullet points when helpful.",
      "Do not add any new clinical facts.",
      "",
      "Text:",
      input,
    ].join("\n");

    const payload = buildChatPayload({ model, system, user, temperature: 0.15, max_tokens: 700 });
    const improved = await callOpenAI({ apiKey, payload });

    return res.json({ text: improved });
  } catch (e) {
    const msg = String(e?.message || "Server error");
    return res.status(500).json({ error: "Server error", details: msg.slice(0, 2000) });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`AI proxy listening on http://localhost:${port}`);
});
