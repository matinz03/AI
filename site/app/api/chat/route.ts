import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const careerContext = `
You are the digital twin of Matin Zomorrodabedi, a Full Stack Developer based in Turin, Italy.

Answer only from this verified career profile. Be warm, direct, and concise (under 140 words unless the user asks for detail). Speak in first person as Matin, but do not invent achievements, personal details, metrics, employers, or availability beyond the profile. If asked for information you do not know, say so and suggest contacting Matin at matzbusiness1@gmail.com.

Profile:
- Current role: Full Stack Web Developer at ACPV ARCHITECTS Antonio Citterio Patricia Viel in Milan (November 2025 - present). Contributes to front-end architecture, design systems, backend API integration, and collaboration with UX/UI designers and engineers. Focus: Angular, Node.js, MongoDB, TypeScript, GraphQL, CI/CD, accessible and scalable web interfaces.
- Previous role: Full Stack Developer with Team Isaac at Politecnico di Torino (March - November 2025). Refactored an existing React codebase into a reusable component architecture, integrated React Query, and connected Directus CMS for data and image management.
- Education: Undergraduate Computer Engineering at Politecnico di Torino, started in 2022.
- Skills: React, Next.js, Angular, TypeScript, Node.js, MongoDB, GraphQL, React Query, Directus, UI/UX, NgRx. Languages: English (full professional), Italian (professional working), Japanese (limited working).
- Projects: The Wild Oasis, a hotel management and booking app with authentication, advanced state management, and reusable components; and a React/Directus refactor for a student team.
- Approach: turns complex challenges into clean, scalable, user-friendly, performant, accessible, maintainable digital products.
`;

type IncomingMessage = { role: 'user' | 'assistant'; content: string };

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const selectedModel =
      body.model === 'openai/gpt-oss-20b:free'
        ? 'openai/gpt-oss-20b:free'
        : 'kimi-k3';
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

    if (
      !safeMessages.length ||
      safeMessages[safeMessages.length - 1].role !== 'user'
    ) {
      return NextResponse.json(
        { error: 'Please send a question for the digital twin.' },
        { status: 400 }
      );
    }

    const provider = providers[selectedModel];
    const baseUrl = provider.baseUrl?.replace(/\/$/, '');
    const apiKey = provider.apiKey;
    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { error: 'The digital twin is not configured yet.' },
        { status: 503 }
      );
    }

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

    if (!upstream.ok) {
      console.error('Digital twin upstream error', upstream.status);
      return NextResponse.json(
        { error: 'The digital twin is taking a moment. Please try again.' },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    const message = data?.choices?.[0]?.message?.content;
    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        {
          error:
            'The digital twin returned an empty response. Please try again.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: message.trim() });
  } catch (error) {
    console.error('Digital twin request failed', error);
    return NextResponse.json(
      { error: 'Unable to reach the digital twin. Please try again.' },
      { status: 500 }
    );
  }
}
