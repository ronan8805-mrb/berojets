import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gate, Shell } from "@/components/shell";
import { btn, btnGhost, field, labelCls } from "@/components/ui";
import { fill, niceDate } from "@/lib/format";
import { createReview, getEnquiry, postMessage, saveNote, setStatus } from "@/lib/marketplace.functions";
import { usePrefs } from "@/lib/prefs";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/trips/$enquiryId")({ component: Trip });

function Trip() {
  const { enquiryId } = Route.useParams();
  return (
    <Shell>
      <Gate>
        <Thread id={enquiryId} />
      </Gate>
    </Shell>
  );
}

function Thread({ id }: { id: string }) {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const [data, setData] = useState<Awaited<ReturnType<typeof getEnquiry>> | null>(null);
  const [body, setBody] = useState("");
  const [review, setReview] = useState("");
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState("");
  const [noteStars, setNoteStars] = useState(5);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await getEnquiry({ data: id });
    setData(r);
    if (r.ok && r.my_note) {
      setNote(r.my_note.note);
      setNoteStars(r.my_note.rating);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [id]);

  if (!data) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;
  if (!data.ok) return <p className="px-4 py-16">{t.results.empty}</p>;
  const trip = data.trip;
  const opName = data.operator_name || t.detail.house;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/trips" className="text-sm text-muted">{t.trips.title}</Link>
      <h1 className="mt-2 font-display text-4xl">
        {trip.origin_label ? `${trip.origin_label} → ` : ""}
        {trip.dest_label}
      </h1>
      <p className="text-sm text-muted">
        {trip.model} · {niceDate(trip.depart, lang)}
        {trip.ret ? ` – ${niceDate(trip.ret, lang)}` : ""} · {trip.passengers}
      </p>
      <p className="mt-2 text-sm">
        {data.customer_name} · {opName}
      </p>
      {data.can_moderate ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {(["new", "quoted", "won", "lost"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={trip.status === s ? btn : btnGhost}
              onClick={() => {
                void setStatus({ data: { id, status: s } }).then(() => load());
              }}
            >
              {t.status[s]}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs tracking-widest text-accent uppercase">{t.status[trip.status as keyof typeof t.status]}</p>
      )}
      {data.can_moderate ? (
        <p className="mt-3 text-sm text-muted">
          {data.reliability
            ? fill(t.trips.reliability, { avg: data.reliability.avg, n: data.reliability.count })
            : t.trips.noneYet}
        </p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {data.messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.sender_id === data.viewer_id ? "ms-auto bg-accent text-accent-fg" : "bg-elev"}`}>
            <p>{m.body}</p>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          void postMessage({ data: { id, body } }).then(() => {
            setBody("");
            void load();
          });
        }}
      >
        <input className={field} value={body} placeholder={t.trips.ph} onChange={(e) => setBody(e.target.value)} />
        <button className={btn} type="submit">{t.trips.send}</button>
      </form>

      {data.is_customer && trip.status === "won" && !data.review ? (
        <form
          className="mt-8 space-y-3 border-t border-line pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void createReview({ data: { id, rating: stars, body: review } }).then((r) => {
              setMsg(r.ok ? t.trips.reviewed : r.error);
              void load();
            });
          }}
        >
          <h2 className="font-display text-2xl">{t.trips.review}</h2>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" className={n <= stars ? btn : btnGhost} onClick={() => setStars(n)}>
                {n}
              </button>
            ))}
          </div>
          <textarea className={`${field} h-24 py-3`} value={review} placeholder={t.trips.reviewPh} onChange={(e) => setReview(e.target.value)} />
          <button className={btn} type="submit">{t.trips.send}</button>
        </form>
      ) : null}
      {data.review ? <p className="mt-6 text-sm text-muted">{t.trips.reviewed} · {data.review.rating}/5</p> : null}

      {data.can_moderate ? (
        <form
          className="mt-8 space-y-3 border-t border-line pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void saveNote({ data: { customerId: trip.customer_id, rating: noteStars, note } }).then((r) => {
              setMsg(r.ok ? t.account.savedOk : r.error);
            });
          }}
        >
          <h2 className="font-display text-2xl">{t.trips.note}</h2>
          <p className="text-sm text-muted">{t.trips.notePh}</p>
          <label className="block">
            <span className={labelCls}>1–5</span>
            <input className={field} type="number" min={1} max={5} value={noteStars} onChange={(e) => setNoteStars(Number(e.target.value) || 1)} />
          </label>
          <textarea className={`${field} h-24 py-3`} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btn} type="submit">{t.trips.noteSave}</button>
        </form>
      ) : null}
      {msg ? <p className="mt-3 text-sm">{msg}</p> : null}
    </main>
  );
}
