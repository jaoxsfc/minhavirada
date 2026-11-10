import { useEffect, useState } from "react";
import { localDate } from "../lib/date";
/** Refresh after date rollover or returning to the app, using device-local dates. */
export function useLocalToday() {
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const refresh = () => setToday(localDate());
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
