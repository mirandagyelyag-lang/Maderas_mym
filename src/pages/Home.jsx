import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import {
  aplicarTema,
  obtenerTema,
  obtenerTemaGuardado,
  THEMES,
} from "@/lib/themes";

import { createSessionUser, SESSION_KEY } from "@/lib/permissions";
import { registrarActividad } from "@/lib/database";
import { supabase } from "@/lib/supabase";

import "@/styles/home-auth-themed.css";

const THEME_LOGOS = {
  "claro-minimal": "/logo-blanco.png",
  "madera-pastel": "/logo-arena.png",
  "arena-calida": "/logo-arena.png",
  "celeste-pastel": "/logo-celeste.png",
  "rosa-pastel": "/logo-rosa.png",
  "verde-salvia": "/logo-verde.png",
  "lavanda-pastel": "/logo-violeta.png",
};

const THEME_TITLE_GRADIENTS = {
  "oscuro-mm": { top: "#f6f0e8", bottom: "#c3a579" },
  "claro-minimal": { top: "#ffffff", bottom: "#9b7951" },
  "madera-pastel": { top: "#fffaf4", bottom: "#a87955" },
  "rosa-pastel": { top: "#fff9fb", bottom: "#b76e89" },
  "celeste-pastel": { top: "#f9fdff", bottom: "#5b8fa8" },
  "lavanda-pastel": { top: "#fcfaff", bottom: "#8069a6" },
  "verde-salvia": { top: "#fbfdf9", bottom: "#6e8b74" },
  "arena-calida": { top: "#fffaf0", bottom: "#b08245" },
  grafito: { top: "#f2f4f7", bottom: "#a9b1bd" },
};

const INITIAL_LOGIN = {
  email: "",
  password: "",
  remember: true,
};

const INITIAL_REGISTER = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function readJSON(key, fallback) {
  try {
    const storedValue = localStorage.getItem(key);

    if (!storedValue) {
      return fallback;
    }

    return JSON.parse(storedValue);
  } catch (error) {
    console.error(`No se pudo leer ${key}:`, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`No se pudo guardar ${key}:`, error);
    return false;
  }
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function validateEmail(value) {
  if (!value.trim()) {
    return "Escribe tu correo electrónico.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailPattern.test(value.trim())) {
    return "Escribe un correo válido.";
  }

  return "";
}

function getPasswordChecks(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-ZÁÉÍÓÚÑ]/.test(password),
    lowercase: /[a-záéíóúñ]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s]/.test(password),
  };
}

function getPasswordStrength(password) {
  const checks = getPasswordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;

  if (!password) {
    return {
      score: 0,
      label: "",
      className: "is-empty",
      checks,
    };
  }

  if (score <= 2) {
    return {
      score: 1,
      label: "Débil",
      className: "is-weak",
      checks,
    };
  }

  if (score === 3) {
    return {
      score: 2,
      label: "Aceptable",
      className: "is-fair",
      checks,
    };
  }

  if (score === 4) {
    return {
      score: 3,
      label: "Segura",
      className: "is-good",
      checks,
    };
  }

  return {
    score: 4,
    label: "Muy segura",
    className: "is-strong",
    checks,
  };
}

function validatePassword(password) {
  const checks = getPasswordChecks(password);

  if (!password) {
    return "Escribe una contraseña.";
  }

  if (!checks.length) {
    return "Usa al menos 8 caracteres.";
  }

  if (!checks.uppercase) {
    return "Agrega una letra mayúscula.";
  }

  if (!checks.lowercase) {
    return "Agrega una letra minúscula.";
  }

  if (!checks.number) {
    return "Agrega al menos un número.";
  }

  return "";
}

