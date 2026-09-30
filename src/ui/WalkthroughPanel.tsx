import type { WalkthroughDefinition, WalkthroughPresentationShot } from '../twin/presentation/walkthrough';
import type { ModuleState } from '../twin/types';
import type { PlaybackState } from '../twin/presentation/playback';
import type { PresentationSceneReadiness } from '../scene/presentationCamera';
const number = (value: number) => value.toLocaleString('en-US', {maximumFractionDigits: 3});
export function WalkthroughPanel({ walkthrough, index, shot, shotIndex, shotCount, playback, scene, reducedMotion, historyMatches, displayedModule, displayTimeS, onStep, onShot, onPlay, onPause, onResume, onRestart, onExit, onReview, onPreviousBoundary }: {
  walkthrough: WalkthroughDefinition; index: number; shot: WalkthroughPresentationShot; shotIndex: number; shotCount: number;
  playback: PlaybackState; scene: PresentationSceneReadiness | null; reducedMotion: boolean; historyMatches: boolean; displayedModule: ModuleState | null; displayTimeS: number | null;
  onStep: (index: number) => void; onShot: (index: number) => void; onPlay: () => void; onPause: () => void; onResume: () => void; onRestart: () => void; onExit: () => void; onReview: () => void; onPreviousBoundary: () => void;
}) {
  const guide = (button: HTMLButtonElement, action: () => void) => {
    const disclosure = button.closest('section')?.querySelector('details');
    if (disclosure) disclosure.open = false;
    action();
  };
  const step = walkthrough.steps[index];
  const resolved = historyMatches && scene?.timeS === displayTimeS && scene?.stepId === step.id && scene.shot === shot.kind && scene.selectedId === shot.assetId && scene.sourceKey === playback.sourceKey && scene.status !== 'settling';
  const status = playback.phase === 'paused' ? 'paused' : playback.phase === 'completed' && resolved ? 'completed' : resolved && ['ready','playing'].includes(playback.phase) ? 'ready' : 'loading';
  const showing = resolved && playback.phase !== 'resolving' && playback.phase !== 'error';
  const caption = showing ? shot.caption : playback.phase === 'paused' ? 'Guidance is paused. Inspect the displayed scene freely; Resume reapplies this chapter.' : playback.phase === 'error' ? playback.reason : 'Resolving the recorded boundary, equipment and camera. Reading time starts when this view is ready.';
  const readiness = scene?.token === String(playback.token) ? scene.status === 'settling' ? 'settling' : scene.representation : 'pending';
  const record = { campaignId: walkthrough.campaign.id, campaignIdentity: walkthrough.result.campaignIdentity, evidenceIdentity: walkthrough.evidenceIdentity, runId: walkthrough.run.id,
    sourceKey: playback.sourceKey, requestToken: playback.token, provenance: walkthrough.result.provenance, stepId: step.id, stepIndex: index, stepSource: step.source,
    shotId: shot.id, shotIndex, shotCount, title: showing ? shot.title : 'Preparing the view', caption, requestedTimeS: shot.timeS, displayedTimeS: displayTimeS, boundary: shot.boundary, eventId: shot.eventId,
    assetId: shot.assetId, authoredKind: shot.authoredKind, status: playback.phase, automatic: playback.automatic, elapsedReadingMs: playback.elapsedMs, readiness, scene };
  return <section className="operator-walkthrough" aria-label="Fault and recovery walkthrough" data-testid="operator-walkthrough"
    data-step-index={index} data-step-count={walkthrough.steps.length} data-step-id={step.id} data-step-title={step.title} data-run-id={walkthrough.run.id} data-status={status}
    data-presentation-status={playback.phase} data-shot-index={shotIndex} data-shot-count={shotCount} data-shot-id={shot.id} data-source-identity={walkthrough.evidenceIdentity}
    data-request-token={playback.token} data-requested-time={shot.timeS} data-display-time={displayTimeS ?? ''} data-readiness={readiness} data-auto-advance={playback.automatic} data-presentation-record={JSON.stringify(record)}>
    <div className="walkthrough-heading"><span className="twin-eyebrow" aria-live="polite">{step.chapter} · {index + 1}/{walkthrough.steps.length}</span><span className="walkthrough-status">{playback.phase === 'playing' ? 'Playing presentation' : playback.phase}</span></div>
    <h2>{showing ? shot.title : playback.phase === 'paused' ? 'Paused for inspection' : playback.phase === 'error' ? 'This view needs attention' : 'Preparing the view'}</h2>
    <p className="walkthrough-caption" data-testid="presentation-caption" role={playback.phase === 'error' ? 'alert' : undefined}>{caption}</p>
    {showing && step.id === 'downstream' && displayedModule && <p className="walkthrough-operating" data-testid="presentation-service">{displayedModule.id} · {number(displayedModule.availableAccelerators)} useful accelerators available at this boundary</p>}
    <p className="walkthrough-time">{step.boundary === 'at-or-after' ? 'Metric marker' : 'Requested boundary'} {step.timeS} s · actual displayed scene {displayTimeS === null ? 'unavailable / resolving' : `${displayTimeS} s`}</p>
    <div className="twin-actions walkthrough-controls">
      {step.id === 'decision' && <button onClick={onReview}>Review evidence</button>}
        {playback.phase !== 'completed' && (!playback.automatic && !['paused','error'].includes(playback.phase) && <button onClick={event => guide(event.currentTarget, onPlay)}>Play presentation</button>)}
      {playback.phase !== 'completed' && (['paused','error'].includes(playback.phase) ? <button onClick={event => guide(event.currentTarget, onResume)}>Resume walkthrough</button> : <button onClick={onPause}>Pause walkthrough</button>)}
      <button disabled={index === 0} onClick={() => onStep(index - 1)}>Previous walkthrough step</button>
      <button disabled={index === walkthrough.steps.length - 1} onClick={() => onStep(index + 1)}>Next walkthrough step</button>
      <button onClick={onExit}>Exit walkthrough</button>
    </div>
    {showing && step.id === 'decision' && <div className="walkthrough-result" data-testid="presentation-result" data-ranking-status={walkthrough.summary.decisionStatus}>
      <p><strong>{walkthrough.summary.preferredCandidates.length ? `${walkthrough.summary.tied ? 'Tied preference' : 'Evaluated preference'}: ${walkthrough.summary.preferredCandidates.map(item => item.label).join(' · ')}` : 'No evaluated candidate meets the declared complete suite.'}</strong></p>
      <dl><div><dt>{walkthrough.summary.scenarioLabel} outcome</dt><dd>{walkthrough.summary.scenarioOutcome}</dd></div><div><dt>Whole-run interruption</dt><dd>{number(walkthrough.summary.totalInterruptionS)} s</dd></div><div><dt>Whole-run unmet service</dt><dd>{number(walkthrough.summary.shortfallAcceleratorS)} accelerator-s</dd></div></dl>
      <p>{walkthrough.summary.scope.candidates} candidates · {walkthrough.summary.scope.scenarios} scenarios · {walkthrough.summary.scope.completedRuns}/{walkthrough.summary.scope.plannedRuns} completed runs. {walkthrough.campaign.scenarios.every(item => item.kind === 'nominal') ? 'Nominal comparison only; fault resilience was not evaluated.' : 'Preference applies to the declared campaign requirements.'}</p>
    </div>}
    <div className="walkthrough-secondary"><details data-ui-overlay onToggle={event => {if(event.currentTarget.open) onPause();}}><summary>Details</summary>
      <h3>{step.title}</h3><p>{step.explanation}</p>
      <p>Source: {walkthrough.result.provenance === 'executed' ? 'executed simulated campaign' : 'imported supplied campaign evidence'}. Run <code>{walkthrough.run.id}</code>. Captured evidence <code>{walkthrough.evidenceIdentity}</code>.</p>
      <p>Evaluated design: {walkthrough.designSummary.candidateLabel}, {walkthrough.designSummary.provisionedAccelerators} installed accelerators, {walkthrough.designSummary.modules} modules. {reducedMotion ? 'Reduced motion: framing is immediate. Play presentation explicitly chooses automatic chapter advancement without camera motion.' : 'Presentation time controls camera movement and reading holds only; no simulation or measured values are interpolated.'}</p>
      <label>Presentation view<select aria-label="Presentation view" value={shotIndex} onChange={event => onShot(Number(event.target.value))}>{walkthrough.steps.flatMap(item => item.shots).map((item, i) => <option key={item.id} value={i}>{i + 1}. {item.title}</option>)}</select></label>
      <div className="twin-actions"><button onClick={event => guide(event.currentTarget, onRestart)}>Restart presentation</button>{step.boundary === 'at-or-after' && <button onClick={onPreviousBoundary}>Inspect boundary before metric marker</button>}{step.id !== 'decision' && <button onClick={onReview}>Review evidence</button>}</div>
      <p>Exit returns to the loaded current checkpoint. The prior project remains in saved scenarios in Compare; restoration is explicit. Private observations and stream URLs are excluded from default saves; incompatible design revisions reset observation mapping.</p>
    </details>
    <span>{walkthrough.result.provenance === 'executed' ? 'Recorded simulation' : 'Imported supplied evidence'}{showing && scene?.representation !== 'authored' && shot.authoredKind ? ' · procedural fallback; authored showcase unavailable' : ''}</span>
    </div>
    <small>Simulated, design-stage prototype; physical validation pending.</small>
  </section>;
}
