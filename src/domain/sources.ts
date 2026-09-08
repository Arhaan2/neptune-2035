export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  checkedDate: string;
  claim: string;
  limitation: string;
}
export const SOURCES: Source[] = [
  {
    id: 'nvidia-b200',
    title: 'DGX B200 User Guide',
    publisher: 'NVIDIA',
    url: 'https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html',
    checkedDate: '2026-09-08',
    claim:
      'Eight GPUs per system; 10U form factor; 14.3 kW maximum whole-system input power.',
    limitation:
      'Electrical reference only. Not measured average consumption or endorsement of a marine/liquid-cooled design.',
  },
  {
    id: 'pue',
    title: 'Power Usage Effectiveness',
    publisher: 'The Green Grid',
    url: 'https://www.thegreengrid.org/node/372',
    checkedDate: '2026-09-08',
    claim: 'PUE is facility energy divided by ICT equipment energy.',
    limitation:
      'Selected values and constant power multiplication are illustrative assumptions.',
  },
  {
    id: 'density',
    title: 'Temperature, Density and Salinity',
    publisher: 'Woods Hole Oceanographic Institution',
    url: 'https://www.whoi.edu/ocean-learning-hub/multimedia/temperature-density-and-salinity/',
    checkedDate: '2026-09-08',
    claim:
      'Seawater density is approximately 1.02–1.03 g/cm³ and varies with temperature and salinity.',
    limitation:
      '1,025 kg/m³ is an illustrative midpoint, not a site measurement.',
  },
  {
    id: 'heat-capacity',
    title: 'gsw_cp_t_exact: seawater heat capacity',
    publisher: 'TEOS-10 GSW',
    url: 'https://www.teos-10.org/pubs/gsw/html/gsw_cp_t_exact.html',
    checkedDate: '2026-09-08',
    claim:
      'Isobaric heat capacity depends on salinity, temperature and pressure; worked examples span roughly 3,960–4,003 J/(kg·K).',
    limitation:
      '3,990 J/(kg·K) is an illustrative constant, not a thermodynamic site solver.',
  },
  {
    id: 'natick',
    title: 'Project Natick',
    publisher: 'Microsoft Research',
    url: 'https://www.microsoft.com/en-us/research/project/natick/',
    checkedDate: '2026-09-08',
    claim: 'Historical experimental research investigated subsea datacenters.',
    limitation:
      'Does not validate this floating design or predict its reliability, cooling efficiency or economics.',
  },
];
