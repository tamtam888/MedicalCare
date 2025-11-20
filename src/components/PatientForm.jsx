// src/components/PatientForm.jsx
import { useState, useEffect } from "react";

const initialFormState = {
  firstName: "",
  lastName: "",
  idNumber: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function PatientForm({
  onCreatePatient,
  onUpdatePatient,
  editingPatient,
  onCancelEdit,
}) {
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState("");

  const isEditing = Boolean(editingPatient);

  // כשעוברים ממצב יצירה למצב עריכה ולהפך
  useEffect(() => {
    if (editingPatient) {
      setFormData(editingPatient);
      setError("");
    } else {
      setFormData(initialFormState);
      setError("");
    }
  }, [editingPatient]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // שדות חובה
    if (!formData.firstName || !formData.lastName || !formData.idNumber) {
      setError("Please fill in all required fields marked with *.");
      return;
    }

    if (isEditing) {
      onUpdatePatient(formData);
    } else {
      onCreatePatient(formData);
    }

    setError("");

    if (!isEditing) {
      setFormData(initialFormState);
    }
  };

  return (
    <form className="patient-form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      <div className="form-field">
        <label htmlFor="firstName">
          First name <span className="required-asterisk">*</span>
        </label>
        <input
          id="firstName"
          name="firstName"
          type="text"
          value={formData.firstName}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="lastName">
          Last name <span className="required-asterisk">*</span>
        </label>
        <input
          id="lastName"
          name="lastName"
          type="text"
          value={formData.lastName}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="idNumber">
          ID number <span className="required-asterisk">*</span>
        </label>
        <input
          id="idNumber"
          name="idNumber"
          type="text"
          value={formData.idNumber}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="dateOfBirth">Date of birth</label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          value={formData.dateOfBirth}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="gender">Gender</label>
        <select
          id="gender"
          name="gender"
          value={formData.gender}
          onChange={handleChange}
        >
          <option value="">Select</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="phone">Phone number</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
        />
      </div>

      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <div className="form-field form-full-width">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          name="address"
          type="text"
          value={formData.address}
          onChange={handleChange}
        />
      </div>

      <div className="form-field form-full-width">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows="3"
          value={formData.notes}
          onChange={handleChange}
        />
      </div>

      <div className="form-actions">
        {isEditing && (
          <button
            type="button"
            className="form-cancel-btn"
            onClick={onCancelEdit}
          >
            Cancel
          </button>
        )}
        <button type="submit">
          {isEditing ? "Update patient" : "Create patient"}
        </button>
      </div>
    </form>
  );
}

export default PatientForm;

