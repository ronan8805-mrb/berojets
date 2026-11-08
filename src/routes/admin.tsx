import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gate, Shell, useProfile } from "@/components/shell";
import { btnGhost } from "@/components/ui";
import {
  adminActive,
  adminBundle,
  adminFeature,
  adminHideReview,
  adminSetRole,
  adminSuspend,
  removeAircraft,
} from "@/lib/marketplace.functions";
import type { Role } from "@/lib/types";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Bundle = Extract<Awaited<ReturnType<typeof adminBundle>>, { ok: true }>;
type Tab = "people" | "jets" | "reviews" | "audit";

function AdminPage() {
  return (
    <Shell>
      <Gate>
        <AdminBody />
      </Gate>
    </Shell>
  );
}

function AdminBody() {
  const t = useI18n();
  const { profile } = useProfile();
  const [tab, setTab] = useState<Tab>("people");
  const [data, setData] = useState<Bundle | null>(null);
  const [denied, setDenied] = useState(false);

  function load() {
    adminBundle()
      .then((r) => {
        if (!r.ok) {
          setDenied(true);
          return;
        }
        setDenied(false);
        setData(r);
      })
      .catch(() => setDenied(true));
  }

  useEffect(() => {
    if (profile?.role === "admin") load();
    else if (profile) setDenied(true);
  }, [profile?.role]);

  if (!profile) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;
  if (denied || profile.role !== "admin") {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-5xl">{t.admin.title}</h1>
        <p className="mt-3 text-muted">{t.admin.denied}</p>
      </main>
    );
  }
  if (!data) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;

  const tabs: Array<[Tab, string]> = [
    ["people", t.admin.people],
    ["jets", t.admin.jets],
    ["reviews", t.admin.reviews],
    ["audit", t.admin.audit],
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs tracking-widest text-accent uppercase">{t.nav.admin}</p>
      <h1 className="mt-2 font-display text-5xl">{t.admin.title}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">{t.admin.lede}</p>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile k={t.admin.users} v={data.stats.users} />
        <Tile k={t.admin.enquiries} v={data.stats.enquiries} />
        <Tile k={t.admin.won} v={data.stats.won} />
        <Tile k={t.admin.aircraft} v={data.stats.aircraft} />
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${tab === id ? "bg-fg text-bg" : "border border-line"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "people" ? (
        <ul className="mt-6 divide-y divide-line">
          {data.users.length === 0 ? <li className="py-6 text-muted">{t.admin.empty}</li> : null}
          {data.users.map((u) => (
            <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">
                  {u.display_name || u.email || u.user_id.slice(0, 8)}
                  {u.suspended ? <span className="ms-2 text-xs text-accent">{t.admin.suspend}</span> : null}
                </p>
                <p className="text-sm text-muted">
                  {t.roles[u.role]}
                  {u.company_name ? ` · ${u.company_name}` : ""}
                  {u.email ? ` · ${u.email}` : ""}
                </p>
              </div>
              {u.user_id !== profile.user_id ? (
                <div className="flex flex-wrap gap-2">
                  {(["customer", "operator", "admin"] as Role[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={btnGhost}
                      disabled={u.role === role}
                      onClick={() => {
                        void adminSetRole({ data: { userId: u.user_id, role } }).then(load);
                      }}
                    >
                      {role === "admin" ? t.admin.makeAdmin : role === "operator" ? t.admin.makeOp : t.admin.makeCustomer}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => {
                      void adminSuspend({ data: { userId: u.user_id, suspended: !u.suspended } }).then(load);
                    }}
                  >
                    {u.suspended ? t.admin.restore : t.admin.suspend}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "jets" ? (
        <ul className="mt-6 divide-y divide-line">
          {data.aircraft.length === 0 ? <li className="py-6 text-muted">{t.admin.empty}</li> : null}
          {data.aircraft.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <img src={a.photo} alt="" className="h-14 w-20 rounded-lg object-cover" />
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-muted">
                    {a.model} · {a.home_city} · {a.operator_id === "bero" ? "BERO House" : a.operator_id.slice(0, 8)}
                    {!a.active ? ` · ${t.admin.hide}` : ""}
                    {a.featured ? ` · ${t.admin.feature}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnGhost} onClick={() => void adminFeature({ data: { id: a.id, featured: !a.featured } }).then(load)}>
                  {a.featured ? t.admin.unfeature : t.admin.feature}
                </button>
                <button type="button" className={btnGhost} onClick={() => void adminActive({ data: { id: a.id, active: !a.active } }).then(load)}>
                  {a.active ? t.admin.deactivate : t.admin.activate}
                </button>
                <button type="button" className={btnGhost} onClick={() => void removeAircraft({ data: a.id }).then(load)}>
                  {t.admin.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "reviews" ? (
        <ul className="mt-6 divide-y divide-line">
          {data.reviews.length === 0 ? <li className="py-6 text-muted">{t.admin.empty}</li> : null}
          {data.reviews.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="text-sm">
                  {"●".repeat(r.rating)}
                  {"○".repeat(Math.max(0, 5 - r.rating))} · {r.name}
                  {r.model ? ` · ${r.model}` : ""}
                </p>
                <p className={`mt-1 text-sm ${r.hidden ? "text-muted line-through" : ""}`}>{r.body || "—"}</p>
              </div>
              <button type="button" className={btnGhost} onClick={() => void adminHideReview({ data: { id: r.id, hidden: !r.hidden } }).then(load)}>
                {r.hidden ? t.admin.show : t.admin.hide}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "audit" ? (
        <ul className="mt-6 divide-y divide-line font-mono text-xs">
          {data.audit.length === 0 ? <li className="py-6 font-sans text-sm text-muted">{t.admin.empty}</li> : null}
          {data.audit.map((row) => (
            <li key={row.id} className="grid gap-1 py-3 sm:grid-cols-[10rem_8rem_1fr]">
              <span className="text-muted">{String(row.created_at).slice(0, 16).replace("T", " ")}</span>
              <span>{row.action}</span>
              <span className="text-muted">
                {row.target}
                {row.detail ? ` · ${row.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

function Tile({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4">
      <p className="text-xs tracking-widest text-muted uppercase">{k}</p>
      <p className="mt-1 font-display text-4xl tabular-nums">{v}</p>
    </div>
  );
}
