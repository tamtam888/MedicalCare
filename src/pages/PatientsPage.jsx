// src/pages/PatientsPage.jsx
import PatientForm from "../components/PatientForm";

function PatientsPage({
  editingPatient,
  handleCreatePatient,
  handleUpdatePatient,
  handleCancelEdit,
}) {
  return (
    <div className="app-container">
      <h1 className="app-title">Digital Patient Record</h1>

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
    </div>
  );
}

export default PatientsPage;
