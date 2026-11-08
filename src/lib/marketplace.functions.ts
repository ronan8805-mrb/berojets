import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { haversineNm, isIsoDate, quote } from "@/lib/geo";
import { findPlace } from "@/lib/places";
import {
  CATEGORIES,
  HOUSE_PHOTOS,
  type Aircraft,
  type Category,
  type JetHit,
  type Profile,
  type Role,
  type SearchInput,
} from "@/lib/types";

const HOUSE = "bero";
const PHOTOS = new Set<string>(HOUSE_PHOTOS);

async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function flag(v: unknown) {
  return v === true || v === "t" || v === "true" || v === 1;
}
function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function roleOf(v: unknown): Role {
  return v === "operator" || v === "admin" ? v : "customer";
}
function catOf(v: unknown): Category {
  return (CATEGORIES as readonly string[]).includes(String(v)) ? (v as Category) : "light";
}
function clip(s: unknown, n: number) {
  return String(s ?? "").trim().slice(0, n);
}
function okPhoto(s: string) {
  return PHOTOS.has(s) || (/^https:\/\/\S+$/.test(s) && s.length < 400);
}

type PRow = {
  user_id: string;
  email: string | null;
  display_name: string;
  role: string;
  suspended: unknown;
  company_name: string | null;
  base_airport: string | null;
  bio: string;
  phone: string;
};

function mapProfile(r: PRow): Profile {
  return {
    user_id: r.user_id,
    email: r.email,
    display_name: r.display_name ?? "",
    role: roleOf(r.role),
    suspended: flag(r.suspended),
    company_name: r.company_name,
    base_airport: r.base_airport,
    bio: r.bio ?? "",
    phone: r.phone ?? "",
  };
}

type ARow = {
  id: string;
  operator_id: string;
  name: string;
  model: string;
  category: string;
  seats: unknown;
  range_nm: unknown;
  speed_kts: unknown;
  year: unknown;
  home_iata: string;
  home_city: string;
  home_country: string;
  lat: unknown;
  lng: unknown;
  hourly_from: unknown;
  hourly_to: unknown;
  description: string;
  photo: string;
  featured: unknown;
  active: unknown;
  operator_name?: string | null;
};

function mapCraft(r: ARow): Aircraft {
  return {
    id: r.id,
    operator_id: r.operator_id,
    name: r.name,
    model: r.model,
    category: catOf(r.category),
    seats: num(r.seats),
    range_nm: num(r.range_nm),
    speed_kts: num(r.speed_kts),
    year: num(r.year),
    home_iata: r.home_iata,
    home_city: r.home_city,
    home_country: r.home_country,
    lat: num(r.lat),
    lng: num(r.lng),
    hourly_from: num(r.hourly_from),
    hourly_to: num(r.hourly_to),
    description: r.description,
    photo: r.photo,
    featured: flag(r.featured),
    active: flag(r.active),
  };
}

async function audit(actor: string, action: string, target: string, detail: string) {
  const sql = await db();
  await sql`insert into audit_log (actor_id, action, target, detail) values (${actor}, ${action}, ${target}, ${detail})`;
}

async function liveProfile(userId: string) {
  const sql = await db();
  const rows = await sql<PRow>`select user_id, email, display_name, role, suspended, company_name, base_airport, bio, phone from profiles where user_id = ${userId}`;
  const p = rows[0] ? mapProfile(rows[0]) : null;
  if (!p) return { error: "Profile missing" as const, profile: null };
  if (p.suspended) return { error: "Account suspended" as const, profile: null };
  return { error: null, profile: p };
}

export const publicStats = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const a = await sql<{ n: number }>`select count(*)::int as n from aircraft where active = true`;
  const c = await sql<{ n: number }>`select count(distinct home_city)::int as n from aircraft where active = true`;
  return { aircraft: num(a[0]?.n), cities: num(c[0]?.n) };
});

export const listFeatured = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql<ARow>`
    select a.id, a.operator_id, a.name, a.model, a.category, a.seats, a.range_nm, a.speed_kts, a.year,
      a.home_iata, a.home_city, a.home_country, a.lat, a.lng, a.hourly_from, a.hourly_to,
      a.description, a.photo, a.featured, a.active,
      coalesce(p.company_name, p.display_name, '') as operator_name
    from aircraft a
    left join profiles p on p.user_id = a.operator_id
    where a.active = true and a.featured = true
      and (a.operator_id = ${HOUSE} or p.suspended = false)
    order by a.created_at desc
    limit 6`;
  return rows.map((r) => ({ ...mapCraft(r), operator_name: r.operator_name ?? "" }));
});

