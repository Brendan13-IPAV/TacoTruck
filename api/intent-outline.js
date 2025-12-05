// api/intent-outline.js
import { parse } from 'csv-parse/sync';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// where to read the CSV from (raw GitHub is easiest & lets you update without redeploy)
const CSV_URL = process.env.CSV_URL || 'https://raw.githubusercontent.com/<YOUR-ORG-OR-USER>/TacoTruck/main/data/ip_intents.csv';

async function fetchCSV() {
  const res = await fetch(CSV_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parse(text, { columns: true, skip_empty_lines: true });
  return rows.map(r => ({
    intent_id: (r.intent_id || '').trim(),
    topic: (r.topic || '').trim(),
    outline_hint: (r.outline_hint || '').trim(),
    synonyms: (r.synonyms || '').split(/[;,]/).map(s => s.trim().toLowerCase()).filter(Boolean),
    examples: (r.examples || '').split(/[;]+/).map(s => s.trim()).filter(Boolean),
  }));
}

// very naive scoring: count synonym hits in user text
function rankByKeyword(userText, rows) {
  const t = userText.toLowerCase();
  return rows.map(r => {
    let score = 0;
    for (const k of r.synonyms) if (k && t.includes(k)) score += 1;
    return { ...r, score };
  }).sort((a,b) => b.score - a.score);
}

async function openai(apiKey, messages) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 400,
      messages
    })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// vercel style handler
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
    const { user_input } = req.body || {};
    if (!user_input || typeof user_input !== 'string') {
      return res.status(400).json({ error: 'user_input (string) is required' });
    }

    const rows = await fetchCSV();
    const ranked = rankByKeyword(user_input, rows).slice(0, 5);

    const system = `
You are an INTENT OUTLINER for Australian IP queries. 
Only output a brief outline of what a response WOULD cover. Do not provide the actual response or legal advice.
If the match is weak, say "Not sure" but still give a minimalist outline shape.
Output JSON only with: 
{"intent_id":"","topic":"","confidence":0-1,"why_short":"","outline_bullets":["...","...","..."],"matched_examples":[]}
    `.trim();

    const candidatesBlock = ranked.map((c,i)=>[
      `#${i+1}`,
      `intent_id: ${c.intent_id}`,
      `topic: ${c.topic}`,
      `outline_hint: ${c.outline_hint}`,
      `synonyms: ${c.synonyms.join(', ')}`,
      `examples: ${c.examples.join(' | ')}`,
      `score: ${c.score}`
    ].join('\n')).join('\n\n');

    const user = `
USER_INPUT:
"${user_input}"

CANDIDATES:
${candidatesBlock}
    `.trim();

    const apiKey = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';
    // demo mode: if the key is a placeholder, return a canned JSON so the link still works
    if (apiKey === 'YOUR_OPENAI_API_KEY') {
      const top = ranked[0] || {};
      const demo = {
        intent_id: top.intent_id || "NOT_SURE",
        topic: top.topic || "Not sure",
        confidence: top.score ? Math.min(0.4 + 0.1*top.score, 0.8) : 0.4,
        why_short: "Demo mode: guessed from simple keyword hits.",
        outline_bullets: [
          "What the topic generally covers",
          "High-level timing or applicability",
          "General next steps (no legal advice)"
        ],
        matched_examples: (top.examples || []).slice(0,1)
      };
      return res.status(200).json({ outline: JSON.stringify(demo, null, 2) });
    }

    const content = await openai(apiKey, [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]);

    res.status(200).json({ outline: content });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
