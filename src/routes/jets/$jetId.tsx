import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shell, useProfile } from "@/components/shell";
import { btn, btnGhost, field, labelCls } from "@/components/ui";
import { fill, money, niceDate } from "@/lib/format";
import { quote } from "@/lib/geo";
import { createEnquiry, getJet, savedIds, toggleSave } from "@/lib/marketplace.functions";
import { findPlace } from "@/lib/places";
import { usePrefs } from "@/lib/prefs";
import { useI18n } from "@/lib/use-i18n";
import { tomorrowIso } from "@/lib/geo";

export const Route = createFileRoute("/jets/$jetId")({
  validateSearch: (s: Record<string, unknown>) => ({
    to: typeof s.to === "string" ? s.to : "",
    from: typeof s.from === "string" ? s.from : "",
    depart: typeof s.depart === "string" ? s.depart : "",
    ret: typeof s.ret === "string" ? s.ret : "",
    pax: Number(s.pax) || 0,
  }),
  component: JetPage,
});

function JetPage() {
  const { jetId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <Shell>
      <JetBody id={jetId} search={search} />
    </Shell>
  );
}

function JetBody({
  id,
  search,
}: {
  id: string;
  search: { to: string; from: string; depart: string; ret: string; pax: number };
}) {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const navigate = useNavigate();
  const { user } = useProfile();
  const [data, setData] = useState<Awaited<ReturnType<typeof getJet>> | null>(null);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [depart, setDepart] = useState(search.depart || tomorrowIso());
  const [ret, setRet] = useState(search.ret);
  const [pax, setPax] = useState(search.pax || 2);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJet({ data: id }).then(setData).catch(() => setData({ ok: false, error: "Missing" }));
  }, [id]);
  useEffect(() => {
    if (!user) return;
    savedIds()
      .then((ids) => setSaved(ids.includes(id)))
      .catch(() => {});
  }, [user?.id, id]);

  if (!data) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;
  if (!data.ok) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-4xl">{t.results.empty}</h1>
        <Link to="/" className="mt-4 inline-block text-accent">
          {t.common.home}
        </Link>
      </main>
    );
  }
  const jet = data.jet;
  const dest = findPlace(search.to);
  const origin = findPlace(search.from);
  const sectorNm = dest ? awaitableDistance(origin ?? { lat: jet.lat, lng: jet.lng }, dest) : 0;
  const priced = sectorNm
    ? quote(jet.hourly_from, jet.hourly_to, sectorNm, jet.speed_kts)
    : { hours: 0, price_low: jet.hourly_from, price_high: jet.hourly_to };
  const op = jet.operator_id === "bero" ? t.detail.house : jet.operator_name || t.detail.house;

  async function send() {
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    setBusy(true);
    const res = await createEnquiry({
      data: {
        aircraftId: jet.id,
        originLabel: origin?.city ?? "",
        destLabel: dest?.city ?? jet.home_city,
        destIata: dest?.iata ?? jet.home_iata,
        destLat: dest?.lat ?? jet.lat,
        destLng: dest?.lng ?? jet.lng,
        depart,
        ret: ret || undefined,
        passengers: pax,
        notes,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    void navigate({ to: "/trips/$enquiryId", params: { enquiryId: res.id } });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/search" search={{ to: search.to || jet.home_iata, from: search.from || undefined, depart, ret: ret || undefined, pax, cat: "any" }} className="text-sm text-muted">
        {t.detail.back}
      </Link>
      <div className="mt-4 grid gap-6 md:grid-cols-5">
        <img src={jet.photo} alt={`${jet.model}, ${jet.home_city}`} className="aspect-video w-full rounded-3xl object-cover md:col-span-3" />
        <div className="md:col-span-2">
          <p className="text-xs tracking-widest text-muted uppercase">{t.cat[jet.category]}</p>
          <h1 className="font-display text-4xl">{jet.name}</h1>
          <p className="text-muted">{jet.model}</p>
          <p className="mt-3 text-sm">
            {t.detail.operator}: {op}
          </p>
          <p className="mt-4 text-2xl tabular-nums">
            {fill(t.card.price, { price: money(priced.price_low, lang) })}
            <span className="text-base text-muted"> – {money(priced.price_high, lang)}</span>
          </p>
          {priced.hours ? <p className="text-sm text-muted">{fill(t.detail.sector, { h: priced.hours })}</p> : null}
          <p className="mt-2 text-sm text-muted">{t.detail.priceNote}</p>
          <p className="mt-2 text-sm text-muted">
            {data.rating_count
              ? fill(t.detail.reviews, { n: data.rating_count }) + ` · ${data.rating_avg}`
              : t.detail.noReviews}
          </p>
          <div className="mt-4 flex gap-2">
            <a href="#enquire" className={btn}>
              {t.detail.enquire}
            </a>
            {user ? (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  void toggleSave({ data: jet.id }).then((r) => {
                    if (r.ok) setSaved(r.saved);
                  });
                }}
              >
                {saved ? t.card.saved : t.card.save}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-8 max-w-2xl text-lg">{jet.description}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t.card.seats, String(jet.seats)],
          [t.detail.speed, `${jet.speed_kts} ${t.detail.kts}`],
          [t.card.range, String(jet.range_nm)],
          [t.detail.year, String(jet.year)],
          [t.detail.base, `${jet.home_city} · ${jet.home_iata}`],
        ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line p-3">
              <dt className="text-xs tracking-widest text-muted uppercase">{k}</dt>
              <dd className="mt-1 tabular-nums">{v}</dd>
            </div>
          ))}
      </dl>
      <p className="sr-only">{niceDate(depart, lang)}</p>
      {data.reviews.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">{fill(t.detail.reviews, { n: data.rating_count })}</h2>
          <ul className="mt-4 space-y-3">
            {data.reviews.map((r, i) => (
              <li key={i} className="rounded-2xl border border-line p-4">
                <p className="text-sm text-accent tabular-nums">{"●".repeat(r.rating)}</p>
                <p className="mt-1">{r.body}</p>
                <p className="text-sm text-muted">{r.name}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section id="enquire" className="mt-10 max-w-xl rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-display text-3xl">{t.enquire.title}</h2>
        {!user ? <p className="mt-2 text-sm text-muted">{t.enquire.sign}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label>
            <span className={labelCls}>{t.search.depart}</span>
            <input className={field} type="date" value={depart} onChange={(e) => setDepart(e.target.value)} />
          </label>
          <label>
            <span className={labelCls}>{t.search.back}</span>
            <input className={field} type="date" value={ret} min={depart} onChange={(e) => setRet(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={labelCls}>{t.search.pax}</span>
          <input className={field} type="number" min={1} max={jet.seats} value={pax} onChange={(e) => setPax(Number(e.target.value) || 1)} />
        </label>
        <label className="mt-3 block">
          <span className={labelCls}>{t.enquire.note}</span>
          <textarea className={`${field} h-28 py-3`} value={notes} placeholder={t.enquire.notePh} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {msg ? <p className="mt-2 text-sm text-accent">{msg}</p> : null}
        <button type="button" className={`${btn} mt-4`} disabled={busy} onClick={() => void send()}>
          {busy ? t.common.loading : t.enquire.send}
        </button>
      </section>
    </main>
  );
}

function awaitableDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 3440.065;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
