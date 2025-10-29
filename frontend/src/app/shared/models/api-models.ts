export type StatusProcesso = 'EmAndamento' | 'Suspenso' | 'Encerrado';

export interface Historico {
  id: number;
  descricao: string;
  dataInclusao: string;
  dataAlteracao?: string | null;
}

export interface ProcessoResumo {
  id: number;
  numeroProcesso: string;
  autor: string;
  reu: string;
  dataAjuizamento: string;
  status: StatusProcesso;
}

export interface ProcessoDetalhe extends ProcessoResumo {
  descricao?: string | null;
  historicos: Historico[];
}

export interface ResultadoPaginado<T> {
  itens: T[];
  totalRegistros: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface SalvarProcessoPayload {
  numeroProcesso: string;
  autor: string;
  reu: string;
  dataAjuizamento: string;
  status: StatusProcesso;
  descricao?: string | null;
}

export interface SalvarHistoricoPayload {
  descricao: string;
}
