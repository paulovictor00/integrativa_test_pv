import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Historico,
  ProcessoDetalhe,
  ProcessoResumo,
  ResultadoPaginado,
  SalvarHistoricoPayload,
  SalvarProcessoPayload,
  StatusProcesso
} from '../../shared/models/api-models';

const API_URL = (typeof window !== 'undefined' && (window as any).INTEGRATIVA_API_URL) || 'http://localhost:5000';

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
    return this.http.get<ProcessoDetalhe>(`${this.baseUrl}/${id}`);
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
}
