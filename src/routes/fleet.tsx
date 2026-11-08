import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FieldPlace } from "@/components/search-form";
import { Gate, Shell, useProfile } from "@/components/shell";
import { btn, btnGhost, field, labelCls } from "@/components/ui";
import { money } from "@/lib/format";
import {
  createInvite,
  listFleet,
  operatorStats,
  removeAircraft,
  saveAircraft,
} from "@/lib/marketplace.functions";
import { usePrefs } from "@/lib/prefs";
import { CATEGORIES, HOUSE_PHOTOS, type Aircraft, type Category } from "@/lib/types";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/fleet")({ component: FleetPage });

const empty = {
  id: "",
  name: "",
  model: "",
  category: "light" as Category,
  seats: 8,
  range_nm: 2200,
  speed_kts: 440,
  year: 2019,
  home_iata: "",
  hourly_from: 3500,
  hourly_to: 5200,
  description: "",
  photo: HOUSE_PHOTOS[1] as string,
  active: true,
};

function FleetPage() {
  return (
    <Shell>
      <Gate>
        <FleetBody />
      </Gate>
    </Shell>
  );
}

function FleetBody() {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const { profile } = useProfile();
  const op = profile && (profile.role === "operator" || profile.role === "admin");
  const [jets, setJets] = useState<Aircraft[]>([]);
  const [stats, setStats] = useState({ enquiries: 0, response_rate: 0, won: 0 });
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  function load() {
    if (!op) return;
    listFleet().then(setJets).catch(() => {});
    operatorStats().then(setStats).catch(() => {});
  }

  useEffect(() => {
    load();
    // profile role is the gate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  if (!profile) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;

  if (!op) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="font-display text-5xl">{t.fleet.title}</h1>
        <p className="mt-3 text-muted">{t.fleet.needOp}</p>
        <Link to="/account" className={`${btn} mt-6`}>
          {t.nav.account}
        </Link>
      </main>
    );
  }

  function edit(a: Aircraft) {
    setForm({
      id: a.id,
      name: a.name,
      model: a.model,
      category: a.category,
      seats: a.seats,
      range_nm: a.range_nm,
      speed_kts: a.speed_kts,
      year: a.year,
      home_iata: a.home_iata,
      hourly_from: a.hourly_from,
      hourly_to: a.hourly_to,
      description: a.description,
      photo: a.photo,
      active: a.active,
    });
    setOpen(true);
    setMsg("");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl">{t.fleet.title}</h1>
          <p className="mt-2 text-sm text-muted">
            {profile.company_name || t.roles.operator}
            {profile.base_airport ? ` · ${profile.base_airport}` : ""}
          </p>
        </div>
        <button
          className={btn}
          type="button"
          onClick={() => {
            setForm(empty);
            setOpen(true);
            setMsg("");
          }}
        >
          {t.fleet.add}
        </button>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label={t.fleet.perfEnq} value={String(stats.enquiries)} />
        <Stat label={t.fleet.perfResp} value={`${stats.response_rate}%`} />
        <Stat label={t.fleet.perfWon} value={String(stats.won)} />
      </section>

      {jets.length === 0 && !open ? <p className="mt-8 text-muted">{t.fleet.empty}</p> : null}

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {jets.map((a) => (
          <li key={a.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="grid grid-cols-[7.5rem_1fr]">
              <img src={a.photo} alt="" className="h-full w-full object-cover" />
              <div className="p-4">
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-muted">
                  {a.model} · {a.home_iata} · {a.seats} {t.card.seats}
                </p>
                <p className="mt-1 text-sm tabular-nums text-muted">
                  {money(a.hourly_from, lang)}–{money(a.hourly_to, lang)}
                </p>
                {!a.active ? <p className="mt-1 text-xs text-accent">{t.admin.deactivate}</p> : null}
                <div className="mt-3 flex gap-2">
                  <button className={btnGhost} type="button" onClick={() => edit(a)}>
                    {t.fleet.edit}
                  </button>
                  <button
                    className={btnGhost}
                    type="button"
                    onClick={() => {
                      void removeAircraft({ data: a.id }).then(() => load());
                    }}
                  >
                    {t.fleet.remove}
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {open ? (
        <form
          className="mt-8 grid gap-3 rounded-2xl border border-line bg-surface p-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveAircraft({
              data: {
                id: form.id || undefined,
                name: form.name,
                model: form.model,
                category: form.category,
                seats: Number(form.seats),
                range_nm: Number(form.range_nm),
                speed_kts: Number(form.speed_kts),
                year: Number(form.year),
                home_iata: form.home_iata,
                hourly_from: Number(form.hourly_from),
                hourly_to: Number(form.hourly_to),
                description: form.description,
                photo: form.photo,
                active: form.active,
              },
            }).then((r) => {
              if (!r.ok) {
                setMsg(r.error);
                return;
              }
              setMsg(t.fleet.savedOk);
              setOpen(false);
              load();
            });
          }}
        >
          <h2 className="font-display text-3xl md:col-span-2">{form.id ? t.fleet.edit : t.fleet.add}</h2>
          <Num label={t.fleet.model} text value={form.model} onChange={(model) => setForm({ ...form, model })} />
          <Num label={t.fleet.callsign} text value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <label className="block">
            <span className={labelCls}>{t.search.category}</span>
            <select
              className={field}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.cat[c]}
                </option>
              ))}
            </select>
          </label>
          <FieldPlace label={t.fleet.base} placeholder={t.fleet.basePh} value={form.home_iata} onChange={(home_iata) => setForm({ ...form, home_iata })} />
          <Num label={t.fleet.seats} value={form.seats} onChange={(seats) => setForm({ ...form, seats })} />
          <Num label={t.fleet.range} value={form.range_nm} onChange={(range_nm) => setForm({ ...form, range_nm })} />
          <Num label={t.fleet.speed} value={form.speed_kts} onChange={(speed_kts) => setForm({ ...form, speed_kts })} />
          <Num label={t.fleet.year} value={form.year} onChange={(year) => setForm({ ...form, year })} />
          <Num label={t.fleet.priceLo} value={form.hourly_from} onChange={(hourly_from) => setForm({ ...form, hourly_from })} />
          <Num label={t.fleet.priceHi} value={form.hourly_to} onChange={(hourly_to) => setForm({ ...form, hourly_to })} />
          <label className="block md:col-span-2">
            <span className={labelCls}>{t.fleet.desc}</span>
            <textarea className={`${field} h-24 py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="md:col-span-2">
            <p className={labelCls}>{t.fleet.photo}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {HOUSE_PHOTOS.map((src) => (
                <button
                  key={src}
                  type="button"
                  className={`overflow-hidden rounded-xl border ${form.photo === src ? "border-accent" : "border-line"}`}
                  onClick={() => setForm({ ...form, photo: src })}
                >
                  <img src={src} alt="" className="h-16 w-24 object-cover" />
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              <span className={labelCls}>{t.fleet.url}</span>
              <input className={field} value={form.photo.startsWith("/jets/") ? "" : form.photo} placeholder="https://" onChange={(e) => setForm({ ...form, photo: e.target.value || HOUSE_PHOTOS[1] })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            {t.fleet.active}
          </label>
          <p className="text-xs text-muted md:col-span-2">{t.fleet.baseHint}</p>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button className={btn} type="submit">{t.fleet.save}</button>
            <button className={btnGhost} type="button" onClick={() => setOpen(false)}>{t.account.cancel}</button>
          </div>
          {msg ? <p className="text-sm text-good md:col-span-2">{msg}</p> : null}
        </form>
      ) : msg ? (
        <p className="mt-4 text-sm text-good">{msg}</p>
      ) : null}

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="font-display text-3xl">{t.fleet.invite}</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">{t.fleet.inviteHint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className={btnGhost}
            type="button"
            onClick={() => {
              void createInvite().then((r) => {
                if (r.ok) {
                  setCode(r.code);
                  setCopied(false);
                }
              });
            }}
          >
            {t.fleet.code}
          </button>
          {code ? (
            <>
              <span className="font-display text-3xl tracking-widest">{code}</span>
              <button
                className={btnGhost}
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(code).then(() => setCopied(true));
                }}
              >
                {copied ? t.fleet.copied : t.fleet.copy}
              </button>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4">
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-4xl tabular-nums">{value}</p>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  text,
}: {
  label: string;
  value: string | number;
  onChange: (n: number) => void;
  text?: false;
} | {
  label: string;
  value: string;
  onChange: (s: string) => void;
  text: true;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        className={field}
        inputMode={text ? "text" : "numeric"}
        value={value}
        onChange={(e) => {
          if (text) onChange(e.target.value);
          else onChange(Number(e.target.value));
        }}
      />
    </label>
  );
}
