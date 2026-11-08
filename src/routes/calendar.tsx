import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gate, Shell, useProfile } from "@/components/shell";
import { field, labelCls } from "@/components/ui";
import { isoLocal } from "@/lib/geo";
import { localeOf } from "@/lib/format";
import { listCalendarCraft, monthBlocks, toggleDay } from "@/lib/marketplace.functions";
import { usePrefs } from "@/lib/prefs";
import type { Aircraft } from "@/lib/types";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

function CalendarPage() {
  return (
    <Shell>
      <Gate>
        <CalBody />
      </Gate>
    </Shell>
  );
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(isoLocal(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

function CalBody() {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const { profile } = useProfile();
  const op = profile && (profile.role === "operator" || profile.role === "admin");
  const [craft, setCraft] = useState<Aircraft[]>([]);
  const [id, setId] = useState("");
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [blocked, setBlocked] = useState<string[]>([]);

  useEffect(() => {
    if (!op) return;
    listCalendarCraft()
      .then((rows) => {
        setCraft(rows);
        setId((cur) => cur || rows[0]?.id || "");
      })
      .catch(() => {});
  }, [op]);

  const start = isoLocal(new Date(cursor.y, cursor.m, 1));
  const end = isoLocal(new Date(cursor.y, cursor.m + 1, 0));

  useEffect(() => {
    if (!id) return;
    monthBlocks({ data: { aircraftId: id, start, end } })
      .then(setBlocked)
      .catch(() => setBlocked([]));
  }, [id, start, end]);

  const cells = useMemo(() => monthCells(cursor.y, cursor.m), [cursor.y, cursor.m]);
  const week = useMemo(() => {
    const loc = localeOf(lang);
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(loc, { weekday: "narrow" }).format(new Date(2024, 0, 1 + i)),
    );
  }, [lang]);
  const title = new Intl.DateTimeFormat(localeOf(lang), { month: "long", year: "numeric" }).format(
    new Date(cursor.y, cursor.m, 1),
  );

  if (!profile) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;
  if (!op) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <h1 className="font-display text-5xl">{t.cal.title}</h1>
        <p className="mt-3 text-muted">{t.fleet.needOp}</p>
        <Link to="/account" className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm text-accent-fg">
          {t.nav.account}
        </Link>
      </main>
    );
  }

  function shift(dir: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl">{t.cal.title}</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">{t.cal.hint}</p>

      {craft.length === 0 ? (
        <p className="mt-8 text-muted">
          {t.cal.none}{" "}
          <Link to="/fleet" className="underline">
            {t.fleet.add}
          </Link>
        </p>
      ) : (
        <>
          <label className="mt-6 block max-w-sm">
            <span className={labelCls}>{t.cal.pick}</span>
            <select className={field} value={id} onChange={(e) => setId(e.target.value)}>
              {craft.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.home_iata}
                  {a.operator_id === "bero" ? " · BERO" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-6 flex items-center justify-between">
            <button type="button" className="rounded-full border border-line px-4 py-2 text-sm" onClick={() => shift(-1)}>
              {t.cal.prev}
            </button>
            <p className="font-display text-2xl capitalize">{title}</p>
            <button type="button" className="rounded-full border border-line px-4 py-2 text-sm" onClick={() => shift(1)}>
              {t.cal.next}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs tracking-widest text-muted uppercase">
            {week.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const on = blocked.includes(day);
              const n = Number(day.slice(8));
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  className={`press aspect-square rounded-xl text-sm tabular-nums ${
                    on ? "bg-accent text-accent-fg" : "border border-line bg-surface"
                  }`}
                  onClick={() => {
                    void toggleDay({ data: { aircraftId: id, day } }).then((r) => {
                      if (!r.ok) return;
                      setBlocked((cur) => (r.blocked ? [...cur, day] : cur.filter((d) => d !== day)));
                    });
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-4 flex items-center gap-3 text-xs text-muted">
            <span className="inline-block h-3 w-3 rounded-sm bg-accent" /> {t.cal.blocked}
            <span className="inline-block h-3 w-3 rounded-sm border border-line" /> {t.cal.open}
          </p>
        </>
      )}
    </main>
  );
}
