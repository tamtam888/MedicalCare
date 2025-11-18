// src/components/PatientForm.jsx

import { useState } from "react";

// Initial empty form values
const initialFormState = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

// Form component used to create a new patient profile
function PatientForm({ onCreatePatient }) {
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState("");

  // Update form state when any input changes
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Basic validation rules
  const validate = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return "First name and last name are required";
    }

    if (!formData.dateOfBirth) {
      return "Date of birth is required";
    }

    if (formData.email && !formData.email.includes("@")) {
      return "Invalid email format";
    }

    return "";
  };

  // Handle form submit
  const handleSubmit = (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");

    onCreatePatient({
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      notes: formData.notes.trim(),
    });

    setFormData(initialFormState);
  };

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

      <div className="form-field">
        <label htmlFor="firstName">First name *</label>
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
        <label htmlFor="lastName">Last name *</label>
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
        <label htmlFor="dateOfBirth">Date of birth *</label>
        <input
          id="dateOfBirth"
          type="date"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={handleChange}
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
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+972-50-1234567"
        />
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
        <button type="submit">Create patient</button>
      </div>
    </form>
  );
}

export default PatientForm;
