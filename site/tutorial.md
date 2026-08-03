# Beginner's guide to this portfolio project

This tutorial explains the web app in the `site` folder: a personal portfolio built with Next.js, React, CSS, and TypeScript. It also explains the new "Digital Twin" chat feature and the TypeScript 7 upgrade that was made during this session.

You do not need to understand every line on the first read. The useful goal is to understand the path a visitor takes:

1. Their browser loads the portfolio page.
2. React displays the sections, navigation, and Digital Twin chat interface.
3. When they ask a question, the browser sends it to this project's own server route.
4. The server route uses a private API key to ask a language-model provider for a reply.
5. The reply is sent back to the browser and shown in the chat.

## 1. What is in this project?

The repository has more than one folder, but the portfolio application is in `site`:

```text
AI/
+-- site/                         # The portfolio application
|   +-- app/                       # Page, components, API routes, and CSS
|   |   +-- api/chat/route.ts       # Server endpoint for the Digital Twin
|   |   +-- components/digital-twin.tsx
|   |   +-- globals.css             # Global styling
|   |   +-- layout.tsx              # Shared HTML shell and metadata
|   |   +-- page.tsx                # The home page
|   +-- .env                        # Private environment values; never publish this
|   +-- next.config.ts              # Next.js configuration
|   +-- package.json                # Project dependencies and commands
|   +-- tsconfig.json               # TypeScript compiler settings
+-- tutorial.md                    # This guide
```

The words *app*, *website*, and *project* all refer to the `site` application below.

## 2. Technology summary

### Next.js

Next.js is a framework for building React web applications. It supplies the development server, production build command, file-based routing, and server-side API routes. A file named `app/page.tsx` becomes the `/` home page. A file named `app/api/chat/route.ts` becomes the `/api/chat` endpoint.

### React

React builds the visible interface out of components. A component is a JavaScript/TypeScript function that returns JSX. JSX looks like HTML, but it lives in a JavaScript file so it can react to state and user actions.

### TypeScript

TypeScript adds types to JavaScript. Types describe the shape of data before the code runs. For example, this type says every chat message has a `role` and `content`:

```ts
type Message = {
  role: 'assistant' | 'user';
  content: string;
};
```

The compiler can then catch mistakes such as passing `role: 'robot'` before they reach a visitor.

### CSS

`app/globals.css` is ordinary CSS. It controls colours, spacing, layouts, fonts, responsive behaviour, and the chat UI. The project uses CSS custom properties (also called variables), such as `--acid`, so a repeated colour can be changed in one place.

### Route handler and environment variables

The chat needs a language-model API key. The key is kept in `.env` and read only by the server route. The browser never receives it. This separation is essential: a key placed in client-side React code could be viewed and abused by any site visitor.

### Turbopack

Next.js 16 uses Turbopack to compile and bundle the app. A bundler turns many source files into optimized files that the browser can load efficiently.

## 3. How to run the project locally

Open a terminal in the app folder, not the repository root:

```powershell
cd C:\Users\Damian Zod\AI\site
```

Install the locked dependency versions:

```powershell
npm install
```

Start a development server:

```powershell
npm run dev
```

Next.js will print a local URL, normally `http://localhost:3000`. Open it in a browser. The development server watches your files and refreshes the page when you save.

For a production-style check, run:

```powershell
npm run build
npm run start
```

`npm run build` is especially important before deployment. It checks TypeScript, compiles the app, and makes sure its pages can be produced.

## 4. High-level walkthrough

The architecture is intentionally small:

```text
Browser
  |
  | loads / and runs React
  v
app/page.tsx
  |
  | renders
  v
DigitalTwin component
  |
  | POST /api/chat with chat history and selected model
  v
app/api/chat/route.ts
  |
  | reads secret key from .env and calls the selected LLM provider
  v
Language-model API
  |
  | response text
  v
route.ts -> DigitalTwin -> Browser
```

There are two important execution environments:

