# Changelog

## 2.8.0 — 2026-08-26

### Changed

- Picks up the js-sdk 2.8.0 date-operand change: a `Before`/`After` operand must be ISO-8601 or Unix seconds, so non-ISO formats like `05/15/2023` and `Jan 1 2024` match nothing rather than resolving in the host's local timezone, and the ISO `T`/`Z` designators are case-sensitive. (#2480)

- A `Before`/`After` date operand that matches the ISO grammar but names no real calendar day now matches nothing, where it previously **rolled over into the following month**. `2024-02-30` resolved to 2024-03-01, `2023-02-29` (2023 is not a leap year) to 2023-03-01 and `2024-04-31` to 2024-05-01 — so a rule evaluated against a date its author never wrote. The evaluation engine and the C#, Go, Python and Java SDKs have always rejected these, so this converges the SDKs rather than making this one an outlier; until now a single saved rule could serve different variations to two users purely by which SDK their service ran. Follows #2480, which pinned the date *grammar* — an unreal day is **inside** that grammar, because a character class cannot express "is a real day", so the grammar guard was silent on it. (#2491)

- The leap-year rule is applied in full, including the century exception: `1900-02-29` and `2100-02-29` match nothing (divisible by 100 but not 400), while `2000-02-29` and `2024-02-29` continue to match. The check runs on the operand's **written** date, before any offset is applied, so `2024-02-30T00:00:00+05:00` is rejected even though it would resolve to 2024-02-29T19:00Z — a date that does exist. (#2491)

**If you have a targeting rule using one of these operands**, rewrite it as the date you meant. The Management API has rejected an unreal day on write since #2480 (`PortableDateOperand` round-trips every grammar-matched operand through the engine's parser), so a rule saved from that release onward cannot carry one — only rules saved earlier are affected.

### Fixed

