# Code review: `site`

Review date: 2026-08-04  
Scope: the Next.js application under `site/`, including the App Router page, Digital Twin client component, `/api/chat` route, configuration, dependencies, styling, accessibility, and local project hygiene.

## Executive assessment

The application is small, readable, and builds successfully. The browser-to-server-to-LLM separation is the right basic architecture, and the UI already performs some useful input limiting and provider selection.

It is not ready for unrestricted public production traffic in its current form. The public chat endpoint can be used to consume provider quota, accepts an unbounded JSON body before truncation, and has no upstream timeout. The dependency audit also reports one high and one moderate production dependency vulnerability through the selected Next.js preview release. These should be addressed before deployment.

The report below separates confirmed issues from defense-in-depth and product improvements. No application source code was changed as part of this review.

## Validation performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit --pretty false` | Pass |
| `npm run build` | Pass; generated `/` as static and `/api/chat` as dynamic |
| `npm run lint` | Fail; `next lint` is no longer a valid command in this Next.js version and is interpreted as a `lint` directory |
| `npm audit --omit=dev --json` | Fail; 1 high and 1 moderate vulnerability reported |
| Test suite | No test script or tests are present under `site/` |

The build regenerated tracked Next.js metadata during validation; those generated changes were restored. The only pre-existing project change still visible is the untracked `site/tutorial.md`.

## Findings

### H-01 — Public LLM proxy has no abuse, quota, or rate-limit control

Severity: High  
Location: `app/api/chat/route.ts:34-87`

`POST /api/chat` is reachable by any caller and forwards accepted requests to a paid or quota-limited upstream provider. There is no authentication, per-IP or per-session rate limit, concurrency limit, spending guard, CAPTCHA/abuse challenge, or request accounting. The fact that the API key remains server-side protects the key but does not protect the provider account from automated use.

Impact:

- An attacker can automate requests and consume provider quota or incur unexpected cost.
- A burst of slow upstream calls can exhaust server connections or worker capacity.
- Prompt injection and generated content can be used to create reputational risk for the portfolio owner.

Remedial action:

1. Add an edge or server-side rate limiter keyed by IP and, if available, a signed visitor/session token. Use a shared store such as Redis/Upstash when deploying more than one instance.
2. Add concurrency limits, provider spend alerts, and a hard provider-side budget/quota.
3. Add a request identifier and metrics for accepted, rejected, timed-out, and upstream-failed requests without logging user prompts or secrets.
4. Consider serving common portfolio questions from a static/structured FAQ path and reserving the model for questions that need generation.
5. Treat origin checks as defense-in-depth only; an origin check alone is not an abuse-control mechanism because non-browser clients can call the route directly.

### H-02 — Request size is unbounded before validation and truncation

Severity: High  
Location: `app/api/chat/route.ts:36-53`

The route calls `await request.json()` before applying `.slice(-10)` and the per-message 600-character limit. A caller can send a very large JSON document or a huge `messages` array, causing JSON parsing and allocation before the defensive limits run. The client-side `maxLength={600}` at `app/components/digital-twin.tsx:148` does not protect the server.

Impact: memory/CPU denial of service, unnecessary bandwidth, and increased request processing cost.

Remedial action:

- Enforce a small body limit at the reverse proxy/platform and in the route. Check `Content-Length` where present and use a bounded stream reader for requests without it; return `413 Payload Too Large` when exceeded.
- Validate the parsed value as `unknown` with a schema or explicit guards. Enforce the maximum message count, content length, and total content size as part of the request contract.
- Do not rely on the browser for any security or cost limit.

### H-03 — Production dependency audit reports vulnerable `next`/`postcss` versions

Severity: High (audit severity; practical exposure depends on the build/deployment path)  
Location: `package.json:10-18`, `package-lock.json`

The audit run on 2026-08-04 reported:

- `postcss`: high-severity arbitrary file read/path traversal issues via attacker-controlled source maps, including `GHSA-6g55-p6wh-862q` and `GHSA-r28c-9q8g-f849`.
- `postcss`: a related moderate advisory, `GHSA-fxqj-rqcc-2cmp`.
- `next`: moderate vulnerability transitively through `postcss`.

The installed `next@16.3.0-preview.9` is in the affected audit range, and the audit reports that a fix is available. The current dependency line is also a preview release rather than a stable production release.

