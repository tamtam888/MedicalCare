<<<<<<< HEAD
import { useMemo, useState } from "react";
=======
import { useEffect, useState } from "react";
>>>>>>> refactor-ui-cleanup
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
  email: "",
};

function toDateInputValue(d) {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== "") return t;
      continue;
    }
    return v;
  }
  return "";
}

function normalizeInitialValues(initialValues) {
  if (!initialValues) return { ...defaultValues };

  const addr = Array.isArray(initialValues.address)
    ? initialValues.address[0]
    : initialValues.address;

  const idNumber = firstNonEmpty(initialValues.idNumber, initialValues.id, "");

  const dobRaw = firstNonEmpty(
    initialValues.dob,
    initialValues.dateOfBirth,
    initialValues.birthDate,
    initialValues.birthDateTime,
    ""
  );
  const dob = toDateInputValue(dobRaw);

  const addrLine0 = Array.isArray(addr?.line) ? addr.line[0] : undefined;

  const street = firstNonEmpty(
    initialValues.street,
    addr?.street,
    addr?.line1,
    addrLine0,
    ""
  );

  const city = firstNonEmpty(initialValues.city, addr?.city, addr?.town, "");
  const zipCode = firstNonEmpty(
    initialValues.zipCode,
    addr?.zipCode,
    addr?.postalCode,
    ""
  );

  const status = firstNonEmpty(
    initialValues.status,
    initialValues.clinicalStatus,
    defaultValues.status
  );

  const conditions = Array.isArray(initialValues.conditions)
    ? initialValues.conditions.join(", ")
    : initialValues.conditions || "";

  return {
    ...defaultValues,
    ...initialValues,
    idNumber,
    dob,
    street,
    city,
    zipCode,
    status,
    conditions,
  };
}

<<<<<<< HEAD
function PatientFormInner({ onClose, onSubmit, initialValues }) {
 const [values] = useState(() =>
  initialValues ? normalizeInitialValues(initialValues) : defaultValues
);

  const [errors, setErrors] = useState({});
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
=======
function PatientForm({ isOpen, onClose, onSubmit, initialValues }) {
  const [values, setValues] = useState(defaultValues);
  const [errors, setErrors] = useState({});
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!isOpen) return;

    if (initialValues) {
      setValues(normalizeInitialValues(initialValues));
    } else {
      setValues(defaultValues);
    }
    setErrors({});
  }, [initialValues, isOpen]);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }
>>>>>>> refactor-ui-cleanup

  function validate(v) {
    const e = {};
    const id = (v.idNumber || "").trim();
    const fn = (v.firstName || "").trim();
    const ln = (v.lastName || "").trim();
    const phone = (v.phone || "").trim();
    const email = (v.email || "").trim();

    if (!id) e.idNumber = "ID number is required.";
    else if (!/^\d{9}$/.test(id)) e.idNumber = "ID number must be 9 digits.";

    if (!fn) e.firstName = "First name is required.";
    if (!ln) e.lastName = "Last name is required.";

    if (!phone) e.phone = "Phone number is required.";
    else {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        e.phone = "Phone must contain 7–15 digits.";
      }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Email format is invalid.";
    }

    if (v.dob && v.dob > today) {
      e.dob = "Date of birth cannot be in the future.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate(values)) return;

    const base = initialValues ? { ...initialValues } : {};
    const trimmedIdNumber = values.idNumber.trim();

    const prepared = {
      ...base,
      ...values,
      _originalIdNumber: base.idNumber || base.id || trimmedIdNumber,
      idNumber: trimmedIdNumber,
      id: base.idNumber || base.id || trimmedIdNumber,
<<<<<<< HEAD
=======

>>>>>>> refactor-ui-cleanup
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
<<<<<<< HEAD
      street: values.street.trim(),
      city: values.city.trim(),
      zipCode: values.zipCode.trim(),
      status: values.status,
      clinicalStatus: values.status,
      dob: toDateInputValue(values.dob),
=======

      street: values.street.trim(),
      city: values.city.trim(),
      zipCode: values.zipCode.trim(),

      status: values.status,
      clinicalStatus: values.status,
      dob: toDateInputValue(values.dob),

>>>>>>> refactor-ui-cleanup
      conditions: values.conditions
        ? values.conditions
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : [],
    };

    onSubmit?.(prepared);
  }

<<<<<<< HEAD
=======
  if (!isOpen) return null;

>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
          {/* UI unchanged */}
=======
          <div className="form-row">
            <div className={`form-field ${errors.idNumber ? "has-error" : ""}`}>
              <label>
                ID Number <span className="required-marker">*</span>
              </label>
              <input
                name="idNumber"
                value={values.idNumber}
                onChange={handleChange}
              />
              {errors.idNumber && (
                <div className="field-error">{errors.idNumber}</div>
              )}
            </div>

            <div className={`form-field ${errors.firstName ? "has-error" : ""}`}>
              <label>
                First Name <span className="required-marker">*</span>
              </label>
              <input
                name="firstName"
                value={values.firstName}
                onChange={handleChange}
              />
              {errors.firstName && (
                <div className="field-error">{errors.firstName}</div>
              )}
            </div>

            <div className={`form-field ${errors.lastName ? "has-error" : ""}`}>
              <label>
                Last Name <span className="required-marker">*</span>
              </label>
              <input
                name="lastName"
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
              <label>Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={values.dob}
                max={today}
                onChange={handleChange}
              />
              {errors.dob && <div className="field-error">{errors.dob}</div>}
            </div>

            <div className="form-field">
              <label>Gender</label>
              <select name="gender" value={values.gender} onChange={handleChange}>
                <option value="Other">Other</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>

            <div className="form-field">
              <label>Status</label>
              <select name="status" value={values.status} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Stable">Stable</option>
                <option value="Inactive">Inactive</option>
                <option value="Disabled">Disabled</option>
                <option value="Not Active">Not Active</option>
              </select>
            </div>
          </div>

          <div className="form-full-width form-field">
            <label>Street</label>
            <input name="street" value={values.street} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>City</label>
              <input name="city" value={values.city} onChange={handleChange} />
            </div>

            <div className="form-field">
              <label>Zip Code</label>
              <input
                name="zipCode"
                value={values.zipCode}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className={`form-field ${errors.phone ? "has-error" : ""}`}>
              <label>
                Phone <span className="required-marker">*</span>
              </label>
              <input name="phone" value={values.phone} onChange={handleChange} />
              {errors.phone && <div className="field-error">{errors.phone}</div>}
            </div>

            <div className={`form-field ${errors.email ? "has-error" : ""}`}>
              <label>Email</label>
              <input name="email" value={values.email} onChange={handleChange} />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>
          </div>

          <div className="form-full-width form-field">
            <label>Conditions</label>
            <input
              name="conditions"
              value={values.conditions}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            {/* ✅ IMPORTANT: classes that your CSS expects */}
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
>>>>>>> refactor-ui-cleanup
        </form>
      </div>
    </div>
  );
}

<<<<<<< HEAD
function PatientForm({ isOpen, onClose, onSubmit, initialValues }) {
  const remountKey = useMemo(() => {
    const id = initialValues?.idNumber || initialValues?.id || "new";
    return `${isOpen ? "open" : "closed"}:${String(id)}`;
  }, [isOpen, initialValues?.idNumber, initialValues?.id]);

  if (!isOpen) return null;

  return (
    <PatientFormInner
      key={remountKey}
      onClose={onClose}
      onSubmit={onSubmit}
      initialValues={initialValues}
    />
  );
}

=======
>>>>>>> refactor-ui-cleanup
export default PatientForm;
