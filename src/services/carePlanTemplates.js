// src/services/carePlanTemplates.js
const TEMPLATE_EXT_URL = "https://medicalcare.app/careplan-template-json";

const SEED_TAG_SYSTEM = "https://medicalcare.app/tags";
const SEED_TAG_CODE = "seed-template";

const SEED_IDENTIFIER_SYSTEM = "https://medicalcare.app/identifiers";
const SEED_IDENTIFIER_PREFIX = "careplan-template-seed";

const CUSTOM_TAG_SYSTEM = "https://medicalcare.app/tags";
const CUSTOM_TAG_CODE = "custom-template";

const CUSTOM_IDENTIFIER_SYSTEM = "https://medicalcare.app/identifiers";
const CUSTOM_IDENTIFIER_PREFIX = "careplan-template-custom";

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

function slugifyAlnum(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}

function stableSeedKey(templateObj, index) {
  const title = toTitle(templateObj);
  const slug = slugifyAlnum(title) || "template";
  return `${SEED_IDENTIFIER_PREFIX}:${String(index)}:${slug}`;
}

function stableCustomKey(localId) {
  const clean = String(localId || "").trim() || "unknown";
  return `${CUSTOM_IDENTIFIER_PREFIX}:${clean}`;
}

function isProbablyAuthError(err) {
  const msg = String(err?.message || "").toLowerCase();
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

  try {
    const token = typeof medplum.getAccessToken === "function" ? medplum.getAccessToken() : null;
    if (token && String(token).trim().length > 10) return true;
  } catch {}

  try {
    const profile = typeof medplum.getProfile === "function" ? medplum.getProfile() : null;
    if (profile && profile.resourceType) return true;
  } catch {}

  return false;
}

export async function listCarePlanTemplatesFromMedplum(medplum) {
  const res = await medplum.searchResources("PlanDefinition", {
    status: "active",
    _count: 200,
  });
  return Array.isArray(res) ? res : [];
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

async function findByIdentifier(medplum, identifierSystem, identifierValue) {
  try {
    const bundle = await medplum.search("PlanDefinition", {
      identifier: `${identifierSystem}|${identifierValue}`,
      _count: 1,
    });
    return bundle?.entry?.[0]?.resource || null;
  } catch {
    return null;
  }
}

export async function syncSeedTemplatesToMedplum(medplum, seedTemplates) {
  const loggedIn = await isMedplumLoggedIn(medplum);
  if (!loggedIn) return { ok: false, message: "Not logged in to Medplum." };

  const seed = Array.isArray(seedTemplates) ? seedTemplates : [];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < seed.length; i++) {
    const t = seed[i];
    if (!t || typeof t !== "object") continue;

    const seedKey = stableSeedKey(t, i);
    const title = toTitle(t);
    const payload = JSON.stringify(t);

    const baseResource = {
      resourceType: "PlanDefinition",
      status: "active",
      title,
      identifier: [{ system: SEED_IDENTIFIER_SYSTEM, value: seedKey }],
      meta: {
        tag: [{ system: SEED_TAG_SYSTEM, code: SEED_TAG_CODE, display: "Seed Template" }],
      },
      extension: [{ url: TEMPLATE_EXT_URL, valueString: payload }],
    };

    const existing = await findByIdentifier(medplum, SEED_IDENTIFIER_SYSTEM, seedKey);

    try {
      if (existing?.id) {
        skipped++;
        continue;
      }
      await medplum.createResource(baseResource);
      created++;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Seed template sync failed", { seedKey, title, error: e });
      throw e;
    }
  }

  return { ok: true, created, skipped, upserted: created };
}

export async function syncCustomTemplateToMedplum(medplum, localTemplate) {
  const loggedIn = await isMedplumLoggedIn(medplum);
  if (!loggedIn) return { ok: false, message: "Not logged in to Medplum." };

  const tpl = localTemplate && typeof localTemplate === "object" ? localTemplate : null;
  const localId = String(tpl?.id || "").trim();
  if (!localId) return { ok: false, message: "Template id is required." };

  const raw = tpl?.raw && typeof tpl.raw === "object" ? tpl.raw : null;
  if (!raw) return { ok: false, message: "Template raw is required." };

  const identifierValue = stableCustomKey(localId);
  const existing = await findByIdentifier(medplum, CUSTOM_IDENTIFIER_SYSTEM, identifierValue);

  if (existing?.id) {
    return { ok: true, mode: "skipped", message: "Template already synced." };
  }

  const title = String(tpl?.title || toTitle(raw)).trim() || "Template";
  const payload = JSON.stringify(raw);

  const resource = {
    resourceType: "PlanDefinition",
    status: "active",
    title,
    identifier: [{ system: CUSTOM_IDENTIFIER_SYSTEM, value: identifierValue }],
    meta: {
      tag: [{ system: CUSTOM_TAG_SYSTEM, code: CUSTOM_TAG_CODE, display: "Custom Template" }],
    },
    extension: [{ url: TEMPLATE_EXT_URL, valueString: payload }],
  };

  try {
    const created = await medplum.createResource(resource);
    return { ok: true, mode: "created", medplumId: String(created?.id || ""), message: "Template synced." };
  } catch (e) {
    if (isProbablyAuthError(e)) return { ok: false, message: "Not authorized." };
    return { ok: false, message: String(e?.message || "Sync failed.") };
  }
}

export async function loadCarePlanTemplatesEnsured(medplum, seedTemplates) {
  const seedFallback = () => {
    const seed = Array.isArray(seedTemplates) ? seedTemplates : [];
    return seed.map((t, i) => ({
      id: stableSeedKey(t, i),
      title: toTitle(t),
      count: toExerciseCount(t),
      raw: t,
      source: "seed",
    }));
  };

  const loggedIn = await isMedplumLoggedIn(medplum);
  if (!loggedIn) return seedFallback();

  try {
    const existing = await listCarePlanTemplatesFromMedplum(medplum);
    return planDefinitionsToUiTemplates(existing);
  } catch (e) {
    if (isProbablyAuthError(e)) return seedFallback();
    return seedFallback();
  }
}