export const searchJets = createServerFn({ method: "POST" })
  .validator((input: SearchInput) => input)
  .handler(async ({ data }) => {
    const dest = findPlace(data.to);
    if (!dest) return { ok: false as const, error: "Unknown destination" };
    if (!isIsoDate(data.depart)) return { ok: false as const, error: "Bad date" };
    const ret = data.ret && data.ret.length > 0 ? data.ret : "";
    if (ret && (!isIsoDate(ret) || ret < data.depart)) return { ok: false as const, error: "Bad date" };
    const pax = Math.min(19, Math.max(1, Math.round(num(data.pax))));
    const cat = data.cat === "any" || (CATEGORIES as readonly string[]).includes(data.cat) ? data.cat : "any";
    const origin = data.from ? findPlace(data.from) : null;
    const end = ret || data.depart;
    const sql = await db();
    const rows = await sql<ARow>`
      select a.id, a.operator_id, a.name, a.model, a.category, a.seats, a.range_nm, a.speed_kts, a.year,
        a.home_iata, a.home_city, a.home_country, a.lat, a.lng, a.hourly_from, a.hourly_to,
        a.description, a.photo, a.featured, a.active,
        coalesce(p.company_name, p.display_name, '') as operator_name
      from aircraft a
      left join profiles p on p.user_id = a.operator_id
      where a.active = true
        and (a.operator_id = ${HOUSE} or (p.user_id is not null and p.suspended = false))`;
    const blocks = await sql<{ aircraft_id: string }>`
      select aircraft_id from availability_blocks
      where day >= ${data.depart}::date and day <= ${end}::date`;
    const blockedIds = new Set(blocks.map((b) => b.aircraft_id));
    const ratings = await sql<{ operator_id: string; avg: unknown; n: unknown }>`
      select operator_id, avg(rating)::float as avg, count(*)::int as n
      from reviews where hidden = false group by operator_id`;
    const rate = new Map(ratings.map((r) => [r.operator_id, { avg: num(r.avg), n: num(r.n) }]));
    let blocked = 0;
    const hits: JetHit[] = [];
    for (const row of rows) {
      const craft = mapCraft(row);
      if (craft.seats < pax) continue;
      if (cat !== "any" && craft.category !== cat) continue;
      const sectorNm = origin
        ? haversineNm(origin, dest)
        : haversineNm({ lat: craft.lat, lng: craft.lng }, dest);
      if (origin && craft.range_nm < sectorNm * 1.08) continue;
      if (blockedIds.has(craft.id)) {
        blocked += 1;
        continue;
      }
      const priced = quote(craft.hourly_from, craft.hourly_to, Math.max(sectorNm, 80), craft.speed_kts);
      const rating = rate.get(craft.operator_id);
      hits.push({
        ...craft,
        operator_name: row.operator_name ?? "",
        distance_nm: Math.round(haversineNm({ lat: craft.lat, lng: craft.lng }, dest)),
        hours: priced.hours,
        price_low: priced.price_low,
        price_high: priced.price_high,
        leg: origin ? "route" : "base",
        rating_avg: rating && rating.n > 0 ? Math.round(rating.avg * 10) / 10 : null,
        rating_count: rating?.n ?? 0,
      });
    }
    hits.sort((a, b) => Number(b.featured) - Number(a.featured) || a.distance_nm - b.distance_nm);
    return { ok: true as const, hits, blocked, dest: dest.city };
  });

export const getJet = createServerFn({ method: "POST" })
  .validator((id: string) => clip(id, 80))
  .handler(async ({ data: id }) => {
    const sql = await db();
    const rows = await sql<ARow>`
      select a.id, a.operator_id, a.name, a.model, a.category, a.seats, a.range_nm, a.speed_kts, a.year,
        a.home_iata, a.home_city, a.home_country, a.lat, a.lng, a.hourly_from, a.hourly_to,
        a.description, a.photo, a.featured, a.active,
        coalesce(p.company_name, p.display_name, '') as operator_name
      from aircraft a
      left join profiles p on p.user_id = a.operator_id
      where a.id = ${id} and a.active = true
        and (a.operator_id = ${HOUSE} or (p.user_id is not null and p.suspended = false))`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Missing" };
    const reviews = await sql<{ rating: unknown; body: string; display_name: string | null; created_at: string }>`
      select r.rating, r.body, pr.display_name, r.created_at::text as created_at
      from reviews r
      left join profiles pr on pr.user_id = r.customer_id
      where r.aircraft_id = ${id} and r.hidden = false
      order by r.created_at desc
      limit 8`;
    const avg = await sql<{ avg: unknown; n: unknown }>`
      select avg(rating)::float as avg, count(*)::int as n from reviews
      where aircraft_id = ${id} and hidden = false`;
    return {
      ok: true as const,
      jet: { ...mapCraft(row), operator_name: row.operator_name ?? "" },
      reviews: reviews.map((r) => ({
        rating: num(r.rating),
        body: r.body,
        name: r.display_name || "Traveller",
        created_at: r.created_at,
      })),
      rating_avg: num(avg[0]?.n) ? Math.round(num(avg[0]?.avg) * 10) / 10 : null,
      rating_count: num(avg[0]?.n),
    };
  });

