import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { useI18n } from "@/lib/use-i18n";

export const Route = createFileRoute("/how")({ component: How });

function How() {
  const t = useI18n();
  const steps = [
    [t.how.s1t, t.how.s1],
    [t.how.s2t, t.how.s2],
    [t.how.s3t, t.how.s3],
  ];
  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs tracking-widest text-accent uppercase">{t.how.kicker}</p>
        <h1 className="mt-3 font-display text-5xl">{t.how.title}</h1>
        <ol className="mt-10 space-y-8">
          {steps.map(([title, body], i) => (
            <li key={title} className="border-t border-line pt-6">
              <p className="text-xs tabular-nums text-muted">0{i + 1}</p>
              <h2 className="mt-1 font-display text-3xl">{title}</h2>
              <p className="mt-2 max-w-xl text-muted">{body}</p>
            </li>
          ))}
        </ol>
        <section className="mt-12 rounded-3xl border border-line bg-surface p-6">
          <h2 className="font-display text-2xl">{t.how.feeT}</h2>
          <p className="mt-2 text-muted">{t.how.fee}</p>
        </section>
      </main>
    </Shell>
  );
}
