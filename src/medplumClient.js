// src/medplumClient.js
import { MedplumClient } from "@medplum/core";

const baseUrl =
  import.meta.env.VITE_MEDPLUM_BASE_URL || "https://api.medplum.com";

const clientId = import.meta.env.VITE_MEDPLUM_CLIENT_ID;

export const medplum = new MedplumClient({
  baseUrl,
  clientId,
  redirectUri: window.location.origin,
  storage: window.localStorage,
});
