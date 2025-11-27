// src/components/PatientDetails.jsx
import React from "react";
import "./PatientDetails.css";

function formatAddress(patient) {
  const parts = [patient.address, patient.city, patient.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

function valueOrDash(value) {
  return value && String(value).trim() !== "" ? value : "-";
}

function textOrFallback(value, fallback) {
  return value && String(value).trim() !== "" ? value : fallback;
}

function PatientDetails({ patient, onClose }) {
  if (!patient) return null;

  const addressLine = formatAddress(patient);

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
          <strong>ID number:</strong> {valueOrDash(patient.idNumber)}
        </div>
        <div>
          <strong>Date of birth:</strong> {valueOrDash(patient.dateOfBirth)}
        </div>
        <div>
          <strong>Gender:</strong> {valueOrDash(patient.gender)}
        </div>
        <div>
          <strong>Phone:</strong> {valueOrDash(patient.phone)}
        </div>
        <div>
          <strong>Email:</strong> {valueOrDash(patient.email)}
        </div>
        <div>
          <strong>Address:</strong> {addressLine}
        </div>
        <div>
          <strong>Clinical status:</strong> {valueOrDash(patient.clinicalStatus)}
        </div>
      </div>

      <div className="patient-details-notes">
        <strong>Medical issues:</strong>
        <p>
          {textOrFallback(
            patient.medicalIssues,
            "No medical issues documented."
          )}
        </p>
      </div>

      <div className="patient-details-notes">
        <strong>Notes:</strong>
        <p>{textOrFallback(patient.notes, "No notes yet.")}</p>
      </div>
    </div>
  );
}

export default PatientDetails;
