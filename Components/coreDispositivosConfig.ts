// Taxonomia dos subtipos de caso previdenciário (INSS) para o mecanismo de
// "Dispositivos Núcleo por Tipo de Caso" — v1 escopo combinado com o Dr. Michel:
// só INSS pra começar (maior volume), granular por subtipo (não por tema amplo,
// ex.: BPC-Deficiência != BPC-Idoso), expandir pra outras áreas depois de validado.
export interface CaseTypeOption {
  key: string;
  label: string;
}

export const CORE_DISPOSITIVOS_CASE_TYPES: CaseTypeOption[] = [
  { key: 'bpc_deficiencia', label: 'BPC/LOAS — Deficiência' },
  { key: 'bpc_idoso', label: 'BPC/LOAS — Idoso' },
  { key: 'aposentadoria_idade', label: 'Aposentadoria por Idade' },
  { key: 'aposentadoria_tempo_contribuicao', label: 'Aposentadoria por Tempo de Contribuição' },
  { key: 'aposentadoria_especial', label: 'Aposentadoria Especial' },
  { key: 'aposentadoria_invalidez', label: 'Aposentadoria por Invalidez' },
  { key: 'auxilio_doenca', label: 'Auxílio-Doença (Incapacidade Temporária)' },
  { key: 'pensao_morte', label: 'Pensão por Morte' },
  { key: 'salario_maternidade', label: 'Salário-Maternidade' },
];

export const CASE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CORE_DISPOSITIVOS_CASE_TYPES.map(t => [t.key, t.label])
);
