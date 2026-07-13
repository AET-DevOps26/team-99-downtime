// Loads .env files from the repo root into process.env using the standard
// Vite-style cascade (lower-priority first; later files override earlier ones):
//   .env → .env.local → .env.<env> → .env.<env>.local
// Shell-exported variables always win and are never overwritten.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';

export function loadDotEnv(repoRoot: string, env: string): void {
  const files = ['.env', '.env.local', `.env.${env}`, `.env.${env}.local`];
  const merged: Record<string, string> = {};

  for (const file of files) {
    try {
      const content = readFileSync(join(repoRoot, file), 'utf-8');
      Object.assign(merged, parse(content)); // later files override earlier
    } catch {
      // file doesn't exist — skip silently
    }
  }

  // Shell env takes highest priority — don't overwrite vars already set
  for (const [key, value] of Object.entries(merged)) {
    if (!process.env[key]) process.env[key] = value;
  }
}