export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string | null; email: string | null }) => ({
    displayName: clip(input?.displayName, 80),
    email: clip(input?.email, 160),
  }))
  .handler(async ({ context, data }) => {
    const sql = await db();
    await sql`
      insert into profiles (user_id, email, display_name, role)
      values (${context.userId}, ${data.email || null}, ${data.displayName}, 'customer')
      on conflict (user_id) do update set
        email = coalesce(excluded.email, profiles.email),
        display_name = case when profiles.display_name = '' then excluded.display_name else profiles.display_name end`;
    await sql`
      update profiles set role = 'admin'
      where user_id = ${context.userId}
        and role = 'customer'
        and not exists (select 1 from profiles p where p.role = 'admin' and p.user_id <> ${context.userId})`;
    const rows = await sql<PRow>`select user_id, email, display_name, role, suspended, company_name, base_airport, bio, phone from profiles where user_id = ${context.userId}`;
    return mapProfile(rows[0]);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string; bio: string; phone: string }) => ({
    displayName: clip(input?.displayName, 80),
    bio: clip(input?.bio, 500),
    phone: clip(input?.phone, 40),
  }))
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error };
    const sql = await db();
    await sql`
      update profiles set display_name = ${data.displayName}, bio = ${data.bio}, phone = ${data.phone}
      where user_id = ${context.userId}`;
    const rows = await sql<PRow>`select user_id, email, display_name, role, suspended, company_name, base_airport, bio, phone from profiles where user_id = ${context.userId}`;
    return { ok: true as const, profile: mapProfile(rows[0]) };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const id = context.userId;
    await audit(id, "delete_account", id, "");
    await sql`delete from messages where enquiry_id in (select id from enquiries where customer_id = ${id})`;
    await sql`delete from reviews where customer_id = ${id}`;
    await sql`delete from enquiries where customer_id = ${id}`;
    await sql`update messages set body = '' where sender_id = ${id}`;
    await sql`delete from saved_jets where user_id = ${id}`;
    await sql`delete from customer_notes where customer_id = ${id} or operator_id = ${id}`;
    await sql`delete from team_invites where operator_id = ${id}`;
    await sql`update aircraft set active = false where operator_id = ${id}`;
    await sql`delete from profiles where user_id = ${id}`;
    return { ok: true as const };
  });

export const toggleSave = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => clip(id, 80))
  .handler(async ({ context, data: aircraftId }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error, saved: false };
    const sql = await db();
    const existing = await sql<{ aircraft_id: string }>`select aircraft_id from saved_jets where user_id = ${context.userId} and aircraft_id = ${aircraftId}`;
    if (existing[0]) {
      await sql`delete from saved_jets where user_id = ${context.userId} and aircraft_id = ${aircraftId}`;
      return { ok: true as const, saved: false };
    }
    await sql`insert into saved_jets (user_id, aircraft_id) values (${context.userId}, ${aircraftId})`;
    return { ok: true as const, saved: true };
  });

export const listSaved = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<ARow>`
      select a.id, a.operator_id, a.name, a.model, a.category, a.seats, a.range_nm, a.speed_kts, a.year,
        a.home_iata, a.home_city, a.home_country, a.lat, a.lng, a.hourly_from, a.hourly_to,
        a.description, a.photo, a.featured, a.active
      from saved_jets s
      join aircraft a on a.id = s.aircraft_id
      where s.user_id = ${context.userId}
      order by s.created_at desc`;
    return rows.map(mapCraft);
  });

export const savedIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const rows = await sql<{ aircraft_id: string }>`select aircraft_id from saved_jets where user_id = ${context.userId}`;
    return rows.map((r) => r.aircraft_id);
  });

type EnquiryIn = {
  aircraftId: string;
  originLabel: string;
  destLabel: string;
  destIata: string;
  destLat: number;
  destLng: number;
  depart: string;
  ret?: string;
  passengers: number;
  notes: string;
};

