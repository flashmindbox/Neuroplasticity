import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  CALIBRATION_STATEMENTS,
  DRILL_TYPES,
  TALK_TOPICS,
  parseBank,
} from '../../src/content/drills';
import { DIMENSIONS } from '../../src/content/dimensions';
import { HANDBOOK_PATHS, resolveHandbookLink } from '../../src/content/handbook';
import { SETUP_TASKS } from '../../src/content/protocol';
import { countFillers, wordsPerMinute } from '../../src/lib/talk';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const mdFiles = walk('handbook').filter((f) => f.endsWith('.md'));

describe('handbook integrity', () => {
  it('has no broken relative links', () => {
    const broken: string[] = [];
    for (const file of mdFiles) {
      for (const [, href] of readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        if (!existsSync(join(dirname(file), href.split('#')[0]))) broken.push(`${file} -> ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('gives every module an evidence grade', () => {
    const modules = mdFiles.filter((f) => f.includes('/modules/'));
    expect(modules.length).toBe(13);
    for (const m of modules) expect(readFileSync(m, 'utf8'), m).toMatch(/\*\*Evidence grade:\*\*/);
  });

  it('describes every app dimension in the target profile', () => {
    const profile = readFileSync('handbook/00-foundations/target-profile.md', 'utf8');
    expect(profile.match(/^### \d+\./gm)).toHaveLength(DIMENSIONS.length);
    for (const d of DIMENSIONS) expect(existsSync(join('handbook', d.module)), d.module).toBe(true);
  });

  it('bundles every handbook page and resolves in-page links', () => {
    expect(HANDBOOK_PATHS).toHaveLength(mdFiles.length);
    expect(resolveHandbookLink('modules/L0-body.md', '../references.md')).toBe('references.md');
    expect(resolveHandbookLink('README.md', 'modules/L0-body.md#x')).toBe('modules/L0-body.md#x');
    for (const t of SETUP_TASKS.filter((s) => s.route?.startsWith('/handbook/')))
      expect(HANDBOOK_PATHS).toContain(t.route!.slice('/handbook/'.length));
  });
});

describe('drill banks', () => {
  it('parses sections and bullets', () => {
    expect(parseBank('intro\n## A\n- one\n- two\ntext\n## B\n- three')).toEqual({
      A: ['one', 'two'],
      B: ['three'],
    });
  });

  it('loads prompts for every drill type from the handbook', () => {
    for (const t of DRILL_TYPES.filter((d) => d.id !== 'calibration'))
      expect(t.bank.length, t.id).toBeGreaterThan(5);
    expect(CALIBRATION_STATEMENTS.length).toBeGreaterThanOrEqual(20);
    expect(
      CALIBRATION_STATEMENTS.some((s) => s.truth) && CALIBRATION_STATEMENTS.some((s) => !s.truth),
    ).toBe(true);
    expect(TALK_TOPICS.length).toBeGreaterThan(15);
  });
});

describe('talk metrics', () => {
  it('counts fillers including repeats', () => {
    expect(countFillers('Um, um, I think, you know, basically we must act. Like this.')).toBe(4);
    expect(countFillers('The umpire basically… actually')).toBe(2);
  });
  it('computes words per minute', () => {
    expect(wordsPerMinute('one two three four', 2)).toBeNull();
    expect(wordsPerMinute(Array(240).fill('w').join(' '), 120)).toBe(120);
  });
});
