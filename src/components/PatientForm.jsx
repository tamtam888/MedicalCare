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
 const [values] = useState(() =>
  initialValues ? normalizeInitialValues(initialValues) : defaultValues
);

  const [errors, setErrors] = useState({});
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

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
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      street: values.street.trim(),
      city: values.city.trim(),
      zipCode: values.zipCode.trim(),
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
          {/* UI unchanged */}
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
