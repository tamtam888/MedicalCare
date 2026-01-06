// src/services/carePlanTemplates.js

const TEMPLATE_EXT_URL = "https://medicalcare.app/careplan-template-json";

/**
 * We treat templates as "global" data.
 * If Medplum is not authenticated (no access token / profile),
 * we fall back to local seed templates without breaking the UI.
 */

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toTitle(obj) {
  return String(obj?.category || obj?.title || obj?.name || "Template").trim() || "Template";
}

function toExerciseCount(obj) {
  const ex = Array.isArray(obj?.exercises) ? obj.exercises : [];
  return ex.length;
}

function findTemplateJsonExtension(planDef) {
  const ext = Array.isArray(planDef?.extension) ? planDef.extension : [];
  return ext.find((e) => e?.url === TEMPLATE_EXT_URL) || null;
}

function extractTemplateJson(planDef) {
  const ext = findTemplateJsonExtension(planDef);
  const value = ext?.valueString;
  if (!value) return null;
  return safeJsonParse(value);
}

function seedToUiTemplates(seedTemplates) {
  const seed = Array.isArray(seedTemplates) ? seedTemplates : [];
  return seed
    .filter((t) => t && typeof t === "object")
    .map((t, idx) => ({
      id: `local_${idx}_${toTitle(t)}`.replace(/\s+/g, "_"),
      title: toTitle(t),
      count: toExerciseCount(t),
      raw: t,
      source: "local",
    }));
}

function isProbablyAuthError(err) {
  const msg = String(err?.message || "").toLowerCase();
  // Medplum errors often come as 401/403 or "unauthorized"
  return (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("not authorized") ||
    msg.includes("invalid token")
  );
}

async function isMedplumLoggedIn(medplum) {
  if (!medplum) return false;

  // Best effort checks that won’t crash if method doesn’t exist.
  try {
    // Common in medplum-client: getAccessToken()
    const token =
      typeof medplum.getAccessToken === "function" ? medplum.getAccessToken() : null;
    if (token && String(token).trim().length > 10) return true;
  } catch {}

  try {
    // If profile exists, you're authenticated.
    const profile =
      typeof medplum.getProfile === "function" ? medplum.getProfile() : null;
    if (profile && profile.resourceType) return true;
  } catch {}

  // If none of the above, assume not logged in
  return false;
}

export async function listCarePlanTemplatesFromMedplum(medplum) {
  const res = await medplum.searchResources("PlanDefinition", {
    status: "active",
    _count: 200,
  });
  return Array.isArray(res) ? res : [];
}

export async function publishSeedTemplatesOnce(medplum, seedTemplates) {
  const existing = await listCarePlanTemplatesFromMedplum(medplum);
  if (existing.length > 0) return;

  const seed = Array.isArray(seedTemplates) ? seedTemplates : [];
  for (const t of seed) {
    if (!t || typeof t !== "object") continue;

    const title = toTitle(t);
    const payload = JSON.stringify(t);

    await medplum.createResource({
      resourceType: "PlanDefinition",
      status: "active",
      title,
      // store JSON in an extension (simple + works)
      extension: [
        {
          url: TEMPLATE_EXT_URL,
          valueString: payload,
        },
      ],
    });
  }
}

export function planDefinitionsToUiTemplates(planDefs) {
  const rows = Array.isArray(planDefs) ? planDefs : [];

  return rows
    .map((pd) => {
      const raw = extractTemplateJson(pd);
      if (!raw) return null;

      const title = String(pd?.title || toTitle(raw));
      const count = toExerciseCount(raw);

      return {
        id: String(pd?.id || ""),
        title,
        count,
        raw,
        source: "medplum",
      };
    })
    .filter(Boolean);
}

/**
 * Main entry used by UI.
 * - If logged in -> load from Medplum (and seed once if empty)
 * - If not logged in / auth error -> fallback to local seed
 */
export async function loadCarePlanTemplatesEnsured(medplum, seedTemplates) {
  const localFallback = () => seedToUiTemplates(seedTemplates);

  // If not logged in, don't even try network calls
  const loggedIn = await isMedplumLoggedIn(medplum);
  if (!loggedIn) return localFallback();

  try {
    const existing = await listCarePlanTemplatesFromMedplum(medplum);
    if (existing.length === 0) {
      await publishSeedTemplatesOnce(medplum, seedTemplates);
    }
    const after = await listCarePlanTemplatesFromMedplum(medplum);
    return planDefinitionsToUiTemplates(after);
  } catch (e) {
    // If it's auth-related, fallback silently to local so the UI works.
    if (isProbablyAuthError(e)) {
      return localFallback();
    }
    // For other errors, still fallback (so the user isn't blocked),
    // but keep the error meaningful by rethrowing if you want.
    // Here we fallback to be resilient.
    return localFallback();
  }
}
