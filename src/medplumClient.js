import { MedplumClient } from "@medplum/core";

const baseUrl =
  import.meta.env.VITE_MEDPLUM_BASE_URL?.replace(/\/$/, "") || "https://api.medplum.com";

const clientId = import.meta.env.VITE_MEDPLUM_CLIENT_ID || "";

const redirectUri =
  import.meta.env.VITE_MEDPLUM_REDIRECT_URI || `${window.location.origin}/`;

export const medplum = new MedplumClient({
  baseUrl,
  clientId,
  redirectUri,
});

if (import.meta.env.DEV) {
  console.log("Medplum config:", { baseUrl, clientId, redirectUri });
  if (!clientId) console.warn("Missing VITE_MEDPLUM_CLIENT_ID in .env");
  window.medplum = medplum;
}