- **Client (browser):** interactive UI code, click handlers, input state, and `fetch` calls.
- **Server (Next.js):** private API keys, input validation, and the upstream language-model request.

The directive `'use client';` at the top of `page.tsx` and `digital-twin.tsx` tells Next.js that these components must run in the browser. The API route has no such directive because it runs on the server.

## 5. The home page: `site/app/page.tsx`

`page.tsx` is the main page. It contains the navigation, hero, profile, career, portfolio, the Digital Twin, and the footer.

### Importing React and a component

At the top of the file, the page imports two React hooks and the new chat component:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { DigitalTwin } from './components/digital-twin';
```

- `useState` stores a value that can change, such as the active navigation item.
- `useEffect` runs a small piece of browser-only work after the page appears.
- `DigitalTwin` is a separate component exported from another file.

Splitting the chat out is useful. It keeps the home-page component from becoming even larger and gives the chat its own focused responsibility.

### Tracking the visible section

The navigation highlights the section that is currently on screen. This is done with state and the browser's `IntersectionObserver` API:

```tsx
const [active, setActive] = useState('home');

useEffect(() => {
  const sections = [...document.querySelectorAll<HTMLElement>('section[id]')];
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible) setActive(visible.target.id);
    },
    { rootMargin: '-38% 0px -54%' }
  );

  sections.forEach((section) => observer.observe(section));
  return () => observer.disconnect();
}, []);
```

Read it in order:

1. `active` starts as `'home'`.
2. The effect finds every `<section>` element that has an `id`.
3. The observer watches those sections while the user scrolls.
4. When a section enters the central area of the viewport, `setActive(...)` changes the state.
5. React re-renders the page, and the matching navigation link gets the `active` CSS class.
6. The `return` function disconnects the observer when the component is removed. This is cleanup and prevents unnecessary browser work.

The empty array `[]` means "set this observer up once when this component first mounts."

### Rendering navigation from data

Instead of repeating five similar links by hand, the page stores them in an array and uses `.map()`:

```tsx
{[
  ['home', 'Home'],
  ['about', 'Profile'],
  ['journey', 'Journey'],
  ['portfolio', 'Work'],
  ['twin', 'AI Twin'],
].map(([id, label]) => (
  <a
    key={id}
    className={active === id ? 'active' : ''}
    href={`#${id}`}
  >
    {label}
  </a>
))}
```

`map()` converts each small data item into a React element. The `key` helps React identify each link reliably. The expression `active === id ? 'active' : ''` is a conditional: it returns `'active'` only for the current section.

### Adding the Digital Twin to the page

This one line places the chat section between the portfolio and the footer:

```tsx
<DigitalTwin />
```

The component itself renders a `<section id="twin">`, so the `AI Twin` navigation link can scroll to `#twin`.

## 6. The interactive chat: `site/app/components/digital-twin.tsx`

This file is a **client component**. It owns the visible chat interface and the changing data that makes the interface interactive.

### The component's state

The first part creates four pieces of state:

```tsx
const [model, setModel] = useState('kimi-k3');
const [messages, setMessages] = useState<Message[]>([
  {
    role: 'assistant',
    content: 'Hi - I am Matin\'s digital twin. Ask me a question.',
  },
]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
```

| State | Meaning | Why it matters |
| --- | --- | --- |
| `model` | The selected AI provider/model | Lets the visitor switch providers. |
| `messages` | The conversation so far | Lets React redraw the chat history. |
| `input` | What is currently typed in the box | Makes the text field a controlled input. |
| `loading` | Whether a reply is being requested | Prevents duplicate sends and shows feedback. |

`useState<Message[]>` is TypeScript help: it says `messages` must always be an array of correctly shaped `Message` objects.

### Sending a message

The core workflow is in `sendMessage`:

