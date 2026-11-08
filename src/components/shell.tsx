import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ensureProfile } from "@/lib/marketplace.functions";
import { LANGS } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Profile } from "@/lib/types";
import { useI18n } from "@/lib/use-i18n";

type ProfileState = {
  user: ReturnType<typeof useCurrentUserState>["user"];
  isPending: boolean;
  ready: boolean;
  profile: Profile | null;
  error: string | null;
  setProfile: (p: Profile | null) => void;
};

const Ctx = createContext<ProfileState | null>(null);

export function useProfile() {
  const v = useContext(Ctx);
  if (!v) throw new Error("Profile is only available inside the shell");
  return v;
}

function useProfileLoader(): ProfileState {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setProfile(null);
      setReady(true);
      return;
    }
    let dead = false;
    setReady(false);
    ensureProfile({ data: { displayName: user.displayName, email: user.primaryEmail } })
      .then((p) => {
        if (!dead) {
          setProfile(p);
          setError(null);
          setReady(true);
        }
      })
      .catch((e: unknown) => {
        if (!dead) {
          setError(e instanceof Error ? e.message : "error");
          setReady(true);
        }
      });
    return () => {
      dead = true;
    };
  }, [isPending, user?.id, user?.displayName, user?.primaryEmail]);
  return { user, isPending, ready, profile, error, setProfile };
}

export function Shell({ children }: { children: ReactNode }) {
  const state = useProfileLoader();
  const t = useI18n();
  return (
    <Ctx.Provider value={state}>
      <div className="min-h-screen bg-bg text-fg">
        <Nav />
        {state.profile?.suspended ? (
          <main className="mx-auto max-w-lg px-4 py-24">
            <h1 className="font-display text-4xl">{t.suspended.title}</h1>
            <p className="mt-3 text-muted">{t.suspended.body}</p>
          </main>
        ) : (
          children
        )}
        <footer className="mx-auto max-w-6xl px-4 py-12 text-sm text-muted">
          <p>{t.footer.line}</p>
          <p className="mt-2 max-w-xl">{t.footer.gdpr}</p>
        </footer>
      </div>
    </Ctx.Provider>
  );
}

function Nav() {
  const t = useI18n();
  const { profile, isPending, user } = useProfile();
  const lang = usePrefs((s) => s.lang);
  const setLang = usePrefs((s) => s.setLang);
  const theme = usePrefs((s) => s.theme);
  const toggle = usePrefs((s) => s.toggleTheme);
  const [open, setOpen] = useState(false);
  const [langs, setLangs] = useState(false);
  const op = profile && (profile.role === "operator" || profile.role === "admin");
  const links = (
    <>
      <Link to="/how" className="rounded-full px-3 py-2 text-sm" onClick={() => setOpen(false)}>
        {t.nav.how}
      </Link>
      {user ? (
        <Link to="/trips" className="rounded-full px-3 py-2 text-sm" onClick={() => setOpen(false)}>
          {t.nav.trips}
        </Link>
      ) : null}
      {op ? (
        <>
          <Link to="/fleet" className="rounded-full px-3 py-2 text-sm" onClick={() => setOpen(false)}>
            {t.nav.fleet}
          </Link>
          <Link to="/calendar" className="rounded-full px-3 py-2 text-sm" onClick={() => setOpen(false)}>
            {t.nav.calendar}
          </Link>
        </>
      ) : null}
      {profile?.role === "admin" ? (
        <Link to="/admin" className="rounded-full px-3 py-2 text-sm" onClick={() => setOpen(false)}>
          {t.nav.admin}
        </Link>
      ) : null}
      {user ? (
        <Link to="/account" className="rounded-full px-3 py-2 text-sm" onClick={() => setOpen(false)}>
          {t.nav.account}
        </Link>
      ) : null}
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="font-display text-3xl leading-none tracking-tight">
          BERO
        </Link>
        <nav className="ms-6 hidden items-center md:flex">{links}</nav>
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            className="press grid size-11 place-items-center rounded-full border border-line"
            aria-label={t.lang.label}
            onClick={() => setLangs((v) => !v)}
          >
            <Languages className="size-4" />
          </button>
          <button
            type="button"
            className="press grid size-11 place-items-center rounded-full border border-line"
            aria-label={theme === "dark" ? t.theme.toLight : t.theme.toDark}
            onClick={toggle}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <div className="hidden md:block">
            {isPending ? (
              <span className="block size-8 animate-pulse rounded-full bg-elev" />
            ) : user ? (
              <UserButton />
            ) : (
              <Link to="/login" className="press inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm text-accent-fg">
                {t.nav.signIn}
              </Link>
            )}
          </div>
          <button
            type="button"
            className="press grid size-11 place-items-center rounded-full border border-line md:hidden"
            aria-label={open ? t.nav.close : t.nav.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {langs ? (
        <div className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <p className="text-sm text-muted">{t.lang.note}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`press h-11 rounded-full border text-sm ${lang === l.id ? "border-accent text-accent" : "border-line"}`}
                  onClick={() => {
                    setLang(l.id);
                    setLangs(false);
                  }}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {open ? (
        <div className="border-t border-line bg-bg px-4 py-3 md:hidden">
          <div className="flex flex-col">{links}</div>
          <div className="mt-3">
            {user ? (
              <UserButton />
            ) : (
              <Link to="/login" className="text-sm text-accent" onClick={() => setOpen(false)}>
                {t.nav.signIn}
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function Gate({ children }: { children: ReactNode }) {
  const { user, isPending, ready } = useProfile();
  const t = useI18n();
  if (isPending || !ready) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;
  if (!user) return <RedirectToSignIn />;
  return children;
}
