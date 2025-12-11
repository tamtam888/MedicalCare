import { MedplumClient } from "@medplum/core";

export const medplum = new MedplumClient({
  clientId: "medicalcare",
  redirectUri: window.location.origin,
});
