import { Link } from "@tanstack/react-router";
import { fill, money } from "@/lib/format";
import type { JetHit } from "@/lib/types";
import { usePrefs } from "@/lib/prefs";
import { useI18n } from "@/lib/use-i18n";
import { btn, btnGhost } from "@/components/ui";

export function JetCard({
  jet,
  saved,
  onSave,
  search,
}: {
  jet: JetHit | (JetHit & { price_low?: number });
  saved?: boolean;
  onSave?: () => void;
  search?: { to: string; from: string; depart: string; ret: string; pax: number };
}) {
  const t = useI18n();
  const lang = usePrefs((s) => s.lang);
  const op = jet.operator_id === "bero" ? t.card.house : jet.operator_name || t.card.house;
  const price = "price_low" in jet && jet.price_low ? fill(t.card.price, { price: money(jet.price_low, lang) }) : null;
  const q = search ?? { to: "", from: "", depart: "", ret: "", pax: 0 };
  return (
    <article className="group overflow-hidden rounded-3xl border border-line bg-surface">
      <Link to="/jets/$jetId" params={{ jetId: jet.id }} search={q} className="block overflow-hidden">
        <img
          src={jet.photo}
          alt={`${jet.model}, ${jet.home_city}`}
          className="card-photo aspect-video w-full object-cover"
        />
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-widest text-muted uppercase">{t.cat[jet.category]}</p>
            <h3 className="font-display text-2xl">
              <Link to="/jets/$jetId" params={{ jetId: jet.id }} search={q}>
                {jet.name}
              </Link>
            </h3>
            <p className="text-sm text-muted">
              {jet.model} · {jet.home_city}
            </p>
          </div>
          {price ? <p className="text-end text-sm tabular-nums">{price}</p> : null}
        </div>
        <p className="text-sm text-muted">
          {jet.seats} {t.card.seats} · {jet.range_nm.toLocaleString()} {t.card.range}
          {"leg" in jet && jet.leg ? ` · ${jet.leg === "route" ? t.card.legRoute : t.card.legBase}` : ""}
        </p>
        <p className="text-sm">{op}</p>
        <div className="flex gap-2">
          <Link to="/jets/$jetId" params={{ jetId: jet.id }} search={q} className={btn}>
            {t.card.enquire}
          </Link>
          {onSave ? (
            <button type="button" className={btnGhost} onClick={onSave}>
              {saved ? t.card.saved : t.card.save}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