```tsx
async function sendMessage(event?: FormEvent, preset?: string) {
  event?.preventDefault();
  const question = (preset ?? input).trim();
  if (!question || loading) return;

  const nextMessages = [
    ...messages,
    { role: 'user' as const, content: question },
  ];
  setMessages(nextMessages);
  setInput('');
  setLoading(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: nextMessages, model }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    setMessages((current) => [
      ...current,
      { role: 'assistant', content: data.message },
    ]);
  } finally {
    setLoading(false);
  }
}
```

Important details:

- `async` allows the function to wait for a network request with `await`.
- `event?.preventDefault()` stops a form submission from reloading the whole page. The `?.` means "only call this if `event` exists." A quick-prompt button does not pass a form event.
- `preset ?? input` chooses a clicked suggestion if one was supplied; otherwise it uses what the visitor typed.
- `trim()` removes accidental spaces at the beginning and end.
- The spread syntax `...messages` copies existing messages into a new array. In React, state should be replaced rather than mutated in place.
- The visitor's message appears immediately before the network request finishes. This feels responsive.
- `fetch('/api/chat', ...)` talks to this same Next.js application, not directly to an external model API.
- The `finally` block runs whether the request succeeds or fails, ensuring the loading state is reset.

The actual project also has a `catch` block that turns an error into a helpful assistant message and focuses the input field again. That is good basic feedback for a network-dependent feature.

### Rendering messages

The component converts each message object into visible UI:

```tsx
{messages.map((message, index) => (
  <div
    key={`${message.role}-${index}`}
    className={`message ${message.role}`}
  >
    <span>{message.role === 'assistant' ? 'MZ' : 'YOU'}</span>
    <p>{message.content}</p>
  </div>
))}
```

The class becomes either `message assistant` or `message user`. CSS uses those classes to give messages different visual treatments. The `aria-live="polite"` attribute on the surrounding message area tells screen readers that a new reply can be announced without interrupting the user.

### Model picker and form controls

The model buttons update `model`:

```tsx
<button
  type="button"
  className={model === 'kimi-k3' ? 'selected' : ''}
  onClick={() => setModel('kimi-k3')}
  disabled={loading}
  aria-pressed={model === 'kimi-k3'}
>
  KIMI K3
</button>
```

This is a good example of **declarative UI**. The code does not manually add or remove CSS classes with browser APIs. It describes the desired UI from state: if `model` is Kimi, render the selected class and `aria-pressed="true"`.

The input is controlled by React:

```tsx
<input
  value={input}
  onChange={(event) => setInput(event.target.value)}
  maxLength={600}
  aria-label="Ask Matin's digital twin"
/>
```

Every keystroke updates `input`; React then uses that state as the input's displayed value. The 600-character UI limit is mirrored by server-side trimming, which is important because client limits alone can be bypassed.

## 7. The server endpoint: `site/app/api/chat/route.ts`

This file is the security boundary of the chat. It receives a browser request, checks it, selects a provider, and makes the real upstream request.

### Why the browser does not call the AI provider directly

The browser can be inspected by anyone. If an API key were placed in `digital-twin.tsx`, it would be exposed. Instead:

```text
Safe:     Browser -> this server route -> model provider
Unsafe:   Browser (with API key) -> model provider
```

The route is explicitly configured for Node.js:

```ts
export const runtime = 'nodejs';
```

This makes the intended server runtime clear.

### The system context

`careerContext` is a long string that establishes the assistant's job and the factual information it may use. It tells the model to answer concisely, speak as Matin, avoid inventing facts, and offer contact details when information is unknown.

That is called a **system prompt**. It is guidance, not a perfect security mechanism: a model can still make mistakes. The prompt is useful because it puts the product goal and verified career information close to the server code that uses it.

### Provider configuration

The code supports two provider settings:

```ts
const providers = {
  'kimi-k3': {
    baseUrl: process.env.LLM_API_URL,
    apiKey: process.env.LLM_API_KEY,
    model: 'kimi-k3',
  },
  'openai/gpt-oss-20b:free': {
    baseUrl: process.env.OPENROUTER_API_URL ?? 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'openai/gpt-oss-20b:free',
  },
} as const;
```

