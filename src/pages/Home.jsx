import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

import {
  aplicarTema,
  obtenerTema,
  obtenerTemaGuardado,
} from "@/lib/themes";

import "@/styles/home-auth-themed.css";

const USERS_KEY = "mm_users";
const SESSION_KEY = "user";
const COMPANY_KEY = "configuracion_empresa";

const DEFAULT_COMPANY = {
  nombre: "Maderas M&M",
  logo: "/logo.png",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export default function Home() {
  const company = useMemo(
    () => ({
      ...DEFAULT_COMPANY,
      ...readJSON(COMPANY_KEY, {}),
    }),
    []
  );

  const [view, setView] = useState("login");
  const [theme, setTheme] = useState(() =>
    obtenerTema(obtenerTemaGuardado())
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] =
    useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const [login, setLogin] = useState({
    email: "",
    password: "",
    remember: true,
  });

  const [register, setRegister] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [recoveryEmail, setRecoveryEmail] = useState("");

  useEffect(() => {
    const storedTheme = obtenerTemaGuardado();
    aplicarTema(storedTheme);
    setTheme(obtenerTema(storedTheme));

    const handleThemeChange = (event) => {
      const nextId =
        event?.detail?.themeId || obtenerTemaGuardado();

      setTheme(obtenerTema(nextId));
    };

    window.addEventListener(
      "tema-aplicacion-actualizado",
      handleThemeChange
    );

    return () =>
      window.removeEventListener(
        "tema-aplicacion-actualizado",
        handleThemeChange
      );
  }, []);

  useEffect(() => {
    setMessage(null);
  }, [view]);

  const goToDashboard = (user) => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })
    );

    window.location.assign("/dashboard");
  };

  const handleLogin = (event) => {
    event.preventDefault();
    setMessage(null);

    const email = normalizeEmail(login.email);
    const users = readJSON(USERS_KEY, []);

    const foundUser = users.find(
      (user) =>
        user.email === email &&
        user.password === login.password
    );

    if (!foundUser) {
      setMessage({
        type: "error",
        text: "El correo o la contraseña no coinciden.",
      });
      return;
    }

    setLoading(true);

    window.setTimeout(() => {
      goToDashboard(foundUser);
    }, 650);
  };

  const handleRegister = (event) => {
    event.preventDefault();
    setMessage(null);

    const name = register.name.trim();
    const email = normalizeEmail(register.email);
    const users = readJSON(USERS_KEY, []);

    if (name.length < 2) {
      setMessage({
        type: "error",
        text: "Escribe tu nombre completo.",
      });
      return;
    }

    if (!email.includes("@")) {
      setMessage({
        type: "error",
        text: "Escribe un correo válido.",
      });
      return;
    }

    if (register.password.length < 6) {
      setMessage({
        type: "error",
        text: "La contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }

    if (register.password !== register.confirmPassword) {
      setMessage({
        type: "error",
        text: "Las contraseñas no coinciden.",
      });
      return;
    }

    if (users.some((user) => user.email === email)) {
      setMessage({
        type: "error",
        text: "Ya existe una cuenta con ese correo.",
      });
      return;
    }

    const newUser = {
      id:
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : String(Date.now()),
      name,
      email,
      password: register.password,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(
      USERS_KEY,
      JSON.stringify([...users, newUser])
    );

    setLoading(true);

    window.setTimeout(() => {
      goToDashboard(newUser);
    }, 750);
  };

  const handleRecovery = (event) => {
    event.preventDefault();
    setMessage(null);

    const email = normalizeEmail(recoveryEmail);
    const users = readJSON(USERS_KEY, []);
    const exists = users.some((user) => user.email === email);

    if (!exists) {
      setMessage({
        type: "error",
        text: "No encontramos una cuenta con ese correo.",
      });
      return;
    }

    setMessage({
      type: "success",
      text: "Cuenta encontrada. En la versión final aquí se enviará el enlace de recuperación.",
    });
  };

  return (
    <main
      className="mm-auth-theme"
      data-atmosphere={theme.atmosfera}
    >
      <div className="mm-auth-theme__aurora mm-auth-theme__aurora--one" />
      <div className="mm-auth-theme__aurora mm-auth-theme__aurora--two" />
      <div className="mm-auth-theme__aurora mm-auth-theme__aurora--three" />
      <div className="mm-auth-theme__grid" />
      <div className="mm-auth-theme__noise" />
      <div className="mm-auth-theme__vignette" />

      <section className="mm-auth-theme__shell">
        <aside className="mm-auth-theme__brand-panel">
          <div className="mm-auth-theme__brand-top">
            <div className="mm-auth-theme__logo">
              <span className="mm-auth-theme__logo-glow" />

              <img
                src={company.logo || "/logo.png"}
                alt={company.nombre}
                onError={(event) => {
                  event.currentTarget.src = "/logo.png";
                }}
              />
            </div>

            <div>
              <p className="mm-auth-theme__company">
                {company.nombre}
              </p>
              <p className="mm-auth-theme__system-name">
                Sistema de gestión empresarial
              </p>
            </div>
          </div>

          <div className="mm-auth-theme__brand-copy">
            <span className="mm-auth-theme__eyebrow">
              ACCESO PRIVADO
            </span>

            <h1>
              Tu empresa,
              <span> bajo control.</span>
            </h1>

            <p>
              Ingresa a una plataforma creada para
              organizar inventario, ventas, clientes,
              gastos y cotizaciones.
            </p>
          </div>

          <div className="mm-auth-theme__brand-footer">
            <span>
              <Check size={15} />
              Cuenta obligatoria
            </span>

            <span>
              <Check size={15} />
              Acceso protegido
            </span>
          </div>
        </aside>

        <section className="mm-auth-theme__form-panel">
          <div className="mm-auth-theme__form-wrap">
            {view === "login" && (
              <AuthHeader
                title="Bienvenida de vuelta"
                description="Ingresa con tu cuenta para continuar."
              />
            )}

            {view === "register" && (
              <AuthHeader
                title="Crea tu cuenta"
                description="Debes registrarte para utilizar el sistema."
              />
            )}

            {view === "forgot" && (
              <AuthHeader
                title="Recupera tu acceso"
                description="Escribe el correo asociado a tu cuenta."
              />
            )}

            {message && (
              <div
                className={`mm-auth-theme__message is-${message.type}`}
                role="status"
              >
                {message.text}
              </div>
            )}

            {view === "login" && (
              <form
                className="mm-auth-theme__form"
                onSubmit={handleLogin}
              >
                <Field
                  label="Correo electrónico"
                  icon={Mail}
                >
                  <input
                    type="email"
                    placeholder="nombre@correo.cl"
                    autoComplete="email"
                    value={login.email}
                    onChange={(event) =>
                      setLogin((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field
                  label="Contraseña"
                  icon={LockKeyhole}
                  action={
                    <button
                      type="button"
                      className="mm-auth-theme__text-button"
                      onClick={() => setView("forgot")}
                    >
                      ¿La olvidaste?
                    </button>
                  }
                >
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Escribe tu contraseña"
                    autoComplete="current-password"
                    value={login.password}
                    onChange={(event) =>
                      setLogin((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required
                  />

                  <PasswordButton
                    visible={showPassword}
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                  />
                </Field>

                <label className="mm-auth-theme__remember">
                  <input
                    type="checkbox"
                    checked={login.remember}
                    onChange={(event) =>
                      setLogin((current) => ({
                        ...current,
                        remember: event.target.checked,
                      }))
                    }
                  />
                  <span>Recordarme en este equipo</span>
                </label>

                <SubmitButton
                  loading={loading}
                  label="Iniciar sesión"
                  loadingLabel="Abriendo sistema"
                />

                <p className="mm-auth-theme__switch">
                  ¿No tienes una cuenta?
                  <button
                    type="button"
                    onClick={() => setView("register")}
                  >
                    Crear cuenta
                  </button>
                </p>
              </form>
            )}

            {view === "register" && (
              <form
                className="mm-auth-theme__form"
                onSubmit={handleRegister}
              >
                <Field
                  label="Nombre completo"
                  icon={UserRound}
                >
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    autoComplete="name"
                    value={register.name}
                    onChange={(event) =>
                      setRegister((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field
                  label="Correo electrónico"
                  icon={Mail}
                >
                  <input
                    type="email"
                    placeholder="nombre@correo.cl"
                    autoComplete="email"
                    value={register.email}
                    onChange={(event) =>
                      setRegister((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <div className="mm-auth-theme__password-grid">
                  <Field
                    label="Contraseña"
                    icon={LockKeyhole}
                  >
                    <input
                      type={
                        showRegisterPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      value={register.password}
                      onChange={(event) =>
                        setRegister((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      required
                    />

                    <PasswordButton
                      visible={showRegisterPassword}
                      onClick={() =>
                        setShowRegisterPassword(
                          (current) => !current
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Confirmar"
                    icon={KeyRound}
                  >
                    <input
                      type={
                        showRegisterPassword
                          ? "text"
                          : "password"
                      }
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                      value={register.confirmPassword}
                      onChange={(event) =>
                        setRegister((current) => ({
                          ...current,
                          confirmPassword:
                            event.target.value,
                        }))
                      }
                      required
                    />
                  </Field>
                </div>

                <SubmitButton
                  loading={loading}
                  label="Crear cuenta"
                  loadingLabel="Creando tu cuenta"
                />

                <p className="mm-auth-theme__switch">
                  ¿Ya tienes una cuenta?
                  <button
                    type="button"
                    onClick={() => setView("login")}
                  >
                    Iniciar sesión
                  </button>
                </p>
              </form>
            )}

            {view === "forgot" && (
              <form
                className="mm-auth-theme__form"
                onSubmit={handleRecovery}
              >
                <Field
                  label="Correo electrónico"
                  icon={Mail}
                >
                  <input
                    type="email"
                    placeholder="nombre@correo.cl"
                    autoComplete="email"
                    value={recoveryEmail}
                    onChange={(event) =>
                      setRecoveryEmail(event.target.value)
                    }
                    required
                  />
                </Field>

                <SubmitButton
                  loading={false}
                  label="Buscar mi cuenta"
                  loadingLabel=""
                />

                <p className="mm-auth-theme__switch">
                  ¿Recordaste tu contraseña?
                  <button
                    type="button"
                    onClick={() => setView("login")}
                  >
                    Volver al inicio
                  </button>
                </p>
              </form>
            )}
          </div>

          <p className="mm-auth-theme__legal">
            M&M Business Control · {theme.nombre}
          </p>
        </section>
      </section>
    </main>
  );
}

function AuthHeader({ title, description }) {
  return (
    <header className="mm-auth-theme__header">
      <span>CUENTA M&M</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function Field({
  label,
  icon: Icon,
  action,
  children,
}) {
  return (
    <label className="mm-auth-theme__field">
      <span className="mm-auth-theme__field-head">
        <span>{label}</span>
        {action}
      </span>

      <span className="mm-auth-theme__input-wrap">
        <Icon size={18} />
        {children}
      </span>
    </label>
  );
}

function PasswordButton({ visible, onClick }) {
  return (
    <button
      type="button"
      className="mm-auth-theme__password-button"
      aria-label={
        visible
          ? "Ocultar contraseña"
          : "Mostrar contraseña"
      }
      onClick={onClick}
    >
      {visible ? (
        <EyeOff size={18} />
      ) : (
        <Eye size={18} />
      )}
    </button>
  );
}

function SubmitButton({
  loading,
  label,
  loadingLabel,
}) {
  return (
    <button
      type="submit"
      className="mm-auth-theme__submit"
      disabled={loading}
    >
      <span>
        {loading ? loadingLabel : label}
      </span>

      <span className="mm-auth-theme__submit-icon">
        <ArrowRight size={18} />
      </span>
    </button>
  );
}
