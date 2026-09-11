import { describe, expect, it } from 'vitest';
import { allocateTransferBundles } from '../src/twin/transfer/controller';
import { capacityOracle, type Bundle, type Resource } from './fixtures/phase-5/independent-oracles';
import frozen from './fixtures/phase-5/frozen-expectations.json';

const resources = frozen.capacity.resources;
const bundles = frozen.capacity.bundles;
function actual(resourceInput: Resource[] = resources, bundleInput: Bundle[] = bundles) {
  return allocateTransferBundles(resourceInput.map(resource => ({ id: resource.id, capacityW: resource.ratingW, nativeW: resource.nativeW })), bundleInput.map(bundle => ({ id: bundle.id, priority: bundle.priority, requestedW: bundle.drawW, resourceIds: bundle.resources })));
}
function check(resourceInput: Resource[], bundleInput: Bundle[]) {
  const expected = capacityOracle(resourceInput, bundleInput), result = actual(resourceInput, bundleInput);
  expect(result.allocations.filter(bundle => bundle.admittedW > 0).map(bundle => bundle.id)).toEqual(expected.admittedIds);
  expect(result.allocations.filter(bundle => bundle.unservedW > 0).map(bundle => bundle.id)).toEqual(expected.unservedIds);
  for (const resource of result.resources) {
    expect(Math.abs(resource.headroomW - expected.spareW[resource.id])).toBeLessThanOrEqual(frozen.absoluteTolerances.syntheticPowerW);
    expect(resource.nativeW + resource.transferredW).toBeLessThanOrEqual(resource.capacityW + frozen.absoluteTolerances.syntheticPowerW);
  }
  for (const allocation of result.allocations) {
    const bundle = bundleInput.find(bundle => bundle.id === allocation.id)!;
    expect([0, bundle.drawW]).toContain(allocation.admittedW);
    expect(allocation.admittedW + allocation.unservedW).toBe(bundle.drawW);
  }
  return result;
}

describe('PH5 D independent capacity constraints and indivisible loads', () => {
  it.each([60000, 89999, 90000, 100000, 120000, 120001])('rating %i W respects zero/insufficient/exact/partial/sufficient headroom', ratingW => {
    check([{ id: 'shared', ratingW, nativeW: 60000 }], bundles);
  });
  it('cannot spend the same 40kW twice for two 30kW recipients', () => {
    const result = check(resources, bundles);
    expect(result.allocations).toMatchObject([{ id: 'recipient-a', admittedW: 30000, unservedW: 0 }, { id: 'recipient-b', admittedW: 0, unservedW: 30000, bindingResourceId: 'shared', headroomW: 10000 }]);
    expect(result.resources).toMatchObject([{ id: 'shared', nativeW: 60000, transferredW: 30000, headroomW: 10000 }]);
  });
  it('a shared upstream bottleneck refuses the second bundle despite adequate independent feeders', () => {
    const rs = [{ id: 'source', ratingW: 100000, nativeW: 60000 }, { id: 'feeder-a', ratingW: 50000, nativeW: 0 }, { id: 'feeder-b', ratingW: 50000, nativeW: 0 }];
    const bs = bundles.map((bundle, index) => ({ ...bundle, resources: ['source', index === 0 ? 'feeder-a' : 'feeder-b'] }));
    const result = check(rs, bs);
    expect(result.allocations[1].bindingResourceId).toBe('source');
    expect(result.resources.find(resource => resource.id === 'feeder-b')!.transferredW).toBe(0);
  });
  it('a tie bottleneck cannot use spare feeder capacity to fractionally restore a platform', () => {
    const rs = [{ id: 'source', ratingW: 200000, nativeW: 60000 }, { id: 'tie', ratingW: 29999, nativeW: 0 }];
    const result = check(rs, [{ ...bundles[0], resources: ['source', 'tie'] }]);
    expect(result.allocations[0]).toMatchObject({ admittedW: 0, unservedW: 30000, bindingResourceId: 'tie' });
  });
  it('protects native demand when its increase sheds lower-priority transferred demand', () => {
    const before = check([{ id: 'shared', ratingW: 120000, nativeW: 60000 }], bundles);
    expect(before.allocations.map(bundle => bundle.admittedW)).toEqual([30000, 30000]);
    const after = check([{ id: 'shared', ratingW: 120000, nativeW: 60001 }], bundles);
    expect(after.allocations.map(bundle => bundle.admittedW)).toEqual([30000, 0]);
    expect(after.resources[0].nativeW).toBe(60001);
  });
});

describe('PH5 E atomic stable priority independent of incidental order', () => {
  it.each([false, true])('resource and request permutation (reversed %s) preserve the same allocation', reverse => {
    const rs = [{ id: 'shared', ratingW: 100000, nativeW: 60000 }, { id: 'tie', ratingW: 70000, nativeW: 0 }];
    const bs = bundles.map(bundle => ({ ...bundle, resources: ['shared', 'tie'] }));
    check(reverse ? rs.reverse() : rs, reverse ? bs.reverse() : bs);
  });
  it('declared priority outranks lexical asset ID, then equal priority uses stable ID', () => {
    const bs = [{ ...bundles[0], priority: 2 }, { ...bundles[1], priority: 1 }];
    expect(check(resources, bs).allocations.filter(bundle => bundle.admittedW > 0).map(bundle => bundle.id)).toEqual(['recipient-b']);
  });
  it('repeated pure evaluations do not retain abandoned reservations or mutate inputs', () => {
    const before = structuredClone({ resources, bundles });
    const a = actual(); actual(resources, [bundles[1]]); const b = actual();
    expect(a).toEqual(b); expect({ resources, bundles }).toEqual(before);
  });
  it('passes every bounded combination against an exhaustive independent oracle', () => {
    for (const nativeW of [0, 40, 60]) for (const sourceW of [60, 90, 100, 120]) for (const tieW of [20, 30, 65]) {
      check([{ id: 'shared', ratingW: sourceW, nativeW }, { id: 'tie', ratingW: tieW, nativeW: 0 }], [
        { id: 'a', priority: 1, drawW: 30, resources: ['shared', 'tie'] },
        { id: 'b', priority: 1, drawW: 30, resources: ['shared', 'tie'] },
        { id: 'c', priority: 2, drawW: 10, resources: ['shared'] },
      ]);
    }
  });
});

describe('PH5 H allocator malformed inputs fail closed', () => {
  it.each([NaN, Infinity, -1])('rejects invalid capacity/native/request watts %s', invalid => {
    expect(() => actual([{ id: 'shared', ratingW: invalid, nativeW: 0 }])).toThrow();
    expect(() => actual([{ id: 'shared', ratingW: 100000, nativeW: invalid }])).toThrow();
    expect(() => actual(resources, [{ ...bundles[0], drawW: invalid }])).toThrow();
  });
  it.each([NaN, Infinity, -1, 0.5])('rejects invalid priority %s', priority => {
    expect(() => actual(resources, [{ ...bundles[0], priority }])).toThrow();
  });
  it('rejects missing resource and duplicate physical resource accounting', () => {
    expect(() => actual(resources, [{ ...bundles[0], resources: ['missing'] }])).toThrow();
    expect(() => actual(resources, [{ ...bundles[0], resources: ['shared', 'shared'] }])).toThrow();
    expect(() => actual([...resources, ...resources])).toThrow();
  });
  it('rejects duplicate bundle identities', () => {
    expect(() => actual(resources, [bundles[0], bundles[0]])).toThrow();
  });
});
