// Lazy Anthropic client. Returns null when ANTHROPIC_API_KEY is unset so
// the server boots and the UI can render a friendly "no key configured"
// state instead of crashing. Callers must check for null.
import './env.js';
import Anthropic from '@anthropic-ai/sdk';

let client = null;

export function getAnthropicClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client = new Anthropic({ apiKey });
  return client;
}

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