export const createEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: EnquiryIn) => input)
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const dest = findPlace(data.destIata);
    if (!dest || !isIsoDate(data.depart)) return { ok: false as const, error: "Bad route" };
    const ret = data.ret && isIsoDate(data.ret) ? data.ret : null;
    if (ret && ret < data.depart) return { ok: false as const, error: "Bad date" };
    const sql = await db();
    const jets = await sql<{ operator_id: string; active: unknown }>`select operator_id, active from aircraft where id = ${clip(data.aircraftId, 80)}`;
    const jet = jets[0];
    if (!jet || !flag(jet.active)) return { ok: false as const, error: "That jet is not listed" };
    const id = crypto.randomUUID();
    const notes = clip(data.notes, 2000);
    const pax = Math.min(19, Math.max(1, Math.round(num(data.passengers))));
    await sql`
      insert into enquiries (id, customer_id, aircraft_id, operator_id, origin_label, dest_label, dest_iata, dest_lat, dest_lng, depart, ret, passengers, notes)
      values (
        ${id}, ${context.userId}, ${clip(data.aircraftId, 80)}, ${jet.operator_id},
        ${clip(data.originLabel, 120)}, ${dest.city}, ${dest.iata}, ${dest.lat}, ${dest.lng},
        ${data.depart}::date, ${ret}::date, ${pax}, ${notes}
      )`;
    if (notes) {
      await sql`insert into messages (enquiry_id, sender_id, body) values (${id}, ${context.userId}, ${notes})`;
    }
    return { ok: true as const, id };
  });

type TripRow = {
  id: string;
  customer_id: string;
  aircraft_id: string;
  operator_id: string;
  origin_label: string;
  dest_label: string;
  dest_iata: string;
  depart: string;
  ret: string | null;
  passengers: unknown;
  notes: string;
  status: string;
  created_at: string;
  model: string;
  photo: string;
  home_city: string;
};

function mapTrip(r: TripRow) {
  const status = r.status === "quoted" || r.status === "won" || r.status === "lost" ? r.status : "new";
  return {
    id: r.id,
    customer_id: r.customer_id,
    aircraft_id: r.aircraft_id,
    operator_id: r.operator_id,
    origin_label: r.origin_label,
    dest_label: r.dest_label,
    dest_iata: r.dest_iata,
    depart: String(r.depart).slice(0, 10),
    ret: r.ret ? String(r.ret).slice(0, 10) : null,
    passengers: num(r.passengers),
    notes: r.notes,
    status,
    created_at: r.created_at,
    model: r.model,
    photo: r.photo,
    home_city: r.home_city,
  };
}

export const listTrips = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return [];
    const sql = await db();
    const me = context.userId;
    const admin = gate.profile.role === "admin";
    const rows = await sql<TripRow>`
      select e.id, e.customer_id, e.aircraft_id, e.operator_id, e.origin_label, e.dest_label, e.dest_iata,
        e.depart::text as depart, e.ret::text as ret, e.passengers, e.notes, e.status, e.created_at::text as created_at,
        a.model, a.photo, a.home_city
      from enquiries e
      join aircraft a on a.id = e.aircraft_id
      where e.customer_id = ${me} or e.operator_id = ${me} or ${admin} = true
      order by e.created_at desc
      limit 100`;
    return rows.map(mapTrip);
  });

export const getEnquiry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    const rows = await sql<TripRow>`
      select e.id, e.customer_id, e.aircraft_id, e.operator_id, e.origin_label, e.dest_label, e.dest_iata,
        e.depart::text as depart, e.ret::text as ret, e.passengers, e.notes, e.status, e.created_at::text as created_at,
        a.model, a.photo, a.home_city
      from enquiries e
      join aircraft a on a.id = e.aircraft_id
      where e.id = ${id}`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Missing" };
    const trip = mapTrip(row);
    const allowed =
      trip.customer_id === context.userId ||
      trip.operator_id === context.userId ||
      gate.profile.role === "admin";
    if (!allowed) return { ok: false as const, error: "Missing" };
    const messages = await sql<{ id: number; sender_id: string; body: string; created_at: string }>`
      select id, sender_id, body, created_at::text as created_at from messages
      where enquiry_id = ${id} order by id asc`;
    const customer = await sql<{ display_name: string }>`select display_name from profiles where user_id = ${trip.customer_id}`;
    const operator = await sql<{ company_name: string | null; display_name: string }>`select company_name, display_name from profiles where user_id = ${trip.operator_id}`;
    const canModerate = trip.operator_id === context.userId || gate.profile.role === "admin";
    let reliability: { avg: number; count: number } | null = null;
    let myNote: { rating: number; note: string } | null = null;
    if (canModerate) {
      const rel = await sql<{ avg: unknown; n: unknown }>`
        select avg(rating)::float as avg, count(*)::int as n from customer_notes where customer_id = ${trip.customer_id}`;
      if (num(rel[0]?.n) > 0) reliability = { avg: Math.round(num(rel[0]?.avg) * 10) / 10, count: num(rel[0]?.n) };
      const note = await sql<{ rating: unknown; note: string }>`
        select rating, note from customer_notes where operator_id = ${context.userId} and customer_id = ${trip.customer_id}`;
      if (note[0]) myNote = { rating: num(note[0].rating), note: note[0].note };
    }
    const review = await sql<{ rating: unknown; body: string }>`select rating, body from reviews where enquiry_id = ${id}`;
    return {
      ok: true as const,
      trip,
      messages,
      customer_name: customer[0]?.display_name || "Traveller",
      operator_name: trip.operator_id === HOUSE ? "" : operator[0]?.company_name || operator[0]?.display_name || "",
      can_moderate: canModerate,
      is_customer: trip.customer_id === context.userId,
      reliability,
      my_note: myNote,
      review: review[0] ? { rating: num(review[0].rating), body: review[0].body } : null,
      viewer_id: context.userId,
    };
  });

