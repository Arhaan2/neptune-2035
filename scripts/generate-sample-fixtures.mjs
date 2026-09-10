/** Fresh, prescribed synthetic import samples for the current reference design.
 * No historical observations are read, remapped or promoted to measured data.
 * Legacy projects/fixtures remain unchanged; these are generated workflow examples.
 */
import { createServer } from 'vite';
import fs from 'node:fs/promises';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,entries:[]},server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'});
try {
  const {buildDesign,DEFAULT_CONFIG}=await server.ssrLoadModule('/src/twin/assets/design.ts');
  const {solveExchanger}=await server.ssrLoadModule('/src/twin/solvers/thermal.ts');
  const {SIMULATION_EPOCH_MS}=await server.ssrLoadModule('/src/twin/telemetry/generated.ts');
  const design=buildDesign(DEFAULT_CONFIG),moduleId=design.modules[0].id;
  const observations=[0,1,2,4,5].map(sequence=>({assetId:moduleId,metric:'temperatureK',value:37+sequence/10,unit:'C',sourceId:'generated:import-fixture',evidence:'generated',observedAt:new Date(SIMULATION_EPOCH_MS+sequence*1000).toISOString(),receivedAt:new Date(SIMULATION_EPOCH_MS+sequence*1000+50).toISOString(),sequence,quality:['fixture-generated','simulated-clock'],mappingVersion:design.revision}));
  const columns=['assetId','metric','value','unit','sourceId','evidence','observedAt','receivedAt','sequence','quality','mappingVersion'];
  const csv=[columns.join(','),...observations.map(row=>columns.map(key=>Array.isArray(row[key])?row[key].join('|'):row[key]).join(','))].join('\n')+'\n';
  const calibration=Array.from({length:10},(_,i)=>{const boundary={technicalInletK:309+i,seawaterInletK:291+i/3,technicalFlowM3S:0.05+i/1000,seawaterFlowM3S:0.06,foulingResistanceKPerW:0};return {assetId:`${moduleId}/hx`,mappingVersion:design.revision,sourceId:'generated:calibration-fixture',evidence:'generated',observedAt:new Date(SIMULATION_EPOCH_MS+i*1000).toISOString(),observedHeatW:solveExchanger({...boundary,cleanUAWPerK:280_000}).heatW,boundary};});
  await fs.mkdir('public/samples',{recursive:true});
  await fs.writeFile('public/samples/telemetry-generated.json',JSON.stringify({schemaVersion:2,observations},null,2)+'\n');
  await fs.writeFile('public/samples/telemetry-generated.csv',csv);
  await fs.writeFile('public/samples/calibration-generated.json',JSON.stringify(calibration,null,2)+'\n');
  console.log(JSON.stringify({evidence:'generated',mappingVersion:design.revision,observations:observations.length,calibrationSamples:calibration.length,calibrationTargetUAWPerK:280000}));
} finally {await server.close();}
