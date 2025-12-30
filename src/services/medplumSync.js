import { medplum } from "../medplumClient";

const SESSION_ID_SYSTEM = "app://your-app/session";

function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function assertValidPatientId(patientId) {
  if (!patientId || typeof patientId !== "string") {
    throw new Error("Missing patientId");
  }
  if (patientId.includes("/") || patientId.includes("Patient")) {
    throw new Error("patientId must be a Patient resource id only (e.g. selectedPatient.id)");
  }
}

function identifierToken(value) {
  return `${SESSION_ID_SYSTEM}|${value}`;
}

async function findExistingDocumentReference(patientId, localSessionId) {
  return medplum.searchOne("DocumentReference", {
    subject: `Patient/${patientId}`,
    identifier: identifierToken(localSessionId),
  });
}

export async function syncLocalSessionsToMedplum(patientId, sessions) {
  assertValidPatientId(patientId);

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return;
  }

  for (const session of sessions) {
    if (!session?.localSessionId) {
      continue;
    }

    let audioAttachment;

    if (session.audioBlob) {
      const binary = await medplum.createBinary({
        data: session.audioBlob,
        filename: `${session.localSessionId}.webm`,
        contentType:
          session.audioContentType ||
          session.audioBlob.type ||
          "audio/webm",
      });

      audioAttachment = {
        contentType:
          session.audioContentType ||
          session.audioBlob.type ||
          "audio/webm",
        title: "Audio recording",
        url: `Binary/${binary.id}`,
      };
    }

    const textAttachment = session.transcriptionText
      ? {
          contentType: "text/plain",
          title: "Transcription",
          data: textToBase64(String(session.transcriptionText)),
        }
      : null;

    const content = [];
    if (textAttachment) content.push({ attachment: textAttachment });
    if (audioAttachment) content.push({ attachment: audioAttachment });

    const docRef = {
      resourceType: "DocumentReference",
      status: "current",
      subject: { reference: `Patient/${patientId}` },
      date: session.createdAt || new Date().toISOString(),
      type: { text: "Treatment session" },
      identifier: [
        {
          system: SESSION_ID_SYSTEM,
          value: session.localSessionId,
        },
      ],
      content,
    };

    const existing = await findExistingDocumentReference(
      patientId,
      session.localSessionId
    );

    if (!existing) {
      await medplum.createResourceIfNoneExist(
        docRef,
        `subject=Patient/${patientId}&identifier=${encodeURIComponent(
          identifierToken(session.localSessionId)
        )}`
      );
    } else {
      await medplum.updateResource({
        ...docRef,
        id: existing.id,
      });
    }
  }
}