export const postMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; body: string }) => ({ id: clip(input?.id, 80), body: clip(input?.body, 2000) }))
  .handler(async ({ context, data }) => {
    if (!data.body) return { ok: false as const, error: "Empty" };
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    const rows = await sql<{ customer_id: string; operator_id: string }>`select customer_id, operator_id from enquiries where id = ${data.id}`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Missing" };
    const allowed = row.customer_id === context.userId || row.operator_id === context.userId || gate.profile.role === "admin";
    if (!allowed) return { ok: false as const, error: "Missing" };
    await sql`insert into messages (enquiry_id, sender_id, body) values (${data.id}, ${context.userId}, ${data.body})`;
    return { ok: true as const };
  });

export const setStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => ({
    id: clip(input?.id, 80),
    status: input?.status,
  }))
  .handler(async ({ context, data }) => {
    const status = data.status;
    if (status !== "new" && status !== "quoted" && status !== "won" && status !== "lost") {
      return { ok: false as const, error: "Bad status" };
    }
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    const rows = await sql<{ operator_id: string }>`select operator_id from enquiries where id = ${data.id}`;
    const row = rows[0];
    if (!row) return { ok: false as const, error: "Missing" };
    if (row.operator_id !== context.userId && gate.profile.role !== "admin") {
      return { ok: false as const, error: "Not your trip" };
    }
    await sql`update enquiries set status = ${status} where id = ${data.id}`;
    return { ok: true as const };
  });

export const createReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; rating: number; body: string }) => ({
    id: clip(input?.id, 80),
    rating: Math.round(num(input?.rating)),
    body: clip(input?.body, 600),
  }))
  .handler(async ({ context, data }) => {
    if (data.rating < 1 || data.rating > 5) return { ok: false as const, error: "Rating" };
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    const rows = await sql<{ customer_id: string; operator_id: string; aircraft_id: string; status: string }>`
      select customer_id, operator_id, aircraft_id, status from enquiries where id = ${data.id}`;
    const row = rows[0];
    if (!row || row.customer_id !== context.userId) return { ok: false as const, error: "Not yours" };
    if (row.status !== "won") return { ok: false as const, error: "Trip is not marked flown" };
    await sql`
      insert into reviews (id, enquiry_id, customer_id, operator_id, aircraft_id, rating, body)
      values (${crypto.randomUUID()}, ${data.id}, ${context.userId}, ${row.operator_id}, ${row.aircraft_id}, ${data.rating}, ${data.body})
      on conflict (enquiry_id) do nothing`;
    return { ok: true as const };
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { customerId: string; rating: number; note: string }) => ({
    customerId: clip(input?.customerId, 80),
    rating: Math.round(num(input?.rating)),
    note: clip(input?.note, 500),
  }))
  .handler(async ({ context, data }) => {
    if (data.rating < 1 || data.rating > 5) return { ok: false as const, error: "Rating" };
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    if (gate.profile.role === "customer") return { ok: false as const, error: "Operators only" };
    const sql = await db();
    await sql`
      insert into customer_notes (operator_id, customer_id, rating, note)
      values (${context.userId}, ${data.customerId}, ${data.rating}, ${data.note})
      on conflict (operator_id, customer_id) do update set rating = excluded.rating, note = excluded.note, updated_at = now()`;
    return { ok: true as const };
  });

export const becomeOperator = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { company: string; base: string }) => ({
    company: clip(input?.company, 120),
    base: clip(input?.base, 12).toUpperCase(),
  }))
  .handler(async ({ context, data }) => {
    if (data.company.length < 2) return { ok: false as const, error: "Company" };
    if (!findPlace(data.base)) return { ok: false as const, error: "Base" };
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    await sql`
      update profiles set
        role = case when role = 'admin' then 'admin' else 'operator' end,
        company_name = ${data.company},
        base_airport = ${data.base}
      where user_id = ${context.userId}`;
    await audit(context.userId, "become_operator", context.userId, data.company);
    const rows = await sql<PRow>`select user_id, email, display_name, role, suspended, company_name, base_airport, bio, phone from profiles where user_id = ${context.userId}`;
    return { ok: true as const, profile: mapProfile(rows[0]) };
  });

