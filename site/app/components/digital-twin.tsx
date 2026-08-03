'use client';

import { FormEvent, useRef, useState } from 'react';

type Message = { role: 'assistant' | 'user'; content: string };

const prompts = [
  'What do you build?',
  'Tell me about ACPV',
  'What are your core skills?',
];

export function DigitalTwin() {
  const [model, setModel] = useState('kimi-k3');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hi — I’m Matin’s digital twin. Ask me about his experience, technical strengths, or the kind of products he enjoys building.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      if (!response.ok)
        throw new Error(data.error ?? 'Unable to reach the digital twin.');
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.message },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <section
      id="twin"
      className="twin section-shell"
      aria-labelledby="twin-heading"
    >
      <div className="twin-intro">
        <div className="section-kicker">
          <span>04</span> DIGITAL TWIN
        </div>
        <h2 id="twin-heading">
          Ask the
          <br />
          <em>career story.</em>
        </h2>
        <p>
          A concise, AI-guided way to explore Matin&apos;s work, strengths, and
          journey.
        </p>
        <div className="model-picker" aria-label="Choose language model">
          <p>SELECT A MODEL</p>
          <div>
            <button type="button" className={model === 'kimi-k3' ? 'selected' : ''} onClick={() => setModel('kimi-k3')} disabled={loading} aria-pressed={model === 'kimi-k3'}>
              <span className="model-light" /> KIMI K3 <small>LLM API</small>
            </button>
            <button type="button" className={model === 'openai/gpt-oss-20b:free' ? 'selected' : ''} onClick={() => setModel('openai/gpt-oss-20b:free')} disabled={loading} aria-pressed={model === 'openai/gpt-oss-20b:free'}>
              <span className="model-light" /> GPT-OSS 20B <small>OPENROUTER / FREE</small>
            </button>
          </div>
        </div>
      </div>

      <div className="chat-shell">
        <div className="chat-top">
          <span>
            <i /> DIGITAL TWIN / ONLINE
          </span>
          <span>POWERED BY {model === 'kimi-k3' ? 'KIMI K3' : 'GPT-OSS 20B'}</span>
        </div>
        <div className="chat-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`message ${message.role}`}
            >
              <span>{message.role === 'assistant' ? 'MZ' : 'YOU'}</span>
              <p>{message.content}</p>
            </div>
          ))}
          {loading && (
            <div className="message assistant loading">
              <span>MZ</span>
              <p>
                <b />
                <b />
                <b />
              </p>
            </div>
          )}
        </div>
        {messages.length < 3 && (
          <div className="prompt-row">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(undefined, prompt)}
              >
                {prompt} <span>↗</span>
              </button>
            ))}
          </div>
        )}
        <form className="chat-form" onSubmit={(event) => sendMessage(event)}>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about Matin’s work…"
            maxLength={600}
            aria-label="Ask Matin's digital twin"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            ↗
          </button>
        </form>
      </div>
    </section>
  );
}
