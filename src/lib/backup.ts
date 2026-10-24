// Export / import all local data as one JSON file. The API key is never exported.
import { db, TABLE_NAMES, type RewireDB, type TableName } from './db';

export const BACKUP_FORMAT = 'rewire-backup';
export const BACKUP_VERSION = 1;
const SECRET_SETTINGS = new Set(['apiKey']);

interface EncodedBlob {
  __blob: true;
  type: string;
  base64: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function encode(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    return {
      __blob: true,
      type: value.type,
      base64: await blobToBase64(value),
    } satisfies EncodedBlob;
  }
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encode(v);
    return out;
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const v = value as Partial<EncodedBlob>;
    if (v.__blob === true && typeof v.base64 === 'string')
      return base64ToBlob(v.base64, v.type ?? '');
    return Object.fromEntries(Object.entries(value).map(([k, x]) => [k, decode(x)]));
  }
  return value;
}

export async function exportBackup(database: RewireDB = db): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const name of TABLE_NAMES) {
    let rows: unknown[] = await database.table(name).toArray();
    if (name === 'settings') {
      rows = rows.filter((r) => !SECRET_SETTINGS.has((r as { key: string }).key));
    }
    tables[name] = (await encode(rows)) as unknown[];
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const b = data as Partial<BackupFile>;
  if (
    b?.format !== BACKUP_FORMAT ||
    typeof b.version !== 'number' ||
    typeof b.tables !== 'object'
  ) {
    throw new Error('This is not a Rewire backup file.');
  }
  if (b.version > BACKUP_VERSION)
    throw new Error('This backup was made by a newer version of Rewire.');
  return b as BackupFile;
}

/** Replaces all local data (except the API key) with the backup's contents. */
export async function importBackup(backup: BackupFile, database: RewireDB = db) {
  const apiKey = await database.settings.get('apiKey');
  await database.transaction(
    'rw',
    TABLE_NAMES.map((n) => database.table(n)),
    async () => {
      for (const name of TABLE_NAMES) {
        const table = database.table(name);
        await table.clear();
        const rows = backup.tables[name];
        if (Array.isArray(rows) && rows.length) await table.bulkAdd(decode(rows) as object[]);
      }
      if (apiKey) await database.settings.put(apiKey);
    },
  );
}
