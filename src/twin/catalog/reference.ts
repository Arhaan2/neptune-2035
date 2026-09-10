import { catalogSpecification } from './equipment';
const computeReference=catalogSpecification('compute-reference');
const pipeReference=catalogSpecification('pipe-reference');
export const HARDWARE = Object.freeze({
  acceleratorsPerNode: 8, nodesPerRack: 4, nodeHeightU: 10, rackHeightU: 48,
  racksPerModule: 40, modulesPerPlatform: 4, nodePeakW: computeReference.ratings.capacityW,
  nodeMassKg: computeReference.operationalMassKg!, rackMassKg: 150, liquidCaptureFraction: computeReference.ratings.liquidCaptureFraction,
  technicalDensityKgM3: 997, technicalCpJKgK: 4180,
  seawaterDensityKgM3: 1025, seawaterCpJKgK: 3990,
  pipeDiameterM: pipeReference.ratings.diameterM, pipeRoughnessM: pipeReference.ratings.roughnessM,
});
export const REFERENCE_SOURCES = [
  { id: 'generic-hardware-v2', evidence: 'assumed', title: 'Illustrative DLC-12 whole-server envelope', url: '', checked: '2026-09-08', claim: '8 accelerators, 10U, 12 kW whole-server peak, 120 kg, 90% liquid capture. Generic co-designed envelope, not a commercial product.', limit: 'Power, mass, cooling compatibility and performance require manufacturer evidence before procurement.' },
  { id: 'layout-v2', evidence: 'assumed', title: 'Reference packing and structure', url: '', checked: '2026-09-08', claim: '24 × 10 × 4 m modules; two rows of 20 racks; 58 × 28 m deck; two 58 × 6 × 5 m rectangular pontoons.', limit: 'Geometric and hydrostatic screens only. Clearances are declared assumptions, not code certification.' },
  { id: 'equipment-v2', evidence: 'assumed', title: 'Support equipment envelope', url: '', checked: '2026-09-08', claim: 'Pump curves, pipe roughness, exchanger UA, UPS capacity, structural masses and efficiencies are explicit editable/design assumptions.', limit: 'No vendor quotation, performance curve certification, site survey or operational measurements.' },
  { id: 'nist-twin', evidence: 'sourced', title: 'NIST — Essential Elements', url: 'https://www.nist.gov/digital-twins/essential-elements', checked: '2026-09-08', claim: 'Physical counterpart, connection and synchronization distinguish an operational twin.', limit: 'Provides terminology; does not validate this facility.' },
  { id: 'nasa-7009', evidence: 'sourced', title: 'NASA-STD-7009B — Models and Simulations', url: 'https://standards.nasa.gov/standard/NASA/NASA-STD-7009', checked: '2026-09-08', claim: 'Separate model credibility, verification, intended use and validation evidence.', limit: 'Methodological reference; no NASA certification or conformance assertion.' },
  { id: 'entu', evidence: 'sourced', title: 'MathWorks — Effectiveness–NTU heat transfer', url: 'https://www.mathworks.com/help/hydro/ref/entuheattransfer.html', checked: '2026-09-08', claim: 'Heat transfer using capacity rates, UA, effectiveness and inlet temperature difference.', limit: 'Equation reference; assumed UA and fluid constants remain unvalidated.' },
  { id: 'lbl', evidence: 'sourced', title: 'LBNL — Modelica Buildings', url: 'https://simulationresearch.lbl.gov/modelica/', checked: '2026-09-08', claim: 'Dynamic reduced-order systems and controls are useful for design exploration.', limit: 'No Modelica dependency or cross-validation claimed.' },
  { id: 'seawater', evidence: 'assumed', title: 'Constant fluid approximation', url: 'https://www.teos-10.org/pubs/gsw/html/gsw_cp_t_exact.html', checked: '2026-09-08', claim: 'Sea density 1025 kg/m³ and cp 3990 J/(kg K); technical water 997 kg/m³ and cp 4180 J/(kg K).', limit: 'Illustrative constants over the declared near-ambient range; no salinity/property solver.' },
] as const;