`process.env.NAME` reads an environment variable from the server's environment. The `??` operator provides a fallback URL if `OPENROUTER_API_URL` is not set. `as const` asks TypeScript to keep these values as precise readonly values instead of broad strings.

Do not put the real values in this tutorial, source code, git commits, screenshots, or browser code. The existing `.env` file should remain ignored by Git.

### Validating incoming data

Data sent by a browser is untrusted, even if it came from this site's own UI. The route applies basic defensive checks:

```ts
const safeMessages: IncomingMessage[] = messages
  .filter(
    (message): message is IncomingMessage =>
      message &&
      (message.role === 'user' || message.role === 'assistant') &&
      typeof message.content === 'string'
  )
  .slice(-10)
  .map((message) => ({
    role: message.role,
    content: message.content.slice(0, 600),
  }));
```

This does three useful things:

1. Removes malformed messages.
2. Keeps only the latest 10 messages, limiting cost and request size.
3. Limits each message to 600 characters.

The notation `(message): message is IncomingMessage => ...` is a **type guard**. It tells TypeScript that filtered values are safe to treat as `IncomingMessage` objects afterwards.

The route also refuses a conversation without a user question at the end, returning HTTP `400` (bad request).

### Calling the provider

Once configuration and input are valid, the route sends an OpenAI-compatible chat request:

```ts
const upstream = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: provider.model,
    messages: [{ role: 'system', content: careerContext }, ...safeMessages],
    temperature: 0.35,
    max_tokens: 350,
  }),
});
```

- `Authorization` sends the private key to the provider from the server only.
- The system prompt is inserted before the visitor's conversation.
- `temperature: 0.35` asks for fairly consistent rather than wildly creative answers.
- `max_tokens: 350` caps the reply size.

If the provider fails, the route returns a clean `502` response. If the app is missing a URL or key, it returns `503`, meaning the service is not configured. The browser catches either response and displays a plain-language message.

## 8. Styling the Digital Twin: `site/app/globals.css`

The page uses one global stylesheet rather than a CSS library. The Digital Twin is a dark two-column section on wide screens:

```css
.twin {
  padding-top: 145px;
  padding-bottom: 145px;
  background: var(--ink);
  color: var(--paper);
  display: grid;
  grid-template-columns: 0.72fr 1.28fr;
  gap: 8vw;
}

.chat-shell {
  background: #20201e;
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 14px 14px 0 rgba(198, 255, 0, 0.9);
}
```

`grid-template-columns: 0.72fr 1.28fr` creates two proportional columns: a smaller introduction column and a wider chat column. `var(--ink)` and `var(--paper)` refer to colours defined near the top of the file.

On smaller screens, a media query switches the section to a single-column layout:

```css
@media (max-width: 800px) {
  .twin {
    padding-top: 95px;
    padding-bottom: 105px;
    display: block;
  }

  .chat-shell {
    box-shadow: 8px 8px 0 var(--acid);
  }
}
```

This is responsive design: the same markup adapts to the space available instead of requiring a separate mobile page.

## 9. TypeScript 7 and Next.js configuration

### What changed

The project used TypeScript `5.8.3` and Next.js `15.3.2`. It now uses:

```json
{
  "dependencies": {
    "next": "^16.3.0-preview.9"
  },
  "devDependencies": {
    "typescript": "^7.0.2"
  }
}
```

The caret (`^`) allows compatible updates within the same major version when running an npm update. `package-lock.json` records the exact versions that were installed so other machines can reproduce the dependency tree.

### Why Next.js was also upgraded

TypeScript 7 no longer provides the JavaScript compiler API that earlier Next.js releases used for their default type checker. Next.js 16.3 provides an experimental alternative: ask Next.js to run the project's local `tsc` command instead.

