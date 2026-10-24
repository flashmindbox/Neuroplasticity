// @vitest-environment node
// Node environment: fake-indexeddb can structured-clone Node Blobs but not jsdom ones.
import { describe, expect, it } from 'vitest';
import { RewireDB } from '../../src/lib/db';
import { exportBackup, importBackup, parseBackup } from '../../src/lib/backup';

describe('backup', () => {
  it('round-trips data, including audio blobs, and never exports the API key', async () => {
    const src = new RewireDB('backup-src');
    await src.settings.bulkPut([
      { key: 'apiKey', value: 'sk-ant-secret' },
      { key: 'lastBackupAt', value: null },
    ]);
    await src.dailyLogs.put({ date: '2026-11-01', checks: { wake: true }, mvd: false, stress: 4 });
    await src.talks.add({
      date: '2026-11-01',
      prompt: 'Why civil services?',
      audio: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'audio/webm' }),
      durationSec: 120,
      transcript: 'um because',
      wpm: 1,
      fillers: 1,
      selfScores: {},
    });

    const file = await exportBackup(src);
    const text = JSON.stringify(file);
    expect(text).not.toContain('sk-ant-secret');

    const dst = new RewireDB('backup-dst');
    await dst.settings.put({ key: 'apiKey', value: 'sk-ant-keep-mine' });
    await dst.journal.add({ date: '2026-01-01', win: 'old', emotions: [], lesson: '', ifThen: '' });
    await importBackup(parseBackup(text), dst);

    expect(await dst.dailyLogs.get('2026-11-01')).toMatchObject({
      stress: 4,
      checks: { wake: true },
    });
    expect(await dst.journal.count()).toBe(0);
    expect((await dst.settings.get('apiKey'))?.value).toBe('sk-ant-keep-mine');
    const talk = (await dst.talks.toArray())[0];
    expect(talk.audio).toBeInstanceOf(Blob);
    expect([...new Uint8Array(await talk.audio!.arrayBuffer())]).toEqual([1, 2, 3, 250]);
  });

  it('rejects files that are not Rewire backups', () => {
    expect(() => parseBackup('nope')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not a Rewire backup/);
    expect(() => parseBackup('{"format":"rewire-backup","version":99,"tables":{}}')).toThrow(
      /newer/,
    );
  });
});
