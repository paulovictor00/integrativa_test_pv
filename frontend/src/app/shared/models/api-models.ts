export type StatusProcesso = 'EmAndamento' | 'Suspenso' | 'Encerrado';

export interface Historico {
  id: number;
  descricao: string;
  dataInclusao: string;
  dataAlteracao?: string | null;
}

export interface Movimentacao {
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
  tribunal?: string | null;
}

export interface ProcessoDetalhe extends ProcessoResumo {
  descricao?: string | null;
  historicos: Historico[];
}

export type ProcessoBusca = ProcessoResumo & { descricao?: string | null };

export interface CnjInfo {
  codigo: string;
  sigla: string;
  nome: string;
  uf: string;
  segmento: string;
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
  tribunal?: string | null;
  descricao?: string | null;
}

export interface SalvarHistoricoPayload {
  descricao: string;
}
