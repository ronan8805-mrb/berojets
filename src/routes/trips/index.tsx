import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gate, Shell } from "@/components/shell";
import { niceDate } from "@/lib/format";
import { listTrips } from "@/lib/marketplace.functions";
import { usePrefs } from "@/lib/prefs";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/trips/")({ component: Trips });

function Trips() {
  return (
    <Shell>
      <Gate>
        <List />
      </Gate>
    </Shell>
  );
}

function List() {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listTrips>>>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    listTrips()
      .then((r) => {
        setRows(r);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-5xl">{t.trips.title}</h1>
      {ready && rows.length === 0 ? <p className="mt-4 text-muted">{t.trips.empty}</p> : null}
      <ul className="mt-6 divide-y divide-line">
        {rows.map((e) => (
          <li key={e.id}>
            <Link to="/trips/$enquiryId" params={{ enquiryId: e.id }} className="flex items-center justify-between gap-3 py-4">
              <span>
                <span className="block font-medium">
                  {e.origin_label ? `${e.origin_label} → ` : ""}
                  {e.dest_label}
                </span>
                <span className="text-sm text-muted">
                  {e.model} · {niceDate(e.depart, lang)}
                </span>
              </span>
              <span className="text-xs tracking-widest text-accent uppercase">{t.status[e.status as keyof typeof t.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
