import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { Shell, useProfile } from "@/components/shell";
import { Gate } from "@/components/shell";
import { btn, btnGhost, field, labelCls } from "@/components/ui";
import {
  becomeOperator,
  deleteAccount,
  joinTeam,
  listSaved,
  updateProfile,
} from "@/lib/marketplace.functions";
import { useI18n } from "@/lib/use-i18n";
import type { Aircraft } from "@/lib/types";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  return (
    <Shell>
      <Gate>
        <AccountBody />
      </Gate>
    </Shell>
  );
}

function AccountBody() {
  const t = useI18n();
  const { profile, setProfile } = useProfile();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState<Aircraft[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [code, setCode] = useState("");
  const [company, setCompany] = useState(profile?.company_name ?? "");
  const [base, setBase] = useState(profile?.base_airport ?? "");

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name);
    setBio(profile.bio);
    setPhone(profile.phone);
    setCompany(profile.company_name ?? "");
    setBase(profile.base_airport ?? "");
  }, [profile?.user_id]);

  useEffect(() => {
    listSaved().then(setSaved).catch(() => {});
  }, []);

  if (!profile) return <p className="px-4 py-16 text-muted">{t.common.loading}</p>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-5xl">{t.account.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {t.account.role}: {t.roles[profile.role]}
        {profile.email ? ` · ${profile.email}` : ""}
      </p>
      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void updateProfile({ data: { displayName: name, bio, phone } }).then((r) => {
            if (r.ok) {
              setProfile(r.profile);
              setMsg(t.account.savedOk);
            }
          });
        }}
      >
        <label className="block">
          <span className={labelCls}>{t.account.name}</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>{t.account.phone}</span>
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>{t.account.bio}</span>
          <textarea className={`${field} h-24 py-3`} value={bio} placeholder={t.account.bioPh} onChange={(e) => setBio(e.target.value)} />
        </label>
        <button className={btn} type="submit">{t.account.save}</button>
        {msg ? <p className="text-sm text-good">{msg}</p> : null}
      </form>

      {profile.role === "customer" ? (
        <form
          className="mt-10 space-y-3 border-t border-line pt-8"
          onSubmit={(e) => {
            e.preventDefault();
            void becomeOperator({ data: { company, base } }).then((r) => {
              if (!r.ok) setMsg(r.error);
              else {
                setProfile(r.profile);
                setMsg(t.account.savedOk);
              }
            });
          }}
        >
          <h2 className="font-display text-3xl">{t.fleet.becomeTitle}</h2>
          <p className="text-sm text-muted">{t.fleet.becomeBody}</p>
          <label className="block">
            <span className={labelCls}>{t.fleet.company}</span>
            <input className={field} value={company} placeholder={t.fleet.companyPh} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>{t.fleet.base}</span>
            <input className={field} value={base} placeholder="LTN" onChange={(e) => setBase(e.target.value)} />
          </label>
          <button className={btn} type="submit">{t.fleet.apply}</button>
        </form>
      ) : null}

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void joinTeam({ data: code }).then((r) => {
            if (!r.ok) setMsg(t.account.badCode);
            else {
              setProfile(r.profile);
              setMsg(t.account.joined);
            }
          });
        }}
      >
        <label className="block flex-1">
          <span className={labelCls}>{t.account.team}</span>
          <input className={field} value={code} placeholder={t.account.codePh} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button className={`${btnGhost} mt-6`} type="submit">{t.account.join}</button>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-3xl">{t.account.jets}</h2>
        {saved.length === 0 ? <p className="mt-2 text-muted">{t.account.noneSaved}</p> : null}
        <ul className="mt-3 space-y-2">
          {saved.map((j) => (
            <li key={j.id}>
              <Link to="/jets/$jetId" params={{ jetId: j.id }} search={{ to: "", from: "", depart: "", ret: "", pax: 0 }} className="text-fg">
                {j.name} · {j.home_city}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border-t border-line pt-8">
        {!confirm ? (
          <button type="button" className="text-sm text-accent" onClick={() => setConfirm(true)}>
            {t.account.delete}
          </button>
        ) : (
          <div>
            <p className="text-sm text-muted">{t.account.deleteWarn}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className={btn}
                onClick={() => {
                  void deleteAccount().then(() => signOut().catch(() => window.location.assign("/")));
                }}
              >
                {t.account.confirmDel}
              </button>
              <button type="button" className={btnGhost} onClick={() => setConfirm(false)}>
                {t.account.cancel}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