export const joinTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((code: string) => clip(code, 12).toUpperCase())
  .handler(async ({ context, data: code }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    const inv = await sql<{ operator_id: string }>`select operator_id from team_invites where code = ${code}`;
    if (!inv[0]) return { ok: false as const, error: "Bad code" };
    const host = await sql<{ company_name: string | null; base_airport: string | null }>`
      select company_name, base_airport from profiles where user_id = ${inv[0].operator_id}`;
    await sql`
      update profiles set
        role = case when role = 'admin' then 'admin' else 'operator' end,
        company_name = ${host[0]?.company_name ?? ""},
        base_airport = ${host[0]?.base_airport ?? null}
      where user_id = ${context.userId}`;
    const rows = await sql<PRow>`select user_id, email, display_name, role, suspended, company_name, base_airport, bio, phone from profiles where user_id = ${context.userId}`;
    return { ok: true as const, profile: mapProfile(rows[0]) };
  });

export const createInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || (gate.profile.role !== "operator" && gate.profile.role !== "admin")) {
      return { ok: false as const, error: "Operators only" };
    }
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    const sql = await db();
    await sql`insert into team_invites (code, operator_id) values (${code}, ${context.userId})`;
    return { ok: true as const, code };
  });

export const listFleet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return [];
    const sql = await db();
    const rows = await sql<ARow>`
      select id, operator_id, name, model, category, seats, range_nm, speed_kts, year,
        home_iata, home_city, home_country, lat, lng, hourly_from, hourly_to,
        description, photo, featured, active
      from aircraft where operator_id = ${context.userId}
      order by created_at desc`;
    return rows.map(mapCraft);
  });

export const listCalendarCraft = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return [];
    const sql = await db();
    const admin = gate.profile.role === "admin";
    const rows = await sql<ARow>`
      select id, operator_id, name, model, category, seats, range_nm, speed_kts, year,
        home_iata, home_city, home_country, lat, lng, hourly_from, hourly_to,
        description, photo, featured, active
      from aircraft
      where operator_id = ${context.userId} or (${admin} = true and operator_id = ${HOUSE})
      order by name`;
    return rows.map(mapCraft);
  });

type JetIn = {
  id?: string;
  name: string;
  model: string;
  category: string;
  seats: number;
  range_nm: number;
  speed_kts: number;
  year: number;
  home_iata: string;
  hourly_from: number;
  hourly_to: number;
  description: string;
  photo: string;
  active: boolean;
};

export const saveAircraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: JetIn) => input)
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || (gate.profile.role !== "operator" && gate.profile.role !== "admin")) {
      return { ok: false as const, error: "Operators only" };
    }
    const place = findPlace(data.home_iata);
    if (!place) return { ok: false as const, error: "Base" };
    const category = catOf(data.category);
    const seats = Math.round(num(data.seats));
    const range = Math.round(num(data.range_nm));
    const speed = Math.round(num(data.speed_kts));
    const year = Math.round(num(data.year));
    const lo = Math.round(num(data.hourly_from));
    const hi = Math.round(num(data.hourly_to));
    if (seats < 1 || seats > 19 || range < 300 || range > 9000 || speed < 200 || speed > 700) {
      return { ok: false as const, error: "Check the numbers" };
    }
    if (year < 1990 || year > 2027 || lo < 500 || hi < lo || hi > 80000) {
      return { ok: false as const, error: "Check the numbers" };
    }
    const photo = okPhoto(clip(data.photo, 400)) ? clip(data.photo, 400) : "/jets/light.jpg";
    const name = clip(data.name, 80);
    const model = clip(data.model, 80);
    const description = clip(data.description, 800);
    if (!name || !model) return { ok: false as const, error: "Name" };
    const sql = await db();
    const id = clip(data.id, 80);
    if (id) {
      const own = await sql<{ operator_id: string }>`select operator_id from aircraft where id = ${id}`;
      if (!own[0] || own[0].operator_id !== context.userId) return { ok: false as const, error: "Not yours" };
      await sql`
        update aircraft set name = ${name}, model = ${model}, category = ${category}, seats = ${seats},
          range_nm = ${range}, speed_kts = ${speed}, year = ${year}, home_iata = ${place.iata},
          home_city = ${place.city}, home_country = ${place.country}, lat = ${place.lat}, lng = ${place.lng},
          hourly_from = ${lo}, hourly_to = ${hi}, description = ${description}, photo = ${photo},
          active = ${Boolean(data.active)}
        where id = ${id} and operator_id = ${context.userId}`;
      return { ok: true as const, id };
    }
    const fresh = `j_${crypto.randomUUID().slice(0, 8)}`;
    await sql`
      insert into aircraft (
        id, operator_id, name, model, category, seats, range_nm, speed_kts, year,
        home_iata, home_city, home_country, lat, lng, hourly_from, hourly_to, description, photo, featured, active
      ) values (
        ${fresh}, ${context.userId}, ${name}, ${model}, ${category}, ${seats}, ${range}, ${speed}, ${year},
        ${place.iata}, ${place.city}, ${place.country}, ${place.lat}, ${place.lng}, ${lo}, ${hi},
        ${description}, ${photo}, false, ${Boolean(data.active)}
      )`;
    return { ok: true as const, id: fresh };
  });

