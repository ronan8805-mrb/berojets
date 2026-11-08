import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CssGlobe, HeroGlobe } from "@/components/flight-overlay";
import { JetCard } from "@/components/jet-card";
import { SearchForm } from "@/components/search-form";
import { Shell, useProfile } from "@/components/shell";
import { fill } from "@/lib/format";
import { listFeatured, publicStats, savedIds, toggleSave } from "@/lib/marketplace.functions";
import type { JetHit } from "@/lib/types";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <HomeBody />
    </Shell>
  );
}

function HomeBody() {
  const t = useI18n();
  const { user } = useProfile();
  const [stats, setStats] = useState({ aircraft: 0, cities: 0 });
  const [jets, setJets] = useState<Array<JetHit>>([]);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    publicStats().then(setStats).catch(() => {});
    listFeatured()
      .then((rows) =>
        setJets(
          rows.map((r) => ({
            ...r,
            distance_nm: 0,
            hours: 0,
            price_low: r.hourly_from,
            price_high: r.hourly_to,
            leg: "base" as const,
            rating_avg: null,
            rating_count: 0,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    savedIds()
      .then(setSaved)
      .catch(() => {});
  }, [user?.id]);

  return (
    <main>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-8 pt-8 md:grid-cols-2 md:pt-14">
        <div>
          <p className="text-xs tracking-widest text-accent uppercase">{t.hero.kicker}</p>
          <h1 className="mt-3 font-display text-5xl leading-none md:text-7xl">
            {t.hero.title} <span className="italic text-accent">{t.hero.titleEm}</span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted">{t.hero.lede}</p>
          <p className="mt-4 text-sm tabular-nums text-muted">
            {fill(t.home.jets, { n: stats.aircraft })} · {fill(t.home.bases, { n: stats.cities })}
          </p>
          <div className="mt-6">
            <SearchForm />
          </div>
        </div>
        <div className="hidden md:block">
          <HeroGlobe />
        </div>
        <div className="md:hidden">
          <CssGlobe />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-3xl">{t.featured}</h2>
          <Link to="/how" className="text-sm text-muted">
            {t.nav.how}
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jets.map((jet) => (
            <JetCard
              key={jet.id}
              jet={jet}
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
        <p className="mt-4 text-xs text-muted">{t.results.indicative}</p>
      </section>
    </main>
  );
}
