import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PAIRED_SENSITIVITIES, createDecisionCampaign, validateDecisionCampaign, planDecisionCampaign, runDecisionCampaign,
  createDecisionWorkerExecutor, exportDecisionCampaign, importDecisionCampaign, decisionReport, compareReproduction,
} from '../twin/decision';
import type { DecisionCampaign, DecisionFixture, DecisionResult, DecisionExport, PlannedDecisionRun } from '../twin/decision/types';
import type { Design, SimulationState } from '../twin/types';
import { readDecisionDraft, writeDecisionDraft } from './decisionStorage';

const format = (value: number | null | undefined, digits = 3) => value == null ? 'unavailable' : value.toLocaleString('en-US', {maximumFractionDigits: digits});
function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fixtures: [DecisionFixture, string][] = [
  ['transfer', 'A · Eligible feeder fault'], ['no-benefit-bus', 'B · Include receiving-bus failure'],
  ['no-benefit-source', 'B · Include common-source failure'], ['nominal', 'C · Nominal only'],
  ['sizing', 'D · Discrete workload sizing'], ['sensitivity', 'E · Paired sensitivity and thermal observation'],
];
export function DecisionPanel({hidden, activeDesign, state, busy, onLoad, onRun}: {
  hidden: boolean; activeDesign: Design; state: SimulationState | null; busy: boolean;
  onLoad: (run: PlannedDecisionRun) => void; onRun: (run: PlannedDecisionRun) => void;
}) {
  const [campaign, setCampaign] = useState(() => createDecisionCampaign('transfer'));
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [resultCampaign, setResultCampaign] = useState<DecisionCampaign | null>(null);
  const [running, setRunning] = useState(false), [problem, setProblem] = useState('');
  const [storage, setStorage] = useState('Recovering local decision draft…'), [recovered, setRecovered] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [scenarioId, setScenarioId] = useState(''), [sensitivityId, setSensitivityId] = useState('central');
  const [imported, setImported] = useState<DecisionExport | null>(null), [reproduction, setReproduction] = useState('');
  const sourceIdentity = useRef({commit:'unpackaged-development',sourceTree:'unpackaged-development'});
  const resultSource = useRef({commit:'unpackaged-development',sourceTree:'unpackaged-development'});
  const abort = useRef<AbortController | null>(null), epoch = useRef(0), edited = useRef(false);
  const invalidate = useCallback(() => { abort.current?.abort(); epoch.current++; }, []);
  const current = useMemo(() => {
    try { validateDecisionCampaign(campaign); return {plan: planDecisionCampaign(campaign), error: ''}; }
    catch (error) { return {plan: null, error: String(error)}; }
  }, [campaign]);
  const stale = Boolean(result && result.campaignIdentity !== current.plan?.campaignIdentity);
  const evidenceCampaign = resultCampaign ?? campaign;
  const inspectedPlan = result && !stale ? result.plan : current.plan;
  const candidate = evidenceCampaign.candidates.find(item => item.id === selected) ?? campaign.candidates.find(item => item.id === selected);
  const choices = inspectedPlan?.runs.filter(run => run.candidateId === selected) ?? [];
  const selectedRun = choices.find(run => run.scenarioId === scenarioId && run.sensitivityId === sensitivityId) ?? choices[0];
  const loaded = Boolean(selectedRun && activeDesign.revision === selectedRun.design.revision && state?.experiment?.definition.id === selectedRun.definition.id);
  const inspect = (id: string) => {
    setSelected(id);
    const runs = inspectedPlan?.runs.filter(run => run.candidateId === id) ?? [];
    setScenarioId(runs.find(run => run.definition.disturbances.length > 0)?.scenarioId ?? runs[0]?.scenarioId ?? '');
    setSensitivityId('central');
  };
  const edit = (next: DecisionCampaign) => {
    edited.current = true;
    if (running) abort.current?.abort();
    setCampaign(next); setImported(null); setProblem(''); setReproduction('');
  };
  useEffect(() => {
    let active = true;
    void fetch(new URL('release.json', window.location.href), {cache:'no-store'}).then(response => response.json()).then((release: {sourceSha?:string;sourceTree?:string}) => {if(active && /^[a-f0-9]{40}$/.test(release.sourceSha ?? '') && /^[a-f0-9]{40}$/.test(release.sourceTree ?? ''))sourceIdentity.current={commit:release.sourceSha!,sourceTree:release.sourceTree!};}).catch(() => {});
    void readDecisionDraft().then(text => {
      if (!active || edited.current || !text) return;
      const draft = JSON.parse(text) as {version: number; campaign: DecisionCampaign; evidence: string | null};
      if (draft.version !== 1) throw Error('Unsupported saved decision draft version.');
      validateDecisionCampaign(draft.campaign);
      setCampaign(draft.campaign);
      if (draft.evidence) {
        const saved = importDecisionCampaign(draft.evidence);
        setResult(saved.result); setResultCampaign(saved.campaign); setImported(saved); resultSource.current=saved.sourceIdentity;
      }
      setStorage('Recovered local decision draft. Stored outcomes are supplied evidence; rerun to verify.');
    }).catch(error => { if (active) setStorage(`Saved draft retained but not loaded: ${String(error)}`); })
      .finally(() => { if (active) {setRecovered(true); setStorage(value => value === 'Recovering local decision draft…' ? 'Decision draft stored on this device.' : value);} });
    return () => {active = false; invalidate();};
  }, [invalidate]);
  useEffect(() => {
    if (!recovered || running) return;
    const timer = setTimeout(() => {
      let text: string;
      try { text = JSON.stringify({version: 1, campaign, evidence: result && resultCampaign ? exportDecisionCampaign(resultCampaign, result, resultSource.current) : null}); }
      catch (error) { setStorage(`Evidence not saved: ${String(error)}`); return; }
      void writeDecisionDraft(text).then(() => setStorage('Decision draft and bounded evidence stored on this device.')).catch(error => setStorage(`Local storage unavailable: ${String(error)} Export the campaign to retain it.`));
    }, 250);
    return () => clearTimeout(timer);
  }, [campaign, result, resultCampaign, recovered, running]);
  async function start(compare = false) {
    if (!current.plan || running) return;
    const snapshot = structuredClone(campaign), controller = new AbortController(), runEpoch = ++epoch.current;
    abort.current?.abort(); abort.current = controller; resultSource.current=sourceIdentity.current; setRunning(true); setProblem(''); setReproduction(''); setResult(null); setResultCampaign(snapshot);
    const executor = createDecisionWorkerExecutor();
    try {
      const completed = await runDecisionCampaign(snapshot, {signal: controller.signal, executor, onProgress: progress => {if (runEpoch === epoch.current) setResult(progress);}});
      if (runEpoch !== epoch.current) return;
      setResult(completed);
      if (compare && imported) {
        const check = compareReproduction(imported, completed);
        setReproduction(check.matches ? 'Reproduction matched: real engine reran all declared cells; metrics and ranking agree within declared tolerances.' : `Reproduction mismatch: ${check.differences.join('; ')}`);
      }
    } catch (error) { if (runEpoch === epoch.current) setProblem(String(error)); }
    finally { executor.dispose(); if (runEpoch === epoch.current) setRunning(false); }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw Error('Decision import exceeds 64 MiB.');
      const evidence = importDecisionCampaign(await file.text());
      abort.current?.abort(); epoch.current++; edited.current = true; setRunning(false);
      setCampaign(evidence.campaign); setResult(evidence.result); setResultCampaign(evidence.campaign); setImported(evidence); resultSource.current=evidence.sourceIdentity;
      setSelected(null); setProblem(''); setReproduction('Imported supplied evidence; outcomes have not been independently rerun in this session.');
    } catch (error) { setProblem(`Import rejected; current campaign retained. ${String(error)}`); }
  }
  const req = (key: keyof DecisionCampaign['requirements'], value: number) => edit({...campaign, requirements: {...campaign.requirements, [key]: value}});
  return <section className="twin-card decision-panel" aria-label="Phase 6 decision support" hidden={hidden}>
    <h2>Phase 6 · Decision support</h2>
    <p>Simulated, design-stage prototype; physical validation pending.</p>
    <p>Choose among a declared discrete menu using full experiment histories. Included cost is an assumption-based equipment, installation and contingency estimate in USD; excluded costs remain unassessed.</p>
    <div className="experiment-fields">
      <label>Named demonstration<select aria-label="Decision fixture" value={campaign.fixture} onChange={event => edit(createDecisionCampaign(event.target.value as DecisionFixture))}>{fixtures.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Objective<select aria-label="Decision objective" value={campaign.objective.mode} onChange={event => edit(createDecisionCampaign(event.target.value === 'maximum-passing-workload' ? 'sizing' : 'transfer'))}><option value="minimum-included-cost">Lowest included cost for fixed workload</option><option value="maximum-passing-workload">Largest passing requested workload</option></select></label>
      <label>Assumption cases<select aria-label="Decision assumption cases" value={campaign.sensitivities.length === 1 ? 'central' : 'paired'} onChange={event => edit({...campaign,sensitivities:structuredClone(event.target.value === 'central' ? PAIRED_SENSITIVITIES.slice(0,1) : PAIRED_SENSITIVITIES)})}><option value="central">Central estimate only</option><option value="paired">Central and eight paired OFAT cases</option></select></label>
      <label>Budget, USD (blank = unset)<input aria-label="Decision budget USD" type="number" min="0" value={campaign.objective.budgetUSD ?? ''} onChange={event => edit({...campaign, objective:{...campaign.objective, budgetUSD: event.target.value === '' ? null : Number(event.target.value)}})}/></label>
      <label>Budget basis<select aria-label="Decision budget basis" value={campaign.objective.budgetBasis} onChange={event => edit({...campaign, objective:{...campaign.objective, budgetBasis:event.target.value as 'central'|'upper-bound'}})}><option value="central">Central included cost</option><option value="upper-bound">Upper included-cost bound</option></select></label>
      <label>Ranking cost basis<select aria-label="Decision ranking cost basis" value={campaign.objective.rankingCostBasis} onChange={event => edit({...campaign, objective:{...campaign.objective, rankingCostBasis:event.target.value as 'central'|'upper-bound'}})}><option value="central">Central included cost</option><option value="upper-bound">Upper included-cost bound</option></select></label>
      <label>Upstream supply ceiling, W (blank = unset)<input aria-label="Decision supply ceiling W" type="number" min="0" value={campaign.objective.supplyCeilingW ?? ''} onChange={event => edit({...campaign, objective:{...campaign.objective, supplyCeilingW:event.target.value === '' ? null : Number(event.target.value)}})}/></label>
      <label>Fault unmet demand limit, accelerator-s<input aria-label="Decision fault unmet accelerator seconds" type="number" min="0" value={campaign.requirements.faultUnmetAcceleratorS} onChange={event => req('faultUnmetAcceleratorS', Number(event.target.value))}/></label>
      <label>Total service interruption limit, s<input aria-label="Decision interruption seconds" type="number" min="0" value={campaign.requirements.totalInterruptionS} onChange={event => req('totalInterruptionS', Number(event.target.value))}/></label>
      <label>Confirmed recovery deadline, absolute s<input aria-label="Decision recovery deadline seconds" type="number" min="0" value={campaign.requirements.recoveryConfirmationDeadlineS} onChange={event => req('recoveryConfirmationDeadlineS', Number(event.target.value))}/></label>
      <label>Continuous recovery dwell, s<input aria-label="Decision recovery dwell seconds" type="number" min="0" value={campaign.requirements.recoveryDwellS} onChange={event => req('recoveryDwellS', Number(event.target.value))}/></label>
      <label>Thermal-limit duration allowance, s<input aria-label="Decision thermal violation seconds" type="number" min="0" value={campaign.requirements.thermalViolationS} onChange={event => req('thermalViolationS', Number(event.target.value))}/></label>
    </div>
    <p>Nominal unmet demand must be zero. Requested useful accelerators, installed capacity and utilization are distinct. Recovery deadline uses absolute evaluation time; continuous dwell confirmation is required after interruption.</p>
    <details><summary>Inspect candidate menu, scenarios, sensitivities and execution plan</summary>
      <p>{current.plan ? `${current.plan.candidates} candidates × ${current.plan.scenarios} scenarios × ${current.plan.sensitivities} assumption cases; ${current.plan.totalRuns} planned runs, ${current.plan.sharedBaselines} baseline references shared. At most ${campaign.execution.concurrency} concurrent workers.` : 'No valid execution plan.'}</p>
      <p>{campaign.sensitivityNote}</p><p>Only the declared observation horizon is assessed. Thermal settling is not requested; the 12-second transfer fixture does not establish long-term thermal adequacy.</p>
      <pre>{JSON.stringify({objective:campaign.objective, requirements:campaign.requirements,candidates:campaign.candidates.map(item => ({id:item.id,label:item.label,workload:item.workload,physicalIdentity:item.physicalIdentity,specificationIdentity:item.specificationIdentity,topology:item.topology,controllerPolicy:item.controllerPolicy})),scenarios:campaign.scenarios,sensitivities:campaign.sensitivities,execution:campaign.execution,costPolicy:campaign.costPolicy,tolerances:campaign.tolerances,versions:campaign.versions},null,2)}</pre>
    </details>
    <div className="twin-actions"><button disabled={running || !current.plan || !recovered} onClick={() => void start()}>Start decision campaign</button><button disabled={!running} onClick={() => abort.current?.abort()}>Cancel decision campaign</button><button disabled={!result || !resultCampaign || running} onClick={() => download('neptune-decision-campaign.json',exportDecisionCampaign(resultCampaign!,result!,resultSource.current))}>Export decision campaign</button><button disabled={!result || !resultCampaign || running} onClick={() => download('neptune-decision-report.md',decisionReport(resultCampaign!,result!),'text/markdown')}>Export decision report</button><label className="decision-import">Import decision campaign<input aria-label="Import decision campaign" type="file" accept=".json,application/json" onChange={event => {void importFile(event.target.files?.[0]);event.target.value='';}}/></label>{imported && <button disabled={running || stale || !current.plan} onClick={() => void start(true)}>Recompute imported campaign</button>}</div>
    {(current.error || problem) && <p role="alert">{current.error || problem}</p>}
    <p className="muted">{storage}</p>
    <output data-testid="decision-coverage" data-status={running ? 'running' : result?.status ?? 'ready'} data-completed={result?.coverage.completed ?? 0} data-planned={result?.coverage.planned ?? current.plan?.totalRuns ?? 0} aria-live="polite">{result ? `${result.coverage.completed}/${result.coverage.planned} runs completed; ${result.coverage.fullyEvaluatedCandidates}/${result.plan.candidates} candidates fully evaluated. ${running ? 'Running' : result.status}.` : `Ready: ${current.plan?.totalRuns ?? 0} planned runs.`}</output>
    {stale && <output data-testid="decision-stale">Results are stale: campaign inputs changed. Export retains the original evaluated definitions. Rerun the current inputs before using a recommendation.</output>}
    {result && <>
      <div data-testid="decision-recommendation" data-ranking-status={stale ? 'stale' : result.ranking.status} className="decision-recommendation">
        <strong>{stale ? 'Historical result — inputs changed' : result.ranking.status.replaceAll('-', ' ')}</strong>
        <p>{result.provenance === 'imported-supplied-evidence' && 'Imported supplied evidence. '}{evidenceCampaign.objective.mode === 'minimum-included-cost' ? 'Lowest included cost' : 'Largest passing requested workload'} across {result.plan.candidates} declared candidates and {result.plan.scenarios} scenarios. {result.ranking.winnerIds.length ? `Preferred evaluated candidate${result.ranking.winnerIds.length > 1 ? 's (tie)' : ''}: ${result.ranking.winnerIds.map(id => evidenceCampaign.candidates.find(item => item.id === id)?.label ?? id).join(', ')}.` : 'No compliant recommendation is available.'} {!result.ranking.scopeComplete && 'Evaluation is incomplete; any preferred candidates are provisional within completed coverage.'}</p>
        {result.ranking.winnerIds.map(id => {const row=result.evaluations.find(item=>item.candidateId===id&&item.sensitivityId==='central');return <p key={id}>Assessed limits for {evidenceCampaign.candidates.find(item=>item.id===id)?.label ?? id}: {row?.requirements.filter(item=>item.class==='operating'&&item.scenarioId!=='nominal').map(item=>`${item.scenarioId} ${item.id}: ${format(item.actual)} ≤ ${format(item.threshold)} ${item.unit}; margin ${format(item.margin)} (${item.status})`).join('; ') || 'Zero nominal unmet demand and thermal violation required; inspect full constraint margins below.'}</p>;})}
        <p>{result.sensitivityConclusion}</p>{evidenceCampaign.scenarios.every(item => item.kind === 'nominal') && <p>Nominal-only coverage: this is not a fault-resilience recommendation.</p>}
      </div>
      <div className="decision-table-scroll"><table className="decision-table"><caption>Central assumptions · full-run operating evidence</caption><thead><tr><th>Candidate / requested capacity</th><th>Included cost, USD</th><th>Feasibility / coverage</th><th>Worst unmet accelerator-s</th><th>Total / longest interruption, s</th><th>Confirmed recovery, absolute s</th><th>Thermal duration, s / upstream peak, W</th><th>Reasons and limiting requirements</th><th>Inspect</th></tr></thead><tbody>{result.evaluations.filter(row => row.sensitivityId === 'central').map(row => <tr key={row.candidateId} data-testid={`decision-row-${row.candidateId}`}><th>{evidenceCampaign.candidates.find(item => item.id === row.candidateId)?.label ?? row.candidateId}<br/>{format(row.workload,0)} requested</th><td>{row.includedCost.completeWithinIncludedScope ? format(row.rankingCostUSD,2) : `Unknown total; known subtotal ${format(row.includedCost.totalUSD,2)}`}<br/>{evidenceCampaign.objective.rankingCostBasis}<details><summary>Included cost breakdown</summary><p>Equipment {format(row.includedCost.equipment,2)}; installation {format(row.includedCost.installation,2)}; contingency {format(row.includedCost.contingency,2)} USD. Budget cost {format(row.budgetCostUSD,2)} USD. {row.includedCost.exclusions}</p><pre>{JSON.stringify(row.includedCost.rows,null,2)}</pre></details></td><td>{row.feasibility}<br/>{row.execution}<br/>{row.completedRuns}/{row.requiredRuns} runs</td><td>{format(row.worst.shortfallAcceleratorS)}</td><td>{format(row.worst.totalInterruptionS)} / {format(row.worst.longestInterruptionS)}</td><td>{format(row.worst.recoveryConfirmationS)}</td><td>{format(row.worst.thermalViolationS)} / {format(row.worst.peakSupplyW)}</td><td>{row.reasons.join('; ') || 'All evaluated requirements satisfied.'}<details><summary>Exact constraint margins</summary>{row.requirements.map((item,index) => <p key={`${item.id}-${index}`}>{item.class} · {item.id}: {item.status}; {format(item.actual,8)} {item.operator} {format(item.threshold,8)} {item.unit}, margin {format(item.margin,8)}, tolerance {item.tolerance}. {item.scenarioId ?? 'design'} / {item.sensitivityId}; {item.assetIds.join(', ')} {item.timeS === null ? '' : `at ${item.timeS} s`}. {item.reason}</p>)}</details></td><td><button onClick={() => inspect(row.candidateId)}>Inspect candidate</button></td></tr>)}</tbody></table></div>
      <details><summary>Paired sensitivity rankings and feasible sets</summary>{result.sensitivityRankings.map(ranking => <p key={ranking.sensitivityId}>{ranking.sensitivityId}: {ranking.status}; preferred {ranking.winnerIds.join(', ') || 'none'}; feasible {ranking.feasibleCandidateIds.join(', ') || 'none'}; unresolved {ranking.unresolvedCandidateIds.join(', ') || 'none'}.</p>)}</details>
    </>}
    {!result && <div className="twin-actions">{campaign.candidates.map(item => <button key={item.id} onClick={() => inspect(item.id)}>Inspect candidate · {item.label}</button>)}</div>}
    {candidate && <section className="decision-inspection" aria-label="Decision candidate inspection"><h3>{candidate.label}</h3>
      <label>Scenario<select aria-label="Decision scenario" value={selectedRun?.scenarioId ?? ''} onChange={event => setScenarioId(event.target.value)}>{Array.from(new Set(choices.map(run => run.scenarioId))).map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <label>Assumption case<select aria-label="Decision sensitivity" value={selectedRun?.sensitivityId ?? ''} onChange={event => setSensitivityId(event.target.value)}>{Array.from(new Set(choices.map(run => run.sensitivityId))).map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <p>Inspection does not replace the active project. Loading preserves its checkpoint in Compare. Running uses this exported scenario and actual initial conditions.</p>
      <div className="twin-actions"><button disabled={!selectedRun || busy || running} onClick={() => {try{onLoad(selectedRun!);setProblem('');}catch(error){setProblem(String(error));}}}>Load selected candidate</button><button disabled={!selectedRun || !loaded || busy || running} onClick={() => onRun(selectedRun!)}>Run selected experiment</button><button onClick={() => setSelected(null)}>Close candidate inspection</button></div>
      <details><summary>Resolved design, fault targets and actual initialization</summary><pre>{JSON.stringify(selectedRun ?? candidate,null,2)}</pre></details>
    </section>}
    {reproduction && <output data-testid="decision-reproduction">{reproduction}</output>}
    <details><summary>Unassessed conditions and excluded search space</summary><ul>{campaign.exclusions.map(item => <li key={item}>{item}</li>)}</ul><p>No global optimality, failure probability, real-world availability or physical validation is inferred from these deterministic scenarios.</p></details>
  </section>;
}
