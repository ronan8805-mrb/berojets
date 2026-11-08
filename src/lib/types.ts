export const CATEGORIES = [
  "very-light",
  "light",
  "midsize",
  "super-mid",
  "heavy",
  "ultra",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Role = "customer" | "operator" | "admin";

export type Profile = {
  user_id: string;
  email: string | null;
  display_name: string;
  role: Role;
  suspended: boolean;
  company_name: string | null;
  base_airport: string | null;
  bio: string;
  phone: string;
};

export type Aircraft = {
  id: string;
  operator_id: string;
  name: string;
  model: string;
  category: Category;
  seats: number;
  range_nm: number;
  speed_kts: number;
  year: number;
  home_iata: string;
  home_city: string;
  home_country: string;
  lat: number;
  lng: number;
  hourly_from: number;
  hourly_to: number;
  description: string;
  photo: string;
  featured: boolean;
  active: boolean;
};

export type JetHit = Aircraft & {
  operator_name: string;
  distance_nm: number;
  hours: number;
  price_low: number;
  price_high: number;
  leg: "route" | "base";
  rating_avg: number | null;
  rating_count: number;
};

export type SearchInput = {
  to: string;
  from?: string;
  depart: string;
  ret?: string;
  pax: number;
  cat: string;
};

export type Enquiry = {
  id: string;
  customer_id: string;
  aircraft_id: string;
  operator_id: string;
  origin_label: string;
  dest_label: string;
  dest_iata: string;
  depart: string;
  ret: string | null;
  passengers: number;
  notes: string;
  status: "new" | "quoted" | "won" | "lost";
  created_at: string;
  model: string;
  photo: string;
  home_city: string;
};

export const HOUSE_PHOTOS = [
  "/jets/vl.jpg",
  "/jets/light.jpg",
  "/jets/mid.jpg",
  "/jets/super.jpg",
  "/jets/heavy.jpg",
  "/jets/ultra.jpg",
] as const;