- A `Before`/`After` date operand that resolves outside the representable date range now matches nothing, where it previously resolved to a real instant. The evaluation engine parses with `DateTimeOffset.TryParse`, so its accepted range is 0001-01-01T00:00:00Z to 9999-12-31T23:59:59.999Z and it matches nothing outside that; this SDK resolved past **both** ends, so a single saved rule served different variations to two users purely by which SDK their service ran. (#2500)

- The two reachable shapes are a **year-zero** operand and an operand carried out of range **by its offset**. `0000-01-01` is inside the ISO grammar and is a real proleptic date (`0000-02-29` exists — year 0 is divisible by 400), so neither #2480's grammar guard nor #2491's calendar-day check excluded it. Separately, `[0-9]{4}` constrains only the **written** year while a timezone offset moves the resolved instant, so `0001-01-01T00:00:00+05:00` fell below the floor and `9999-12-31T23:59:59-05:00` rose above the ceiling from years the grammar allows. The check therefore runs on the **resolved** instant — deliberately unlike #2491's, which runs on the written date. (#2500)

- The exact boundaries remain accepted: `0001-01-01`, `0001-01-01T05:00:00+05:00`, `9999-12-31T23:59:59Z` and `9999-12-31T18:59:59-05:00` all still resolve. (#2500)

**If you have a targeting rule using one of these operands**, rewrite it as the date you meant. The Management API has rejected them on write since #2480 (`PortableDateOperand` round-trips every grammar-matched operand through the engine's own parser, so it inherits the range bound), meaning only rules saved before that release can carry one.

## 2.7.1 — 2026-08-24

### Fixed

- Picks up the js-sdk 2.7.1 date-operand fixes: a NUL- or separator-bearing operand no longer resolves in the host's local timezone, the trimmed whitespace class matches the engine's, and hour 24 matches nothing. (#2468)

## 2.7.0 — 2026-08-24

### Fixed

- Analytics events survive a transient failure of the events endpoint, and a non-2xx from it is no longer mistaken for a successful send. Both come from `@featureflip/js`. (#2456)

## 2.6.1 — 2026-08-23

### Changed

- Picks up `@featureflip/js` 2.6.1, which carries the fail-closed operator handling, the uniform `identify()`/`track()` payload, and config-payload validation. No change in this package's own code.

## 2.6.0 — 2026-08-20

### Changed

- Inherits this release's js-sdk changes: a type-mismatched read returns the caller's default and reports `'Error'` (#2281), and a closed handle serves the caller's default and reports not-initialized (#2310).

## 2.5.4 — 2026-08-18

### Fixed

- `require('@featureflip/node')` threw at module load. The CommonJS build loads `@featureflip/js` when the module is first required, and that package's CommonJS entrypoint was broken in every release since the first. Fixed in `@featureflip/js` 2.5.4; ESM consumers were unaffected (#2245).

## 2.5.3 — 2026-08-05

### Fixed

- `LICENSE` is now the verbatim Apache-2.0 text. Three phrases in the operative sections had been reworded and the appendix dropped, which left automated license scanners unable to identify it. The license itself is unchanged; the file now says what it always claimed to.
- The README's License section said MIT. `LICENSE`, `package.json` and the npm listing have always said Apache-2.0, which is the actual license.

## 2.5.2 — 2026-08-02

### Fixed

- Inherits the `@featureflip/js` 2.5.2 fix: the `User-Agent` reports the SDK's real version instead of the `0.1.0` it had been pinned to since the first release (#2141).

## 2.5.1 — 2026-07-30

### Fixed

- Inherits the `@featureflip/js` 2.5.1 fix: `on('update')` resolves prerequisites back to their dependents, so a dependent of a toggled prerequisite is no longer omitted from the reported keys (#2087).
- Inherits the `@featureflip/js` 2.5.1 fix: a same-version flag delta is applied rather than discarded, so two edits inside the same wall-clock second no longer leave the client evaluating the pre-edit configuration (#2090).
- Inherits the `@featureflip/js` 2.5.1 fix: full-snapshot change detection compares configuration rather than the second-granular `version`, so a same-second edit straddling a poll or SSE `sync` is reported to `on('update')` instead of silently applied (#2088).

## 2.5.0 — 2026-07-29

### Added

- **Flag-update hook.** `client.on('update', keys => …)` and `client.off(...)`, surfaced from `@featureflip/js`. Fires when flag configuration changes after startup, with the affected flag keys batched into one call; returns an unsubscribe function. Used by `@featureflip/openfeature-node` to emit OpenFeature's `PROVIDER_CONFIGURATION_CHANGED` (#1866).
- **`onEvaluation` inspector callback** via the `inspectors` config option (#1800).

### Fixed

- Inherits the `@featureflip/js` 2.5.0 fixes: `Error` reason for an undefined served variation (#1989), `prerequisiteKey` on analytics events (#1919), poison-metadata isolation (#1918), `userId` alias resolution (#1922), and numeric-config validation (#1917).

## 2.4.0 — 2026-07-13

### Added

- OpenFeature provider, published separately as `@featureflip/openfeature-node` (#1227).

### Fixed

- Outage-recovery hardening inherited from `@featureflip/js`: non-terminal initialization and SSE `sync` full-replace (#1863, #1896).

### Changed

- Enforced `tsc --noEmit` typecheck gate added to CI (#1465).

## 2.3.0 — 2026-06-19

### Fixed

- Cross-SDK evaluation parity fixes inherited from `@featureflip/js`: any-of relational operators (#1443), case-sensitive `MatchesRegex` (#1453) and semver prerelease (#1454), engine-aligned date operators (#1455), type-aware numeric equality (#1458), keyless-rollout control variation (#1457), fail-closed segment rules (#1459), and rollout-with-no-variations guard (#1469).

## 2.2.0 — 2026-06-16

### Added

- Semantic-version condition operators for local rule evaluation (#1409).

## 2.1.0 — 2026-05-27

### Added

- **Prerequisite flag support** (#1028).

### Changed

- Monorepo converted to npm workspaces (#1207).

## 2.0.0 — 2026-04-08

### BREAKING

- **Public `FeatureflipClient` constructor removed.** The only way to obtain a client is now the static factory `FeatureflipClient.get(config)`. The factory dedupes by SDK key: repeated calls with the same key return handles pointing at a single shared underlying client. This aligns the Node SDK with the same singleton-by-construction pattern used by `@featureflip/js` 2.0, making per-request instantiation in Express/Fastify/NestJS handlers harmless instead of leaking SSE connections and background tasks.

  **Migration:**

  Before:
  ```ts
  import { FeatureflipClient } from '@featureflip/node';

  const client = new FeatureflipClient({ sdkKey: 'your-sdk-key' });
  await client.waitForInitialization();
  ```

  After:
  ```ts
  import { FeatureflipClient } from '@featureflip/node';

  const client = FeatureflipClient.get({ sdkKey: 'your-sdk-key' });
  await client.waitForInitialization();
  ```

  Or, as a one-liner that waits for init:
  ```ts
  const client = await FeatureflipClient.create({ sdkKey: 'your-sdk-key' });
  ```

- **`close()` is now refcounted** via `@featureflip/js` 2.0. When multiple handles share one cached core, closing one handle does not shut down the core — background tasks and the SSE connection stay alive until the last handle is closed.

### Added

- `FeatureflipClient.get(config)` — static factory, the new primary entry point.
- `FeatureflipClient.create(config)` continues to work and is now implemented in terms of `get()`.

### Changed

- Bumped `@featureflip/js` peer to 2.0 to pick up the singleton factory.

## 1.0.0

Initial release.
