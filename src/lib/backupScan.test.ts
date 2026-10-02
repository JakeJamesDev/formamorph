import { describe, it, expect } from 'vitest';
import { BackupShapeError, BackupSyntaxError, scanBackupSpans } from './backupScan';

const CATEGORIES = ['worlds', 'saves'] as const;

const tricky = [
  { id: 'w1', name: 'Café 🐸 "quoted" {not} [a] \\ back', data: { data: { worlds: [1] } } },
  { id: 'w2', text: 'ends in a backslash \\', nums: [1.5e3, -2, true, false, null] },
  // An escaped quote before a bracket: a missed escape would close the record here.
  { id: 'w3', text: 'a"}', more: '"]' },
];
const bundle = {
  formamorphBackup: 1,
  appVersion: '3.1.1',
  extra: { worlds: [{ id: 'not a record' }] },
  data: { worlds: tricky, saves: [], unknown: [{ id: 'u' }], entities: 'not an array' },
  exportedAt: '2026-10-02',
};

const read = async (blob: Blob, span: { start: number; end: number }) =>
  JSON.parse(await blob.slice(span.start, span.end).text());

describe('scanBackupSpans', () => {
  it.each([
    ['compact', JSON.stringify(bundle)],
    ['pretty', JSON.stringify(bundle, null, 2)],
    ['BOM', '﻿' + JSON.stringify(bundle)],
  ])('finds every record and header value in %s text at any chunk size', async (_, text) => {
    const blob = new Blob([text]);
    for (const chunkSize of [1, 2, 7, 4096]) {
      const spans = await scanBackupSpans(blob, CATEGORIES, chunkSize);
      expect(spans.hasData).toBe(true);
      expect(spans.records.map((r) => r.category)).toEqual(['worlds', 'worlds', 'worlds']);
      expect(await Promise.all(spans.records.map((r) => read(blob, r)))).toEqual(tricky);
      expect(await read(blob, spans.header.formamorphBackup)).toBe(1);
      expect(await read(blob, spans.header.appVersion)).toBe('3.1.1');
      expect(await read(blob, spans.header.exportedAt)).toBe('2026-10-02');
      expect(spans.header.data).toBeUndefined();
    }
  });

  it('reports no data when the top level has none', async () => {
    const spans = await scanBackupSpans(new Blob([JSON.stringify({ formamorphBackup: 1 })]), CATEGORIES);
    expect(spans.hasData).toBe(false);
    expect(spans.records).toEqual([]);
  });

  it.each([
    ['broken text', '{ not json'],
    ['a cut-off file', JSON.stringify(bundle).slice(0, -5)],
    ['an open string', '{"a": "b'],
    ['text after the end', '{"a": 1} 2'],
    ['a mismatched bracket', '{"a": [1}'],
    ['a web page', '<!doctype html><html></html>'],
    ['plain text', 'hello'],
    ['a trailing comma', '{"a": 1,}'],
    ['a missing colon', '{"a" 1}'],
    ['a double comma', '{"a": 1,, "b": 2}'],
    ['a leading comma in an array', '{"a": [,1]}'],
    ['a missing comma between values', '{"formamorphBackup": 1 "x": 2}'],
    ['a missing comma between records', '{"data": {"worlds": [{"id": "a"} {"id": "b"}]}}'],
    ['an unknown word', '{"a": nul}'],
    ['a key with no value', '{"a":}'],
  ])('rejects %s as broken JSON at any chunk size', async (_, text) => {
    expect(() => JSON.parse(text)).toThrow();
    for (const chunkSize of [1, 3, 4096]) {
      await expect(scanBackupSpans(new Blob([text]), CATEGORIES, chunkSize)).rejects.toBeInstanceOf(BackupSyntaxError);
    }
  });

  it('keeps the last value of a repeated key, as JSON.parse does', async () => {
    const text =
      // The first `data` holds a category the second lacks, and the second repeats one of its own.
      '{"formamorphBackup": 1, "data": {"saves": [{"id": "old"}]}, "formamorphBackup": 2,' +
      ' "data": {"worlds": [{"id": "a"}], "worlds": [{"id": "b"}]}}';
    const blob = new Blob([text]);
    const spans = await scanBackupSpans(blob, CATEGORIES);
    const parsed = JSON.parse(text);
    expect(parsed.data).toEqual({ worlds: [{ id: 'b' }] });
    expect(await read(blob, spans.header.formamorphBackup)).toBe(parsed.formamorphBackup);
    expect(await Promise.all(spans.records.map((r) => read(blob, r)))).toEqual(parsed.data.worlds);
  });

  it.each([['an array', '[1, 2]'], ['a string', '"x"'], ['a number', '5']])(
    'rejects %s at the top level as the wrong shape',
    async (_, text) => {
      await expect(scanBackupSpans(new Blob([text]), CATEGORIES)).rejects.toBeInstanceOf(BackupShapeError);
    },
  );
});
