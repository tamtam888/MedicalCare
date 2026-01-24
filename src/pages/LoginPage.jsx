import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTherapists } from "../therapists/therapistsStore";
import "./LoginPage.css";

const LOGGED_IN_KEY = "mc_logged_in";
const ROLE_KEY = "mc_role";
const THERAPIST_ID_KEY = "mc_therapistId";
const DISPLAY_NAME_KEY = "mc_display_name";

const ADMIN_USERNAME = "admin";
const ADMIN_ID = "15951595";

function normalize(value) {
  return String(value ?? "").trim();
}

function digitsOnly(value) {
  return normalize(value).replace(/\D/g, "");
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("admin");
  const [idNumber, setIdNumber] = useState(ADMIN_ID);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return normalize(fullName).length > 0 && normalize(idNumber).length > 0 && !submitting;
  }, [fullName, idNumber, submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const name = normalize(fullName);
    const nameLower = name.toLowerCase();
    const id = digitsOnly(idNumber);

    if (!name || !id) {
      setError("Please enter full name and ID number.");
      return;
    }

    setSubmitting(true);

    try {
      const isAdmin = nameLower === ADMIN_USERNAME && id === ADMIN_ID;

      if (isAdmin) {
        try {
          localStorage.setItem(LOGGED_IN_KEY, "1");
          localStorage.setItem(ROLE_KEY, "admin");
          localStorage.setItem(THERAPIST_ID_KEY, "admin");
          localStorage.setItem(DISPLAY_NAME_KEY, "Admin");
        } catch {}

        navigate("/dashboard", { replace: true });
        return;
      }

      const therapists = await getAllTherapists();

      const match = Array.isArray(therapists)
        ? therapists.find((t) => {
            const tName = normalize(t?.name).toLowerCase();
            const tId = digitsOnly(t?.id);
            return tName === nameLower && tId === id;
          })
        : null;

      if (!match) {
        setError("Name and ID do not match any therapist. Please check your details.");
        return;
      }

      if (match?.active === false) {
        setError("This therapist is currently inactive. Please contact the admin.");
        return;
      }

      try {
        localStorage.setItem(LOGGED_IN_KEY, "1");
        localStorage.setItem(ROLE_KEY, "therapist");
        localStorage.setItem(THERAPIST_ID_KEY, digitsOnly(match.id));
        localStorage.setItem(DISPLAY_NAME_KEY, normalize(match.name));
      } catch {}

      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (import.meta.env.DEV) console.error("Login failed:", err);
      setError("Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap" aria-hidden="true">
          <div className="login-logo-ring">
            <img src="/icon.png" alt="MedicalCare" className="login-logo" />
          </div>
        </div>

        <h1 className="login-title">MedicalCare</h1>
        <div className="login-subtitle">Therapist Login</div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="login_full_name">
              Full name
            </label>
            <input
              id="login_full_name"
              className="login-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login_id_number">
              ID number
            </label>
            <input
              id="login_id_number"
              className="login-input"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="ID number"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button type="submit" className="login-submit" disabled={!canSubmit}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
