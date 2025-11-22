// src/App.jsx
import { useEffect, useState } from "react";
import PatientForm from "./components/PatientForm";
import PatientList from "./components/PatientList";
import PatientHistory from "./components/PatientHistory";
import AttachReports from "./components/AttachReports";
import "./App.css";

const STORAGE_KEY = "patients";

function toFhirPatient(patient) {
  return {
    resourceType: "Patient",
    id: patient.idNumber || "",
    identifier: [
      {
        system: "local-id-number",
        value: patient.idNumber || "",
      },
    ],
    name: [
      {
        given: [patient.firstName || ""],
        family: patient.lastName || "",
      },
    ],
    birthDate: patient.dateOfBirth || "",
    gender: patient.gender || "",
    telecom: [
      patient.phone
        ? { system: "phone", value: patient.phone }
        : null,
      patient.email
        ? { system: "email", value: patient.email }
        : null,
    ].filter(Boolean),
    address: [
      {
        text: patient.address || "",
        city: patient.city || "",
        country: patient.country || "",
      },
    ],
    extension: [
      patient.medicalIssues
        ? {
            url: "medical-issues",
            valueString: patient.medicalIssues,
          }
        : null,
      patient.clinicalStatus
        ? {
            url: "clinical-status",
            valueString: patient.clinicalStatus,
          }
        : null,
    ].filter(Boolean),
    note: patient.notes
      ? [
          {
            text: patient.notes,
          },
        ]
      : [],
  };
}

function fromFhirPatient(fhirPatient) {
  const identifier = Array.isArray(fhirPatient.identifier)
    ? fhirPatient.identifier[0] || {}
    : {};
  const name = Array.isArray(fhirPatient.name)
    ? fhirPatient.name[0] || {}
    : {};
  const given = Array.isArray(name.given)
    ? name.given[0] || ""
    : "";
  const telecom = Array.isArray(fhirPatient.telecom)
    ? fhirPatient.telecom
    : [];
  const phone =
    telecom.find((t) => t.system === "phone")?.value || "";
  const email =
    telecom.find((t) => t.system === "email")?.value || "";
  const address = Array.isArray(fhirPatient.address)
    ? fhirPatient.address[0] || {}
    : {};
  const extensions = Array.isArray(fhirPatient.extension)
    ? fhirPatient.extension
    : [];
  const medicalIssuesExt = extensions.find(
    (ext) => ext.url === "medical-issues"
  );
  const clinicalStatusExt = extensions.find(
    (ext) => ext.url === "clinical-status"
  );
  const note = Array.isArray(fhirPatient.note)
    ? fhirPatient.note[0]?.text || ""
    : "";

  return {
    idNumber: (identifier.value || "").trim(),
    firstName: given,
    lastName: name.family || "",
    dateOfBirth: fhirPatient.birthDate || "",
    gender: fhirPatient.gender || "",
    phone,
    email,
    address: address.text || "",
    city: address.city || "",
    country: address.country || "",
    medicalIssues: medicalIssuesExt?.valueString || "",
    clinicalStatus: clinicalStatusExt?.valueString || "",
    notes: note,
  };
}

