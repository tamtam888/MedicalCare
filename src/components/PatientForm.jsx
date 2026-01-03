import { useEffect, useMemo, useState } from "react";
import "./PatientForm.css";
import { formatDateDMY } from "../utils/dateFormat";

const defaultValues = {
  idNumber: "",
  firstName: "",
  lastName: "",
  dob: "",
  dobText: "",
  gender: "Other",
  street: "",
  city: "",
  zipCode: "",
  status: "Active",
  conditions: "",
  phone: "",
  email: "",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateOnly(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDMYToISODateOnly(dmy) {
  const s = String(dmy || "").trim();
  if (!s) return "";

  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return "";

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (yyyy < 100) yyyy += 2000;

  const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return "";

  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

  const addr = Array.isArray(initialValues.address) ? initialValues.address[0] : initialValues.address;

  const idNumber = firstNonEmpty(initialValues.idNumber, initialValues.id, "");

  const dobRaw = firstNonEmpty(
    initialValues.dob,
    initialValues.dateOfBirth,
    initialValues.birthDate,
    initialValues.birthDateTime,
    ""
  );

  const dobISO = toISODateOnly(dobRaw);
  const dobText = dobISO ? formatDateDMY(dobISO) : "";

  const addrLine0 = Array.isArray(addr?.line) ? addr.line[0] : undefined;

  const street = firstNonEmpty(
    initialValues.street,
    addr?.street,
    addr?.line1,
    addrLine0,
    ""
  );

  const city = firstNonEmpty(initialValues.city, addr?.city, addr?.town, "");
  const zipCode = firstNonEmpty(initialValues.zipCode, addr?.zipCode, addr?.postalCode, "");

  const status = firstNonEmpty(
    initialValues.status,
    initialValues.clinicalStatus,
    defaultValues.status
  );

  const conditions = Array.isArray(initialValues.conditions)
    ? initialValues.conditions.join(", ")
    : (initialValues.conditions || "");

  return {
    ...defaultValues,
    ...initialValues,
    idNumber,
    dob: dobISO,
    dobText,
    street,
    city,
    zipCode,
    status,
    conditions,
  };
}

function PatientForm({ isOpen, onClose, onSubmit, initialValues }) {
  const [values, setValues] = useState(defaultValues);
  const [errors, setErrors] = useState({});

  const todayISO = useMemo(() => toISODateOnly(new Date()), []);

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

  function handleDobTextChange(e) {
    const nextText = e.target.value;
    setValues((prev) => ({
      ...prev,
      dobText: nextText,
    }));
  }

  function handleDobBlur() {
    const iso = parseDMYToISODateOnly(values.dobText);
    setValues((prev) => ({
      ...prev,
      dob: iso || prev.dob,
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

    const dobISO = v.dob || parseDMYToISODateOnly(v.dobText);
    if (v.dobText && !dobISO) {
      e.dob = "Date of birth must be DD/MM/YYYY.";
    } else if (dobISO && dobISO > todayISO) {
      e.dob = "Date of birth cannot be in the future.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();

    const dobISO = values.dob || parseDMYToISODateOnly(values.dobText);
    const nextValues = { ...values, dob: dobISO };

    if (!validate(nextValues)) return;

    const base = initialValues ? { ...initialValues } : {};
    const trimmedIdNumber = nextValues.idNumber.trim();

    const prepared = {
      ...base,
      ...nextValues,
      _originalIdNumber: base.idNumber || base.id || trimmedIdNumber,
      idNumber: trimmedIdNumber,
      id: base.idNumber || base.id || trimmedIdNumber,

      firstName: nextValues.firstName.trim(),
      lastName: nextValues.lastName.trim(),
      phone: nextValues.phone.trim(),
      email: nextValues.email.trim(),

      street: nextValues.street.trim(),
      city: nextValues.city.trim(),
      zipCode: nextValues.zipCode.trim(),

      status: nextValues.status,
      clinicalStatus: nextValues.status,

      dob: nextValues.dob || "",

      conditions: nextValues.conditions
        ? nextValues.conditions
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
        : [],
    };

    delete prepared.dobText;

    onSubmit?.(prepared);
  }

  if (!isOpen) return null;

  const dobPreview = values.dob ? formatDateDMY(values.dob) : (values.dobText ? formatDateDMY(values.dobText) : "");

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
                type="text"
                name="dobText"
                value={values.dobText}
                onChange={handleDobTextChange}
                onBlur={handleDobBlur}
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                dir="ltr"
              />

              {dobPreview ? (
                <div style={{ marginTop: 6 }}>
                  <bdi dir="ltr" style={{ unicodeBidi: "isolate" }}>
                    {dobPreview}
                  </bdi>
                </div>
              ) : null}

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
            <button type="button" className="form-cancel-btn" onClick={onClose}>
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
