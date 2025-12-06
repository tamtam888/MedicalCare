// src/components/PatientForm.jsx
import { useState, useEffect } from "react";
import "./PatientForm.css";

const initialFormState = {
  firstName: "",
  lastName: "",
  idNumber: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  country: "",
  medicalIssues: "",
  clinicalStatus: "",
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

  // תאריך היום בפורמט YYYY-MM-DD כדי להשתמש ב max בשדה התאריך
  const today = new Date().toISOString().split("T")[0];

  // כשעוברים ממצב יצירה למצב עריכה ולהפך
  useEffect(() => {
    if (editingPatient) {
      setFormData(editingPatient);
      setError("");
    } else {
      setFormData(initialFormState);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPatient]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    // מניעת תאריך לידה עתידי
    if (name === "dateOfBirth" && value && value > today) {
      setError("Date of birth cannot be in the future.");
      return;
    }

    // Clear error when user starts typing
    if (error) {
      setError("");
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    // שדות חובה: firstName, lastName, idNumber, phone
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.idNumber ||
      !formData.phone
    ) {
      setError("Please fill in all required fields marked with *.");
      return;
    }

    // בדיקה נוספת: תאריך לידה לא עתידי
    if (formData.dateOfBirth && formData.dateOfBirth > today) {
      setError("Date of birth cannot be in the future.");
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
          pattern="[0-9]*"
          inputMode="numeric"
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
          max={today} 
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
        <label htmlFor="phone">
          Phone number <span className="required-asterisk">*</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          pattern="[0-9+\-() ]*"
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

      <div className="form-row">
  <div className="form-field">
    <label htmlFor="address">Address</label>
    <input
      id="address"
      name="address"
      type="text"
      value={formData.address}
      onChange={handleChange}
      placeholder="Street and number"
    />
  </div>
</div>


      <div className="form-row">
  <div className="form-field">
    <label htmlFor="city">City</label>
    <input
      id="city"
      name="city"
      type="text"
      value={formData.city}
      onChange={handleChange}
    />
  </div>

  <div className="form-field">
    <label htmlFor="country">Country</label>
    <input
      id="country"
      name="country"
      type="text"
      value={formData.country}
      onChange={handleChange}
    />
  </div>
</div>

<div className="form-row">
  <div className="form-field">
    <label htmlFor="medicalIssues">Medical issues</label>
    <textarea
      id="medicalIssues"
      name="medicalIssues"
      rows={3}
      value={formData.medicalIssues}
      onChange={handleChange}
      placeholder="Chronic conditions, injuries, risk factors"
    />
  </div>

  <div className="form-field">
    <label htmlFor="clinicalStatus">Clinical status</label>
    <select
      id="clinicalStatus"
      name="clinicalStatus"
      value={formData.clinicalStatus}
      onChange={handleChange}
    >
      <option value="">Not set</option>
      <option value="active">Active</option>
      <option value="in-treatment">In treatment</option>
      <option value="stable">Stable</option>
      <option value="discharged">Discharged</option>
    </select>
  </div>
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
        <button type="submit" className="form-submit-btn">
          {isEditing ? "Update patient" : "Create patient"}
        </button>
      </div>
    </form>
  );
}

export default PatientForm;
