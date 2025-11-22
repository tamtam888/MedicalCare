// src/components/PatientDetails.jsx
import React from "react";
import "./PatientDetails.css";

function PatientDetails({ patient, onClose }) {
  if (!patient) return null;

  const hasAddress =
    patient.address || patient.city || patient.country;

  const addressLine = hasAddress
    ? [
        patient.address,
        patient.city,
        patient.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "-";

  return (
    <div className="patient-details-card">
      <div className="patient-details-header">
        <h3>
          {patient.firstName} {patient.lastName}
        </h3>
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="patient-details-grid">
        <div>
          <strong>ID number:</strong> {patient.idNumber}
        </div>
        <div>
          <strong>Date of birth:</strong>{" "}
          {patient.dateOfBirth || "-"}
        </div>
        <div>
          <strong>Gender:</strong> {patient.gender || "-"}
        </div>
        <div>
          <strong>Phone:</strong> {patient.phone || "-"}
        </div>
        <div>
          <strong>Email:</strong> {patient.email || "-"}
        </div>
        <div>
          <strong>Address:</strong> {addressLine}
        </div>
        <div>
          <strong>Clinical status:</strong>{" "}
          {patient.clinicalStatus || "-"}
        </div>
      </div>

      <div className="patient-details-notes">
        <strong>Medical issues:</strong>
        <p>
          {patient.medicalIssues &&
          patient.medicalIssues.trim() !== ""
            ? patient.medicalIssues
            : "No medical issues documented."}
        </p>
      </div>

      <div className="patient-details-notes">
        <strong>Notes:</strong>
        <p>
          {patient.notes && patient.notes.trim() !== ""
            ? patient.notes
            : "No notes yet."}
        </p>
      </div>
    </div>
  );
}

export default PatientDetails;
