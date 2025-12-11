import { useEffect, useState } from "react";
import "./PatientForm.css";

const defaultValues = {
  idNumber: "",
  firstName: "",
  lastName: "",
  dob: "",
  gender: "Other",
  street: "",
  city: "",
  zipCode: "",
  status: "Active",
  conditions: "",
  phone: "",
  email: ""
};

function PatientForm({ isOpen, onClose, onSubmit, initialValues }) {
  const [values, setValues] = useState(defaultValues);
  const [errors, setErrors] = useState({});

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (initialValues) {
      setValues({
        ...defaultValues,
        ...initialValues,
        idNumber:
          initialValues.idNumber ||
          initialValues.id ||
          "",
        status:
          initialValues.status ||
          initialValues.clinicalStatus ||
          defaultValues.status,
        conditions: Array.isArray(initialValues.conditions)
          ? initialValues.conditions.join(", ")
          : initialValues.conditions || ""
      });
    } else {
      setValues(defaultValues);
    }
    setErrors({});
  }, [initialValues]);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function validate(valuesForValidation) {
    const newErrors = {};
    const trimmedId = (valuesForValidation.idNumber || "").trim();
    const trimmedFirstName = (valuesForValidation.firstName || "").trim();
    const trimmedLastName = (valuesForValidation.lastName || "").trim();
    const trimmedPhone = (valuesForValidation.phone || "").trim();
    const trimmedEmail = (valuesForValidation.email || "").trim();
    const dobValue = valuesForValidation.dob || "";

    if (!trimmedId) {
      newErrors.idNumber = "ID number is required.";
    } else if (!/^\d{9}$/.test(trimmedId)) {
      newErrors.idNumber = "ID number must be 9 digits.";
    }

    if (!trimmedFirstName) {
      newErrors.firstName = "First name is required.";
    } else if (trimmedFirstName.length < 2) {
      newErrors.firstName = "First name must be at least 2 characters.";
    }

    if (!trimmedLastName) {
      newErrors.lastName = "Last name is required.";
    } else if (trimmedLastName.length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters.";
    }

    if (!trimmedPhone) {
      newErrors.phone = "Phone number is required.";
    } else {
      const digitsOnly = trimmedPhone.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        newErrors.phone = "Phone must contain 7–15 digits.";
      }
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Email format is invalid.";
    }

    if (!valuesForValidation.status) {
      newErrors.status = "Clinical status is required.";
    }

    if (dobValue && dobValue > today) {
      newErrors.dob = "Date of birth cannot be in the future.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!validate(values)) {
      return;
    }

    const trimmedId = (values.idNumber || "").trim();

    // Start from initialValues (to keep things like medplumId, reports, history),
    // then override with the edited form values.
    const base = initialValues ? { ...initialValues } : {};

    const prepared = {
      ...base,
      ...values,
      idNumber: trimmedId,
      id: base.id || trimmedId,
      clinicalStatus: values.status,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      city: values.city.trim(),
      street: values.street.trim(),
      conditions: values.conditions
        ? values.conditions
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : []
    };

    if (onSubmit) {
      onSubmit(prepared);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">
            {initialValues ? "Edit Patient" : "New Patient Registration"}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="form-error">Please fix the highlighted fields.</div>
        )}

        <form className="patient-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className={`form-field ${errors.idNumber ? "has-error" : ""}`}>
              <label htmlFor="idNumber">
                ID Number <span className="required-marker">*</span>
              </label>
              <input
                id="idNumber"
                name="idNumber"
                type="text"
                value={values.idNumber}
                onChange={handleChange}
              />
              {errors.idNumber && (
                <div className="field-error">{errors.idNumber}</div>
              )}
            </div>

            <div className={`form-field ${errors.firstName ? "has-error" : ""}`}>
              <label htmlFor="firstName">
                First Name <span className="required-marker">*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={values.firstName}
                onChange={handleChange}
              />
              {errors.firstName && (
                <div className="field-error">{errors.firstName}</div>
              )}
            </div>

            <div className={`form-field ${errors.lastName ? "has-error" : ""}`}>
              <label htmlFor="lastName">
                Last Name <span className="required-marker">*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={values.lastName}
                onChange={handleChange}
              />
              {errors.lastName && (
                <div className="field-error">{errors.lastName}</div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className={`form-field ${errors.dob ? "has-error" : ""}`}>
              <label htmlFor="dob">Date of Birth</label>
              <input
                id="dob"
                name="dob"
                type="date"
                value={values.dob}
                max={today}
                onChange={handleChange}
              />
              {errors.dob && (
                <div className="field-error">{errors.dob}</div>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={values.gender}
                onChange={handleChange}
              >
                <option value="Other">Other</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>

            <div className={`form-field ${errors.status ? "has-error" : ""}`}>
              <label htmlFor="status">
                Clinical Status <span className="required-marker">*</span>
              </label>
              <select
                id="status"
                name="status"
                value={values.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Stable">Stable</option>
                <option value="Inactive">Inactive</option>
                <option value="Disabled">Disabled</option>
                <option value="Not Active">Not Active</option>
              </select>
              {errors.status && (
                <div className="field-error">{errors.status}</div>
              )}
            </div>
          </div>

          <div className="form-full-width form-field">
            <label htmlFor="street">Street Address</label>
            <input
              id="street"
              name="street"
              type="text"
              value={values.street}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                type="text"
                value={values.city}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="zipCode">Zip Code</label>
              <input
                id="zipCode"
                name="zipCode"
                type="text"
                value={values.zipCode}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className={`form-field ${errors.phone ? "has-error" : ""}`}>
              <label htmlFor="phone">
                Phone <span className="required-marker">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                value={values.phone}
                onChange={handleChange}
              />
              {errors.phone && (
                <div className="field-error">{errors.phone}</div>
              )}
            </div>

            <div className={`form-field ${errors.email ? "has-error" : ""}`}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
              />
              {errors.email && (
                <div className="field-error">{errors.email}</div>
              )}
            </div>
          </div>

          <div className="form-full-width form-field">
            <label htmlFor="conditions">Conditions</label>
            <input
              id="conditions"
              name="conditions"
              type="text"
              value={values.conditions}
              onChange={handleChange}
              placeholder="Type conditions, separated by commas"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="form-cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit" className="form-submit-btn">
              {initialValues ? "Save Changes" : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PatientForm;
