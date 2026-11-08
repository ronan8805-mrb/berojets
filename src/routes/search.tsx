import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { JetCard } from "@/components/jet-card";
import { draftFromSearch, launchSearch, SearchForm } from "@/components/search-form";
import { Shell, useProfile } from "@/components/shell";
import { btnGhost } from "@/components/ui";
import { fill } from "@/lib/format";
import { findPlace } from "@/lib/places";
import { useI18n } from "@/lib/use-i18n";
import { searchJets, savedIds, toggleSave } from "@/lib/marketplace.functions";
import type { JetHit, SearchInput } from "@/lib/types";

type Search = SearchInput;

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    to: typeof s.to === "string" ? s.to : "",
    from: typeof s.from === "string" && s.from ? s.from : undefined,
    depart: typeof s.depart === "string" ? s.depart : "",
    ret: typeof s.ret === "string" && s.ret ? s.ret : undefined,
    pax: Number(s.pax) || 1,
    cat: typeof s.cat === "string" ? s.cat : "any",
  }),
  component: SearchPage,
});

function SearchPage() {
  const params = Route.useSearch();
  return (
    <Shell>
      <Results params={params} />
    </Shell>
  );
}

function Results({ params }: { params: Search }) {
  const t = useI18n();
  const { user } = useProfile();
  const [hits, setHits] = useState<JetHit[]>([]);
  const [blocked, setBlocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const dest = findPlace(params.to);
  const from = findPlace(params.from);

  useEffect(() => {
    let dead = false;
    setLoading(true);
    searchJets({ data: params })
      .then((r) => {
        if (dead) return;
        if (!r.ok) {
          setError(r.error);
          setHits([]);
        } else {
          setError("");
          setHits(r.hits);
          setBlocked(r.blocked);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!dead) {
          setError(t.common.error);
          setLoading(false);
        }
      });
    return () => {
      dead = true;
    };
  }, [params.to, params.from, params.depart, params.ret, params.pax, params.cat, t.common.error]);

  useEffect(() => {
    if (!user) return;
    savedIds()
      .then(setSaved)
      .catch(() => {});
  }, [user?.id]);

  const title = from
    ? fill(t.results.route, { from: from.city, city: dest?.city ?? params.to })
    : fill(t.results.to, { city: dest?.city ?? params.to });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs tracking-widest text-muted uppercase">{t.results.kicker}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl md:text-5xl">{title}</h1>
        <button
          type="button"
          className={btnGhost}
          onClick={() => launchSearch(draftFromSearch(params))}
        >
          {t.globe.again}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        {loading
          ? t.common.loading
          : hits.length === 1
            ? fill(t.results.one, { n: hits.length })
            : fill(t.results.many, { n: hits.length })}
        {blocked > 0 ? ` · ${fill(t.results.blocked, { n: blocked })}` : ""}
      </p>
      <p className="text-sm text-muted">{t.results.indicative}</p>
      <div className="mt-6 max-w-xl">
        <SearchForm initial={draftFromSearch(params)} />
      </div>
      {error ? <p className="mt-6 text-accent">{error}</p> : null}
      {!loading && hits.length === 0 ? (
        <div className="mt-10 max-w-lg">
          <h2 className="font-display text-3xl">{t.results.empty}</h2>
          <p className="mt-2 text-muted">{t.results.emptyHint}</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hits.map((jet) => (
            <JetCard
              key={jet.id}
              jet={jet}
              search={{
                to: params.to,
                from: params.from ?? "",
                depart: params.depart,
                ret: params.ret ?? "",
                pax: params.pax,
              }}
              saved={saved.includes(jet.id)}
              onSave={
                user
                  ? () => {
                      void toggleSave({ data: jet.id }).then((r) => {
                        if (!r.ok) return;
                        setSaved((cur) => (r.saved ? [...cur, jet.id] : cur.filter((id) => id !== jet.id)));
                      });
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
