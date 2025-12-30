import { useMemo, useState } from "react";
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
    initialValues.address,
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

function PatientFormInner({ onClose, onSubmit, initialValues }) {
  const [values, setValues] = useState(() =>
    normalizeInitialValues(initialValues)
  );
  const [errors, setErrors] = useState({});
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  function handleChange(e) {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: name === "dob" ? toDateInputValue(value) : value,
    }));
  }

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
    const trimmedIdNumber = (values.idNumber || "").trim();

    const street = (values.street || "").trim();
    const city = (values.city || "").trim();
    const zipCode = (values.zipCode || "").trim();

    const prepared = {
      ...base,
      ...values,
      _originalIdNumber: base.idNumber || base.id || trimmedIdNumber,
      idNumber: trimmedIdNumber,
      id: base.idNumber || base.id || trimmedIdNumber,
      firstName: (values.firstName || "").trim(),
      lastName: (values.lastName || "").trim(),
      phone: (values.phone || "").trim(),
      email: (values.email || "").trim(),
      street,
      address: street,
      city,
      zipCode,
      status: values.status,
      clinicalStatus: values.status,
      dob: toDateInputValue(values.dob),
      conditions: values.conditions
        ? values.conditions
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : [],
    };

    onSubmit?.(prepared);
  }

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
          <div className="form-field">
            <label htmlFor="firstName">First name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={values.firstName}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="lastName">Last name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={values.lastName}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="idNumber">ID number</label>
            <input
              id="idNumber"
              name="idNumber"
              type="text"
              value={values.idNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="dob">Date of birth</label>
            <input
              id="dob"
              name="dob"
              type="date"
              value={values.dob}
              onChange={handleChange}
              max={today}
            />
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

          <div className="form-field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="street">Street</label>
            <input
              id="street"
              name="street"
              type="text"
              value={values.street}
              onChange={handleChange}
            />
          </div>

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
            <label htmlFor="zipCode">Zip code</label>
            <input
              id="zipCode"
              name="zipCode"
              type="text"
              value={values.zipCode}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label htmlFor="status">Status</label>
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
          </div>

          <div className="form-field">
            <label htmlFor="conditions">Conditions</label>
            <input
              id="conditions"
              name="conditions"
              type="text"
              value={values.conditions}
              onChange={handleChange}
              placeholder="Comma-separated"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="form-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="form-submit-btn">
              {initialValues ? "Update patient" : "Create patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

export default PatientForm;
