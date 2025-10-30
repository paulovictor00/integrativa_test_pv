import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Historico,
  Movimentacao,
  CnjInfo,
  ProcessoBusca,
  ProcessoDetalhe,
  ProcessoResumo,
  ResultadoPaginado,
  SalvarHistoricoPayload,
  SalvarProcessoPayload,
  StatusProcesso
} from '../../shared/models/api-models';

const API_URL = resolverApiBase();

function resolverApiBase(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const origin = window.location.origin;
  const porta = window.location.port;

  if (porta === '4200') {
    return 'http://localhost:5000';
  }

  return origin || 'http://localhost:5000';
}

export interface FiltroProcessos {
  numero?: string;
  autor?: string;
  reu?: string;
  status?: StatusProcesso | '';
  pagina?: number;
  tamanho?: number;
}

@Injectable({ providedIn: 'root' })
export class ProcessosService {
  private readonly baseUrl = `${API_URL}/api/processos`;
  private readonly historicosUrl = `${API_URL}/api/historicos`;

  constructor(private readonly http: HttpClient) {}

  listar(filtro: FiltroProcessos): Observable<ResultadoPaginado<ProcessoResumo>> {
    let params = new HttpParams();
    if (filtro.numero) params = params.set('numero', filtro.numero);
    if (filtro.autor) params = params.set('autor', filtro.autor);
    if (filtro.reu) params = params.set('reu', filtro.reu);
    if (filtro.status) params = params.set('status', filtro.status);
    if (filtro.pagina) params = params.set('pagina', filtro.pagina);
    if (filtro.tamanho) params = params.set('tamanho', filtro.tamanho);

    return this.http.get<ResultadoPaginado<ProcessoResumo>>(this.baseUrl, { params });
  }

  obter(id: number): Observable<ProcessoDetalhe> {
    return this.http.get<ProcessoDetalhe>(`${this.baseUrl}/${id}`).pipe(
      map((processo) => this.normalizarProcessoDetalhe(processo))
    );
  }

  criar(payload: SalvarProcessoPayload): Observable<ProcessoDetalhe> {
    return this.http.post<ProcessoDetalhe>(this.baseUrl, payload);
  }

  atualizar(id: number, payload: SalvarProcessoPayload): Observable<ProcessoDetalhe> {
    return this.http.put<ProcessoDetalhe>(`${this.baseUrl}/${id}`, payload);
  }

