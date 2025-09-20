// Centralized feature flag access. Keep flags defined in one place only.
// Flags are read from environment variables and normalized to booleans.

export const FEATURE_FLAGS = {
  MASTER_GODVIEW: String(process.env.NEXT_PUBLIC_MASTER_GODVIEW || '').toLowerCase() === 'true',
} as const;

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}


