import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Health } from "../lib/types";

let cached: Promise<Health | null> | null = null;

export function useHealth(): Health | null {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    cached ??= api.health().catch(() => null);
    let alive = true;
    cached.then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, []);
  return health;
}