function App() {
  // Load patients once from localStorage on first render
  const [patients, setPatients] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);

      const normalized = parsed.map((p) => ({
        ...p,
        history: Array.isArray(p.history) ? p.history : [],
        reports: Array.isArray(p.reports) ? p.reports : [],
      }));

      return normalized;
    } catch (error) {
      console.error("Failed to parse patients from localStorage", error);
      return [];
    }
  });

  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] =
    useState(null);

  // Persist patients to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    } catch (error) {
      console.error("Failed to save patients to localStorage", error);
    }
  }, [patients]);

  const selectedPatient =
    patients.find((p) => p.idNumber === selectedPatientIdNumber) || null;

  const handleCreatePatient = (formData) => {
    const createdAt = new Date().toISOString();
    const idNumber = String(formData.idNumber).trim();

    // Prevent duplicate ID numbers
    const exists = patients.some(
      (p) => String(p.idNumber).trim() === idNumber
    );
    if (exists) {
      alert("A patient with this ID number already exists.");
      return;
    }

    const newPatient = {
      ...formData,
      idNumber,
      history: [
        {
          id: crypto.randomUUID(),
          type: "Note",
          title: "Patient profile created",
          date: createdAt,
          summary: "Initial patient profile was created in the system.",
        },
      ],
      reports: [],
    };

    setPatients((prev) => [...prev, newPatient]);
    setSelectedPatientIdNumber(idNumber);
    setEditingPatient(null);
  };

  const handleUpdatePatient = (updatedData) => {
    if (!editingPatient) return;

    const newIdNumber = String(updatedData.idNumber).trim();
    const oldIdNumber = String(editingPatient.idNumber).trim();

    // If ID number changed, ensure uniqueness
    if (newIdNumber !== oldIdNumber) {
      const exists = patients.some(
        (p) => String(p.idNumber).trim() === newIdNumber
      );
      if (exists) {
        alert("Another patient already uses this ID number.");
        return;
      }
    }

    setPatients((prev) =>
      prev.map((p) =>
        p.idNumber === editingPatient.idNumber
          ? {
              ...p,
              ...updatedData,
              idNumber: newIdNumber,
              history: Array.isArray(p.history) ? p.history : [],
              reports: Array.isArray(p.reports) ? p.reports : [],
            }
          : p
      )
    );

    setEditingPatient(null);
    setSelectedPatientIdNumber(newIdNumber);
  };

  const handleCancelEdit = () => {
    setEditingPatient(null);
  };

  const handleEditPatient = (idNumber) => {
    const patient = patients.find((p) => p.idNumber === idNumber);
    if (!patient) return;

    setEditingPatient(patient);
    setSelectedPatientIdNumber(idNumber);
  };

  const handleDeletePatient = (idNumber) => {
    setPatients((prev) => prev.filter((p) => p.idNumber !== idNumber));

    if (selectedPatientIdNumber === idNumber) {
      setSelectedPatientIdNumber(null);
    }

    if (editingPatient && editingPatient.idNumber === idNumber) {
      setEditingPatient(null);
    }
  };

  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  };

  const handleAddReport = (idNumber, reportMeta) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.idNumber !== idNumber) return p;

        const reports = [...(p.reports || []), reportMeta];

        const historyEntry = {
          id: reportMeta.id,
          type: "Report",
          title: `Report attached: ${reportMeta.name}`,
          date: reportMeta.uploadedAt,
          summary: "PDF report was attached to the patient profile.",
        };

        const history = [...(p.history || []), historyEntry];

        return { ...p, reports, history };
      })
    );
  };

  const handleExportPatients = () => {
    if (!patients.length) {
      alert("No patients to export.");
      return;
    }

    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: patients.map((p) => ({
        resource: toFhirPatient(p),
      })),
    };

    const blob = new Blob(
      [JSON.stringify(fhirBundle, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "patients-fhir.json";
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleImportPatients = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);

        if (
          json.resourceType !== "Bundle" ||
          !Array.isArray(json.entry)
        ) {
          alert("Invalid FHIR JSON file.");
          return;
        }

        const importedResources = json.entry
          .map((entry) => entry.resource)
          .filter(
            (res) => res && res.resourceType === "Patient"
          );

        if (!importedResources.length) {
          alert("No Patient resources found in file.");
          return;
        }

        const importedPatients = importedResources.map(
          fromFhirPatient
        );

        setPatients((prev) => {
          const map = new Map(
            prev.map((p) => [
              String(p.idNumber).trim(),
              {
                ...p,
                history: Array.isArray(p.history)
                  ? p.history
                  : [],
                reports: Array.isArray(p.reports)
                  ? p.reports
                  : [],
              },
            ])
          );

          importedPatients.forEach((imp) => {
            const key = String(imp.idNumber || "").trim();
            if (!key) return;

            if (map.has(key)) {
              const existing = map.get(key);
              map.set(key, {
                ...existing,
                ...imp,
                history: existing.history,
                reports: existing.reports,
              });
            } else {
              map.set(key, {
                ...imp,
                history: [],
                reports: [],
              });
            }
          });

          return Array.from(map.values());
        });

        alert("Patients imported successfully.");
      } catch (error) {
        console.error("Failed to import patients", error);
        alert("Failed to read JSON file.");
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <img src="/icon.png" alt="MedicalCare Icon" className="app-logo" />

      <h1 className="app-title">
        Digital Patient Record - Create patient profile
      </h1>

      <section className="app-section">
        <h2 className="section-title">
          {editingPatient ? "Edit patient profile" : "Create patient profile"}
        </h2>
        <PatientForm
          onCreatePatient={handleCreatePatient}
          onUpdatePatient={handleUpdatePatient}
          editingPatient={editingPatient}
          onCancelEdit={handleCancelEdit}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Patients</h2>
        <PatientList
          patients={patients}
          onEditPatient={handleEditPatient}
          onDeletePatient={handleDeletePatient}
          onSelectPatient={handleSelectPatient}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Export and import</h2>
        <div className="export-import-controls">
          <button
            type="button"
            className="primary-button"
            onClick={handleExportPatients}
          >
            Export patients (FHIR JSON)
          </button>

          <label className="import-label">
            Import patients
            <input
              type="file"
              accept="application/json"
              onChange={handleImportPatients}
            />
          </label>
        </div>
      </section>

      {selectedPatient && (
        <section className="app-section">
          <h2 className="section-title">
            Patient history and reports -{" "}
            {selectedPatient.firstName} {selectedPatient.lastName}
          </h2>

          <PatientHistory patient={selectedPatient} />

          <AttachReports
            patientId={selectedPatient.idNumber}
            existingReports={selectedPatient.reports || []}
            onAddReport={handleAddReport}
          />
        </section>
      )}
    </div>
  );
}

export default App;
