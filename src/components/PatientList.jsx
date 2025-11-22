// src/components/PatientList.jsx
import React from "react";
import "./PatientList.css";

function PatientList({
  patients,
  onEditPatient,
  onDeletePatient,
  onSelectPatient,
}) {
  if (!patients || patients.length === 0) {
    return <p>No patients yet.</p>;
  }

  return (
    <ul className="patient-list">
      {patients.map((patient) => (
        <li key={patient.idNumber} className="patient-list-item">
          <div className="patient-list-left">
            <div className="patient-list-main">
              <span className="patient-list-name">
                {patient.firstName} {patient.lastName}
              </span>
              <span className="patient-list-id">{patient.idNumber}</span>
            </div>

            <div className="patient-list-extra">
              {(patient.address || patient.city || patient.country) && (
                <p className="patient-list-field">
                  <strong>Address:</strong>{" "}
                  {patient.address || ""}
                  {patient.city ? `, ${patient.city}` : ""}
                  {patient.country ? `, ${patient.country}` : ""}
                </p>
              )}

              {patient.medicalIssues && (
                <p className="patient-list-field">
                  <strong>Medical issues:</strong> {patient.medicalIssues}
                </p>
              )}

              {patient.clinicalStatus && (
                <p className="patient-list-field">
                  <strong>Clinical status:</strong> {patient.clinicalStatus}
                </p>
              )}
            </div>
          </div>

          <div className="patient-list-actions">
            {onSelectPatient && (
              <button
                type="button"
                className="primary-button"
                onClick={() => onSelectPatient(patient.idNumber)}
              >
                View details
              </button>
            )}

            {onEditPatient && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => onEditPatient(patient.idNumber)}
              >
                Edit
              </button>
            )}

            {onDeletePatient && (
              <button
                type="button"
                className="danger-button"
                onClick={() => onDeletePatient(patient.idNumber)}
              >
                Delete
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default PatientList;
