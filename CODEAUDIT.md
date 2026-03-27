# Code Audit

## Scope

This document summarizes the current audit status of the `ioBroker.ankersolix2` adapter with a focus on:

- Performance
- Security
- Operational robustness

The goal is to create a working document that can be updated incrementally while the findings are addressed.

## Executive Summary

The adapter is functionally useful and already contains a fair amount of domain logic for Anker Solix devices, polling, energy analysis, and control workflows.

At the same time, the current implementation shows a clear gap between "feature-complete enough to run" and "robust enough to trust under load and during edge cases".

The highest-priority concerns are:

1. State-driven control paths can react to acknowledged states and may trigger unintended writes to the cloud API.
2. The configured API server is not strictly restricted on the backend side, which creates a credential and token exfiltration risk.
3. The polling and publish pipeline does too much dynamic work per cycle and does not consistently preserve backpressure.
4. The analysis pipeline appears both more expensive than necessary and partially incorrect for multi-site scenarios.
5. Critical behavior is largely untested.

## Overall Assessment

Current state: functional, but not yet hardened.

This adapter should currently be treated as a community-grade implementation with real value, but with meaningful technical debt in the areas that matter most for production confidence:

- Write safety
- API trust boundaries
- Polling efficiency
- Error containment
- Test coverage

## Findings

### 1. High: Control paths react to acknowledged states

Severity: High
Category: Security / Safety / Robustness

Relevant code:

- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L128)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L1100)
- [src/lib/schedule.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/lib/schedule.ts#L59)

Summary:

The adapter reacts to subscribed state changes without requiring `state.ack === false`.

Status:

Resolved in code on 2026-03-27.

Implementation note:

- `HomeLoadID` now only reacts to confirmed values (`ack: true`).
- Adapter-owned command states reject acknowledged changes before triggering writes.
- Timeplan activation no longer re-triggers control indirectly by writing an acknowledged foreign state back into the event chain.

Why this matters:

- A confirmed state can still trigger write actions.
- The adapter can react to its own confirmed writes or to confirmed writes coming from other sources.
- In the worst case this can cause unintended cloud control operations against real devices.

Observed examples:

- `setHomeLoadID(true, true)` writes the foreign state with `ack: true`.
- `onStateChange()` does not reject acknowledged states before calling:
  - `setControlByAdapter(...)`
  - `setACLoading(...)`
  - `setPowerPlan(...)`

Impact:

- Unexpected cloud writes
- Hard-to-debug feedback loops
- Unsafe device behavior under automation chains

Recommended remediation:

- Reject acknowledged states in all control paths unless there is a very explicit reason not to.
- Split read synchronization from command execution.
- Add debounce / deduplication for control writes where repeated values are common.

Suggested priority: Immediate

### 2. High: API server is not backend-whitelisted

Severity: High
Category: Security

Relevant code:

- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L141)
- [src/lib/api.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/lib/api.ts#L309)

Summary:

The backend validation only checks that `API_Server` exists. It does not enforce that the configured host is one of the known Anker API endpoints.

Why this matters:

- UI restrictions alone are not a trust boundary.
- Config can still be imported, manipulated, or written outside the Admin UI.
- Credentials and auth tokens could be sent to an attacker-controlled endpoint.

Impact:

- Credential exfiltration
- Token exfiltration
- SSRF-style misuse through arbitrary outbound requests

Recommended remediation:

- Enforce a strict allowlist in runtime validation.
- Reject startup when `API_Server` is not one of the supported official hosts.
- Consider normalizing the configured URL before comparison.

Suggested priority: Immediate

### 3. High: Polling and publish pipeline creates unnecessary load

Severity: High
Category: Performance / Robustness

Relevant code:

- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L330)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L554)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L571)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L617)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L679)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L752)

Summary:

The adapter performs a large amount of dynamic object creation and state writes on every poll cycle, and several asynchronous operations are triggered recursively without consistent awaiting.

Observed patterns:

- Repeated `extendObject(...)` calls for already-known objects
- Repeated deep clone patterns via `JSON.parse(JSON.stringify(...))`
- Recursive publish traversal with mixed sync/async flow
- State writes using `setState(...)` instead of change-aware updates in many places

Why this matters:

- Avoidable ioBroker DB load
- Avoidable CPU and GC pressure
- Harder timing behavior under larger payloads or multiple sites
- Reduced resilience during API slowness

Impact:

- Lower efficiency
- Higher latency
- Increased probability of overlapping work under slow runs

Recommended remediation:

- Cache object existence and skip repeated `extendObject(...)` where possible.
- Replace deep clone patterns with direct traversal unless mutation is required.
- Refactor recursive parsing to a fully awaited model or a controlled worker queue.
- Prefer `setStateChanged(...)` / `setStateChangedAsync(...)` where semantically correct.

Suggested priority: Immediate

### 4. Medium: Delay logic is partially ineffective

Severity: Medium
Category: Performance / Robustness

Relevant code:

- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L397)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L463)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L490)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L537)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L547)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L875)

Summary:

Several calls to `sleep(...)` are not awaited and therefore do not actually delay request execution.

