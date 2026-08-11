import { Eye, EyeOff, KeyRound, Mail, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import velvetLogo from "../assets/velvet-logo.png";
import "../styles/auth.css";

const SAVED_EMAIL_KEY = "velvet-private-email-v1";

function getSavedEmail() {
  try {
    return window.localStorage.getItem(SAVED_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function translateAuthError(message = "") {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "That password doesn't match your Velvet account.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email before entering Velvet.";
  }
  if (normalized.includes("rate limit")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  return message || "Velvet could not open your private session.";
}

export default function Auth() {
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const rememberedEmail = getSavedEmail();

  const [email, setEmail] = useState(rememberedEmail);
  const [useSavedAccount, setUseSavedAccount] = useState(Boolean(rememberedEmail));
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Your password needs at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      await signIn({ email: email.trim(), password });
      try {
        window.localStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      } catch {
        // localStorage is only a convenience.
      }
    } catch (requestError) {
      setError(translateAuthError(requestError.message));
    } finally {
      setSubmitting(false);
    }
  }

  function chooseDifferentAccount() {
    setUseSavedAccount(false);
    setEmail("");
    setPassword("");
    setError("");
  }

  return (
    <main className="auth auth--first-choice">
      <div className="auth__background auth__background--first-choice" aria-hidden="true" />
      <div className="auth__veil auth__veil--first-choice" aria-hidden="true" />

      <button
        className="auth__theme-toggle auth__theme-toggle--first-choice"
        onClick={toggleTheme}
        type="button"
        aria-label="Change theme"
      >
        {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
      </button>

      <section className="auth__card auth__card--first-choice">
        <header className="auth__hero auth__hero--first-choice">
          <img className="auth__logo auth__logo--first-choice" src={velvetLogo} alt="Velvet" />
          <div className="auth__ornament" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
        </header>

        <form className="auth__form auth__form--first-choice" onSubmit={handleSubmit}>
          {useSavedAccount ? (
            <div className="auth__remembered auth__remembered--first-choice">
              <div className="auth__remembered-icon">
                <Mail size={16} />
              </div>
              <div className="auth__remembered-copy">
                <small>Remembered account</small>
                <strong>{email}</strong>
              </div>
              <button type="button" onClick={chooseDifferentAccount}>Change</button>
            </div>
          ) : (
            <label className="auth__field auth__field--first-choice">
              <span>Email</span>
              <div className="auth__input auth__input--first-choice auth__input--two">
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="Email"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </label>
          )}

          <label className="auth__field auth__field--first-choice">
            <span>Password</span>
            <div className="auth__input auth__input--first-choice auth__input--three">
              <KeyRound size={16} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                placeholder="Password"
                autoComplete="current-password"
                autoFocus={useSavedAccount}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error ? <p className="auth__error auth__error--first-choice">{error}</p> : null}

          <button className="auth__submit auth__submit--first-choice" type="submit" disabled={submitting}>
            {submitting ? "Opening Velvet..." : "Enter Velvet"}
          </button>
        </form>
      </section>
    </main>
  );
}
