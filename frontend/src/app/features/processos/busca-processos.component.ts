import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProcessosService, FiltroProcessos } from '../../core/services/processos.service';
import { Historico, ProcessoBusca, StatusProcesso } from '../../shared/models/api-models';

@Component({
  selector: 'app-processos-busca',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container py-5">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 class="fw-bold mb-1">Buscar Processos</h2>
          <p class="text-secondary mb-0">Veja os últimos registros cadastrados com paginação simples.</p>
        </div>
        <div class="text-secondary small">
          Exibindo {{ processos().length }} de {{ totalRegistros() }} processos
        </div>
      </div>

      <div class="card p-4 mb-4">
        <form [formGroup]="filtrosForm" (ngSubmit)="buscar()" class="row g-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label text-secondary">Número</label>
            <input
              type="text"
              class="form-control"
              placeholder="0000000-00.0000.0.00.0000"
              formControlName="numero"
              (input)="formatarNumeroFiltro($event)"
            />
          </div>
          <div class="col-md-4">
            <label class="form-label text-secondary">Autor</label>
            <input type="text" class="form-control" placeholder="Nome do autor" formControlName="autor" />
          </div>
          <div class="col-md-4">
            <label class="form-label text-secondary">Réu</label>
            <input type="text" class="form-control" placeholder="Nome do réu" formControlName="reu" />
          </div>
          <div class="col-md-4">
            <label class="form-label text-secondary">Status</label>
            <select class="form-select" formControlName="status">
              <option value="">Todos</option>
              <option *ngFor="let status of statusOpcoes" [value]="status.valor">{{ status.rotulo }}</option>
            </select>
          </div>
          <div class="col-md-8 text-md-end d-flex gap-2 justify-content-md-end">
            <button type="button" class="btn btn-light btn-rounded" (click)="limparFiltros()">Limpar</button>
            <button type="submit" class="btn btn-outline-primary btn-rounded">Buscar</button>
          </div>
        </form>
      </div>

      <div *ngIf="mensagemSucesso()" class="alert alert-success rounded-4 border-0">
        {{ mensagemSucesso() }}
      </div>

      <div *ngIf="mensagemErro()" class="alert alert-danger rounded-4 border-0">
        {{ mensagemErro() }}
      </div>

      <ng-container *ngIf="!carregando(); else carregandoTpl">
        <ng-container *ngIf="processos().length; else vazioTpl">
          <div class="card processo-card p-4 mb-3" *ngFor="let processo of processos()">
            <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
              <div>
                <div class="d-flex align-items-center gap-2">
                  <div class="fw-semibold text-uppercase text-primary small">#{{ processo.id }}</div>
                  <button
                    type="button"
                    class="toggle-historico btn btn-light btn-sm"
                    (click)="alternarHistoricos(processo.id)"
                    [attr.aria-expanded]="estaExpandido(processo.id)"
                  >
                    <span [class.rotacionado]="estaExpandido(processo.id)">▼</span>
                  </button>
                </div>
                <h5 class="fw-bold mb-1 d-flex align-items-center gap-2">
                  <button type="button" class="btn btn-link p-0 cnj-link" (click)="editarProcesso(processo)">
                    {{ mascararNumeroDisplay(numeroProcessoDe(processo)) }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-light btn-sm btn-gear"
                    (click)="editarProcesso(processo)"
                    aria-label="Editar processo"
                  >
                    ⚙
                  </button>
                </h5>
                <div class="text-secondary small" *ngIf="tribunalDe(processo) as tribunal">
                  Tribunal: {{ tribunal }}
                </div>
                <div class="text-secondary small">
                  Ajuizado em
                  <ng-container *ngIf="dataAjuizamentoFormatada(processo) as data; else dataNaoInformada">
                    {{ data | date:'dd/MM/yyyy' }}
                  </ng-container>
                  <ng-template #dataNaoInformada>—</ng-template>
                </div>
              </div>
              <div class="text-md-end d-flex align-items-start justify-content-end gap-2">
                <span class="badge status-badge" [ngClass]="badgeClasse(processo.status)">{{ processo.status | titlecase }}</span>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm btn-mov"
                  (click)="verMovimentacoes(processo)"
                >
                  Movimentações
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm btn-excluir"
                  (click)="excluirProcesso(processo)"
                >
                  Excluir
                </button>
              </div>
            </div>
            <hr />
            <div class="row g-3">
              <div class="col-md-6">
                <div class="label text-secondary">Autor</div>
                <div class="fw-semibold">{{ processo.autor || '—' }}</div>
              </div>
              <div class="col-md-6">
                <div class="label text-secondary">Réu</div>
                <div class="fw-semibold">{{ processo.reu || '—' }}</div>
              </div>
              <div class="col-12" *ngIf="processo.descricao">
                <div class="label text-secondary">Descrição</div>
                <div>{{ processo.descricao }}</div>
              </div>
            </div>

            <div class="historico-wrapper mt-3" *ngIf="estaExpandido(processo.id)">
              <hr />
              <div *ngIf="carregandoHistorico(processo.id)" class="text-secondary small">Carregando histórico...</div>
              <div *ngIf="erroHistoricoDe(processo.id) as erro" class="alert alert-danger rounded-4 border-0 py-2 px-3 small">
                {{ erro }}
              </div>
              <ng-container *ngIf="!carregandoHistorico(processo.id) && !erroHistoricoDe(processo.id)">
                <ng-container *ngIf="historicosDo(processo.id).length; else semHistoricoCard">
                  <div class="historico-item rounded-4 p-3 mb-2" *ngFor="let historico of historicosDo(processo.id)">
                    <div class="fw-semibold">{{ historico.descricao }}</div>
                    <small class="text-secondary d-block">Incluído em {{ historico.dataInclusao | date:'dd/MM/yyyy HH:mm' }}</small>
                    <small class="text-secondary d-block" *ngIf="historico.dataAlteracao">Alterado em {{ historico.dataAlteracao | date:'dd/MM/yyyy HH:mm' }}</small>
                  </div>
                </ng-container>
                <ng-template #semHistoricoCard>
                  <div class="text-secondary small">Nenhum histórico registrado.</div>
                </ng-template>
              </ng-container>
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center mt-4">
            <div class="text-secondary small">
              Página {{ paginaAtual() }} de {{ totalPaginas() }}
            </div>
            <div class="btn-group">
              <button class="btn btn-light" (click)="paginaAnterior()" [disabled]="paginaAtual() === 1">Anterior</button>
              <button class="btn btn-light" (click)="proximaPagina()" [disabled]="paginaAtual() >= totalPaginas()">Próxima</button>
            </div>
          </div>
        </ng-container>
      </ng-container>

      <ng-template #carregandoTpl>
        <div class="card p-5 text-center text-secondary">
          <div class="spinner-border text-primary mb-3" role="status"></div>
          Carregando processos...
        </div>
      </ng-template>

      <ng-template #vazioTpl>
        <div class="card p-5 text-center text-secondary">
          Nenhum processo encontrado.
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .processo-card {
      border-radius: 1.25rem;
      border: none;
      box-shadow: 0 15px 45px rgba(15, 23, 42, 0.08);
    }

    .processo-card .label {
      font-size: 0.85rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
    }

    .status-badge {
      border-radius: 999px;
      padding: 0.35rem 1.25rem;
      font-size: 0.85rem;
    }

    .status-badge.em-andamento {
      background-color: rgba(79, 70, 229, 0.12);
      color: #4f46e5;
    }

    .status-badge.suspenso {
      background-color: rgba(16, 185, 129, 0.12);
      color: #047857;
    }

    .status-badge.encerrado {
      background-color: rgba(239, 68, 68, 0.12);
      color: #dc2626;
    }

    .status-badge.excluido {
      background-color: rgba(107, 114, 128, 0.16);
      color: #1f2937;
    }

    .toggle-historico {
      border-radius: 999px;
      padding: 0.25rem 0.6rem;
      line-height: 1;
    }

    .toggle-historico span {
      display: inline-block;
      transition: transform 0.2s ease;
    }

    .toggle-historico span.rotacionado {
      transform: rotate(180deg);
    }

    .historico-item {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02));
    }

    .cnj-link {
      color: #2563eb;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }

    .cnj-link:hover,
    .cnj-link:focus {
      text-decoration: underline;
      color: #1d4ed8;
    }

    .btn-gear {
      line-height: 1;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn-excluir {
      border-radius: 999px;
      padding-inline: 0.9rem;
    }

    .btn-mov {
      border-radius: 999px;
      padding-inline: 0.9rem;
    }
  `]
})
export class ProcessosBuscaComponent implements OnInit {
  private readonly tamanhoPagina = 5;

  readonly statusOpcoes: { valor: StatusProcesso; rotulo: string }[] = [
    { valor: 'EmAndamento', rotulo: 'Em andamento' },
    { valor: 'Suspenso', rotulo: 'Suspenso' },
    { valor: 'Encerrado', rotulo: 'Encerrado' }
  ];

  processos = signal<ProcessoBusca[]>([]);
  paginaAtual = signal(1);
  totalRegistros = signal(0);
  carregando = signal(false);
  mensagemSucesso = signal<string | null>(null);
  mensagemErro = signal<string | null>(null);
  historicosCache = signal<Record<number, Historico[]>>({});
  carregandoHistoricos = signal<Record<number, boolean>>({});
  expandidos = signal<Record<number, boolean>>({});
  erroHistorico = signal<Record<number, string>>({});

  totalPaginas = computed(() => {
    const total = this.totalRegistros();
    if (total === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / this.tamanhoPagina));
  });

  filtrosForm = this.fb.group({
    numero: [''],
    autor: [''],
    reu: [''],
    status: ['']
  });

  constructor(
    private readonly processosService: ProcessosService,
    private readonly fb: FormBuilder,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.carregarProcessos(1);
  }

  carregarProcessos(pagina: number, manterSucesso: boolean = false): void {
    if (!manterSucesso) {
      this.mensagemSucesso.set(null);
    }
    this.carregando.set(true);
    this.mensagemErro.set(null);

    const numeroFiltro = this.limparNumero(this.filtrosForm.value.numero ?? '');
    const filtros: FiltroProcessos = {
      numero: numeroFiltro || undefined,
      autor: this.filtrosForm.value.autor || undefined,
      reu: this.filtrosForm.value.reu || undefined,
      status: (this.filtrosForm.value.status as StatusProcesso) || undefined
    };

    this.processosService
      .listarUltimos(pagina, this.tamanhoPagina, filtros)
      .pipe(finalize(() => this.carregando.set(false)))
      .subscribe({
        next: (resultado) => {
          this.processos.set(resultado.itens ?? []);
          this.totalRegistros.set(resultado.totalRegistros ?? 0);
          this.paginaAtual.set(resultado.pagina ?? pagina);
          this.expandidos.set({});
          this.historicosCache.set({});
          this.carregandoHistoricos.set({});
          this.erroHistorico.set({});
        },
        error: () => {
          this.mensagemErro.set('Não foi possível carregar os processos.');
        }
      });
  }

  excluirProcesso(processo: ProcessoBusca): void {
    if (!processo) {
      return;
    }

    if (!confirm(`Deseja realmente excluir o processo ${this.mascararNumeroDisplay(this.numeroProcessoDe(processo))}?`)) {
      return;
    }

    this.processosService.remover(processo.id).subscribe({
      next: () => {
        this.exibirSucesso('Processo excluído com sucesso.');
        const itensRestantes = this.processos().length;
        const paginaDestino = itensRestantes > 1 ? this.paginaAtual() : Math.max(1, this.paginaAtual() - 1);
        this.carregarProcessos(paginaDestino, true);
      },
      error: () => {
        this.mensagemErro.set('Não foi possível excluir o processo.');
      }
    });
  }

  buscar(): void {
    this.carregarProcessos(1);
  }

  limparFiltros(): void {
    this.filtrosForm.reset({ status: '' });
    this.carregarProcessos(1);
  }

  paginaAnterior(): void {
    if (this.paginaAtual() > 1) {
      this.carregarProcessos(this.paginaAtual() - 1);
    }
  }

  proximaPagina(): void {
    if (this.paginaAtual() < this.totalPaginas()) {
      this.carregarProcessos(this.paginaAtual() + 1);
    }
  }

  alternarHistoricos(id: number): void {
    const atual = { ...this.expandidos() };
    const estaAberto = !!atual[id];
    if (estaAberto) {
      delete atual[id];
    } else {
      atual[id] = true;
      if (!this.historicosCache()[id]) {
        this.carregarHistoricos(id);
      }
    }
    this.expandidos.set(atual);
  }

  estaExpandido(id: number): boolean {
    return !!this.expandidos()[id];
  }

  historicosDo(id: number): Historico[] {
    return this.historicosCache()[id] ?? [];
  }

  carregandoHistorico(id: number): boolean {
    return !!this.carregandoHistoricos()[id];
  }

  erroHistoricoDe(id: number): string | null {
    return this.erroHistorico()[id] ?? null;
  }

  private carregarHistoricos(id: number): void {
    this.carregandoHistoricos.set({ ...this.carregandoHistoricos(), [id]: true });
    const errosAtuais = { ...this.erroHistorico() };
    delete errosAtuais[id];
    this.erroHistorico.set(errosAtuais);

    this.processosService.listarHistoricos(id).subscribe({
      next: (historicos) => {
        const cache = { ...this.historicosCache() };
        cache[id] = historicos;
        this.historicosCache.set(cache);
        const carregando = { ...this.carregandoHistoricos() };
        delete carregando[id];
        this.carregandoHistoricos.set(carregando);
      },
      error: () => {
        const carregando = { ...this.carregandoHistoricos() };
        delete carregando[id];
        this.carregandoHistoricos.set(carregando);
        const cache = { ...this.historicosCache() };
        cache[id] = [];
        this.historicosCache.set(cache);
      }
    });
  }

  numeroProcessoDe(processo: ProcessoBusca): string {
    return processo.numeroProcesso || '';
  }

  private exibirSucesso(mensagem: string): void {
    this.mensagemSucesso.set(mensagem);
    setTimeout(() => this.mensagemSucesso.set(null), 4000);
  }

  tribunalDe(processo: ProcessoBusca): string {
    return processo.tribunal || '';
  }

  editarProcesso(processo: ProcessoBusca): void {
    const id = Number(processo?.id);
    if (!id || Number.isNaN(id)) {
      return;
    }
    this.router.navigate(['/processos'], { queryParams: { id } });
  }

  verMovimentacoes(processo: ProcessoBusca): void {
    const id = Number(processo?.id);
    if (!id || Number.isNaN(id)) {
      return;
    }
    this.router.navigate(['/processos', id, 'movimentacoes']);
  }

  badgeClasse(status: string): string {
    const valor = (status || '').toLowerCase();
    if (valor === 'suspenso') return 'status-badge suspenso';
    if (valor === 'encerrado') return 'status-badge encerrado';
    if (valor === 'excluido') return 'status-badge excluido';
    return 'status-badge em-andamento';
  }

  mascararNumeroDisplay(valor: string | null | undefined): string {
    const apenasDigitos = this.limparNumero(valor);
    return this.aplicarMascaraCnj(apenasDigitos);
  }

  dataAjuizamentoFormatada(processo: ProcessoBusca): string | null {
    const valor = processo.dataAjuizamento?.trim();
    return valor ? valor : null;
  }

  formatarNumeroFiltro(evento: Event): void {
    const input = evento.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const apenasDigitos = this.limparNumero(input.value).slice(0, 20);
    const mascarado = this.aplicarMascaraCnj(apenasDigitos);
    input.value = mascarado;
    this.filtrosForm.patchValue({ numero: mascarado }, { emitEvent: false });
  }

  private aplicarMascaraCnj(digitos: string): string {
    const partes = [
      digitos.slice(0, 7),
      digitos.slice(7, 9),
      digitos.slice(9, 13),
      digitos.slice(13, 14),
      digitos.slice(14, 16),
      digitos.slice(16, 20)
    ];

    let resultado = partes[0] || '';
    if (partes[1]) resultado += '-' + partes[1];
    if (partes[2]) resultado += '.' + partes[2];
    if (partes[3]) resultado += '.' + partes[3];
    if (partes[4]) resultado += '.' + partes[4];
    if (partes[5]) resultado += '.' + partes[5];

    return resultado;
  }

  private limparNumero(valor: string | null | undefined): string {
    if (!valor) {
      return '';
    }
    return valor.replace(/\D/g, '');
  }
}
