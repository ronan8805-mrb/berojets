export type Place = {
  iata: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
};

const RAW: [string, string, string, number, number][] = [
  ["LHR", "London", "United Kingdom", 51.47, -0.4543],
  ["LTN", "London Luton", "United Kingdom", 51.8747, -0.3683],
  ["FAB", "Farnborough", "United Kingdom", 51.2758, -0.7763],
  ["LCY", "London City", "United Kingdom", 51.5053, 0.0553],
  ["EDI", "Edinburgh", "United Kingdom", 55.95, -3.3725],
  ["MAN", "Manchester", "United Kingdom", 53.3537, -2.275],
  ["DUB", "Dublin", "Ireland", 53.4213, -6.2701],
  ["CDG", "Paris", "France", 49.0097, 2.5479],
  ["LBG", "Paris Le Bourget", "France", 48.9694, 2.4414],
  ["NCE", "Nice", "France", 43.6584, 7.2159],
  ["LYS", "Lyon", "France", 45.7256, 5.0811],
  ["GVA", "Geneva", "Switzerland", 46.2381, 6.1089],
  ["ZRH", "Zurich", "Switzerland", 47.4582, 8.5481],
  ["MUC", "Munich", "Germany", 48.3538, 11.7861],
  ["FRA", "Frankfurt", "Germany", 50.0379, 8.5622],
  ["BER", "Berlin", "Germany", 52.3667, 13.5033],
  ["AMS", "Amsterdam", "Netherlands", 52.3105, 4.7683],
  ["BRU", "Brussels", "Belgium", 50.9014, 4.4844],
  ["MAD", "Madrid", "Spain", 40.4983, -3.5676],
  ["BCN", "Barcelona", "Spain", 41.2971, 2.0785],
  ["PMI", "Palma", "Spain", 39.5517, 2.7388],
  ["IBZ", "Ibiza", "Spain", 38.8729, 1.3731],
  ["LIS", "Lisbon", "Portugal", 38.7742, -9.1342],
  ["FAO", "Faro", "Portugal", 37.0144, -7.9659],
  ["FCO", "Rome", "Italy", 41.8003, 12.2389],
  ["MXP", "Milan", "Italy", 45.6306, 8.7281],
  ["VCE", "Venice", "Italy", 45.5053, 12.3519],
  ["NAP", "Naples", "Italy", 40.886, 14.2908],
  ["VIE", "Vienna", "Austria", 48.1103, 16.5697],
  ["PRG", "Prague", "Czechia", 50.1008, 14.26],
  ["CPH", "Copenhagen", "Denmark", 55.618, 12.6508],
  ["ARN", "Stockholm", "Sweden", 59.6519, 17.9186],
  ["OSL", "Oslo", "Norway", 60.1939, 11.1004],
  ["HEL", "Helsinki", "Finland", 60.3172, 24.9633],
  ["ATH", "Athens", "Greece", 37.9364, 23.9445],
  ["IST", "Istanbul", "Turkey", 41.2753, 28.7519],
  ["WAW", "Warsaw", "Poland", 52.1657, 20.9671],
  ["BUD", "Budapest", "Hungary", 47.4298, 19.2611],
  ["TEB", "Teterboro", "United States", 40.8501, -74.0608],
  ["HPN", "White Plains", "United States", 41.067, -73.7076],
  ["JFK", "New York", "United States", 40.6413, -73.7781],
  ["BOS", "Boston", "United States", 42.3656, -71.0096],
  ["IAD", "Washington", "United States", 38.9531, -77.4565],
  ["MIA", "Miami", "United States", 25.7959, -80.287],
  ["OPF", "Miami Opa-locka", "United States", 25.907, -80.2784],
  ["PBI", "Palm Beach", "United States", 26.6832, -80.0956],
  ["MCO", "Orlando", "United States", 28.4312, -81.3081],
  ["ATL", "Atlanta", "United States", 33.6407, -84.4277],
  ["ORD", "Chicago", "United States", 41.9742, -87.9073],
  ["MDW", "Chicago Midway", "United States", 41.7868, -87.7522],
  ["DFW", "Dallas", "United States", 32.8998, -97.0403],
  ["DAL", "Dallas Love", "United States", 32.8471, -96.8518],
  ["IAH", "Houston", "United States", 29.9902, -95.3368],
  ["HOU", "Houston Hobby", "United States", 29.6454, -95.2789],
  ["AUS", "Austin", "United States", 30.1945, -97.6699],
  ["DEN", "Denver", "United States", 39.8561, -104.6737],
  ["APA", "Denver Centennial", "United States", 39.5701, -104.8493],
  ["LAS", "Las Vegas", "United States", 36.084, -115.1537],
  ["LAX", "Los Angeles", "United States", 33.9416, -118.4085],
  ["VNY", "Van Nuys", "United States", 34.2098, -118.49],
  ["SNA", "Orange County", "United States", 33.6757, -117.8682],
  ["SAN", "San Diego", "United States", 32.7338, -117.1933],
  ["SFO", "San Francisco", "United States", 37.6213, -122.379],
  ["SJC", "San Jose", "United States", 37.3639, -121.9289],
  ["SEA", "Seattle", "United States", 47.4502, -122.3088],
  ["BFI", "Seattle Boeing", "United States", 47.53, -122.302],
  ["PHX", "Phoenix", "United States", 33.4373, -112.0078],
  ["SDL", "Scottsdale", "United States", 33.6229, -111.9105],
  ["MSY", "New Orleans", "United States", 29.9934, -90.258],
  ["BNA", "Nashville", "United States", 36.1263, -86.6774],
  ["SLC", "Salt Lake City", "United States", 40.7899, -111.9791],
  ["HNL", "Honolulu", "United States", 21.3187, -157.9225],
  ["ANC", "Anchorage", "United States", 61.1743, -149.9962],
  ["YYZ", "Toronto", "Canada", 43.6777, -79.6248],
  ["YUL", "Montreal", "Canada", 45.4706, -73.7408],
  ["YVR", "Vancouver", "Canada", 49.1947, -123.1792],
  ["YYC", "Calgary", "Canada", 51.1215, -114.0076],
  ["MEX", "Mexico City", "Mexico", 19.4363, -99.0721],
  ["CUN", "Cancun", "Mexico", 21.0365, -86.8771],
  ["GRU", "Sao Paulo", "Brazil", -23.4356, -46.4731],
  ["CGH", "Sao Paulo Congonhas", "Brazil", -23.6261, -46.6566],
  ["GIG", "Rio de Janeiro", "Brazil", -22.8099, -43.2505],
  ["EZE", "Buenos Aires", "Argentina", -34.8222, -58.5358],
  ["SCL", "Santiago", "Chile", -33.393, -70.7858],
  ["BOG", "Bogota", "Colombia", 4.7016, -74.1469],
  ["LIM", "Lima", "Peru", -12.0219, -77.1143],
  ["PTY", "Panama City", "Panama", 9.0714, -79.3835],
  ["DXB", "Dubai", "United Arab Emirates", 25.2532, 55.3657],
  ["DWC", "Dubai World Central", "United Arab Emirates", 24.8964, 55.1614],
  ["AUH", "Abu Dhabi", "United Arab Emirates", 24.433, 54.6511],
  ["DOH", "Doha", "Qatar", 25.2731, 51.6081],
  ["RUH", "Riyadh", "Saudi Arabia", 24.9576, 46.6988],
  ["JED", "Jeddah", "Saudi Arabia", 21.6796, 39.1565],
  ["BAH", "Bahrain", "Bahrain", 26.2708, 50.6336],
  ["KWI", "Kuwait City", "Kuwait", 29.2266, 47.9689],
  ["MCT", "Muscat", "Oman", 23.5933, 58.2844],
  ["CAI", "Cairo", "Egypt", 30.1219, 31.4056],
  ["CMN", "Casablanca", "Morocco", 33.3675, -7.59],
  ["JNB", "Johannesburg", "South Africa", -26.1392, 28.246],
  ["CPT", "Cape Town", "South Africa", -33.9715, 18.6021],
  ["NBO", "Nairobi", "Kenya", -1.3192, 36.9278],
  ["ADD", "Addis Ababa", "Ethiopia", 8.9779, 38.7993],
  ["TLV", "Tel Aviv", "Israel", 32.0055, 34.8854],
  ["AMM", "Amman", "Jordan", 31.7226, 35.9932],
  ["SIN", "Singapore", "Singapore", 1.3644, 103.9915],
  ["HKG", "Hong Kong", "Hong Kong", 22.308, 113.9185],
  ["NRT", "Tokyo Narita", "Japan", 35.772, 140.3929],
  ["HND", "Tokyo Haneda", "Japan", 35.5494, 139.7798],
  ["KIX", "Osaka", "Japan", 34.4347, 135.244],
  ["ICN", "Seoul", "South Korea", 37.4602, 126.4407],
  ["PEK", "Beijing", "China", 40.0799, 116.6031],
  ["PVG", "Shanghai", "China", 31.1443, 121.8083],
  ["CAN", "Guangzhou", "China", 23.3924, 113.2988],
  ["TPE", "Taipei", "Taiwan", 25.0797, 121.2342],
  ["BKK", "Bangkok", "Thailand", 13.69, 100.7501],
  ["HAN", "Hanoi", "Vietnam", 21.2212, 105.8072],
  ["SGN", "Ho Chi Minh City", "Vietnam", 10.8188, 106.652],
  ["KUL", "Kuala Lumpur", "Malaysia", 2.7456, 101.7099],
  ["CGK", "Jakarta", "Indonesia", -6.1256, 106.6559],
  ["DPS", "Bali", "Indonesia", -8.7482, 115.1671],
  ["MNL", "Manila", "Philippines", 14.5086, 121.0194],
  ["DEL", "Delhi", "India", 28.5562, 77.1],
  ["BOM", "Mumbai", "India", 19.0896, 72.8656],
  ["BLR", "Bengaluru", "India", 13.1986, 77.7066],
  ["MLE", "Male", "Maldives", 4.1918, 73.5291],
  ["CMB", "Colombo", "Sri Lanka", 7.1808, 79.8841],
  ["SYD", "Sydney", "Australia", -33.9399, 151.1753],
  ["MEL", "Melbourne", "Australia", -37.669, 144.841],
  ["BNE", "Brisbane", "Australia", -27.3942, 153.1218],
  ["PER", "Perth", "Australia", -31.9403, 115.967],
  ["AKL", "Auckland", "New Zealand", -37.0082, 174.785],
  ["NAN", "Nadi", "Fiji", -17.7554, 177.4434],
  ["NAS", "Nassau", "Bahamas", 25.039, -77.4662],
  ["SXM", "St Maarten", "Sint Maarten", 18.041, -63.1089],
  ["UVF", "St Lucia", "Saint Lucia", 13.7332, -60.9526],
  ["GCM", "Grand Cayman", "Cayman Islands", 19.2928, -81.3577],
  ["SJU", "San Juan", "Puerto Rico", 18.4394, -66.0018],
  ["SEZ", "Mahe", "Seychelles", -4.6743, 55.5218],
  ["RAK", "Marrakech", "Morocco", 31.6069, -8.0363],
  ["KEF", "Reykjavik", "Iceland", 63.985, -22.6056],
  ["SVO", "Moscow", "Russia", 55.9726, 37.4146],
  ["LED", "St Petersburg", "Russia", 59.8003, 30.2625],
];

export const PLACES: Place[] = RAW.map(([iata, city, country, lat, lng]) => ({
  iata,
  city,
  country,
  lat,
  lng,
}));

const byIata = new Map(PLACES.map((p) => [p.iata, p]));

export function findPlace(iata: string | undefined | null) {
  if (!iata) return null;
  return byIata.get(iata.toUpperCase()) ?? null;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function searchPlaces(q: string, limit = 7): Place[] {
  const n = norm(q.trim());
  if (!n) return PLACES.slice(0, limit);
  const scored = PLACES.map((p) => {
    const city = norm(p.city);
    const iata = p.iata.toLowerCase();
    const country = norm(p.country);
    let s = 0;
    if (iata === n) s = 100;
    else if (city === n) s = 92;
    else if (city.startsWith(n)) s = 80;
    else if (iata.startsWith(n)) s = 74;
    else if (city.includes(n)) s = 50;
    else if (country.startsWith(n)) s = 36;
    else if (`${city} ${country}`.includes(n)) s = 24;
    return { p, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.city.localeCompare(b.p.city));
  return scored.slice(0, limit).map((x) => x.p);
}

export function placeLabel(p: Place) {
  return `${p.city} · ${p.iata}`;
}
