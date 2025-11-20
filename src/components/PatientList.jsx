// src/components/PatientList.jsx

function PatientList({ patients, onEditPatient, onDeletePatient }) {
  if (!patients || patients.length === 0) {
    return <p>No patients yet.</p>;
  }

  return (
    <ul className="patients-list">
      {patients.map((patient) => (
        <li key={patient.idNumber} className="patients-item">
          <div className="patients-item-content">
            <div className="patients-item-row patients-item-main">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="patients-item-row patients-item-sub">
              ID: {patient.idNumber}
            </div>
            {patient.phone && (
              <div className="patients-item-row patients-item-sub">
                Phone: {patient.phone}
              </div>
            )}
            {patient.email && (
              <div className="patients-item-row patients-item-sub">
                Email: {patient.email}
              </div>
            )}
          </div>

          <div className="patients-item-actions">
            <button
              type="button"
              className="patients-item-edit-btn"
              onClick={() => onEditPatient(patient.idNumber)}
            >
              Edit
            </button>
            <button
              type="button"
              className="patients-item-delete-btn"
              onClick={() => onDeletePatient(patient.idNumber)}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default PatientList;
