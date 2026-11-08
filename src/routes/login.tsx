import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { Shell, useProfile } from "@/components/shell";
import { btn, btnGhost, field, labelCls } from "@/components/ui";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <Shell>
      <LoginBody />
    </Shell>
  );
}

function LoginBody() {
  const t = useI18n();
  const { user, isPending } = useProfile();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErr(t.login.short);
      return;
    }
    setBusy(true);
    setErr("");
    const res =
      mode === "up"
        ? await authClient.signUp.email({ email, password, name: name || email })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message || t.login.failed);
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-5xl">{t.login.title}</h1>
      <p className="mt-3 text-muted">{t.login.lede}</p>
      {isPending ? <p className="mt-8 text-muted">{t.common.loading}</p> : null}
      {!isPending && user ? (
        <p className="mt-8">
          {t.login.in}{" "}
          <Link to="/account" className="text-accent">
            {t.nav.account}
          </Link>
        </p>
      ) : null}
      {!isPending && !user ? (
        <>
          <div className="mt-8 space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className={`${btnGhost} w-full`}
                onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
              >
                {p.providerId === "google" ? t.login.google : t.login.x}
              </button>
            ))}
          </div>
          <form className="mt-6 space-y-3" onSubmit={(e) => void submit(e)}>
            {mode === "up" ? (
              <label className="block">
                <span className={labelCls}>{t.login.name}</span>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            ) : null}
            <label className="block">
              <span className={labelCls}>{t.login.email}</span>
              <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block">
              <span className={labelCls}>{t.login.password}</span>
              <input
                className={field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            {err ? <p className="text-sm text-accent">{err}</p> : null}
            <button className={`${btn} w-full`} disabled={busy} type="submit">
              {busy ? t.login.working : mode === "up" ? t.login.create : t.login.signIn}
            </button>
            <button
              type="button"
              className="text-sm text-muted"
              onClick={() => setMode(mode === "up" ? "in" : "up")}
            >
              {mode === "up" ? t.login.have : t.login.need}
            </button>
          </form>
        </>
      ) : null}
    </main>
  );
}
