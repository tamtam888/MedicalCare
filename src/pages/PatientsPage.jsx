// src/pages/PatientsPage.jsx
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Download, Plus, RefreshCw } from "lucide-react";
import PatientList from "../components/PatientList";
import PatientForm from "../components/PatientForm";
import "./PatientsPage.css";

function PatientsPage(props) {
  const {
    patients = [],
    onAddPatient,
    onUpdatePatient,
    onDeletePatient,
    onImportPatients,
    onExportPatients,
    onSelectPatient,
    handleAddPatient,
    handleUpdatePatientInline,
    handleDeletePatient,
    handleImportPatients,
    handleExportPatients,
    handleSelectPatient,
    handleSyncAllToMedplum,
  } = props;

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  function callAddPatient(patient) {
    if (typeof handleAddPatient === "function") {
      handleAddPatient(patient);
      return;
    }
    if (typeof onAddPatient === "function") {
      onAddPatient(patient);
    }
  }

  function callUpdatePatient(patient) {
    const id = patient?.idNumber || patient?.id || patient?.medplumId || null;

    if (typeof handleUpdatePatientInline === "function") {
      if (handleUpdatePatientInline.length >= 2) {
        handleUpdatePatientInline(id, patient);
      } else {
        handleUpdatePatientInline(patient);
      }
      return;
    }

    if (typeof onUpdatePatient === "function") {
      if (onUpdatePatient.length >= 2) {
        onUpdatePatient(id, patient);
      } else {
        onUpdatePatient(patient);
      }
    }
  }

  function callDeletePatient(patient) {
    const id = patient?.idNumber || patient?.id || patient?.medplumId || null;

    if (typeof handleDeletePatient === "function") {
      if (handleDeletePatient.length >= 2) {
        handleDeletePatient(id, patient);
      } else {
        handleDeletePatient(id ?? patient);
      }
      return;
    }

    if (typeof onDeletePatient === "function") {
      if (onDeletePatient.length >= 2) {
        onDeletePatient(id, patient);
      } else {
        onDeletePatient(id ?? patient);
      }
    }
  }

  function callSelectPatient(patient) {
    if (typeof handleSelectPatient === "function") {
      handleSelectPatient(patient);
    } else if (typeof onSelectPatient === "function") {
      onSelectPatient(patient);
    }

    const id = patient?.idNumber || patient?.id || null;

    if (id) {
      navigate(`/patients/${encodeURIComponent(id)}`);
    }
  }

  function callImportPatients(file) {
    if (!file) return;
    if (typeof handleImportPatients === "function") {
      handleImportPatients(file);
      return;
    }
    if (typeof onImportPatients === "function") {
      onImportPatients(file);
    }
  }

  function callExportPatients() {
    if (typeof handleExportPatients === "function") {
      handleExportPatients();
      return;
    }
    if (typeof onExportPatients === "function") {
      onExportPatients();
    }
  }

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return patients;

    return patients.filter((p) => {
      const fullName = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
      const idValue = String(p.idNumber || p.id || "").toLowerCase();
      const conditionsText = Array.isArray(p.conditions)
        ? p.conditions.join(" ").toLowerCase()
        : String(p.conditions || "").toLowerCase();

      return fullName.includes(term) || idValue.includes(term) || conditionsText.includes(term);
    });
  }, [patients, searchTerm]);

  function handleClickAdd() {
    setEditingPatient(null);
    setShowForm(true);
  }

  function handleEditPatient(patient) {
    setEditingPatient(patient);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingPatient(null);
  }

  function handleSubmitForm(prepared) {
    if (editingPatient) {
      callUpdatePatient(prepared);
    } else {
      callAddPatient(prepared);
    }
    setShowForm(false);
    setEditingPatient(null);
  }

  function handleClickImport() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleFileChange(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      callImportPatients(file);
    }
  }

  function handleClickSyncAll() {
    if (typeof handleSyncAllToMedplum === "function") handleSyncAllToMedplum();
  }

  return (
    <div className="patients-page" dir="ltr">
      <div className="patients-page-header-row">
        <div className="patients-page-header-text">
          <h1 className="patients-page-title">Patient Directory</h1>
          <p className="patients-page-subtitle">Manage patients and their clinical details.</p>
        </div>

        <div className="patients-page-header-actions">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="application/json"
            onChange={handleFileChange}
          />

          <button type="button" className="patients-toolbar-button" onClick={handleClickImport}>
            <span className="patients-toolbar-button-icon">
              <Upload size={16} />
            </span>
            <span>Import</span>
          </button>

          <button type="button" className="patients-toolbar-button" onClick={callExportPatients}>
            <span className="patients-toolbar-button-icon">
              <Download size={16} />
            </span>
            <span>Export JSON</span>
          </button>

          <button type="button" className="patients-toolbar-button" onClick={handleClickSyncAll}>
            <span className="patients-toolbar-button-icon">
              <RefreshCw size={16} />
            </span>
            <span>Sync All</span>
          </button>

          <button type="button" className="patients-add-button" onClick={handleClickAdd}>
            <span className="patients-toolbar-button-icon patients-add-button-icon">
              <Plus size={16} />
            </span>
            <span>Add Patient</span>
          </button>
        </div>
      </div>

      <div className="patients-search-wrapper">
        <div className="patients-search-icon">🔍</div>
        <input
          className="patients-search-input"
          type="text"
          placeholder="Search by ID, name or condition..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <PatientList
        patients={filteredPatients}
        onEditPatient={handleEditPatient}
        onDeletePatient={callDeletePatient}
        onViewPatient={callSelectPatient}
      />

      <PatientForm
        isOpen={showForm}
        initialValues={editingPatient}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
      />
    </div>
  );
}

export default PatientsPage;
