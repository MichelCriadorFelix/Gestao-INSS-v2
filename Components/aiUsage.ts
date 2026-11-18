// Resumo do consumo diário de tokens (tabela gestao_ai_usage_daily → GET /api/admin/ai-usage), para o painel "Diagnóstico de Chaves".

export interface UsageRow {
  day: string;
  kind: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  cached_tokens: number;
}

export interface UsageKindSummary { kind: string; label: string; requests: number; input: number; output: number; thought: number; total: number }
export interface UsageDaySummary { day: string; requests: number; input: number; output: number; thought: number; total: number; kinds: UsageKindSummary[] }

const KIND_LABELS: Record<string, string> = {
  'chat-michel': 'Chat Dr. Michel',
  'chat-luana': 'Chat Dra. Luana',
  'chat-felix': 'Chat Dr. Felix e Castro',
  'chat-fabricia': 'Chat Sec. Fabrícia',
  'chat-outros': 'Chat (outros)',
  'planner-rag': 'Busca de leis (planner)',
  'revisao-peca': 'Revisão automática da peça',
  outros: 'Outras chamadas',
};

export const kindLabel = (kind: string): string => KIND_LABELS[kind] || kind;

const num = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Agrupa as linhas (dia × tipo) por dia, do mais recente ao mais antigo. "Total" = entrada + saída + raciocínio. */
export function summarizeUsage(rows: UsageRow[]): { days: UsageDaySummary[]; avgTotalPerActiveDay: number; avgRequestsPerActiveDay: number } {
  const byDay = new Map<string, UsageDaySummary>();
  for (const r of rows || []) {
    if (!r || !r.day) continue;
    const day = String(r.day).slice(0, 10);
    const d = byDay.get(day) || { day, requests: 0, input: 0, output: 0, thought: 0, total: 0, kinds: [] };
    const k: UsageKindSummary = {
      kind: r.kind, label: kindLabel(r.kind), requests: num(r.requests),
      input: num(r.input_tokens), output: num(r.output_tokens), thought: num(r.thought_tokens), total: 0,
    };
    k.total = k.input + k.output + k.thought;
    d.kinds.push(k);
    d.requests += k.requests; d.input += k.input; d.output += k.output; d.thought += k.thought; d.total += k.total;
    byDay.set(day, d);
  }
  const days = [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  days.forEach(d => d.kinds.sort((a, b) => b.total - a.total));
  const active = days.filter(d => d.total > 0);
  const avgTotalPerActiveDay = active.length ? Math.round(active.reduce((s, d) => s + d.total, 0) / active.length) : 0;
  const avgRequestsPerActiveDay = active.length ? Math.round(active.reduce((s, d) => s + d.requests, 0) / active.length) : 0;
  return { days, avgTotalPerActiveDay, avgRequestsPerActiveDay };
}

/** 1.234.567 → "1,23 mi"; 85.400 → "85 mil"; 640 → "640". */
export function formatTokens(n: number): string {
  const v = Math.max(0, Math.round(n || 0));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace('.', ',')} mi`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} mil`;
  return String(v);
}

/** "2026-11-18" → "18/11". */
export function formatDay(day: string): string {
  const m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : String(day);
}