  remover(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  atualizarStatus(id: number, status: StatusProcesso): Observable<{ mensagem: string }> {
    return this.http.patch<{ mensagem: string }>(`${this.baseUrl}/${id}/status`, { status });
  }

  criarHistorico(idProcesso: number, payload: SalvarHistoricoPayload): Observable<Historico> {
    return this.http.post<Historico>(`${this.baseUrl}/${idProcesso}/historicos`, payload);
  }

  atualizarHistorico(id: number, payload: SalvarHistoricoPayload): Observable<Historico> {
    return this.http.put<Historico>(`${this.historicosUrl}/${id}`, payload);
  }

  removerHistorico(id: number): Observable<void> {
    return this.http.delete<void>(`${this.historicosUrl}/${id}`);
  }

  listarMovimentacoes(idProcesso: number, pagina: number, tamanho: number = 5): Observable<ResultadoPaginado<Movimentacao>> {
    let params = new HttpParams();
    params = params.set('pagina', pagina.toString());
    params = params.set('tamanho', tamanho.toString());

    return this.http
      .get<ResultadoPaginado<Movimentacao>>(`${this.baseUrl}/${idProcesso}/movimentacoes`, { params })
      .pipe(
        map((res) => ({
          itens: (res?.itens ?? []).map((item) => this.normalizarMovimentacao(item)),
          totalRegistros: res?.totalRegistros ?? 0,
          pagina: res?.pagina ?? pagina,
          tamanhoPagina: res?.tamanhoPagina ?? tamanho
        }))
      );
  }

  criarMovimentacao(idProcesso: number, payload: { descricao: string }): Observable<{ resultado: string; linhas: number }> {
    return this.http.post<{ resultado: string; linhas: number }>(`${this.baseUrl}/${idProcesso}/movimentacoes`, payload);
  }

  atualizarMovimentacao(idProcesso: number, id: number, payload: { descricao: string }): Observable<{ resultado: string; linhas: number }> {
    return this.http.put<{ resultado: string; linhas: number }>(`${this.baseUrl}/${idProcesso}/movimentacoes/${id}`, payload);
  }

  removerMovimentacao(idProcesso: number, id: number): Observable<{ resultado: string; linhas: number }> {
    return this.http.delete<{ resultado: string; linhas: number }>(`${this.baseUrl}/${idProcesso}/movimentacoes/${id}`);
  }

  listarHistoricos(idProcesso: number): Observable<Historico[]> {
    return this.http
      .get<{ historicos: Historico[] }>(`${this.baseUrl}/${idProcesso}/historicos`)
      .pipe(
        map((res) => res?.historicos ?? []),
        catchError(() => of([]))
      );
  }

  obterInformacoesCnj(numero: string): Observable<CnjInfo> {
    const params = new HttpParams().set('numero', numero);
    return this.http.get<CnjInfo>(`${this.baseUrl}/cnj-info`, { params });
  }

  listarUltimos(pagina: number, tamanho: number = 5, filtro?: FiltroProcessos): Observable<ResultadoPaginado<ProcessoBusca>> {
    let params = new HttpParams();
    params = params.set('pagina', pagina.toString());
    params = params.set('tamanho', tamanho.toString());
    if (filtro?.numero) params = params.set('numero', filtro.numero);
    if (filtro?.autor) params = params.set('autor', filtro.autor);
    if (filtro?.reu) params = params.set('reu', filtro.reu);
    if (filtro?.status) params = params.set('status', filtro.status);

    return this.http.get<ResultadoPaginado<ProcessoBusca>>(`${this.baseUrl}/ultimos`, { params }).pipe(
      map((res) => ({
        itens: (res?.itens ?? []).map((p) => this.normalizarProcessoBusca(p)),
        totalRegistros: res?.totalRegistros ?? 0,
        pagina: res?.pagina ?? pagina,
        tamanhoPagina: res?.tamanhoPagina ?? tamanho
      }))
    );
  }

  private normalizarProcessoBusca(p: ProcessoBusca): ProcessoBusca {
    return {
      ...p,
      autor: p.autor ?? '',
      reu: p.reu ?? '',
      tribunal: p.tribunal ?? '',
      dataAjuizamento: this.normalizarData(p.dataAjuizamento)
    };
  }

  private normalizarProcessoDetalhe(p: ProcessoDetalhe): ProcessoDetalhe {
    return {
      ...p,
      autor: p.autor ?? '',
      reu: p.reu ?? '',
      tribunal: p.tribunal ?? '',
      dataAjuizamento: this.normalizarData(p.dataAjuizamento),
      historicos: (p.historicos ?? []).map((h) => ({
        ...h,
        dataInclusao: this.normalizarDataHora(h.dataInclusao),
        dataAlteracao: this.normalizarDataHora(h.dataAlteracao ?? undefined)
      }))
    };
  }

  private normalizarMovimentacao(m: Movimentacao | any): Movimentacao {
    const dataInclusao = this.normalizarDataHora(m?.dataInclusao);
    const dataAlteracao = this.normalizarDataHora(m?.dataAlteracao);

    return {
      id: this.extrairNumero(m?.id),
      descricao: m?.descricao ?? '',
      dataInclusao,
      dataAlteracao: dataAlteracao ? dataAlteracao : null
    };
  }

  private normalizarData(valor: any): string {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'object' && '$date' in valor) {
      const data = valor['$date'];
      return typeof data === 'string' ? data.slice(0, 10) : '';
    }
    return '';
  }

  private normalizarDataHora(valor: any): string {
    if (!valor) return '';
    if (typeof valor === 'string') return valor;
    if (typeof valor === 'object' && '$date' in valor) {
      const data = valor['$date'];
      return typeof data === 'string' ? data.replace('T', ' ').replace('Z', '') : '';
    }
    return '';
  }

  private extrairNumero(valor: any): number {
    if (typeof valor === 'number') {
      return valor;
    }

    if (typeof valor === 'string') {
      const numerico = Number(valor);
      return Number.isNaN(numerico) ? 0 : numerico;
    }

    if (valor && typeof valor === 'object') {
      if ('$numberInt' in valor) {
        return Number((valor as any)['$numberInt']);
      }

      if ('$numberLong' in valor) {
        return Number((valor as any)['$numberLong']);
      }

      if ('$numberDouble' in valor) {
        return Number((valor as any)['$numberDouble']);
      }
    }

    return 0;
  }
}
