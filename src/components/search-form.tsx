import { useEffect, useId, useRef, useState } from "react";
import { arcLaunch, haversineNm, tomorrowIso } from "@/lib/geo";
import { useFlight } from "@/lib/flight";
import { findPlace, placeLabel, searchPlaces, type Place } from "@/lib/places";
import { usePrefs } from "@/lib/prefs";
import { CATEGORIES } from "@/lib/types";
import { useI18n } from "@/lib/use-i18n";
import { btn, field, labelCls } from "@/components/ui";

export type Draft = {
  from: string;
  to: string;
  depart: string;
  ret: string;
  pax: number;
  cat: string;
};

export function draftFromSearch(s: {
  to: string;
  from?: string;
  depart: string;
  ret?: string;
  pax: number;
  cat: string;
}): Draft {
  return {
    to: s.to,
    from: s.from ?? "",
    depart: s.depart || tomorrowIso(),
    ret: s.ret ?? "",
    pax: s.pax || 2,
    cat: s.cat || "any",
  };
}

export function FieldPlace({
  label,
  placeholder,
  optional,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  optional?: string;
  value: string;
  onChange: (iata: string) => void;
}) {
  const t = useI18n();
  const listId = useId();
  const place = findPlace(value);
  const [text, setText] = useState(place ? placeLabel(place) : "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const matches = searchPlaces(text, 7);

  useEffect(() => {
    const next = findPlace(value);
    setText(next ? placeLabel(next) : value ? text : "");
    // only sync when the committed iata changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(p: Place) {
    onChange(p.iata);
    setText(placeLabel(p));
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <label className={labelCls}>
        {label}
        {optional ? <span className="ms-2 normal-case tracking-normal">{optional}</span> : null}
      </label>
      <input
        className={field}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange("");
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((n) => Math.min(matches.length - 1, n + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((n) => Math.max(0, n - 1));
          } else if (e.key === "Enter" && open && matches[hi]) {
            e.preventDefault();
            pick(matches[hi]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && text.trim() && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted">{t.search.noMatch}</li>
          ) : (
            matches.map((p, i) => (
              <li key={p.iata}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === hi}
                  className={`flex w-full items-center justify-between px-3 py-3 text-start text-sm ${i === hi ? "bg-elev" : ""}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(p)}
                >
                  <span>
                    {p.city}
                    <span className="text-muted"> · {p.country}</span>
                  </span>
                  <span className="text-xs tracking-widest text-muted">{p.iata}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function launchSearch(draft: Draft) {
  const to = findPlace(draft.to);
  if (!to) return "dest" as const;
  if (draft.ret && draft.ret < draft.depart) return "dates" as const;
  const from = draft.from ? findPlace(draft.from) : null;
  let launch = from
    ? { lat: from.lat, lng: from.lng, label: from.city }
    : { ...arcLaunch(to), label: "" };
  if (haversineNm(launch, to) < 120) {
    launch = { ...launch, lng: to.lng + (to.lng > 0 ? -64 : 64), label: launch.label };
  }
  useFlight.getState().play({
    from: launch,
    to: { lat: to.lat, lng: to.lng, label: to.city },
    search: {
      to: to.iata,
      from: from?.iata,
      depart: draft.depart,
      ret: draft.ret || undefined,
      pax: draft.pax,
      cat: draft.cat,
    },
  });
  return "ok" as const;
}

export function SearchForm({ initial }: { initial?: Draft }) {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const [draft, setDraft] = useState<Draft>(
    initial ?? { from: "", to: "", depart: tomorrowIso(), ret: "", pax: 4, cat: "any" },
  );
  const [err, setErr] = useState("");

  useEffect(() => {
    if (initial) setDraft(initial);
  }, [initial?.to, initial?.from, initial?.depart, initial?.ret, initial?.pax, initial?.cat]);

  return (
    <form
      className="grid gap-3 rounded-3xl border border-line bg-surface p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const res = launchSearch(draft);
        setErr(res === "dest" ? t.search.needDest : res === "dates" ? t.search.badDates : "");
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldPlace
          label={t.search.from}
          optional={t.search.optional}
          placeholder={t.search.fromPh}
          value={draft.from}
          onChange={(from) => setDraft({ ...draft, from })}
        />
        <FieldPlace
          label={t.search.to}
          placeholder={t.search.toPh}
          value={draft.to}
          onChange={(to) => setDraft({ ...draft, to })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={labelCls}>{t.search.depart}</span>
          <input
            className={field}
            type="date"
            required
            value={draft.depart}
            min={tomorrowIso()}
            onChange={(e) => setDraft({ ...draft, depart: e.target.value })}
          />
        </label>
        <label>
          <span className={labelCls}>
            {t.search.back} <span className="normal-case tracking-normal">{t.search.optional}</span>
          </span>
          <input
            className={field}
            type="date"
            value={draft.ret}
            min={draft.depart}
            onChange={(e) => setDraft({ ...draft, ret: e.target.value })}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={labelCls}>{t.search.pax}</span>
          <input
            className={`${field} tabular-nums`}
            type="number"
            min={1}
            max={19}
            value={draft.pax}
            onChange={(e) => setDraft({ ...draft, pax: Number(e.target.value) || 1 })}
          />
        </label>
        <label>
          <span className={labelCls}>{t.search.category}</span>
          <select
            className={field}
            value={draft.cat}
            onChange={(e) => setDraft({ ...draft, cat: e.target.value })}
          >
            <option value="any">{t.cat.any}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.cat[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err ? <p className="text-sm text-accent">{err}</p> : null}
      <button className={`${btn} w-full`} type="submit">
        {t.search.go}
      </button>
      <p className="sr-only">{lang}</p>
    </form>
  );
}
