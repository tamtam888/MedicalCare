// src/components/PatientList.jsx

function PatientList({ patients, onEditPatient }) {
  if (!patients || patients.length === 0) {
    return <p>No patients yet.</p>;
  }

  return (
    <ul className="patients-list">
      {patients.map((p) => (
        <li key={p.idNumber} className="patients-item">
          <div className="patients-item-content">
            <div className="patients-item-row">
              <span className="patients-item-id">ID {p.idNumber}</span>
              <span className="patients-item-main">
                {p.firstName} {p.lastName}
              </span>
            </div>
            <div className="patients-item-row">
              <span className="patients-item-sub">
                {p.dateOfBirth} {p.gender && `- ${p.gender}`}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="patients-item-edit-btn"
            title="Edit patient"
            onClick={() => onEditPatient(p.idNumber)}
          >
            Edit
          </button>
        </li>
      ))}
    </ul>
  );
}

export default PatientList;

