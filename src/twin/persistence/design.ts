import { validateEquipment, resolveSpecification } from '../catalog/equipment';
import { validateConfig } from '../assets/design';
import { failure, finiteNumber, SimulationError } from '../safety';
import type { Design } from '../types';
import { CONTRACT } from './limits';
import { array, keys, record, string, validateStructure } from './structure';

const media = ['power', 'technical', 'seawater', 'cluster', 'external-network'];
function vector(v: unknown, name: string, positive = false) {
  array(v, name, 3); if (v.length !== 3) failure('invalid-input', 'VECTOR_DIMENSION', `${name} requires three SI coordinates.`);
  v.forEach(n => { finiteNumber(n, name, { ...(positive ? { min: Number.MIN_VALUE } : {}), unit: 'm' }); });
}
export function validateDesign(value: unknown): asserts value is Design {
  validateStructure(value); record(value, 'design');
  keys(value, ['schemaVersion', 'revision', 'config', 'assets', 'connections', 'modules', 'nodeCount', 'rackCount', 'provisionedAccelerators', 'installedPeakITW', 'sourceIds', 'equipment'], 'design');
  if (value.schemaVersion !== 2) failure('unsupported-configuration', 'DESIGN_SCHEMA', 'Unsupported design schema.');
  string(value.revision, 'design.revision', 100);
  try { validateConfig(value.config); } catch (error) { if (error instanceof SimulationError) throw error; failure('invalid-input', 'DESIGN_CONFIG', error instanceof Error ? error.message : 'Invalid design configuration.', { field: 'design.config' }); }
  validateEquipment(value as unknown as Design);
  array(value.modules, 'design.modules', CONTRACT.maxModules);
  if (!value.modules.length) failure('invalid-input', 'DESIGN_MODULES', 'Design requires at least one module.');
  const modules = new Set<string>(); let nodes = 0, racks = 0;
  for (const m of value.modules) {
    record(m, 'module'); keys(m, ['id', 'platformId', 'powerDomainId', 'networkDomainId', 'nodeCount', 'rackCount', 'positionM'], 'module');
    for (const key of ['id', 'platformId', 'powerDomainId', 'networkDomainId']) string(m[key], `module.${key}`, CONTRACT.maxAssetIdLength);
    if (modules.has(m.id as string)) failure('invalid-input', 'DESIGN_DUPLICATE', 'Duplicate module ID.'); modules.add(m.id as string);
    finiteNumber(m.nodeCount, 'module.nodeCount', { min: 1, max: 160, integer: true });
    finiteNumber(m.rackCount, 'module.rackCount', { min: 1, max: 40, integer: true });
    if (m.rackCount !== Math.ceil(m.nodeCount / 4)) failure('invalid-input', 'DESIGN_INVENTORY', 'Module rack and node counts disagree.');
    nodes += m.nodeCount; racks += m.rackCount; vector(m.positionM, 'module.positionM');
  }
  for (const [key, expected] of Object.entries({ nodeCount: nodes, rackCount: racks, provisionedAccelerators: nodes * 8, installedPeakITW: nodes * resolveSpecification(value as unknown as Design,'compute').ratings.capacityW })) if (value[key] !== expected) failure('invalid-input', 'DESIGN_INVENTORY', `Design ${key} disagrees with inventory.`, { field: key });
  array(value.assets, 'design.assets', CONTRACT.maxDesignAssets);
  const ids = new Set<string>();
  for (const a of value.assets) {
    record(a, 'asset'); keys(a, ['id', 'type', 'name', 'parentId', 'catalogId', 'revision', 'dimensionsM', 'positionM', 'operationalMassKg', 'ratings', 'ports', 'failureDomain', 'provenance'], 'asset');
    string(a.id, 'asset.id', CONTRACT.maxAssetIdLength);
    if (!a.id || ids.has(a.id)) failure('invalid-input', 'DESIGN_DUPLICATE', 'Asset IDs must be nonempty and unique.'); ids.add(a.id);
    for (const key of ['name', 'catalogId', 'revision', 'failureDomain']) string(a[key], `asset.${key}`);
    if (a.parentId !== null) string(a.parentId, 'asset.parentId', CONTRACT.maxAssetIdLength);
    if (!['platform', 'hull', 'module', 'rack', 'compute', 'cdu', 'exchanger', 'pump', 'valve', 'pipe', 'transformer', 'switchboard', 'battery', 'network', 'external'].includes(String(a.type))) failure('unsupported-configuration', 'ASSET_TYPE', 'Unsupported asset type.');
    vector(a.dimensionsM, 'asset.dimensionsM', true); vector(a.positionM, 'asset.positionM');
    if (a.operationalMassKg !== null) finiteNumber(a.operationalMassKg, 'asset.operationalMassKg', { min: 0, unit: 'kg' });
    record(a.ratings, 'asset.ratings');
    if(a.type==='transformer')finiteNumber(a.ratings.efficiency,'transformer.efficiency',{min:Number.MIN_VALUE,max:1}); for (const [key, n] of Object.entries(a.ratings)) finiteNumber(n, `asset.ratings.${key}`, { min: 0 });
    array(a.ports, 'asset.ports', 16); const ports = new Set<string>();
    for (const p of a.ports) {
      record(p, 'port'); keys(p, ['id', 'medium', 'direction', 'capacity', 'unit'], 'port'); string(p.id, 'port.id', 100); string(p.unit, 'port.unit', 60);
      if (ports.has(p.id)) failure('invalid-input', 'PORT_DUPLICATE', 'Duplicate asset port.'); ports.add(p.id);
      if (!media.includes(String(p.medium)) || !['in', 'out', 'bidirectional'].includes(String(p.direction))) failure('invalid-input', 'PORT_TYPE', 'Invalid typed port.');
      const expectedUnit = p.medium === 'power' ? 'W' : p.medium === 'cluster' || p.medium === 'external-network' ? 'bit/s' : 'm³/s';
      if (p.unit !== expectedUnit) failure('invalid-input', 'PORT_UNIT', `Port ${p.id} requires ${expectedUnit} for its declared medium.`, { assetId: a.id, field: 'port.unit', unit: expectedUnit });
      finiteNumber(p.capacity, 'port.capacity', { min: 0 });
    }
    array(a.provenance, 'asset.provenance', 32); a.provenance.forEach(s => string(s, 'asset.provenance'));
  }
  for (const id of modules) if (!ids.has(id)) failure('invalid-input', 'DESIGN_MODULE_ASSET', 'Module is missing its inventory asset.', { assetId: id });
  if (!ids.has('shore/grid')) failure('invalid-input', 'DESIGN_SOURCE', 'The implemented electrical model requires the declared shore/grid source asset.');
  const assets = new Map((value.assets as Design['assets']).map(a => [a.id, a]));
  for (const asset of assets.values()) if (asset.parentId !== null && !ids.has(asset.parentId)) failure('invalid-input', 'DESIGN_PARENT', 'Asset parent reference is missing.', { assetId: asset.id });
  for (const m of value.modules as Design['modules']) for (const field of ['platformId', 'powerDomainId', 'networkDomainId'] as const) if (!ids.has(m[field])) failure('invalid-input', 'DESIGN_DOMAIN', 'Module domain reference is missing.', { assetId: m.id, field });
  array(value.connections, 'design.connections', CONTRACT.maxConnections); const edges = new Set<string>();
  for (const c of value.connections) {
    record(c, 'connection'); keys(c, ['id', 'from', 'fromPort', 'to', 'toPort', 'medium', 'capacity', 'enabled', 'routeM', 'allowanceM'], 'connection');
    string(c.id, 'connection.id', CONTRACT.maxAssetIdLength * 2 + 40);
    if (edges.has(c.id)) failure('invalid-input', 'EDGE_DUPLICATE', 'Duplicate connection ID.'); edges.add(c.id);
    for (const key of ['from', 'to', 'fromPort', 'toPort']) string(c[key], `connection.${key}`, CONTRACT.maxAssetIdLength);
    if (!media.includes(String(c.medium)) || typeof c.enabled !== 'boolean') failure('invalid-input', 'EDGE_TYPE', 'Invalid typed connection.');
    const from = assets.get(c.from as string), to = assets.get(c.to as string);
    if (!from || !to || !from.ports.some(p => p.id === c.fromPort) || !to.ports.some(p => p.id === c.toPort)) failure('invalid-input', 'EDGE_REFERENCE', 'Connection endpoint or port reference is missing.', { field: c.id });
    if (c.medium === 'power') {
      const output = from.ports.find(p => p.id === c.fromPort)!, input = to.ports.find(p => p.id === c.toPort)!;
      if (output.medium !== 'power' || input.medium !== 'power' || output.direction === 'in' || input.direction === 'out') failure('unsupported-configuration', 'POWER_PORT_TOPOLOGY', 'Power connection requires compatible supply/output and load/input ports.', { field: c.id });
    }
    finiteNumber(c.capacity, 'connection.capacity', { min: 0 }); finiteNumber(c.allowanceM, 'connection.allowanceM', { min: 0, unit: 'm' });
    array(c.routeM, 'connection.routeM', 64); c.routeM.forEach(v => vector(v, 'route point'));
  }
  array(value.sourceIds, 'design.sourceIds', 32); value.sourceIds.forEach(s => string(s, 'design.sourceIds'));
}
