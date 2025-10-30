import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProcessosService } from '../../core/services/processos.service';
import { Movimentacao, ProcessoDetalhe } from '../../shared/models/api-models';

@Component({
  selector: 'app-movimentacoes-processo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="container py-5" *ngIf="carregandoProcesso(); else processContent">
      <div class="card p-5 text-center">
        <div class="spinner-border text-primary mb-3" role="status"></div>
        Carregando processo...
      </div>
    </div>

    <ng-template #processContent>
      <div class="container py-5" *ngIf="processo(); else processoNaoEncontrado">
      <div class="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3 mb-4">
        <div>
          <h2 class="fw-bold mb-1">Movimentações do Processo</h2>
          <p class="text-secondary mb-0">Gerencie os andamentos e mantenha o histórico atualizado.</p>
        </div>
        <div class="text-lg-end">
          <div class="fw-semibold text-primary text-uppercase small">#{{ processo()!.id }}</div>
          <div class="h5 fw-bold mb-0">{{ numeroProcessoMascarado() }}</div>
          <small class="text-secondary text-uppercase">{{ processo()!.status | titlecase }}</small>
        </div>
      </div>

      <div class="card processo-info mb-4">
        <div class="card-body row g-3">
          <div class="col-md-3 col-sm-6">
            <div class="label text-secondary">Autor</div>
            <div class="fw-semibold">{{ processo()!.autor || '—' }}</div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="label text-secondary">Réu</div>
            <div class="fw-semibold">{{ processo()!.reu || '—' }}</div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="label text-secondary">Data de ajuizamento</div>
            <div class="fw-semibold">
              {{ processo()!.dataAjuizamento | date:'dd/MM/yyyy' }}
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="label text-secondary">Tribunal</div>
            <div class="fw-semibold">{{ processo()!.tribunal || '—' }}</div>
          </div>
        </div>
      </div>

      <div *ngIf="mensagemSistema()" class="alert" [ngClass]="{'alert-success': tipoMensagem() === 'sucesso', 'alert-danger': tipoMensagem() === 'erro'}">
        {{ mensagemSistema() }}
      </div>

      <div class="row g-4">
        <div class="col-12 col-xl-4">
          <div class="card p-4 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-semibold mb-0">{{ movimentacaoEmEdicao() ? 'Editar movimentação' : 'Cadastrar movimentação' }}</h5>
              <button type="button" class="btn btn-sm btn-light" (click)="limparFormulario()" [disabled]="salvando()">
                Limpar
              </button>
            </div>

            <form [formGroup]="movimentacaoForm" (ngSubmit)="salvarMovimentacao()" class="d-flex flex-column gap-3">
              <div>
                <label class="form-label">Descrição</label>
                <textarea
                  rows="4"
                  class="form-control"
                  formControlName="descricao"
                  placeholder="Descreva o andamento do processo"
                  [class.is-invalid]="campoInvalido('descricao')"
                  [readonly]="salvando()"
                ></textarea>
                <div class="invalid-feedback">Informe a descrição da movimentação.</div>
              </div>

              <button type="submit" class="btn btn-primary btn-rounded w-100 py-3 fw-semibold" [disabled]="salvando()">
                <span *ngIf="!salvando(); else carregandoTpl">{{ movimentacaoEmEdicao() ? 'Atualizar movimentação' : 'Cadastrar movimentação' }}</span>
              </button>
            </form>
          </div>
        </div>

        <div class="col">
          <div class="card p-4 shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-semibold mb-0">Linha do tempo</h5>
              <a class="btn btn-light btn-rounded" [routerLink]="['/processos/busca']">Voltar para busca</a>
            </div>

            <div *ngIf="carregandoMovimentacoes(); else listaMovimentacoes" class="text-center py-5 text-secondary">
              <div class="spinner-border text-primary mb-3" role="status"></div>
              Carregando movimentações...
            </div>

            <ng-template #listaMovimentacoes>
              <ng-container *ngIf="movimentacoes().length; else vazioTpl">
                <div class="mov-card rounded-4 p-3 mb-3" *ngFor="let movimentacao of movimentacoes()">
                  <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                    <div>
                      <div class="fw-semibold">{{ movimentacao.descricao }}</div>
                      <small class="text-secondary d-block">
                        Incluído em {{ movimentacao.dataInclusao | date:'dd/MM/yyyy HH:mm' }}
                      </small>
                      <small class="text-secondary d-block" *ngIf="movimentacao.dataAlteracao">
                        Atualizado em {{ movimentacao.dataAlteracao | date:'dd/MM/yyyy HH:mm' }}
                      </small>
                    </div>
                    <div class="btn-group align-self-start">
                      <button type="button" class="btn btn-sm btn-outline-primary" (click)="editarMovimentacao(movimentacao)">Editar</button>
                      <button type="button" class="btn btn-sm btn-outline-danger" (click)="excluirMovimentacao(movimentacao)">Excluir</button>
                    </div>
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
            </ng-template>

            <ng-template #vazioTpl>
              <div class="text-center text-secondary py-5">
                Nenhuma movimentação registrada para este processo.
              </div>
            </ng-template>
          </div>
        </div>
      </div>
      </div>
    </ng-template>

    <ng-template #processoNaoEncontrado>
      <div class="container py-5">
        <div class="card p-5 text-center">
          <h2 class="fw-bold mb-3">Processo não encontrado</h2>
          <p class="text-secondary">Verifique se o processo ainda está disponível ou se foi removido.</p>
          <a class="btn btn-primary btn-rounded" [routerLink]="['/processos/busca']">Voltar para busca</a>
        </div>
      </div>
    </ng-template>

    <ng-template #carregandoTpl>
      <span class="spinner-border spinner-border-sm me-2" role="status"></span>
      Salvando...
    </ng-template>
  `,
  styles: [`
    .processo-info {
      border: none;
      border-radius: 1rem;
      box-shadow: 0 15px 40px rgba(15, 23, 42, 0.08);
    }

    .processo-info .label {
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 0.2rem;
    }

    .mov-card {
      background: linear-gradient(135deg, rgba(226, 232, 240, 0.4), rgba(255, 255, 255, 1));
      border: 1px solid rgba(148, 163, 184, 0.25);
    }

    .btn-group .btn {
      border-radius: 999px;
    }
  `]
})
export class MovimentacoesProcessoComponent implements OnInit {
  private readonly tamanhoPagina = 5;
  private processoId = 0;

  processo = signal<ProcessoDetalhe | null>(null);
  movimentacoes = signal<Movimentacao[]>([]);
  paginaAtual = signal(1);
  totalRegistros = signal(0);
  carregandoMovimentacoes = signal(false);
  carregandoProcesso = signal(false);
  mensagemSistema = signal<string | null>(null);
  tipoMensagem = signal<'sucesso' | 'erro' | null>(null);
  movimentacaoEmEdicao = signal<Movimentacao | null>(null);
  salvando = signal(false);

  totalPaginas = computed(() => {
    const total = this.totalRegistros();
    if (total === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / this.tamanhoPagina));
  });

  movimentacaoForm = this.fb.group({
    descricao: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly processosService: ProcessosService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      const id = Number(idParam);

      if (!idParam || Number.isNaN(id) || id <= 0) {
        this.exibirMensagem('Processo inválido.', 'erro');
        this.processo.set(null);
        return;
      }

      this.processoId = id;
      this.carregarProcesso(id);
      this.carregarMovimentacoes(id, 1);
    });
  }

  numeroProcessoMascarado(): string {
    const numero = this.processo()?.numeroProcesso || '';
    return this.aplicarMascaraCnj(this.limparNumero(numero));
  }

  carregarProcesso(id: number): void {
    this.carregandoProcesso.set(true);
    this.processosService
      .obter(id)
      .pipe(finalize(() => this.carregandoProcesso.set(false)))
      .subscribe({
        next: (proc) => {
          this.processo.set(proc);
        },
        error: () => {
          this.exibirMensagem('Não foi possível carregar os dados do processo.', 'erro');
          this.processo.set(null);
        }
      });
  }

  carregarMovimentacoes(id: number, pagina: number, manterMensagem: boolean = false): void {
    this.carregandoMovimentacoes.set(true);
    if (!manterMensagem) {
      this.mensagemSistema.set(null);
      this.tipoMensagem.set(null);
    }

    this.processosService
      .listarMovimentacoes(id, pagina, this.tamanhoPagina)
      .pipe(finalize(() => this.carregandoMovimentacoes.set(false)))
      .subscribe({
        next: (resultado) => {
          this.movimentacoes.set(resultado.itens ?? []);
          this.totalRegistros.set(resultado.totalRegistros ?? 0);
          this.paginaAtual.set(resultado.pagina ?? pagina);
        },
        error: () => {
          this.exibirMensagem('Não foi possível carregar as movimentações.', 'erro');
          this.movimentacoes.set([]);
        }
      });
  }

  salvarMovimentacao(): void {
    if (this.movimentacaoForm.invalid) {
      this.movimentacaoForm.markAllAsTouched();
      return;
    }

    const descricao = (this.movimentacaoForm.value.descricao || '').trim();
    if (!descricao) {
      this.exibirMensagem('Descrição é obrigatória.', 'erro');
      return;
    }

    if (this.processoId <= 0) {
      this.exibirMensagem('Processo não identificado.', 'erro');
      return;
    }

    const emEdicao = this.movimentacaoEmEdicao();
    const paginaDestino = emEdicao ? this.paginaAtual() : 1;

    this.salvando.set(true);
    const requisicao = emEdicao
      ? this.processosService.atualizarMovimentacao(this.processoId, emEdicao.id, { descricao })
      : this.processosService.criarMovimentacao(this.processoId, { descricao });

    requisicao
      .pipe(finalize(() => this.salvando.set(false)))
      .subscribe({
        next: () => {
          const mensagem = emEdicao ? 'Movimentação atualizada com sucesso.' : 'Movimentação cadastrada com sucesso.';
          this.exibirMensagem(mensagem, 'sucesso');
          this.limparFormulario();
          this.carregarMovimentacoes(this.processoId, paginaDestino, true);
        },
        error: () => {
          this.exibirMensagem('Não foi possível salvar a movimentação.', 'erro');
        }
      });
  }

  editarMovimentacao(movimentacao: Movimentacao): void {
    if (!movimentacao) {
      return;
    }

    this.movimentacaoEmEdicao.set(movimentacao);
    this.movimentacaoForm.patchValue({ descricao: movimentacao.descricao }, { emitEvent: false });
  }

  excluirMovimentacao(movimentacao: Movimentacao): void {
    if (!movimentacao) {
      return;
    }

    if (!confirm('Deseja realmente excluir esta movimentação?')) {
      return;
    }

    this.processosService
      .removerMovimentacao(this.processoId, movimentacao.id)
      .subscribe({
        next: () => {
          this.exibirMensagem('Movimentação excluída com sucesso.', 'sucesso');
          const itensRestantes = this.movimentacoes().length;
          const paginaDestino = itensRestantes > 1 ? this.paginaAtual() : Math.max(1, this.paginaAtual() - 1);
          this.carregarMovimentacoes(this.processoId, paginaDestino, true);
          if (this.movimentacaoEmEdicao()?.id === movimentacao.id) {
            this.limparFormulario();
          }
        },
        error: () => {
          this.exibirMensagem('Não foi possível excluir a movimentação.', 'erro');
        }
      });
  }

  paginaAnterior(): void {
    if (this.paginaAtual() > 1) {
      this.carregarMovimentacoes(this.processoId, this.paginaAtual() - 1);
    }
  }

  proximaPagina(): void {
    if (this.paginaAtual() < this.totalPaginas()) {
      this.carregarMovimentacoes(this.processoId, this.paginaAtual() + 1);
    }
  }

  limparFormulario(): void {
    this.movimentacaoEmEdicao.set(null);
    this.movimentacaoForm.reset();
  }

  campoInvalido(nome: string): boolean {
    const campo = this.movimentacaoForm.get(nome);
    if (!campo) {
      return false;
    }
    return campo.invalid && (campo.dirty || campo.touched);
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
    return valor.replace(/\\D/g, '');
  }
}
