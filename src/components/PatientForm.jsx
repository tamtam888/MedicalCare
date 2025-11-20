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
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (editingPatient) {
      setFormData({
        firstName: editingPatient.firstName || "",
        lastName: editingPatient.lastName || "",
        idNumber: editingPatient.idNumber || "",
        dateOfBirth: editingPatient.dateOfBirth || "",
        gender: editingPatient.gender || "",
        phone: editingPatient.phone || "",
        email: editingPatient.email || "",
        address: editingPatient.address || "",
        notes: editingPatient.notes || "",
      });
      setError("");
    } else {
      setFormData(initialFormState);
    }
  }, [editingPatient]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return "First name and last name are required";
    }

    if (!formData.idNumber.trim()) {
      return "ID number is required";
    }

    const idPattern = /^[0-9]{5,20}$/;
    if (!idPattern.test(formData.idNumber.trim())) {
      return "ID number must contain only digits";
    }

    if (!formData.dateOfBirth) {
      return "Date of birth is required";
    }

    if (formData.dateOfBirth > today) {
      return "Date of birth cannot be in the future";
    }

    if (!formData.phone.trim()) {
      return "Phone number is required";
    }

    const phonePattern = /^\+?[0-9\- ]{7,20}$/;
    if (!phonePattern.test(formData.phone.trim())) {
      return "Invalid phone number format";
    }

    if (formData.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.email.trim())) {
        return "Invalid email format";
      }
    }

    return "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      console.error("Patient form validation error:", validationError);
      setError(validationError);
      return;
    }

    setError("");

    const cleanedData = {
      ...formData,
      idNumber: formData.idNumber.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      notes: formData.notes.trim(),
    };

    if (isEditing) {
      onUpdatePatient(cleanedData);
    } else {
      onCreatePatient(cleanedData);
    }

    setFormData(initialFormState);
  };

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

      {isEditing && (
        <div className="form-edit-banner">
          <span>Editing existing patient</span>
          <button
            type="button"
            className="form-cancel-btn"
            onClick={onCancelEdit}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="firstName">
          First name <span className="required-mark">*</span>
        </label>
        <input
          id="firstName"
          type="text"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="lastName">
          Last name <span className="required-mark">*</span>
        </label>
        <input
          id="lastName"
          type="text"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="idNumber">
          ID number <span className="required-mark">*</span>
        </label>
        <input
          id="idNumber"
          type="text"
          name="idNumber"
          value={formData.idNumber}
          onChange={handleChange}
          placeholder="123456789"
          required
          disabled={isEditing}
        />
      </div>

      <div className="form-field">
        <label htmlFor="dateOfBirth">
          Date of birth <span className="required-mark">*</span>
        </label>
        <input
          id="dateOfBirth"
          type="date"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={handleChange}
          max={today}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="phone">
          Phone <span className="required-mark">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+972-50-1234567"
          required
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
          <option value="prefer_not_to_say">Prefer not to say</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="patient@example.com"
        />
      </div>

      <div className="form-field form-full-width">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          type="text"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="City, Country"
        />
      </div>

      <div className="form-field form-full-width">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
        ></textarea>
      </div>

      <div className="form-actions">
        <button type="submit">
          {isEditing ? "Save changes" : "Create patient"}
        </button>
      </div>
    </form>
  );
}

export default PatientForm;