Why this matters:

- If these waits are intended to reduce API pressure, they currently do not do that.
- The code suggests rate limiting exists, but behavior does not match the intent.

Impact:

- Higher request burstiness
- Larger chance of remote throttling or rate-limit issues

Recommended remediation:

- Audit every `sleep(...)` usage.
- Remove fake delays or replace them with properly awaited throttling.
- Consider a dedicated request scheduler if API pacing is required.

Suggested priority: High

### 5. Medium: Analysis pipeline has correctness and efficiency issues

Severity: Medium
Category: Performance / Correctness

Relevant code:

- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L400)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L416)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L437)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L475)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L522)

Summary:

The analysis path appears to reuse `scenInfo` across sites and issues "day" and "week" analysis requests with the request type hardcoded as `'week'`.

Why this matters:

- Multi-site behavior may be incorrect.
- Day-range output may not actually be generated from a day request.
- The feature is more expensive than necessary and harder to trust.

Impact:

- Potentially wrong analysis data
- Unnecessary API cost
- Lower confidence in the feature set

Recommended remediation:

- Re-fetch or scope `scenInfo` per site.
- Pass the actual `range` as the request type where appropriate.
- Add regression tests around day/week behavior and multi-site scenarios.

Suggested priority: High

### 6. Medium: Session token is stored in plaintext on disk

Severity: Medium
Category: Security

Relevant code:

- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L192)
- [src/main.ts](/z:/Dokumente/GitHub/ioBroker.ankersolix2/src/main.ts#L217)

Summary:

The adapter stores the login/session object including auth token in `session.json` in the instance data directory.

Why this matters:

- This extends the attack surface beyond the encrypted adapter password.
- Token theft may be enough to impersonate a valid session.

Impact:

- Local credential/session exposure
- Increased persistence of sensitive material

Recommended remediation:

- Minimize persisted session scope.
- Consider encrypting the persisted token or avoiding disk persistence entirely.
- At minimum, document the storage behavior and file sensitivity clearly.

Suggested priority: Medium

### 7. Medium: Critical paths are largely untested

Severity: Medium
Category: Quality / Robustness

Relevant code:

- [test/integration.js](/z:/Dokumente/GitHub/ioBroker.ankersolix2/test/integration.js)

Summary:

The repository currently appears to contain the standard test scaffold, but no meaningful targeted tests for critical adapter behavior.

Missing coverage areas:

- Login persistence and invalidation
- `ack` handling for control datapoints
- Power plan validation
- Analysis range handling
- API server validation
- Publish path behavior under repeated polling

Impact:

- High regression risk
- Low confidence during refactoring
- Slower hardening work

Recommended remediation:

- Add unit tests for helper logic first.
- Add adapter-level tests for state-change control behavior.
- Add regression tests for the issues listed in this audit before major refactors.

Suggested priority: High

## Remediation Roadmap

### Phase 1: Safety and Security

Goal: prevent unintended writes and close obvious trust-boundary gaps.

Tasks:

- Add `ack` guards to every control-triggered state path.
- Separate synchronization writes from command writes.
- Enforce a strict `API_Server` allowlist in runtime validation.
- Review whether control functions should verify admin status and object validity more defensively.

### Phase 2: Performance Hardening

Goal: reduce poll-cycle overhead and API pressure.

Tasks:

- Remove non-awaited sleep calls or replace them with real pacing.
- Reduce `JSON.parse(JSON.stringify(...))` cloning.
- Cache object creation decisions to avoid repeated `extendObject(...)`.
- Move to change-aware state writes where possible.
- Review whether parsing can be made iterative and fully awaited.

### Phase 3: Correctness

Goal: make analysis and control behavior predictable.

Tasks:

- Fix per-site analysis scoping.
- Fix day/week request typing.
- Validate all assumptions around `ControlSiteID` parsing.
- Review cloud write payload generation for minimality and correctness.

### Phase 4: Test Coverage

Goal: make future changes safe.

Tasks:

- Add unit tests for helper functions.
- Add regression tests for all findings marked High.
- Add basic tests for polling/publish behavior and message handling.

## Suggested Work Order

Recommended order for implementation:

1. `ack` guards on control flows
2. Backend allowlist for `API_Server`
3. Effective pacing / removal of fake delays
4. Publish pipeline optimization
5. Analysis correctness fixes
6. Token persistence hardening
7. Test coverage expansion

## Tracking

Use the checklist below as findings are addressed.

- [x] Finding 1 resolved: acknowledged-state semantics are now enforced for external control input and adapter-owned command states
- [ ] Finding 2 resolved: API server is strictly allowlisted
- [ ] Finding 3 resolved: poll/publish path reduced in object and state churn
- [ ] Finding 4 resolved: all request pacing is either effective or removed
- [ ] Finding 5 resolved: analysis path is correct for day/week and multi-site use
- [ ] Finding 6 resolved: session persistence is hardened or reduced
- [ ] Finding 7 resolved: critical-path tests exist

## Notes

This document reflects the current audit snapshot and should be updated as fixes are implemented, retested, or re-evaluated.
