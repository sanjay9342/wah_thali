import "server-only";

function cleanEnvValue(raw: string | undefined) {
  return raw?.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1") ?? "";
}

export function readServerEnv(key: string, aliases: string[] = []) {
  const keys = [key, ...aliases];

  for (const candidate of keys) {
    const exact = cleanEnvValue(process.env[candidate]);
    if (exact) return exact;
  }

  for (const [envKey, envValue] of Object.entries(process.env)) {
    if (keys.includes(envKey.trim())) {
      const loose = cleanEnvValue(envValue);
      if (loose) return loose;
    }
  }

  return "";
}

export function hasServerEnv(key: string, aliases: string[] = []) {
  return Boolean(readServerEnv(key, aliases));
}

