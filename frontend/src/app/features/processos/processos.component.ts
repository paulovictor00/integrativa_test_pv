import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ProcessosService, FiltroProcessos } from '../../core/services/processos.service';
import {
  Historico,
  ProcessoDetalhe,
  ProcessoResumo,
  SalvarHistoricoPayload,
  SalvarProcessoPayload,
  StatusProcesso
} from '../../shared/models/api-models';

@Component({
  selector: 'app-processos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="container py-5">
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 class="fw-bold mb-1">Gestão de Processos</h2>
          <p class="text-secondary mb-0">Acompanhe, atualize e mantenha o histórico das movimentações com facilidade.</p>
        </div>
        <button class="btn btn-primary btn-rounded px-4 py-2 shadow" (click)="abrirFormularioEdicao()">
          + Novo processo
        </button>
      </div>

      <div *ngIf="mensagemSistema()" class="alert" [ngClass]="{'alert-success': tipoMensagem() === 'sucesso', 'alert-danger': tipoMensagem() === 'erro'}">
        {{ mensagemSistema() }}
      </div>

      <div class="row g-4">
        <div class="col-lg-7">
          <div class="card p-4 mb-4">
            <form [formGroup]="filtrosForm" (ngSubmit)="buscar()" class="row g-3 align-items-end">
              <div class="col-md-4">
                <label class="form-label text-secondary">Número</label>
                <input type="text" class="form-control" placeholder="Ex: 0000000-00.0000.0.00.0000" formControlName="numero" />
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

          <div class="card p-0 overflow-hidden">
            <div class="table-responsive p-4" *ngIf="!carregandoLista(); else carregandoListaTpl">
              <table class="table table-rounded align-middle">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Número</th>
                    <th>Partes</th>
                    <th>Status</th>
                    <th class="text-end">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let processo of processos()" (click)="selecionarProcesso(processo.id)" class="cursor-pointer">
                    <th scope="row">{{ processo.id }}</th>
                    <td>
                      <div class="fw-semibold">{{ mascararNumeroDisplay(processo.numeroProcesso) }}</div>
                      <small class="text-secondary">{{ processo.dataAjuizamento | date:'dd/MM/yyyy' }}</small>
                    </td>
                    <td>
                      <div class="fw-semibold text-primary">{{ processo.autor }}</div>
                      <small class="text-secondary">vs {{ processo.reu }}</small>
                    </td>
                    <td>
                      <span class="badge" [ngClass]="badgeClasse(processo.status)">{{ processo.status | titlecase }}</span>
                      <div class="mt-2">
                        <select
                          class="form-select form-select-sm"
                          [value]="processo.status"
                          (change)="mudarStatus(processo, $event.target)"
                          (click)="$event.stopPropagation()"
                        >
                          <option *ngFor="let status of statusOpcoes" [value]="status.valor">{{ status.rotulo }}</option>
                        </select>
                      </div>
                    </td>
                    <td class="text-end">
                      <div class="btn-group">
                        <button
                          class="btn btn-sm btn-outline-primary"
                          type="button"
                          (click)="selecionarProcesso(processo.id); abrirFormularioEdicao(processoSelecionado()); $event.stopPropagation();"
                        >
                          Editar
                        </button>
                        <button class="btn btn-sm btn-outline-danger" type="button" (click)="excluirProcesso(processo.id); $event.stopPropagation();">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="d-flex justify-content-between align-items-center mt-3">
                <div class="text-secondary small">Total de registros: {{ totalRegistros() }}</div>
                <div class="btn-group">
                  <button class="btn btn-light" (click)="paginaAnterior()" [disabled]="paginaAtual() === 1">Anterior</button>
                  <button class="btn btn-light" (click)="proximaPagina()" [disabled]="paginaAtual() * tamanhoPagina() >= totalRegistros()">Próxima</button>
                </div>
              </div>
            </div>
            <ng-template #carregandoListaTpl>
              <div class="p-5 text-center">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <p class="text-secondary">Carregando processos...</p>
              </div>
            </ng-template>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="card p-4 mb-4" *ngIf="exibindoFormulario(); else detalheProcessoTpl">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-semibold mb-0">{{ tituloFormulario() }}</h5>
              <button class="btn btn-sm btn-light" (click)="fecharFormulario()">Fechar</button>
            </div>

            <form [formGroup]="processoForm" (ngSubmit)="salvarProcesso()" class="row g-3">
              <div class="col-12">
                <label class="form-label">Número do processo</label>
                <input
                  class="form-control"
                  formControlName="numeroProcesso"
                  placeholder="0000000-00.0000.0.00.0000"
                  [class.is-invalid]="processoForm.get('numeroProcesso')?.invalid && (processoForm.get('numeroProcesso')?.touched || processoForm.get('numeroProcesso')?.dirty)"
                  (input)="formatarNumeroProcesso($event)"
                />
                <div class="invalid-feedback">Informe um número válido.</div>
              </div>
              <div class="col-12">
                <label class="form-label">Autor</label>
                <input
                  class="form-control"
                  formControlName="autor"
                  [class.is-invalid]="processoForm.get('autor')?.invalid && (processoForm.get('autor')?.touched || processoForm.get('autor')?.dirty)"
                />
                <div class="invalid-feedback">Informe o autor.</div>
              </div>
              <div class="col-12">
                <label class="form-label">Réu</label>
                <input
                  class="form-control"
                  formControlName="reu"
                  [class.is-invalid]="processoForm.get('reu')?.invalid && (processoForm.get('reu')?.touched || processoForm.get('reu')?.dirty)"
                />
                <div class="invalid-feedback">Informe o réu.</div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Data de ajuizamento</label>
                <input
                  type="date"
                  class="form-control"
                  formControlName="dataAjuizamento"
                  [class.is-invalid]="processoForm.get('dataAjuizamento')?.invalid && (processoForm.get('dataAjuizamento')?.touched || processoForm.get('dataAjuizamento')?.dirty)"
                />
                <div class="invalid-feedback">Selecione a data de ajuizamento.</div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Status</label>
                <select
                  class="form-select"
                  formControlName="status"
                  [class.is-invalid]="processoForm.get('status')?.invalid && (processoForm.get('status')?.touched || processoForm.get('status')?.dirty)"
                >
                  <option *ngFor="let status of statusOpcoes" [value]="status.valor">{{ status.rotulo }}</option>
                </select>
                <div class="invalid-feedback">Selecione o status.</div>
              </div>
              <div class="col-12">
                <label class="form-label">Descrição</label>
                <textarea rows="3" class="form-control" formControlName="descricao" placeholder="Observações gerais"></textarea>
              </div>
              <div class="col-12 text-end">
                <button type="submit" class="btn btn-primary btn-rounded px-4">Salvar</button>
              </div>
            </form>
          </div>

          <ng-template #detalheProcessoTpl>
            <div class="card p-4" *ngIf="processoSelecionado(); else selecioneProcessoTpl">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 class="fw-bold mb-1">{{ mascararNumeroDisplay(processoSelecionado()!.numeroProcesso) }}</h5>
                  <div class="text-secondary">Ajuizado em {{ processoSelecionado()!.dataAjuizamento | date:'dd/MM/yyyy' }}</div>
                </div>
                <span class="badge" [ngClass]="badgeClasse(processoSelecionado()!.status)">{{ processoSelecionado()!.status | titlecase }}</span>
              </div>

              <div class="mb-4">
                <div class="mb-2"><strong>Autor:</strong> {{ processoSelecionado()!.autor }}</div>
                <div class="mb-2"><strong>Réu:</strong> {{ processoSelecionado()!.reu }}</div>
                <div><strong>Descrição:</strong> {{ processoSelecionado()!.descricao || 'Sem observações.' }}</div>
              </div>

              <hr />
              <div class="mb-3 d-flex justify-content-between align-items-center">
                <h6 class="fw-semibold mb-0">Histórico de movimentações</h6>
                <button class="btn btn-sm btn-outline-primary" (click)="cancelarEdicaoHistorico(); historicoForm.reset({ descricao: '' });">
                  Novo histórico
                </button>
              </div>

              <form [formGroup]="historicoForm" (ngSubmit)="salvarHistorico()" class="mb-4">
                <label class="form-label">Descrição</label>
                <textarea rows="3" class="form-control" placeholder="Detalhe a movimentação" formControlName="descricao"></textarea>
                <div class="d-flex gap-2 justify-content-end mt-2">
                  <button type="button" class="btn btn-light" *ngIf="historicoEmEdicao()" (click)="cancelarEdicaoHistorico()">Cancelar</button>
                  <button type="submit" class="btn btn-primary">{{ historicoEmEdicao() ? 'Atualizar' : 'Adicionar' }}</button>
                </div>
              </form>

              <div class="lista-historicos" *ngIf="processoSelecionado()!.historicos.length; else semHistoricoTpl">
                <div class="historico-item rounded-4 p-3 mb-3" *ngFor="let historico of processoSelecionado()!.historicos">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <div class="fw-semibold">{{ historico.descricao }}</div>
                      <small class="text-secondary">Incluído em {{ historico.dataInclusao | date:'dd/MM/yyyy HH:mm' }}</small>
                      <div *ngIf="historico.dataAlteracao" class="text-secondary small">Alterado em {{ historico.dataAlteracao | date:'dd/MM/yyyy HH:mm' }}</div>
                    </div>
                    <div class="btn-group">
                      <button class="btn btn-sm btn-outline-secondary" (click)="iniciarEdicaoHistorico(historico)">Editar</button>
                      <button class="btn btn-sm btn-outline-danger" (click)="removerHistorico(historico)">Excluir</button>
                    </div>
                  </div>
                </div>
              </div>
              <ng-template #semHistoricoTpl>
                <div class="alert alert-info rounded-4 border-0">Nenhum histórico cadastrado até o momento.</div>
              </ng-template>
            </div>
            <ng-template #selecioneProcessoTpl>
              <div class="card p-5 text-center text-secondary">
                <p class="mb-0">Selecione um processo na lista para visualizar detalhes ou clique em "Novo processo" para cadastrar.</p>
              </div>
            </ng-template>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .cursor-pointer {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.2s ease;
    }

    .cursor-pointer:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 35px rgba(15, 23, 42, 0.12);
    }

    .card {
      border-radius: 1.25rem;
    }

    .historico-item {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02));
    }

    .btn-group .btn {
      border-radius: 999px;
    }

    .alert {
      border-radius: 1rem;
      border: none;
    }
  `]
})
export class ProcessosComponent implements OnInit {
  processos = signal<ProcessoResumo[]>([]);
  paginaAtual = signal(1);
  tamanhoPagina = signal(10);
  totalRegistros = signal(0);
  carregandoLista = signal(false);
  carregandoDetalhe = signal(false);
  exibindoFormulario = signal(false);
  processoSelecionado = signal<ProcessoDetalhe | null>(null);
  historicoEmEdicao = signal<Historico | null>(null);
  mensagemSistema = signal<string | null>(null);
  tipoMensagem = signal<'sucesso' | 'erro' | null>(null);

  readonly statusOpcoes: { valor: StatusProcesso; rotulo: string; classe: string }[] = [
    { valor: 'EmAndamento', rotulo: 'Em andamento', classe: 'em-andamento' },
    { valor: 'Suspenso', rotulo: 'Suspenso', classe: 'suspenso' },
    { valor: 'Encerrado', rotulo: 'Encerrado', classe: 'encerrado' }
  ];

  filtrosForm = this.fb.group({
    numero: [''],
    autor: [''],
    reu: [''],
    status: ['']
  });

  processoForm = this.fb.group({
    id: [0],
    numeroProcesso: ['', [Validators.required, Validators.maxLength(100)]],
    autor: ['', [Validators.required, Validators.maxLength(200)]],
    reu: ['', [Validators.required, Validators.maxLength(200)]],
    dataAjuizamento: ['', [Validators.required]],
    status: ['EmAndamento' as StatusProcesso, [Validators.required]],
    descricao: ['']
  });

  historicoForm = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  tituloFormulario = computed(() => (this.processoForm.value.id ? 'Editar processo' : 'Cadastrar processo'));

  constructor(private readonly fb: FormBuilder, private readonly processosService: ProcessosService) {}

  ngOnInit(): void {
    this.carregarProcessos();
  }

  carregarProcessos(pagina: number = 1): void {
    this.carregandoLista.set(true);
    this.mensagemSistema.set(null);
    this.tipoMensagem.set(null);

    const filtros: FiltroProcessos = {
      numero: this.filtrosForm.value.numero || undefined,
      autor: this.filtrosForm.value.autor || undefined,
      reu: this.filtrosForm.value.reu || undefined,
      status: (this.filtrosForm.value.status as StatusProcesso) || undefined,
      pagina,
      tamanho: this.tamanhoPagina()
    };

    this.processosService
      .listar(filtros)
      .pipe(finalize(() => this.carregandoLista.set(false)))
      .subscribe({
        next: (resultado) => {
          this.processos.set(resultado.itens);
          this.totalRegistros.set(resultado.totalRegistros);
          this.paginaAtual.set(resultado.pagina);
        },
        error: () => this.exibirMensagem('Não foi possível carregar os processos.', 'erro')
      });
  }

  buscar(): void {
    this.carregarProcessos(1);
  }

  limparFiltros(): void {
    this.filtrosForm.reset({ status: '' });
    this.carregarProcessos(1);
  }

  abrirFormularioEdicao(processo?: ProcessoDetalhe): void {
    this.exibindoFormulario.set(true);
    if (processo) {
      const numeroFormatado = this.mascararNumeroDisplay(processo.numeroProcesso);
      this.processoForm.setValue({
        id: processo.id,
        numeroProcesso: numeroFormatado,
        autor: processo.autor,
        reu: processo.reu,
        dataAjuizamento: processo.dataAjuizamento.substring(0, 10),
        status: processo.status,
        descricao: processo.descricao ?? ''
      });
    } else {
      this.processoForm.reset({
        id: 0,
        numeroProcesso: '',
        autor: '',
        reu: '',
        dataAjuizamento: new Date().toISOString().substring(0, 10),
        status: 'EmAndamento',
        descricao: ''
      });
    }
  }

  fecharFormulario(): void {
    this.exibindoFormulario.set(false);
    this.processoForm.reset();
  }

  salvarProcesso(): void {
    if (this.processoForm.invalid) {
      this.processoForm.markAllAsTouched();
      return;
    }

    const valor = this.processoForm.value;
    const numeroLimpo = this.limparNumero(valor.numeroProcesso ?? '');
    const payload: SalvarProcessoPayload = {
      numeroProcesso: numeroLimpo,
      autor: valor.autor!,
      reu: valor.reu!,
      dataAjuizamento: valor.dataAjuizamento!,
      status: valor.status!,
      descricao: valor.descricao || ''
    };

    const operacao = valor.id && valor.id > 0
      ? this.processosService.atualizar(valor.id, payload)
      : this.processosService.criar(payload);

    operacao.subscribe({
      next: (processo) => {
        this.exibirMensagem('Processo salvo com sucesso!', 'sucesso');
        this.fecharFormulario();
        this.carregarProcessos(this.paginaAtual());
        this.selecionarProcesso(processo.id);
      },
      error: (erro) => {
        const mensagem = erro?.error?.erro || 'Não foi possível salvar o processo.';
        this.exibirMensagem(mensagem, 'erro');
      }
    });
  }

  selecionarProcesso(id: number): void {
    this.carregandoDetalhe.set(true);
    this.processosService
      .obter(id)
      .pipe(finalize(() => this.carregandoDetalhe.set(false)))
      .subscribe({
        next: (detalhe) => {
          this.processoSelecionado.set(detalhe);
          this.historicoEmEdicao.set(null);
          this.historicoForm.reset({ descricao: '' });
        },
        error: () => {
          this.exibirMensagem('Não foi possível carregar o processo selecionado.', 'erro');
        }
      });
  }

  excluirProcesso(id: number): void {
    if (!confirm('Deseja realmente excluir este processo?')) {
      return;
    }

    this.processosService.remover(id).subscribe({
      next: () => {
        this.exibirMensagem('Processo removido com sucesso.', 'sucesso');
        this.processoSelecionado.set(null);
        this.carregarProcessos(this.paginaAtual());
      },
      error: () => this.exibirMensagem('Não foi possível remover o processo.', 'erro')
    });
  }

  alterarStatus(processo: ProcessoResumo, status: StatusProcesso): void {
    if (processo.status === status) {
      return;
    }

    this.processosService.atualizarStatus(processo.id, status).subscribe({
      next: () => {
        this.exibirMensagem('Status atualizado com sucesso.', 'sucesso');
        const listaAtualizada = this.processos().map((item) =>
          item.id === processo.id ? { ...item, status } : item
        );
        this.processos.set(listaAtualizada);
        const detalhe = this.processoSelecionado();
        if (detalhe && detalhe.id === processo.id) {
          this.processoSelecionado.set({ ...detalhe, status });
        }
      },
      error: () => this.exibirMensagem('Não foi possível atualizar o status.', 'erro')
    });
  }

  mudarStatus(processo: ProcessoResumo, alvo: EventTarget | null): void {
    const select = alvo as HTMLSelectElement | null;
    if (!select) {
      return;
    }
    this.alterarStatus(processo, select.value as StatusProcesso);
  }

  badgeClasse(status: StatusProcesso): string {
    const item = this.statusOpcoes.find((s) => s.valor === status);
    return item ? `badge-status ${item.classe}` : 'badge-status';
  }

  mascararNumeroDisplay(valor: string): string {
    const apenasDigitos = this.limparNumero(valor);
    return this.aplicarMascaraCnj(apenasDigitos);
  }

  formatarNumeroProcesso(evento: Event): void {
    const input = evento.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const apenasDigitos = this.limparNumero(input.value).slice(0, 20);
    const mascarado = this.aplicarMascaraCnj(apenasDigitos);
    input.value = mascarado;
    this.processoForm.patchValue({ numeroProcesso: mascarado }, { emitEvent: false });
  }

  iniciarEdicaoHistorico(historico: Historico): void {
    this.historicoEmEdicao.set(historico);
    this.historicoForm.reset({ descricao: historico.descricao });
  }

  cancelarEdicaoHistorico(): void {
    this.historicoEmEdicao.set(null);
    this.historicoForm.reset({ descricao: '' });
  }

  salvarHistorico(): void {
    if (this.historicoForm.invalid || !this.processoSelecionado()) {
      this.historicoForm.markAllAsTouched();
      return;
    }

    const payload: SalvarHistoricoPayload = {
      descricao: this.historicoForm.value.descricao!
    };

    const processoAtual = this.processoSelecionado();
    if (!processoAtual) {
      return;
    }

    const historicoAtual = this.historicoEmEdicao();
    const requisicao = historicoAtual
      ? this.processosService.atualizarHistorico(historicoAtual.id, payload)
      : this.processosService.criarHistorico(processoAtual.id, payload);

    requisicao.subscribe({
      next: (historico) => {
        const detalhe = this.processoSelecionado();
        if (!detalhe) {
          return;
        }
        let historicos: Historico[];
        if (historicoAtual) {
          historicos = detalhe.historicos.map((item) => (item.id === historico.id ? historico : item));
        } else {
          historicos = [historico, ...detalhe.historicos];
        }
        this.processoSelecionado.set({ ...detalhe, historicos });
        this.historicoEmEdicao.set(null);
        this.historicoForm.reset({ descricao: '' });
        this.exibirMensagem('Histórico salvo com sucesso.', 'sucesso');
      },
      error: () => this.exibirMensagem('Não foi possível salvar o histórico.', 'erro')
    });
  }

  removerHistorico(historico: Historico): void {
    if (!this.processoSelecionado()) {
      return;
    }

    if (!confirm('Remover este histórico?')) {
      return;
    }

    this.processosService.removerHistorico(historico.id).subscribe({
      next: () => {
        const detalhe = this.processoSelecionado();
        if (!detalhe) {
          return;
        }
        const historicos = detalhe.historicos.filter((item) => item.id !== historico.id);
        this.processoSelecionado.set({ ...detalhe, historicos });
        this.exibirMensagem('Histórico removido.', 'sucesso');
      },
      error: () => this.exibirMensagem('Não foi possível remover o histórico.', 'erro')
    });
  }

  paginaAnterior(): void {
    if (this.paginaAtual() > 1) {
      this.carregarProcessos(this.paginaAtual() - 1);
    }
  }

  proximaPagina(): void {
    const totalPaginas = Math.ceil(this.totalRegistros() / this.tamanhoPagina());
    if (this.paginaAtual() < totalPaginas) {
      this.carregarProcessos(this.paginaAtual() + 1);
    }
  }

  private exibirMensagem(mensagem: string, tipo: 'sucesso' | 'erro'): void {
    this.mensagemSistema.set(mensagem);
    this.tipoMensagem.set(tipo);
    setTimeout(() => {
      this.mensagemSistema.set(null);
      this.tipoMensagem.set(null);
    }, 4000);
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

    let resultado = partes[0];
    if (partes[1]) resultado += '-' + partes[1];
    if (partes[2]) resultado += '.' + partes[2];
    if (partes[3]) resultado += '.' + partes[3];
    if (partes[4]) resultado += '.' + partes[4];
    if (partes[5]) resultado += '.' + partes[5];

    return resultado;
  }

  private limparNumero(valor: string): string {
    return valor.replace(/\D/g, '');
  }
}
