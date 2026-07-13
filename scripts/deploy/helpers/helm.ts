// Utilities for building Helm values objects and writing them to a temp file.
// A temp file is used instead of --set so secrets never appear on the process list.

import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Writes a value into a nested object using a dot-notation path. */
export function setPath(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  if (parts.some((k) => UNSAFE_KEYS.has(k))) {
    throw new Error(`Unsafe helm path segment in: ${path}`);
  }
  const leaf = parts[parts.length - 1];
  const parent = parts.slice(0, -1).reduce<Record<string, unknown>>((cur, key) => {
    if (cur[key] === undefined || cur[key] === null) {
      cur[key] = Object.create(null) as Record<string, unknown>;
    }
    return cur[key] as Record<string, unknown>;
  }, obj);
  parent[leaf] = value;
}

/** Serialises a plain object to indented YAML (string leaf values only). */
export function toYaml(obj: Record<string, unknown>, depth = 0): string {
  const pad = '  '.repeat(depth);
  return Object.entries(obj)
    .map(([k, v]) =>
      typeof v === 'object' && v !== null
        ? `${pad}${k}:\n${toYaml(v as Record<string, unknown>, depth + 1)}`
        : `${pad}${k}: ${JSON.stringify(v)}`
    )
    .join('\n');
}

/** Writes a values object to a temp YAML file; returns path + cleanup fn. */
export async function writeTempValues(
  obj: Record<string, unknown>
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const path = join(tmpdir(), `t99-deploy-${Date.now()}.yaml`);
  await Bun.write(path, `${toYaml(obj)}\n`);
  return { path, cleanup: () => unlink(path).catch(() => {}) };
}

/** Returns the public hostname for a given namespace. */
export function domainForNamespace(namespace: string): string {
  if (namespace === 't99-prod') return 't99.stud.k8s.aet.cit.tum.de';
  if (namespace === 't99-stage') return 'stage.t99.stud.k8s.aet.cit.tum.de';
  return `${namespace}.t99.stud.k8s.aet.cit.tum.de`;
}
