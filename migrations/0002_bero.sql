create table if not exists profiles (
  user_id text primary key,
  email text,
  display_name text not null default '',
  role text not null default 'customer',
  suspended boolean not null default false,
  company_name text,
  base_airport text,
  bio text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists aircraft (
  id text primary key,
  operator_id text not null,
  name text not null,
  model text not null,
  category text not null,
  seats integer not null,
  range_nm integer not null,
  speed_kts integer not null,
  year integer not null,
  home_iata text not null,
  home_city text not null,
  home_country text not null,
  lat double precision not null,
  lng double precision not null,
  hourly_from integer not null,
  hourly_to integer not null,
  description text not null,
  photo text not null,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists availability_blocks (
  aircraft_id text not null references aircraft(id) on delete cascade,
  day date not null,
  primary key (aircraft_id, day)
);

create table if not exists enquiries (
  id text primary key,
  customer_id text not null,
  aircraft_id text not null,
  operator_id text not null,
  origin_label text not null default '',
  dest_label text not null,
  dest_iata text not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  depart date not null,
  ret date,
  passengers integer not null,
  notes text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id serial primary key,
  enquiry_id text not null references enquiries(id) on delete cascade,
  sender_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id text primary key,
  enquiry_id text not null unique references enquiries(id) on delete cascade,
  customer_id text not null,
  operator_id text not null,
  aircraft_id text not null,
  rating integer not null,
  body text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists saved_jets (
  user_id text not null,
  aircraft_id text not null references aircraft(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, aircraft_id)
);

create table if not exists customer_notes (
  operator_id text not null,
  customer_id text not null,
  rating integer not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (operator_id, customer_id)
);

create table if not exists team_invites (
  code text primary key,
  operator_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id serial primary key,
  actor_id text not null,
  action text not null,
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists enquiries_customer_idx on enquiries (customer_id);
create index if not exists enquiries_operator_idx on enquiries (operator_id);
create index if not exists messages_enquiry_idx on messages (enquiry_id, id);

insert into aircraft (
  id, operator_id, name, model, category, seats, range_nm, speed_kts, year,
  home_iata, home_city, home_country, lat, lng, hourly_from, hourly_to,
  description, photo, featured, active
) values
('cj4-ltn', 'bero', 'Luton Needle', 'Citation CJ4', 'light', 8, 2165, 451, 2019,
 'LTN', 'London Luton', 'United Kingdom', 51.8747, -0.3683, 4900, 6400,
 'Eight seats out of Luton. Short runways, sharp exits, no small talk.', '/jets/light.jpg', false, true),
('phenom-gva', 'bero', 'Geneva Comet', 'Phenom 300E', 'light', 9, 2010, 464, 2021,
 'GVA', 'Geneva', 'Switzerland', 46.2381, 6.1089, 5200, 6800,
 'Geneva based and usually already warm. Light jet, long manners.', '/jets/light.jpg', false, true),
('pc24-zrh', 'bero', 'Alpine Door', 'PC-24', 'light', 8, 2000, 440, 2022,
 'ZRH', 'Zurich', 'Switzerland', 47.4582, 8.5481, 5000, 6600,
 'The PC-24 uses runways bigger jets pretend not to see. Zurich home.', '/jets/vl.jpg', false, true),
('hjet-opf', 'bero', 'Miami Sliver', 'HondaJet Elite II', 'very-light', 5, 1547, 422, 2023,
 'OPF', 'Miami Opa-locka', 'United States', 25.907, -80.2784, 3400, 4600,
 'Five seats. Miami humidity not included. Very light, very direct.', '/jets/vl.jpg', false, true),
('lat-syd', 'bero', 'Harbour Latitude', 'Citation Latitude', 'midsize', 9, 2700, 446, 2020,
 'SYD', 'Sydney', 'Australia', -33.9399, 151.1753, 6800, 8600,
 'Sydney to wherever the range says yes. Midsize and unfussy.', '/jets/mid.jpg', false, true),
('g280-ruh', 'bero', 'Najd Wind', 'Gulfstream G280', 'super-mid', 10, 3600, 482, 2018,
 'RUH', 'Riyadh', 'Saudi Arabia', 24.9576, 46.6988, 9000, 11500,
 'Riyadh base, super-mid cabin, built for the longer Gulf day.', '/jets/super.jpg', false, true),
('praetor-dxb', 'bero', 'Gulf Praetor', 'Praetor 600', 'super-mid', 12, 4018, 466, 2022,
 'DXB', 'Dubai', 'United Arab Emirates', 25.2532, 55.3657, 9800, 12800,
 'Dubai super-mid with the legs for Europe. People keep asking for it.', '/jets/super.jpg', true, true),
('cl350-teb', 'bero', 'Hudson Challenger', 'Challenger 350', 'super-mid', 10, 3200, 470, 2017,
 'TEB', 'Teterboro', 'United States', 40.8501, -74.0608, 9200, 12000,
 'Teterboro. The New York jet people mean when they say New York.', '/jets/super.jpg', true, true),
('falcon-lbg', 'bero', 'Paris Falcon', 'Falcon 8X', 'heavy', 14, 6450, 488, 2021,
 'LBG', 'Paris Le Bourget', 'France', 48.9694, 2.4414, 13000, 16500,
 'Paris Le Bourget. Heavy metal, quiet cabin, three continents if you insist.', '/jets/heavy.jpg', true, true),
('legacy-cgh', 'bero', 'Ibirapuera', 'Legacy 650', 'heavy', 13, 3900, 453, 2016,
 'CGH', 'Sao Paulo Congonhas', 'Brazil', -23.6261, -46.6566, 11000, 14500,
 'Sao Paulo city airport. Heavy, practical, allergic to fuss.', '/jets/heavy.jpg', false, true),
('g650-vny', 'bero', 'Pacific G650', 'Gulfstream G650', 'ultra', 16, 7000, 516, 2020,
 'VNY', 'Van Nuys', 'United States', 34.2098, -118.49, 16000, 21000,
 'Los Angeles. Ultra range, the one you take when the ocean is in the way.', '/jets/ultra.jpg', true, true),
('global-sin', 'bero', 'Strait Global', 'Global 7500', 'ultra', 19, 7700, 516, 2023,
 'SIN', 'Singapore', 'Singapore', 1.3644, 103.9915, 17500, 23000,
 'Singapore. Nineteen seats of patience and a ridiculous range.', '/jets/ultra.jpg', true, true);