export const removeAircraft = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => clip(id, 80))
  .handler(async ({ context, data: id }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope" };
    const sql = await db();
    const rows = await sql<{ operator_id: string }>`select operator_id from aircraft where id = ${id}`;
    if (!rows[0]) return { ok: false as const, error: "Missing" };
    const admin = gate.profile.role === "admin";
    if (rows[0].operator_id !== context.userId && !admin) return { ok: false as const, error: "Not yours" };
    const n = await sql<{ n: number }>`select count(*)::int as n from enquiries where aircraft_id = ${id}`;
    if (num(n[0]?.n) > 0) {
      await sql`update aircraft set active = false where id = ${id}`;
    } else {
      await sql`delete from aircraft where id = ${id}`;
    }
    await audit(context.userId, "remove_aircraft", id, "");
    return { ok: true as const };
  });

export const monthBlocks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { aircraftId: string; start: string; end: string }) => ({
    aircraftId: clip(input?.aircraftId, 80),
    start: clip(input?.start, 10),
    end: clip(input?.end, 10),
  }))
  .handler(async ({ context, data }) => {
    if (!isIsoDate(data.start) || !isIsoDate(data.end)) return [];
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return [];
    const sql = await db();
    const own = await sql<{ operator_id: string }>`select operator_id from aircraft where id = ${data.aircraftId}`;
    if (!own[0]) return [];
    const allowed = own[0].operator_id === context.userId || gate.profile.role === "admin";
    if (!allowed) return [];
    const rows = await sql<{ day: string }>`
      select day::text as day from availability_blocks
      where aircraft_id = ${data.aircraftId} and day >= ${data.start}::date and day <= ${data.end}::date`;
    return rows.map((r) => String(r.day).slice(0, 10));
  });

export const toggleDay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { aircraftId: string; day: string }) => ({
    aircraftId: clip(input?.aircraftId, 80),
    day: clip(input?.day, 10),
  }))
  .handler(async ({ context, data }) => {
    if (!isIsoDate(data.day)) return { ok: false as const, error: "Date", blocked: false };
    const gate = await liveProfile(context.userId);
    if (!gate.profile) return { ok: false as const, error: gate.error ?? "Nope", blocked: false };
    const sql = await db();
    const own = await sql<{ operator_id: string }>`select operator_id from aircraft where id = ${data.aircraftId}`;
    if (!own[0]) return { ok: false as const, error: "Missing", blocked: false };
    if (own[0].operator_id !== context.userId && gate.profile.role !== "admin") {
      return { ok: false as const, error: "Not yours", blocked: false };
    }
    const existing = await sql<{ day: string }>`
      select day::text as day from availability_blocks where aircraft_id = ${data.aircraftId} and day = ${data.day}::date`;
    if (existing[0]) {
      await sql`delete from availability_blocks where aircraft_id = ${data.aircraftId} and day = ${data.day}::date`;
      return { ok: true as const, blocked: false };
    }
    await sql`insert into availability_blocks (aircraft_id, day) values (${data.aircraftId}, ${data.day}::date)`;
    return { ok: true as const, blocked: true };
  });

export const operatorStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await db();
    const id = context.userId;
    const total = await sql<{ n: number }>`select count(*)::int as n from enquiries where operator_id = ${id}`;
    const replied = await sql<{ n: number }>`
      select count(*)::int as n from enquiries e
      where e.operator_id = ${id}
        and exists (select 1 from messages m where m.enquiry_id = e.id and m.sender_id = ${id})`;
    const won = await sql<{ n: number }>`select count(*)::int as n from enquiries where operator_id = ${id} and status = 'won'`;
    const t = num(total[0]?.n);
    const r = num(replied[0]?.n);
    return { enquiries: t, responded: r, won: num(won[0]?.n), response_rate: t ? Math.round((r / t) * 100) : 0 };
  });