That is why `site/next.config.ts` was added:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
```

- `NextConfig` provides type checking for the configuration itself.
- `useTypeScriptCli: true` is the compatibility switch for TypeScript 7.
- `turbopack.root: __dirname` tells Turbopack that `site` is the application root. This prevents it from treating the parent workspace's separate lockfile as the app root.

This flag is marked experimental by Next.js, so check the Next.js release notes before future framework upgrades. The production build was run successfully with this configuration.

### `tsconfig.json`

`tsconfig.json` configures TypeScript. You rarely need to edit it for ordinary component work. A few useful settings are:

```json
{
  "compilerOptions": {
    "strict": false,
    "noEmit": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx"
  }
}
```

- `noEmit: true` means TypeScript checks code but does not produce JavaScript files itself; Next.js handles the build output.
- `moduleResolution: "bundler"` makes imports behave in a way suitable for modern web build tools.
- `jsx: "react-jsx"` supports modern JSX compilation.
- `strict: false` is forgiving for a beginner project, but it allows more potential mistakes through. See the self-review at the end.

Next.js also updated `next-env.d.ts`. It is generated by Next.js and should not be manually edited. It provides framework type information such as Next-specific image and route declarations.

## 10. Environment variables and local setup

The chat route expects values similar to these in `site/.env`:

```dotenv
LLM_API_URL=https://provider.example/v1
LLM_API_KEY=your-secret-key
OPENROUTER_API_KEY=another-secret-key
```

The exact keys and URLs depend on the providers you use. The project also supports an OpenRouter default endpoint when `OPENROUTER_API_URL` is absent.

Rules to follow:

1. Keep `.env` out of Git. Check `.gitignore` before committing.
2. Do not prefix secrets with `NEXT_PUBLIC_`; that prefix exposes variables to browser code.
3. Create a separate `.env` on the VPS or deployment platform. Never copy a secret into the repository just to deploy it.
4. Restart the development server after changing environment variables.

If the keys are absent, the route deliberately returns a `503` error and the chat will say that it is not configured. That is safer than attempting an unauthenticated provider request.

## 11. A practical editing workflow

When making a small frontend change, use this loop:

1. Start `npm run dev` in `site`.
2. Change one focused component or CSS rule.
3. Check the result in a browser at desktop and mobile widths.
4. Watch the terminal and browser console for errors.
5. Run `npx tsc --noEmit` to check types.
6. Run `npm run build` before committing or deploying.

For a chat-related change, test at least these cases:

- send a normal typed question;
- click a suggested prompt;
- switch models;
- try an empty message;
- temporarily remove a key in a local test environment and confirm the error is understandable;
- test a narrow mobile viewport and keyboard navigation.

## 12. What was verified

After the TypeScript upgrade, these commands passed in `site`:

```powershell
npx tsc --noEmit
npm run build
```

The production build created the `/` page and the dynamic `/api/chat` route successfully. A passing build is valuable, but it does not prove that a real provider key works or that every browser interaction is perfect. Those need manual and automated tests too.

## 13. Self-review: five next improvements

1. **Fix the visible text encoding issues.** Some source strings currently show mojibake, where punctuation becomes a sequence of unrelated characters, instead of rendering as an em dash, arrow, or copyright symbol. Save the source files as UTF-8 and replace the damaged characters. This is the most immediate visitor-facing issue.

2. **Make the chat API more robust and secure.** Add a request timeout with `AbortController`, rate limiting, and an origin/abuse strategy. Without them, a public endpoint could be slow, expensive, or abused even though its API key is private.

3. **Use runtime schema validation.** The existing filtering is a good start, but a schema library such as Zod could validate the entire request and the upstream response in one clear definition. This would make invalid input handling more predictable as the API grows.

4. **Add automated tests and stronger type settings.** There are no dedicated tests for the route, the error paths, or chat interaction. Add unit tests for request validation and browser tests for sending messages, then gradually change `"strict": false` to `"strict": true` and resolve the resulting type warnings.

5. **Move content and provider settings out of the route file.** The career prompt, provider metadata, and API-specific logic are all in one file. Extracting them into small configuration and service modules would make updates easier, reduce the chance of accidental factual edits, and make it simpler to add streaming responses later.
