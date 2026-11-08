import { create } from "zustand";
import type { SearchInput } from "@/lib/types";

export type LatLng = { lat: number; lng: number; label: string };

export type FlightPlan = {
  id: number;
  from: LatLng;
  to: LatLng;
  search: SearchInput;
};

type FlightState = {
  plan: FlightPlan | null;
  play: (plan: Omit<FlightPlan, "id">) => void;
  clear: () => void;
};

export const useFlight = create<FlightState>((set) => ({
  plan: null,
  play: (plan) => set({ plan: { ...plan, id: Date.now() } }),
  clear: () => set({ plan: null }),
}));
