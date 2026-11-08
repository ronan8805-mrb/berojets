import { useEffect } from "react";
import { usePrefs } from "@/lib/prefs";

export function BootPrefs() {
  const boot = usePrefs((s) => s.boot);
  useEffect(() => {
    boot();
  }, [boot]);
  return null;
}
