import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LOGO_URL } from "@/lib/format";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Ingresa tu correo electrónico.");
      return;
    }

    if (!password.trim()) {
      setError("Ingresa tu contraseña.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      if (password === "123456") {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userEmail", email.trim());

        if (rememberMe) {
          localStorage.setItem("rememberSession", "true");
        } else {
          localStorage.removeItem("rememberSession");
        }

        navigate("/", { replace: true });
      } else {
        setError("La contraseña ingresada es incorrecta.");
        setLoading(false);
      }
    }, 800);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Luces decorativas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Panel izquierdo */}
        <section className="hidden border-r border-border/70 bg-card/30 p-10 backdrop-blur-sm lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-lg">
              <img
                src={LOGO_URL}
                alt="Logo de Maderas M&M"
                className="h-16 w-16 rounded-xl object-cover"
              />
            </div>

            <div>
              <p className="font-heading text-lg font-bold">
                Maderas M&M
              </p>

              <p className="text-sm text-muted-foreground">
                Business Control
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-4 w-4" />
              Gestión empresarial
            </div>

            <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-6xl">
              Tu negocio,
              <span className="block text-primary">
                bajo control.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              Administra inventario, ventas, gastos, clientes y cotizaciones
              desde una plataforma privada creada para Maderas M&M.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <ShieldCheck className="mb-3 h-6 w-6 text-primary" />

                <p className="font-semibold">
                  Acceso privado
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Información protegida para la administración de la empresa.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm">
                <Sparkles className="mb-3 h-6 w-6 text-primary" />

                <p className="font-semibold">
                  Información organizada
                </p>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Todo lo importante reunido en un solo sistema.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            M&M Business Control · Acceso exclusivo
          </p>
        </section>

        {/* Panel derecho */}
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-14">
          <div className="w-full max-w-md">
            {/* Logo móvil */}
            <div className="mb-8 flex justify-center lg:hidden">
              <div className="rounded-2xl border border-border bg-card p-2 shadow-lg">
                <img
                  src={LOGO_URL}
                  alt="Logo de Maderas M&M"
                  className="h-24 w-24 rounded-xl object-cover"
                />
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-primary">
                CUENTA M&M
              </p>

              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Bienvenida de vuelta
              </h2>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Ingresa con tu cuenta para continuar al panel de administración.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Correo electrónico
                  </Label>

                  <div className="relative">
                    <Mail
                      aria-hidden="true"
                      className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    />

                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="nombre@correo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-xl pl-11"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="password">
                      Contraseña
                    </Label>

                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      ¿La olvidaste?
                    </Link>
                  </div>

                  <div className="relative">
                    <Lock
                      aria-hidden="true"
                      className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    />

                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Escribe tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 rounded-xl px-11"
                      disabled={loading}
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                    disabled={loading}
                  />

                  Recordarme en este equipo
                </label>

                <Button
                  type="submit"
                  className="group h-12 w-full rounded-xl font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      Iniciar sesión

                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            <p className="mt-7 text-center text-sm text-muted-foreground">
              ¿Todavía no tienes una cuenta?{" "}
              <Link
                to="/register"
                className="font-semibold text-primary hover:underline"
              >
                Crear cuenta
              </Link>
            </p>

            <p className="mt-5 text-center text-xs text-muted-foreground/70">
              M&M Business Control · Acceso exclusivo
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}