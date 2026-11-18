import React, { useEffect, useState } from "react";
import { X, KeyRound, RefreshCw, CheckCircle2, Clock, ShieldOff, HelpCircle, Flame, AlertTriangle, CalendarX, BarChart3 } from "lucide-react";
import { apiFetch } from "../services/apiService";
import { summarizeUsage, formatTokens, formatDay, type UsageRow } from "./aiUsage";

interface KeyTestResult {
  index: number;
  keyMask: string;
  status: string;
  statusLabel: string;
  responseTimeMs: number;
  windowCount: number;
  windowLimit: number;
  windowTokens: number;
  tokenLimit: number;
  percentFreeWindow: number;
  dailyExhausted: boolean;
  errorDetail?: string;
}

interface KeyTestResponse {
  testedAt: string;
  totalKeys: number;
  model?: string;
  results: KeyTestResult[];
  summary: Record<string, number>;
}

interface ApiKeysDiagnosticsModalProps {
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  saudavel: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  esgotada: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  esgotada_diaria: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
  sobrecarregada: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
  invalida: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  bloqueada: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  nao_encontrada: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
  erro: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  saudavel: <CheckCircle2 size={14} />,
  esgotada: <Clock size={14} />,
  esgotada_diaria: <CalendarX size={14} />,
  sobrecarregada: <Flame size={14} />,
  invalida: <ShieldOff size={14} />,
  bloqueada: <ShieldOff size={14} />,
  nao_encontrada: <HelpCircle size={14} />,
  erro: <AlertTriangle size={14} />
};

const SUMMARY_ORDER = ['saudavel', 'esgotada', 'esgotada_diaria', 'sobrecarregada', 'invalida', 'bloqueada', 'nao_encontrada', 'erro'];
const SUMMARY_LABELS: Record<string, string> = {
  saudavel: 'Saudáveis',
  esgotada: 'Esgotadas (min.)',
  esgotada_diaria: 'Esgotadas (dia)',
  sobrecarregada: 'Sobrecarregadas',
  invalida: 'Inválidas',
  bloqueada: 'Bloqueadas',
  nao_encontrada: 'Não encontradas',
  erro: 'Erro'
};

