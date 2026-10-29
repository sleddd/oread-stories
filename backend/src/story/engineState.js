// A chat's story-engine state: the scene count, current stress, the last appraisal, the ledger
// of past appraisals (the character's memory of what happened) and the total drift per trait.

const DRIFT_DECIMALS = 3;

export function initialEngineState() {
  return { scene: 0, stress: 0, lastAppraisal: null, ledger: [], drift: {} };
}

// Fills gaps in state saved by older versions, or creates it for chats that have none.
export function normalizeEngineState(engineState) {
  return { ...initialEngineState(), ...(engineState ?? {}) };
}

export function appendToLedger(ledger, entry, ledgerLimit) {
  const extended = [...ledger, entry];
  return extended.slice(-ledgerLimit);
}

export function addDrift(totals, changes) {
  const nextTotals = { ...totals };
  for (const [axisId, change] of Object.entries(changes)) {
    const total = (nextTotals[axisId] ?? 0) + change;
    nextTotals[axisId] = Number(total.toFixed(DRIFT_DECIMALS));
  }
  return nextTotals;
}
