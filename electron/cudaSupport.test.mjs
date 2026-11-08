import { describe, it, expect } from 'vitest';
import cudaSupportRule from './cudaSupport.cjs';
import nvidiaFacts from './nvidiaFacts.cjs';

const { evaluateCudaSupport } = cudaSupportRule;
const { cudaSupport } = nvidiaFacts;

const card = (computeCap, driverVersion, name = 'Test Card') => ({ name, driverVersion, computeCap });
const reasonOf = (...cards) => evaluateCudaSupport(cards);

describe('evaluateCudaSupport · floors', () => {
  it('8.6 needs R580', () => {
    expect(reasonOf(card('8.6', '579.99'))).toMatchObject({ supported: false, reason: 'driver-too-old', driverFloor: 580 });
    expect(reasonOf(card('8.6', '580.00'))).toEqual({ supported: true });
  });

  it('7.5 needs R620', () => {
    expect(reasonOf(card('7.5', '619.99'))).toMatchObject({ supported: false, reason: 'driver-too-old', driverFloor: 620 });
    expect(reasonOf(card('7.5', '620.00'))).toEqual({ supported: true });
  });

  it('9.0 fails on R615 and passes on R620', () => {
    expect(reasonOf(card('9.0', '616.92'))).toMatchObject({ supported: false, reason: 'driver-too-old' });
    expect(reasonOf(card('9.0', '620.10'))).toEqual({ supported: true });
  });

  it.each(['8.9', '12.0', '12.1'])('%s runs on R580', (cap) => {
    expect(reasonOf(card(cap, '580.10'))).toEqual({ supported: true });
  });

  it('6.1 is a card too old, whatever the driver', () => {
    expect(reasonOf(card('6.1', '616.92'))).toMatchObject({ supported: false, reason: 'card-too-old' });
  });
});

describe('evaluateCudaSupport · several cards', () => {
  it('one failing card makes the machine unsupported, with that card and its reason', () => {
    const verdict = reasonOf(card('8.9', '616.92', 'Good'), card('6.1', '616.92', 'Old'));
    expect(verdict).toMatchObject({ supported: false, reason: 'card-too-old', cardName: 'Old' });
  });

  it('all cards passing is supported', () => {
    expect(reasonOf(card('8.9', '620.10'), card('7.5', '620.10'))).toEqual({ supported: true });
  });
});

describe('evaluateCudaSupport · unreadable facts', () => {
  it('an unreadable capability or driver is support unknown', () => {
    expect(reasonOf(card('[N/A]', '616.92'))).toMatchObject({ supported: false, reason: 'support-unknown' });
    expect(reasonOf(card('8.9', ''))).toMatchObject({ supported: false, reason: 'support-unknown' });
  });

  it('a readable old capability beats an unreadable driver', () => {
    expect(reasonOf(card('6.1', 'N/A'))).toMatchObject({ supported: false, reason: 'card-too-old' });
  });

  it('no cards is no NVIDIA card', () => {
    expect(evaluateCudaSupport([])).toEqual({ supported: false, reason: 'no-nvidia-card' });
  });
});

describe('cudaSupport · the nvidia-smi query', () => {
  it('parses a real query output into a verdict', async () => {
    const run = async () => 'NVIDIA GeForce RTX 4090, 616.92, 8.9\n';
    expect(await cudaSupport({ run })).toEqual({ supported: true });
  });

  it('asks for the facts in a query of its own', async () => {
    let args;
    await cudaSupport({ run: async (a) => ((args = a), '') });
    expect(args.join(' ')).toContain('compute_cap');
  });

  it.each([
    ['a missing nvidia-smi', () => Promise.reject(Object.assign(new Error('spawn nvidia-smi ENOENT'), { code: 'ENOENT' }))],
    ['a rejected field', () => Promise.reject(new Error('Field "compute_cap" is not a valid field to query.'))],
    ['a timeout', () => Promise.reject(Object.assign(new Error('timed out'), { killed: true }))],
  ])('%s gives support unknown', async (_label, run) => {
    expect(await cudaSupport({ run })).toEqual({ supported: false, reason: 'support-unknown' });
  });

  it('a card name with a comma does not shift the fields', async () => {
    const run = async () => 'NVIDIA GeForce RTX 4090, Founders, 616.92, 8.9\n';
    expect(await cudaSupport({ run })).toEqual({ supported: true });
  });

  it('a short row is support unknown', async () => {
    expect(await cudaSupport({ run: async () => 'NVIDIA GeForce RTX 4090, 616.92\n' })).toMatchObject({
      supported: false,
      reason: 'support-unknown',
    });
  });

  it('a clean query with no rows is no NVIDIA card', async () => {
    expect(await cudaSupport({ run: async () => '\n' })).toEqual({ supported: false, reason: 'no-nvidia-card' });
  });
});