export function ApiKeysDiagnosticsModal({ onClose }: ApiKeysDiagnosticsModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KeyTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageRows, setUsageRows] = useState<UsageRow[] | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  // Consumo diário MEDIDO (tokens e chamadas) — vem do servidor, que grava a cada chamada ao Gemini.
  const loadUsage = async () => {
    setUsageError(null);
    try {
      const res = await apiFetch('/api/admin/ai-usage?days=14');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const json = await res.json();
      setUsageRows(json.rows || []);
    } catch (e: any) {
      setUsageError(e.message || 'Falha ao ler o consumo.');
    }
  };
  useEffect(() => { loadUsage(); }, []);
  const usage = usageRows ? summarizeUsage(usageRows) : null;

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/test-gemini-keys', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Falha ao testar as chaves.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
      <div className="bg-white dark:bg-bordeaux-950 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-gold-500/20">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gold-500/20 bg-gradient-to-r from-primary-50 to-white dark:from-bordeaux-900/40 dark:to-bordeaux-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg">
              <KeyRound size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Diagnóstico de Chaves Gemini</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {data ? `${data.totalKeys} chave(s) testadas às ${new Date(data.testedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Faz uma chamada real e mínima em cada chave para ver o status atual'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-bordeaux-900/50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-bordeaux-950/40">

          {/* Consumo diário medido */}
          <div className="mb-6 bg-white dark:bg-bordeaux-900/30 border border-slate-200 dark:border-gold-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
                <BarChart3 size={16} /> Consumo por dia (últimos 14 dias, horário de Brasília)
              </div>
              <button onClick={loadUsage} className="text-xs text-primary-700 dark:text-gold-400 hover:underline">Atualizar</button>
            </div>
            {usageError && <p className="text-xs text-red-600 dark:text-red-300">{usageError}</p>}
            {!usageError && !usage && <p className="text-xs text-slate-500">Carregando…</p>}
            {usage && usage.days.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Ainda sem registros: o consumo passa a ser gravado a partir das próximas chamadas ao Gemini.</p>
            )}
            {usage && usage.days.length > 0 && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Média nos dias com uso: <strong>{formatTokens(usage.avgTotalPerActiveDay)}</strong> tokens e <strong>{usage.avgRequestsPerActiveDay}</strong> chamadas por dia.
                  “Total” = entrada + saída + raciocínio.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-gold-500/20">
                        <th className="py-1.5 pr-3">Dia</th><th className="pr-3">Chamadas</th><th className="pr-3">Entrada</th><th className="pr-3">Saída</th><th className="pr-3">Raciocínio</th><th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.days.map(d => (
                        <React.Fragment key={d.day}>
                          <tr className="border-b border-slate-100 dark:border-bordeaux-800/40 font-semibold text-slate-800 dark:text-slate-100">
                            <td className="py-1.5 pr-3">{formatDay(d.day)}</td><td className="pr-3">{d.requests}</td><td className="pr-3">{formatTokens(d.input)}</td><td className="pr-3">{formatTokens(d.output)}</td><td className="pr-3">{formatTokens(d.thought)}</td><td>{formatTokens(d.total)}</td>
                          </tr>
                          {d.day === usage.days[0].day && d.kinds.map(k => (
                            <tr key={k.kind} className="text-slate-500 dark:text-slate-400">
                              <td className="py-1 pr-3 pl-3" colSpan={1}>↳ {k.label}</td><td className="pr-3">{k.requests}</td><td className="pr-3">{formatTokens(k.input)}</td><td className="pr-3">{formatTokens(k.output)}</td><td className="pr-3">{formatTokens(k.thought)}</td><td>{formatTokens(k.total)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <button
              onClick={runTest}
              disabled={loading}
              className="fc-btn-primary text-cream-50 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-primary-900/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Testando chaves...' : data ? 'Testar novamente' : 'Iniciar teste'}
            </button>
            {data && (
              <div className="flex flex-wrap gap-2">
                {SUMMARY_ORDER.filter(s => data.summary[s] > 0).map(s => (
                  <span key={s} className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${STATUS_STYLES[s] || STATUS_STYLES.erro}`}>
                    {STATUS_ICON[s]} {data.summary[s]} {SUMMARY_LABELS[s] || s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {!data && !loading && !error && (
            <div className="text-center py-16 px-4 border border-dashed border-slate-300 dark:border-gold-500/20 rounded-xl bg-white dark:bg-bordeaux-900/20">
              <KeyRound size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Clique em "Iniciar teste" para verificar cada chave.</p>
              <p className="text-xs text-slate-400 mt-1">Cada teste faz uma chamada real e mínima ao Gemini por chave — evite rodar repetidamente em pouco tempo.</p>
            </div>
          )}

          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={28} className="animate-spin text-primary-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Testando cada chave em pequenos lotes, isso pode levar alguns segundos...</p>
            </div>
          )}

          {data && data.results.length > 0 && (
            <div className="bg-white dark:bg-bordeaux-900/20 border border-slate-200 dark:border-gold-500/20 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-bordeaux-900/40 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">#</th>
                      <th className="px-4 py-2.5 font-semibold">Chave</th>
                      <th className="px-4 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 font-semibold">Resp.</th>
                      <th className="px-4 py-2.5 font-semibold">Janela (60s)</th>
                      <th className="px-4 py-2.5 font-semibold">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gold-500/10">
                    {data.results.map(r => (
                      <tr key={r.index} className="hover:bg-slate-50 dark:hover:bg-bordeaux-900/30 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono">{r.index}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">{r.keyMask}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[r.status] || STATUS_STYLES.erro}`}>
                            {STATUS_ICON[r.status]} {r.statusLabel}
                          </span>
                          {r.dailyExhausted && (
                            <span className="ml-1.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">cota diária esgotada</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 font-mono">{r.responseTimeMs}ms</td>
                        <td className="px-4 py-2.5 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-bordeaux-900/60 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${r.percentFreeWindow > 50 ? 'bg-emerald-500' : r.percentFreeWindow > 15 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${r.percentFreeWindow}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">{r.percentFreeWindow}% livre</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{r.windowCount}/{r.windowLimit} chamadas · {(r.windowTokens / 1000).toFixed(0)}k/{(r.tokenLimit / 1000).toFixed(0)}k tokens</p>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-400 max-w-[220px] truncate" title={r.errorDetail}>
                          {r.errorDetail || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data && (
            <p className="text-[11px] text-slate-400 mt-3">
              % livre na janela considera tanto quantidade de chamadas quanto volume estimado de tokens enviados nos últimos 60s (conversas grandes consomem mais tokens por chamada). É uma estimativa baseada no que o próprio app já tentou — não é a cota real do Google, que não é exposta pela API. Modelo testado: {data.model}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