Remedial action:

1. Upgrade to a fixed, supported stable Next.js release, or the latest fixed release explicitly recommended by the advisory.
2. Regenerate and review the lockfile, then rerun `npm audit --omit=dev` and the full build.
3. Do not deploy from untrusted source trees or allow untrusted CSS/source-map content into the build until the vulnerable toolchain is patched.
4. Add dependency update monitoring and a CI audit gate appropriate to the deployment risk.

Advisory references: [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), and [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).

### M-01 — Upstream requests have no timeout or cancellation

Severity: Medium  
Location: `app/api/chat/route.ts:75-87`

The provider `fetch` has no `AbortController` or deadline. A slow, stalled, or degraded provider can leave the route waiting indefinitely. The browser can navigate away while the server-side request continues.

Remedial action:

- Add a bounded timeout, typically around 10–20 seconds for this UI, and pass its signal to `fetch`.
- Return a controlled `504` or `502` response for timeouts and make the client show a retryable message.
- Add upstream latency and timeout metrics.

### M-02 — Request validation is incomplete and reports malformed input as a server error

Severity: Medium  
Location: `app/api/chat/route.ts:34-73`

`request.json()` is treated as an implicitly untyped value. A top-level JSON `null` causes `body.messages` to throw and results in HTTP 500. Invalid JSON also falls through the broad catch block and results in 500 instead of 400. A whitespace-only user message passes because only the role and `typeof content === 'string'` are checked. Any unrecognized model silently falls back to Kimi rather than being rejected.

Remedial action:

- Parse into `unknown`, validate the entire request shape, and return 400 for malformed or unsupported input.
- Require a non-empty trimmed final user message.
- Use a single model enum/allowlist and reject unknown values rather than silently changing provider behavior.
- Either use the `LLM_MODEL` value if it is intended to configure the provider or remove it from the environment contract; the current route hard-codes `kimi-k3` while the local environment contains `LLM_MODEL`.

### M-03 — Provider URL and secret transport are not validated

Severity: Medium  
Location: `app/api/chat/route.ts:21-32`, `65-80`

The provider base URL is taken from environment variables and concatenated with `/chat/completions`. The route does not parse the URL, require HTTPS in production, or restrict it to an expected provider host. A deployment typo such as an HTTP or attacker-controlled endpoint would send the bearer token to that endpoint.

Remedial action:

- Parse and validate provider URLs at startup or request time.
- Require `https:` outside local development and allowlist the expected hosts.
- Fail startup/deployment health checks when a required secret or URL is absent or invalid.
- Keep the existing practice of never exposing these variables with a `NEXT_PUBLIC_` prefix.

### M-04 — Upstream response contract and output length are not enforced

Severity: Medium  
Location: `app/api/chat/route.ts:97-109`, `app/components/digital-twin.tsx:45-51`

The response is parsed as arbitrary JSON and only the nested string field is checked. A malformed JSON response becomes a generic HTTP 500 through the outer catch, even though the fault is upstream. The prompt asks for fewer than 140 words, but the request permits 350 tokens and the server does not enforce a response length or content policy. The client also trusts `data.message` without validating its type.

Remedial action:

- Validate the upstream response against a small schema and map parse failures to a controlled 502.
- Define an explicit output limit that matches the product requirement, while preserving whole-word boundaries where truncation is needed.
- Validate the client response shape before adding it to the message list.
- Keep rendering as text, as the current React interpolation does; do not introduce HTML rendering for model output without a dedicated sanitizer and policy.

### M-05 — AI grounding and privacy expectations are not implemented as product controls

Severity: Medium  
Location: `app/api/chat/route.ts:5-17`, `81-85`; no privacy notice is present in `app/`

The system prompt is useful guidance, but it is not a reliable factual or security boundary. A visitor can prompt the model to ignore the profile, reveal the prompt, or invent claims. All visitor messages and the career context are sent to the selected third-party model provider. The UI does not tell visitors that their question is sent to an external provider or describe retention/training handling.

Remedial action:

- Add a concise privacy/data-processing notice near the chat, covering the provider, retention, and what users should not submit.
- Review provider data-use and retention terms before production use.
- For high factual accuracy, prefer structured profile data and constrained answer generation over an unconstrained free-form prompt. Add an explicit refusal/fallback policy for unsupported questions.
- Avoid logging raw prompts, model responses, API keys, or the full career context.