function createUserId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Home() {
  const authRootRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [authPanelOpen, setAuthPanelOpen] = useState(true);
  const [login, setLogin] = useState(INITIAL_LOGIN);
  const [register, setRegister] = useState(INITIAL_REGISTER);

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [currentThemeId, setCurrentThemeId] = useState(
    () => obtenerTemaGuardado()
  );

  const [touched, setTouched] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const currentTheme = useMemo(
    () => obtenerTema(currentThemeId),
    [currentThemeId]
  );

  const currentLogo = THEME_LOGOS[currentThemeId] || "/logo.png";
  const titleGradient =
    THEME_TITLE_GRADIENTS[currentThemeId] ||
    THEME_TITLE_GRADIENTS["oscuro-mm"];

  useEffect(() => {
    const storedTheme = obtenerTemaGuardado();
    const appliedTheme = aplicarTema(storedTheme);

    setCurrentThemeId(appliedTheme);

    function handleThemeChange(event) {
      const nextTheme = event?.detail?.themeId;

      if (nextTheme) {
        setCurrentThemeId(nextTheme);
      }
    }

    window.addEventListener(
      "tema-aplicacion-actualizado",
      handleThemeChange
    );

    return () => {
      window.removeEventListener(
        "tema-aplicacion-actualizado",
        handleThemeChange
      );
    };
  }, []);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const hashParameters = new URLSearchParams(
      currentUrl.hash.replace(/^#/, "")
    );

    const confirmationError =
      currentUrl.searchParams.get("error_description") ||
      hashParameters.get("error_description");

    const confirmationType =
      currentUrl.searchParams.get("type") ||
      hashParameters.get("type");

    const hasConfirmationCode =
      currentUrl.searchParams.has("code");

    const isEmailConfirmation =
      hasConfirmationCode ||
      confirmationType === "signup" ||
      confirmationType === "email";

    if (confirmationError) {
      setMode("login");
      setAuthPanelOpen(true);
      setMessage(
        "No pudimos confirmar el correo. El enlace puede haber vencido; solicita uno nuevo e inténtalo nuevamente."
      );
      return;
    }

    if (!isEmailConfirmation) {
      return;
    }

    let active = true;

    const finishEmailConfirmation = async () => {
      await supabase.auth.getSession();

      if (!active) return;

      setMode("login");
      setAuthPanelOpen(true);
      setMessage(
        "Correo confirmado correctamente. Tu cuenta está esperando la aprobación del administrador, quien te asignará un rol próximamente."
      );

      window.history.replaceState(
        {},
        document.title,
        "/inicio"
      );

      await supabase.auth.signOut();
    };

    finishEmailConfirmation();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") {
        setThemePanelOpen(false);
        setAuthPanelOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const root = authRootRef.current;

    if (!root) {
      return undefined;
    }

    let animationFrame = 0;

    function updateParallax(event) {
      window.cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;

        root.style.setProperty("--auth-shift-x", `${x * -22}px`);
        root.style.setProperty("--auth-shift-y", `${y * -16}px`);
        root.style.setProperty("--auth-aura-x", `${50 + x * 7}%`);
        root.style.setProperty("--auth-aura-y", `${43 + y * 6}%`);
      });
    }

    function resetParallax() {
      root.style.setProperty("--auth-shift-x", "0px");
      root.style.setProperty("--auth-shift-y", "0px");
      root.style.setProperty("--auth-aura-x", "50%");
      root.style.setProperty("--auth-aura-y", "43%");
    }

    window.addEventListener("pointermove", updateParallax, {
      passive: true,
    });
    window.addEventListener("pointerleave", resetParallax);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("pointermove", updateParallax);
      window.removeEventListener("pointerleave", resetParallax);
    };
  }, []);

  const passwordStrength = useMemo(
    () => getPasswordStrength(register.password),
    [register.password]
  );

  const loginErrors = useMemo(
    () => ({
      email: validateEmail(login.email),
      password: login.password ? "" : "Escribe tu contraseña.",
    }),
    [login]
  );

  const registerErrors = useMemo(
    () => ({
      name:
        register.name.trim().length >= 2
          ? ""
          : "Escribe tu nombre completo.",
      email: validateEmail(register.email),
      password: validatePassword(register.password),
      confirmPassword:
        !register.confirmPassword
          ? "Confirma tu contraseña."
          : register.confirmPassword !== register.password
            ? "Las contraseñas no coinciden."
            : "",
    }),
    [register]
  );

  const loginReady =
    !loginErrors.email &&
    !loginErrors.password;

  const registerReady =
    !registerErrors.name &&
    !registerErrors.email &&
    !registerErrors.password &&
    !registerErrors.confirmPassword;

  function changeMode(nextMode) {
    setMode(nextMode);
    setAuthPanelOpen(true);
    setTouched({});
    setMessage("");
    setLoading(false);
  }

  function handleThemeChange(themeId) {
    const appliedTheme = aplicarTema(themeId);
    setCurrentThemeId(appliedTheme);
  }

  function handleLogin(event) {
    event.preventDefault();

    setTouched({
      loginEmail: true,
      loginPassword: true,
    });

    if (!loginReady) {
      return;
    }

    setLoading(true);
    setMessage("");

    window.setTimeout(async () => {
      const email = normalizeEmail(login.email);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password: login.password,
        });

      if (authError || !authData.user) {
        const authErrorMessage = String(
          authError?.message || ""
        ).toLowerCase();

        if (
          authErrorMessage.includes("email not confirmed") ||
          authErrorMessage.includes("email_not_confirmed")
        ) {
          setMessage(
            "Primero debes confirmar tu correo electrónico. Después, tu cuenta quedará esperando la aprobación del administrador."
          );
        } else {
          setMessage("El correo o la contraseña no coinciden.");
        }

        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setMessage("No pudimos cargar tu perfil de usuario.");
        setLoading(false);
        return;
      }

      if (profile.status === "pending") {
        await supabase.auth.signOut();
        setMessage(
          "Tu correo está confirmado. La cuenta está esperando la aprobación del administrador y la asignación de un rol."
        );
        setLoading(false);
        return;
      }

      if (profile.active !== true || profile.status === "inactive") {
        await supabase.auth.signOut();
        setMessage(
          "Tu cuenta está desactivada. Contacta al administrador."
        );
        setLoading(false);
        return;
      }

      const user = createSessionUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        active: profile.active,
        phone: profile.phone,
        jobTitle: profile.job_title,
        themeId: profile.theme_id,
        logoMode: profile.logo_mode,
        logoVariant: profile.logo_variant,
        createdAt: profile.created_at,
      });

      const saved = writeJSON(SESSION_KEY, user);

      if (!saved) {
        setMessage("No pudimos guardar tu sesión.");
        setLoading(false);
        return;
      }

      aplicarTema(user.themeId || obtenerTemaGuardado());

      registrarActividad({
        accion: "iniciar_sesion",
        modulo: "Autenticación",
        entidadId: user.id,
        entidadNombre: user.name,
        descripcion: `${user.name} inició sesión`,
        datosDespues: {
          nombre: user.name,
          email: user.email,
          rol: user.role,
        },
      });

      window.dispatchEvent(new Event("auth-changed"));
      window.location.assign("/dashboard");
    }, 450);
  }

  function handleRegister(event) {
    event.preventDefault();

    setTouched({
      registerName: true,
      registerEmail: true,
      registerPassword: true,
      registerConfirmPassword: true,
    });

    if (!registerReady) {
      return;
    }

    setLoading(true);
    setMessage("");

    window.setTimeout(async () => {
      const email = normalizeEmail(register.email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password: register.password,
        options: {
          data: {
            name: register.name.trim(),
            theme_id: currentThemeId,
          },
          emailRedirectTo: `${window.location.origin}/inicio`,
        },
      });

      if (error) {
        const errorMessage = String(error.message || "").toLowerCase();
        const rateLimited =
          error.status === 429 ||
          error.code === "over_email_send_rate_limit" ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("too many requests");

        if (rateLimited) {
          setMessage(
            "Se alcanzó temporalmente el límite de correos de confirmación. Espera unos minutos e inténtalo nuevamente."
          );
        } else if (errorMessage.includes("already")) {
          setMessage("Ya existe una cuenta con ese correo.");
        } else {
          setMessage("No pudimos crear la cuenta. Inténtalo nuevamente.");
        }

        setLoading(false);
        return;
      }

      if (data.user?.identities?.length === 0) {
        setMessage("Ya existe una cuenta con ese correo.");
        setLoading(false);
        return;
      }

      if (data.session) {
        await supabase.auth.signOut();
      }

      setRegister(INITIAL_REGISTER);
      setTouched({});
      setMode("login");

      if (data.session) {
        setMessage(
          "Cuenta creada correctamente. Tu solicitud está esperando la aprobación del administrador, quien te asignará un rol próximamente."
        );
      } else {
        setMessage(
          "Cuenta creada. Revisa tu correo y confirma tu dirección. Después de confirmarla, el administrador revisará tu solicitud y te asignará un rol."
        );
      }

      setLoading(false);
    }, 550);
  }

  return (
    <main
      ref={authRootRef}
      className="mm-premium-auth"
      data-theme-id={currentThemeId}
      data-atmosphere={currentTheme.atmosfera}
      style={{ "--auth-live-accent": currentTheme.preview[2] }}
    >
      <div
        className="mm-premium-auth__scene"
        aria-hidden="true"
      >
        <div className="mm-premium-auth__base" />

        <div className="mm-premium-auth__light mm-premium-auth__light--one" />
        <div className="mm-premium-auth__light mm-premium-auth__light--two" />
        <div className="mm-premium-auth__light mm-premium-auth__light--three" />

        <div className="mm-premium-auth__noise" />
        <div className="mm-premium-auth__vignette" />
      </div>

      <header className="mm-premium-auth__topbar">
        <a
          href="/inicio"
          className="mm-premium-auth__brand"
          aria-label="Maderas M&M"
        >
          <span className="mm-premium-auth__brand-logo">
            <img
              key={currentLogo}
              src={currentLogo}
              alt=""
            />
          </span>

          <span className="mm-premium-auth__brand-copy">
            <strong>Maderas M&M</strong>
            <small>Business Control</small>
          </span>
        </a>

        <div className="mm-premium-auth__topbar-actions">
          <button
            type="button"
            className="mm-premium-auth__nav-action"
            onClick={() => changeMode("login")}
          >
            Ingresar
          </button>

          <button
            type="button"
            className="mm-premium-auth__nav-action is-primary"
            onClick={() => changeMode("register")}
          >
            Crear cuenta
          </button>

          <button
            type="button"
            className="mm-premium-auth__theme-button"
            onClick={() => setThemePanelOpen(true)}
          >
            <Palette size={17} />

            <span>Apariencia</span>

            <i
              style={{
                background: currentTheme.preview[2],
              }}
            />
          </button>
        </div>
      </header>

      <div className="mm-premium-auth__layout">
        <section className="mm-premium-auth__presentation">
          <div className="mm-premium-auth__presentation-inner">
            <div className="mm-premium-auth__eyebrow">
              <Sparkles size={14} />
              Control que crece contigo
            </div>

            <h1
              className="mm-premium-auth__brand-statement"
              aria-label="Maderas M&M"
            >
              <span
                key={`mm-title-${currentThemeId}`}
                className="mm-premium-auth__title-word"
                aria-hidden="true"
              >
                {Array.from("MADERAS").map((letter, index) => (
                  <span
                    key={`${letter}-${index}`}
                    className="mm-premium-auth__title-glyph"
                    style={{
                      backgroundImage: `linear-gradient(180deg, ${titleGradient.top} 0%, ${titleGradient.top} 34%, ${titleGradient.bottom} 66%, ${titleGradient.bottom} 100%)`,
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </span>

              <span
                className="mm-premium-auth__title-signature"
                aria-hidden="true"
              >
                <span className="mm-premium-auth__title-rule" />
                <span className="mm-premium-auth__title-plaque">
                  M&amp;M
                </span>
              </span>

              <span
                className="mm-premium-auth__title-meta"
                aria-hidden="true"
              >
                Arquitectura · Control · Madera
              </span>
            </h1>

            <p className="mm-premium-auth__lead">
              Control empresarial que se mueve al ritmo de tu negocio.
            </p>

            <div className="mm-premium-auth__features">
              <article>
                <span>
                  <Layers3 size={18} />
                </span>

                <div>
                  <strong>Toda la operación</strong>
                  <p>Información conectada en un solo lugar.</p>
                </div>
              </article>

              <article>
                <span>
                  <ShieldCheck size={18} />
                </span>

                <div>
                  <strong>Acceso protegido</strong>
                  <p>Tu operación permanece dentro de M&M.</p>
                </div>
              </article>
            </div>

            <div className="mm-premium-auth__presentation-footer">
              <span>M&M</span>
              <div />
              <p>Arquitectura digital para una empresa que avanza.</p>
            </div>
          </div>
        </section>

        <section
          className={`mm-premium-auth__access ${
            authPanelOpen ? "is-open" : ""
          } ${
            mode === "register" ? "is-register" : ""
          }`}
          aria-hidden={!authPanelOpen}
        >
          <button
            type="button"
            className="mm-premium-auth__access-backdrop"
            onClick={() => setAuthPanelOpen(false)}
            aria-label="Cerrar acceso"
          />

          <div
            className={`mm-premium-auth__panel ${
              mode === "register" ? "is-register" : ""
            }`}
          >
            <div className="mm-premium-auth__panel-glow" />

            <button
              type="button"
              className="mm-premium-auth__panel-close"
              onClick={() => setAuthPanelOpen(false)}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="mm-premium-auth__mobile-brand">
              <img
                key={currentLogo}
                src={currentLogo}
                alt="Maderas M&M"
              />

              <div>
                <strong>Maderas M&M</strong>
                <span>Business Control</span>
              </div>
            </div>

            <header className="mm-premium-auth__heading">
              <div className="mm-premium-auth__heading-mark">
                <span />
                <p>Acceso M&M</p>
              </div>

              <h2>
                {mode === "login"
                  ? "Vuelve a tu espacio."
                  : "Crea tu acceso privado."}
              </h2>

              <p>
                {mode === "login"
                  ? "Ingresa tus datos para continuar en Maderas M&M."
                  : "Registra tus datos para comenzar a administrar la empresa."}
              </p>
            </header>

            {message && (
              <div
                className="mm-premium-auth__message"
                role="alert"
              >
                <span />
                {message}
              </div>
            )}

            {mode === "login" ? (
              <form
                className="mm-premium-auth__form"
                onSubmit={handleLogin}
                noValidate
              >
                <AuthField
                  label="Correo electrónico"
                  icon={Mail}
                  error={
                    touched.loginEmail
                      ? loginErrors.email
                      : ""
                  }
                >
                  <input
                    type="email"
                    placeholder="nombre@correo.com"
                    autoComplete="email"
                    value={login.email}
                    onChange={(event) =>
                      setLogin((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        loginEmail: true,
                      }))
                    }
                  />
                </AuthField>

                <AuthField
                  label="Contraseña"
                  icon={LockKeyhole}
                  error={
                    touched.loginPassword
                      ? loginErrors.password
                      : ""
                  }
                >
                  <input
                    type={
                      showLoginPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Escribe tu contraseña"
                    autoComplete="current-password"
                    value={login.password}
                    onChange={(event) =>
                      setLogin((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        loginPassword: true,
                      }))
                    }
                  />

                  <PasswordButton
                    visible={showLoginPassword}
                    onClick={() =>
                      setShowLoginPassword(
                        (current) => !current
                      )
                    }
                  />
                </AuthField>

                <div className="mm-premium-auth__form-row">
                  <label className="mm-premium-auth__remember">
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

                    <span>
                      <Check size={12} />
                    </span>

                    Recordarme en este equipo
                  </label>

                  <button
                    type="button"
                    className="mm-premium-auth__text-button"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <SubmitButton
                  disabled={!loginReady || loading}
                  loading={loading}
                  label="Entrar al sistema"
                  loadingLabel="Ingresando..."
                />

                <AuthSwitch
                  text="¿Todavía no tienes una cuenta?"
                  action="Crear cuenta"
                  onClick={() => changeMode("register")}
                />
              </form>
            ) : (
              <form
                className="mm-premium-auth__form"
                onSubmit={handleRegister}
                noValidate
              >
                <AuthField
                  label="Nombre completo"
                  icon={UserRound}
                  error={
                    touched.registerName
                      ? registerErrors.name
                      : ""
                  }
                >
                  <input
                    type="text"
                    placeholder="Tu nombre completo"
                    autoComplete="name"
                    value={register.name}
                    onChange={(event) =>
                      setRegister((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        registerName: true,
                      }))
                    }
                  />
                </AuthField>

                <AuthField
                  label="Correo electrónico"
                  icon={Mail}
                  error={
                    touched.registerEmail
                      ? registerErrors.email
                      : ""
                  }
                >
                  <input
                    type="email"
                    placeholder="nombre@correo.com"
                    autoComplete="email"
                    value={register.email}
                    onChange={(event) =>
                      setRegister((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        registerEmail: true,
                      }))
                    }
                  />
                </AuthField>

                <AuthField
                  label="Contraseña"
                  icon={LockKeyhole}
                  error={
                    touched.registerPassword
                      ? registerErrors.password
                      : ""
                  }
                >
                  <input
                    type={
                      showRegisterPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Crea una contraseña segura"
                    autoComplete="new-password"
                    value={register.password}
                    onChange={(event) =>
                      setRegister((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        registerPassword: true,
                      }))
                    }
                  />

                  <PasswordButton
                    visible={showRegisterPassword}
                    onClick={() =>
                      setShowRegisterPassword(
                        (current) => !current
                      )
                    }
                  />
                </AuthField>

                <PasswordStrength
                  strength={passwordStrength}
                />

                <AuthField
                  label="Confirmar contraseña"
                  icon={LockKeyhole}
                  error={
                    touched.registerConfirmPassword
                      ? registerErrors.confirmPassword
                      : ""
                  }
                >
                  <input
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="Repite tu contraseña"
                    autoComplete="new-password"
                    value={register.confirmPassword}
                    onChange={(event) =>
                      setRegister((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({
                        ...current,
                        registerConfirmPassword: true,
                      }))
                    }
                  />

                  <PasswordButton
                    visible={showConfirmPassword}
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) => !current
                      )
                    }
                  />
                </AuthField>

                <SubmitButton
                  disabled={!registerReady || loading}
                  loading={loading}
                  label="Crear cuenta"
                  loadingLabel="Creando cuenta..."
                />

                <AuthSwitch
                  text="¿Ya tienes una cuenta?"
                  action="Iniciar sesión"
                  onClick={() => changeMode("login")}
                />
              </form>
            )}

            <footer className="mm-premium-auth__panel-footer">
              <ShieldCheck size={14} />
              Acceso seguro y exclusivo
            </footer>
          </div>
        </section>
      </div>

      <aside
        className={`mm-theme-drawer ${
          themePanelOpen ? "is-open" : ""
        }`}
        aria-hidden={!themePanelOpen}
      >
        <button
          type="button"
          className="mm-theme-drawer__backdrop"
          onClick={() => setThemePanelOpen(false)}
          aria-label="Cerrar selector de apariencia"
        />

        <section className="mm-theme-drawer__panel">
          <header className="mm-theme-drawer__header">
            <div>
              <span>Apariencia</span>
              <h2>Elige la atmósfera</h2>
              <p>
                La interfaz cambia sin alterar tus datos ni el funcionamiento
                del sistema.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setThemePanelOpen(false)}
              aria-label="Cerrar"
            >
              <X size={19} />
            </button>
          </header>

          <div className="mm-theme-drawer__current">
            <div
              className="mm-theme-drawer__current-preview"
              style={{
                "--preview-one": currentTheme.preview[0],
                "--preview-two": currentTheme.preview[1],
                "--preview-three": currentTheme.preview[2],
              }}
            >
              <span />
              <span />
              <span />
            </div>

            <div>
              <small>Tema actual</small>
              <strong>{currentTheme.nombre}</strong>
              <p>{currentTheme.descripcion}</p>
            </div>
          </div>

          <div className="mm-theme-drawer__grid">
            {THEMES.map((theme) => {
              const active = theme.id === currentThemeId;

              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`mm-theme-card ${
                    active ? "is-active" : ""
                  }`}
                  onClick={() => handleThemeChange(theme.id)}
                >
                  <span
                    className="mm-theme-card__preview"
                    style={{
                      "--preview-one": theme.preview[0],
                      "--preview-two": theme.preview[1],
                      "--preview-three": theme.preview[2],
                    }}
                  >
                    <i className="mm-theme-card__preview-light" />
                    <i className="mm-theme-card__preview-panel" />
                    <i className="mm-theme-card__preview-line" />
                    <i className="mm-theme-card__preview-button" />
                  </span>

                  <span className="mm-theme-card__copy">
                    <strong>{theme.nombre}</strong>
                    <small>{theme.descripcion}</small>
                  </span>

                  <span className="mm-theme-card__check">
                    {active && (
                      <CheckCircle2 size={17} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </main>
  );
}

function AuthField({
  label,
  icon: Icon,
  error,
  children,
}) {
  return (
    <label
      className={`mm-premium-auth__field ${
        error ? "is-invalid" : ""
      }`}
    >
      <span className="mm-premium-auth__field-label">
        {label}
      </span>

      <span className="mm-premium-auth__input-wrap">
        <Icon
          size={17}
          strokeWidth={1.7}
          className="mm-premium-auth__input-icon"
        />

        {children}
      </span>

      {error && (
        <span className="mm-premium-auth__field-error">
          {error}
        </span>
      )}
    </label>
  );
}

function PasswordButton({
  visible,
  onClick,
}) {
  return (
    <button
      type="button"
      className="mm-premium-auth__password-button"
      onClick={onClick}
      aria-label={
        visible
          ? "Ocultar contraseña"
          : "Mostrar contraseña"
      }
    >
      {visible ? (
        <EyeOff size={18} />
      ) : (
        <Eye size={18} />
      )}
    </button>
  );
}

function PasswordStrength({
  strength,
}) {
  if (!strength.label) {
    return null;
  }

  return (
    <div
      className={`mm-premium-auth__strength ${strength.className}`}
    >
      <div className="mm-premium-auth__strength-head">
        <span>Seguridad de la contraseña</span>
        <strong>{strength.label}</strong>
      </div>

      <div className="mm-premium-auth__strength-bars">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={
              strength.score >= bar
                ? "is-active"
                : ""
            }
          />
        ))}
      </div>
    </div>
  );
}

function SubmitButton({
  disabled,
  loading,
  label,
  loadingLabel,
}) {
  return (
    <button
      type="submit"
      className="mm-premium-auth__submit"
      disabled={disabled}
    >
      <span className="mm-premium-auth__submit-shine" />

      <span className="mm-premium-auth__submit-content">
        <span
          className={`mm-premium-auth__submit-status ${
            loading ? "is-loading" : ""
          }`}
        />

        <span>
          {loading ? loadingLabel : label}
        </span>

        <ArrowRight size={18} />
      </span>
    </button>
  );
}

function AuthSwitch({
  text,
  action,
  onClick,
}) {
  return (
    <div className="mm-premium-auth__switch">
      <span>{text}</span>

      <button
        type="button"
        onClick={onClick}
      >
        {action}
      </button>
    </div>
  );
}