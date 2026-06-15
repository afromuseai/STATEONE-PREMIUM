import { useState, useEffect } from "react";

interface FeatureFlagResult {
  enabled: boolean;
  loading: boolean;
}

const cache = new Map<string, boolean>();

export function useFeatureFlag(featureKey: string): FeatureFlagResult {
  const [enabled, setEnabled] = useState<boolean>(cache.get(featureKey) ?? false);
  const [loading, setLoading] = useState<boolean>(!cache.has(featureKey));

  useEffect(() => {
    if (cache.has(featureKey)) {
      setEnabled(cache.get(featureKey) ?? false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/feature-flags/${encodeURIComponent(featureKey)}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) return { enabled: false };
        return res.json() as Promise<{ enabled: boolean }>;
      })
      .then((data) => {
        if (!cancelled) {
          cache.set(featureKey, data.enabled ?? false);
          setEnabled(data.enabled ?? false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          cache.set(featureKey, false);
          setEnabled(false);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [featureKey]);

  return { enabled, loading };
}