### M-06 — The lint command is broken and there is no replacement static-analysis setup

Severity: Medium  
Location: `package.json:6`

`npm run lint` executes `next lint`. In the installed Next.js version this produces `Invalid project directory provided, no such directory: ...\\site\\lint`. The project has no ESLint dependency or configuration, so the build currently provides no lint or accessibility rule coverage.

Remedial action:

- Add ESLint and an explicit `eslint.config.mjs` with the Next.js, React, TypeScript, and JSX accessibility rules appropriate for the project.
- Change the script to the ESLint CLI, for example `eslint .`, as described by the installed Next.js documentation.
- Run lint in CI and treat new errors as build failures.

### M-07 — Unstable and floating dependency declarations weaken release reproducibility

Severity: Medium  
Location: `package.json:10-18`

`next` is declared as `^16.3.0-preview.9`, while `react` and `react-dom` are declared as `latest`. The lockfile makes the current `npm ci` installation reproducible, but a future ordinary `npm install` can update these ranges unexpectedly. A preview framework release plus floating React declarations makes framework upgrades harder to review and can reintroduce incompatible combinations.

Remedial action:

- Pin tested versions or use deliberately bounded stable ranges.
- Prefer a stable Next.js release for production.
- Add an `engines` declaration for the supported Node and npm versions.
- Use `npm ci` in deployment and update dependencies only through reviewed changes.

### M-08 — No automated coverage exists for the security-critical chat flow

Severity: Medium  
Location: `package.json`; no test files under `site/`

There are no unit, integration, or browser tests for request validation, missing configuration, provider errors, timeouts, response parsing, model selection, or chat interaction. A passing build does not exercise those behaviors.

Remedial action:

- Add route tests for malformed JSON, oversized bodies, blank questions, invalid models, missing keys, upstream non-2xx, timeout, malformed response, and successful response.
- Add browser tests for keyboard submission, model selection, loading/error states, prompt buttons, and mobile navigation.
- Add a CI job that runs type-check, lint, tests, and build.

### M-09 — Baseline browser security headers are absent

Severity: Medium  
Location: `next.config.ts`; no security-header configuration found

The project does not explicitly set a Content Security Policy, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or frame-embedding protection. HSTS should also be configured at the TLS-terminating edge. This increases exposure to clickjacking, unintended referrer leakage, and injection impact if the application grows or a dependency is compromised.

Remedial action:

- Add headers in the deployment edge or Next.js configuration, starting with a tested CSP, `frame-ancestors 'none'` (or an intentional allowlist), `nosniff`, a restrictive referrer policy, and a minimal permissions policy.
- Account for the Google Fonts request in the CSP, or move to self-hosted/`next/font` assets.
- Enable HSTS only once every production path is HTTPS.

### M-10 — The whole home page is a client component

Severity: Medium  
Location: `app/page.tsx:1-4`

The entire portfolio page is marked `'use client'` only because the navigation needs `useEffect`/`useState`. This forces static portfolio markup and navigation data into the client component boundary and increases the JavaScript required for a mostly static page.

Remedial action:

- Keep the page and static sections as a server component.
- Extract only the active-section navigation behavior into a small client component, and keep the Digital Twin isolated as it already is.
- Recheck the resulting bundle and hydration behavior after the split.

### M-11 — Keyboard focus and small-screen navigation need accessibility work

Severity: Medium  
Location: `app/globals.css:73-80`, `735-746`, `817-830`; `app/components/digital-twin.tsx:88-98`

There are no custom `:focus-visible` styles. The chat input explicitly removes its outline with `outline: 0` and provides no replacement focus indicator. Inactive desktop nav links use `#777` on `#f1f0ea`, approximately a 3.92:1 contrast ratio, below the 4.5:1 WCAG AA target for normal text. On screens up to 800px, `.nav-links` is hidden and no menu or alternative section navigation is provided. The model picker uses an `aria-label` on a generic `div` rather than a fieldset/legend or an explicit group role.

Remedial action:

- Add visible, high-contrast `:focus-visible` styles for links, buttons, and inputs; remove `outline: 0` unless it is replaced.
- Increase inactive navigation contrast and verify all small mono labels at their actual font sizes.
- Provide a mobile menu or a compact accessible section navigation.
- Use a semantic fieldset/legend or `role="group"` with a proper accessible name for model selection.
- Run an automated accessibility audit and a keyboard-only manual pass.