export const adminBundle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || gate.profile.role !== "admin") return { ok: false as const, error: "Not admin" };
    const sql = await db();
    const users = (await sql<PRow>`select user_id, email, display_name, role, suspended, company_name, base_airport, bio, phone from profiles order by created_at desc limit 200`).map(mapProfile);
    const aircraft = (await sql<ARow>`
      select id, operator_id, name, model, category, seats, range_nm, speed_kts, year,
        home_iata, home_city, home_country, lat, lng, hourly_from, hourly_to,
        description, photo, featured, active
      from aircraft order by created_at desc`).map(mapCraft);
    const reviews = await sql<{ id: string; rating: unknown; body: string; hidden: unknown; name: string | null; model: string }>`
      select r.id, r.rating, r.body, r.hidden, p.display_name as name, a.model
      from reviews r
      left join profiles p on p.user_id = r.customer_id
      left join aircraft a on a.id = r.aircraft_id
      order by r.created_at desc limit 40`;
    const auditRows = await sql<{ id: number; action: string; target: string; detail: string; created_at: string; actor: string }>`
      select id, action, target, detail, created_at::text as created_at, actor_id as actor
      from audit_log order by id desc limit 40`;
    const counts = await sql<{ users: number; enquiries: number; won: number; aircraft: number }>`
      select
        (select count(*)::int from profiles) as users,
        (select count(*)::int from enquiries) as enquiries,
        (select count(*)::int from enquiries where status = 'won') as won,
        (select count(*)::int from aircraft where active = true) as aircraft`;
    return {
      ok: true as const,
      stats: {
        users: num(counts[0]?.users),
        enquiries: num(counts[0]?.enquiries),
        won: num(counts[0]?.won),
        aircraft: num(counts[0]?.aircraft),
      },
      users,
      aircraft,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: num(r.rating),
        body: r.body,
        hidden: flag(r.hidden),
        name: r.name || "Traveller",
        model: r.model || "",
      })),
      audit: auditRows,
    };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; role: string }) => ({
    userId: clip(input?.userId, 80),
    role: input?.role,
  }))
  .handler(async ({ context, data }) => {
    const role = roleOf(data.role);
    if (data.role !== "customer" && data.role !== "operator" && data.role !== "admin") {
      return { ok: false as const, error: "Role" };
    }
    const gate = await liveProfile(context.userId);
    if (!gate.profile || gate.profile.role !== "admin") return { ok: false as const, error: "Not admin" };
    if (data.userId === context.userId && data.role !== "admin") return { ok: false as const, error: "Keep one admin" };
    const sql = await db();
    await sql`update profiles set role = ${data.role} where user_id = ${data.userId}`;
    await audit(context.userId, "set_role", data.userId, data.role);
    return { ok: true as const };
  });

export const adminSuspend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; suspended: boolean }) => ({
    userId: clip(input?.userId, 80),
    suspended: Boolean(input?.suspended),
  }))
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || gate.profile.role !== "admin") return { ok: false as const, error: "Not admin" };
    if (data.userId === context.userId) return { ok: false as const, error: "Not yourself" };
    const sql = await db();
    await sql`update profiles set suspended = ${data.suspended} where user_id = ${data.userId}`;
    await audit(context.userId, data.suspended ? "suspend" : "restore", data.userId, "");
    return { ok: true as const };
  });

export const adminFeature = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; featured: boolean }) => ({
    id: clip(input?.id, 80),
    featured: Boolean(input?.featured),
  }))
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || gate.profile.role !== "admin") return { ok: false as const, error: "Not admin" };
    const sql = await db();
    await sql`update aircraft set featured = ${data.featured} where id = ${data.id}`;
    await audit(context.userId, data.featured ? "feature" : "unfeature", data.id, "");
    return { ok: true as const };
  });

export const adminActive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; active: boolean }) => ({
    id: clip(input?.id, 80),
    active: Boolean(input?.active),
  }))
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || gate.profile.role !== "admin") return { ok: false as const, error: "Not admin" };
    const sql = await db();
    await sql`update aircraft set active = ${data.active} where id = ${data.id}`;
    await audit(context.userId, data.active ? "activate" : "deactivate", data.id, "");
    return { ok: true as const };
  });

export const adminHideReview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; hidden: boolean }) => ({
    id: clip(input?.id, 80),
    hidden: Boolean(input?.hidden),
  }))
  .handler(async ({ context, data }) => {
    const gate = await liveProfile(context.userId);
    if (!gate.profile || gate.profile.role !== "admin") return { ok: false as const, error: "Not admin" };
    const sql = await db();
    await sql`update reviews set hidden = ${data.hidden} where id = ${data.id}`;
    await audit(context.userId, data.hidden ? "hide_review" : "show_review", data.id, "");
    return { ok: true as const };
  });
