// src/medplumClient.js
import { MedplumClient } from "@medplum/core";

export const medplum = new MedplumClient({
  // אפשר פשוט להשאיר בלי baseUrl ואז הוא כבר ישתמש ב-https://api.medplum.com
  // או לכתוב אותו מפורשות:
  baseUrl: "https://api.medplum.com",
  clientId: "94a688a5-15e5-487b-8ff8-5175aca6dbf7",
  redirectUri: "http://localhost:5173/",
});