### M-12 — Chat output does not automatically keep the newest message visible

Severity: Medium  
Location: `app/components/digital-twin.tsx:108-127`; `app/globals.css:627-635`

The message container becomes scrollable after `max-height: 420px`, but there is no effect or ref that scrolls to the newest user/assistant message. After several exchanges, a new response can be appended below the current viewport without being visible.

Remedial action:

- Track a bottom sentinel or the message container and scroll it into view after a response, while respecting a user who has intentionally scrolled upward.
- Add `aria-busy` or a concise status announcement for the loading state instead of relying only on decorative animated dots.

### M-13 — External font loading adds performance and privacy cost

Severity: Medium  
Location: `app/globals.css:1`

The stylesheet uses a Google Fonts `@import`, which adds a render-blocking third-party request, can create font swap/layout-shift behavior, and exposes a visitor request to the external font service. It also complicates the CSP.

Remedial action:

- Use `next/font` or self-host the required font files with a deliberate `font-display` strategy.
- Measure first contentful paint, layout shift, and the JavaScript/CSS payload after the change.

## Lower-priority improvements

### L-01 — Reduced-motion handling is incomplete

`app/globals.css:14` applies smooth scrolling globally, while the reduced-motion media query at lines 991-1007 only gates the reveal animation. Disable smooth scrolling and non-essential transitions/animations when `prefers-reduced-motion: reduce` is active.

### L-02 — SEO and sharing metadata are minimal

`app/layout.tsx:4-8` defines only title and description. Add a canonical URL, Open Graph/Twitter metadata, a favicon/app icon, and any intentional robots metadata once the production domain is known.

### L-03 — Generated TypeScript build state is tracked

`site/tsconfig.tsbuildinfo` is tracked and changed by type-check/build operations. Generated build state should normally be ignored or deliberately managed so local validation does not create source-control churn. Confirm the repository policy before removing it from version control.

### L-04 — Some interaction affordances are not exposed consistently

Prompt buttons remain enabled-looking while a request is in flight even though `sendMessage` ignores them when `loading` is true. Disable them during loading, expose a busy/status state, and provide a retry action for failed requests instead of only appending an assistant-style error message.

## Positive observations

- `app/api/chat/route.ts` keeps provider keys on the server and does not use `NEXT_PUBLIC_` variables.
- `.gitignore` excludes `.env` and `.env*.local`; the local environment file was not exposed in this review.
- The provider choice is constrained to a fixed allowlist rather than interpolating an arbitrary model name into the upstream request.
- Message roles are constrained to `user` and `assistant`, conversation history is limited to the last 10 accepted messages, and each accepted message is truncated to 600 characters.
- Model output is rendered as React text rather than injected as HTML, which avoids a direct XSS path through model responses.
- The route returns sanitized user-facing errors for upstream failures instead of returning provider response bodies or API keys.
- The code has sensible cleanup for `IntersectionObserver`, explicit Node.js runtime selection, and external-link `noreferrer` attributes.
- TypeScript and the production build both pass.

## Recommended remediation order

### Before public deployment

1. Patch the vulnerable dependency tree and move off the Next.js preview release.
2. Add a hard request-body limit, schema validation, non-empty-question validation, model rejection, and an upstream timeout.
3. Add rate limiting/concurrency control, provider budget alerts, and basic abuse/latency metrics.
4. Validate provider URLs and enforce HTTPS/host allowlisting in production.
5. Add security headers and a short AI privacy/data-use notice.

### Next engineering iteration

1. Replace `next lint` with a real ESLint setup and add CI.
2. Add route and browser tests for the chat and failure paths.
3. Split the static page from the active-navigation client code.
4. Fix focus indicators, contrast, mobile navigation, and chat auto-scroll/status behavior.
5. Move Google Fonts to `next/font` or self-hosted assets.

### Ongoing product hardening

1. Ground answers in structured, reviewed profile data and define a clear unsupported-question policy.
2. Monitor provider cost, latency, errors, and abuse without retaining unnecessary user content.
3. Keep dependency updates, metadata, and the tutorial synchronized with the deployed application.
