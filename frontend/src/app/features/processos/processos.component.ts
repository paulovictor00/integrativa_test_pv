import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ProcessosService } from '../../core/services/processos.service';
import {
  CnjInfo,
  ProcessoDetalhe,
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
      <div class="mb-4">
        <h2 class="fw-bold mb-1">Gestão de Processos</h2>
        <p class="text-secondary mb-0">Acompanhe, atualize e mantenha o histórico das movimentações com facilidade.</p>
      </div>

      <div *ngIf="mensagemSistema()" class="alert" [ngClass]="{'alert-success': tipoMensagem() === 'sucesso', 'alert-danger': tipoMensagem() === 'erro'}">
        {{ mensagemSistema() }}
      </div>

      <div class="row justify-content-center">
        <div class="col-12 col-xl-8">
          <div class="card p-4 form-card">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="fw-semibold mb-0">{{ tituloFormulario() }}</h5>
              <button type="button" class="btn btn-sm btn-light" (click)="limparFormulario()">Limpar</button>
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
                  (blur)="buscarInformacoesCnj()"
                />
                <div class="invalid-feedback">Informe um número válido.</div>
              </div>
              <div class="col-md-6">
                <label class="form-label">Tribunal identificado</label>
                <input class="form-control" formControlName="tribunal" placeholder="Ex: TJRN" readonly />
              </div>
              <div class="col-md-6">
                <label class="form-label">Estado</label>
                <input class="form-control" formControlName="estado" placeholder="UF" readonly />
              </div>
              <div class="col-12 text-secondary small" *ngIf="consultandoCnj()">
                Consultando tribunal pelo CNJ...
              </div>
              <div class="col-12 text-secondary small" *ngIf="cnjInfo()">
                {{ cnjInfo()!.nome }} · {{ cnjInfo()!.segmento }}
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
              <div class="col-12 d-flex justify-content-end">
                <button type="submit" class="btn btn-primary btn-rounded px-4">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .card {
      border-radius: 1.25rem;
    }

    .btn-group .btn {
      border-radius: 999px;
    }

    .alert {
      border-radius: 1rem;
      border: none;
    }

    .form-card {
      position: sticky;
      top: 1.5rem;
    }
  `]
})
export class ProcessosComponent {
  carregandoDetalhe = signal(false);
  processoSelecionado = signal<ProcessoDetalhe | null>(null);
  mensagemSistema = signal<string | null>(null);
  tipoMensagem = signal<'sucesso' | 'erro' | null>(null);
  cnjInfo = signal<CnjInfo | null>(null);
  consultandoCnj = signal(false);
  private ultimoNumeroCnjConsultado: string | null = null;

  readonly statusOpcoes: { valor: StatusProcesso; rotulo: string; classe: string }[] = [
    { valor: 'EmAndamento', rotulo: 'Em andamento', classe: 'em-andamento' },
    { valor: 'Suspenso', rotulo: 'Suspenso', classe: 'suspenso' },
    { valor: 'Encerrado', rotulo: 'Encerrado', classe: 'encerrado' }
  ];

  processoForm = this.fb.group({
    id: [0],
    numeroProcesso: ['', [Validators.required, Validators.maxLength(100)]],
    tribunal: [''],
    estado: [''],
    autor: ['', [Validators.required, Validators.maxLength(200)]],
    reu: ['', [Validators.required, Validators.maxLength(200)]],
    dataAjuizamento: ['', [Validators.required]],
    status: ['EmAndamento' as StatusProcesso, [Validators.required]],
    descricao: ['']
  });

  tituloFormulario = computed(() => (this.processoForm.value.id ? 'Editar processo' : 'Cadastrar processo'));

  constructor(
    private readonly fb: FormBuilder,
    private readonly processosService: ProcessosService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.prepararNovoProcesso();
    this.route.queryParamMap.subscribe((params) => {
      const idParam = params.get('id');
      if (!idParam) {
        return;
      }
      const id = Number(idParam);
      if (!Number.isNaN(id) && id > 0) {
        this.selecionarProcesso(id, true);
      }
    });
  }

  prepararNovoProcesso(): void {
    this.processoForm.reset({
      id: 0,
      numeroProcesso: '',
      tribunal: '',
      estado: '',
      autor: '',
      reu: '',
      dataAjuizamento: new Date().toISOString().substring(0, 10),
      status: 'EmAndamento',
      descricao: ''
    });
    this.limparCamposCnj();
    this.cnjInfo.set(null);
    this.consultandoCnj.set(false);
    this.ultimoNumeroCnjConsultado = null;
    this.processoSelecionado.set(null);
  }

  limparFormulario(): void {
    this.prepararNovoProcesso();
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  private preencherFormulario(detalhe: ProcessoDetalhe): void {
    const numeroMascarado = this.mascararNumeroDisplay(detalhe.numeroProcesso);
    const data = (detalhe.dataAjuizamento ?? '').substring(0, 10);

    this.processoForm.setValue({
      id: detalhe.id,
      numeroProcesso: numeroMascarado,
      tribunal: detalhe.tribunal ?? '',
      estado: '',
      autor: detalhe.autor,
      reu: detalhe.reu,
      dataAjuizamento: data,
      status: detalhe.status,
      descricao: detalhe.descricao ?? ''
    });

    this.ultimoNumeroCnjConsultado = null;
    this.buscarInformacoesCnjPorNumero(this.limparNumero(detalhe.numeroProcesso), detalhe.tribunal ?? '');
  }

  salvarProcesso(): void {
    if (this.processoForm.invalid) {
      this.processoForm.markAllAsTouched();
      return;
    }

    const valor = this.processoForm.value;
    const idProcesso = Number(valor.id ?? 0);
    const anterior = idProcesso > 0 ? this.processoSelecionado() : null;
    const numeroLimpo = this.limparNumero(valor.numeroProcesso ?? '');
    const payload: SalvarProcessoPayload = {
      numeroProcesso: numeroLimpo,
      autor: valor.autor!,
      reu: valor.reu!,
      dataAjuizamento: valor.dataAjuizamento!,
      status: valor.status!,
      tribunal: valor.tribunal || null,
      descricao: valor.descricao || ''
    };

    const operacao = idProcesso > 0
      ? this.processosService.atualizar(idProcesso, payload)
      : this.processosService.criar(payload);

    operacao.subscribe({
      next: (processo) => {
        this.exibirMensagem('Processo salvo com sucesso!', 'sucesso');
        if (idProcesso > 0) {
          if (anterior) {
            this.registrarAuditoriaEdicao(anterior, payload);
          }
          const idAtual = Number(processo?.id ?? idProcesso);
          this.selecionarProcesso(idAtual || idProcesso);
        } else {
          this.registrarAuditoriaCriacao(Number(processo?.id ?? 0) || undefined, payload);
          this.limparFormulario();
        }
      },
      error: (erro) => {
        const mensagem = erro?.error?.erro || 'Não foi possível salvar o processo.';
        this.exibirMensagem(mensagem, 'erro');
      }
    });
  }

  selecionarProcesso(id: number, manterQuery: boolean = false): void {
    this.carregandoDetalhe.set(true);
    this.processosService
      .obter(id)
      .pipe(finalize(() => this.carregandoDetalhe.set(false)))
      .subscribe({
        next: (detalhe) => {
          this.processoSelecionado.set(detalhe);
          this.preencherFormulario(detalhe);
          if (!manterQuery) {
            this.router.navigate([], { queryParams: { id: detalhe.id }, replaceUrl: true });
          }
        },
        error: () => {
          this.exibirMensagem('Não foi possível carregar o processo selecionado.', 'erro');
          this.limparFormulario();
        }
      });
  }

  editarProcessoSelecionado(): void {
    const detalhe = this.processoSelecionado();
    if (!detalhe) {
      return;
    }
    this.preencherFormulario(detalhe);
    this.router.navigate([], { queryParams: { id: detalhe.id }, replaceUrl: true });
  }

  excluirProcessoAtual(): void {
    const detalhe = this.processoSelecionado();
    if (!detalhe) {
      return;
    }

    if (!confirm('Deseja realmente excluir este processo?')) {
      return;
    }

    this.processosService.remover(detalhe.id).subscribe({
      next: () => {
        this.exibirMensagem('Processo removido com sucesso.', 'sucesso');
        this.prepararNovoProcesso();
        this.processoSelecionado.set(null);
      },
      error: () => this.exibirMensagem('Não foi possível remover o processo.', 'erro')
    });
  }

  alterarStatusSelecionado(alvo: EventTarget | null): void {
    const detalhe = this.processoSelecionado();
    if (!detalhe) {
      return;
    }

    const select = alvo as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    const status = select.value as StatusProcesso;
    if (detalhe.status === status) {
      return;
    }

    this.processosService.atualizarStatus(detalhe.id, status).subscribe({
      next: () => {
        this.exibirMensagem('Status atualizado com sucesso.', 'sucesso');
        this.processoSelecionado.set({ ...detalhe, status });
        if (this.processoForm.value.id === detalhe.id) {
          this.processoForm.patchValue({ status }, { emitEvent: false });
        }
      },
      error: () => this.exibirMensagem('Não foi possível atualizar o status.', 'erro')
    });
  }

  private registrarAuditoriaCriacao(id: number | undefined, payload: SalvarProcessoPayload): void {
    if (!id) return;
    const mensagem = `Criação (${new Date().toLocaleString('pt-BR')}): Autor '${this.formatarValorMensagem(payload.autor)}', Réu '${this.formatarValorMensagem(payload.reu)}', Data '${this.formatarDataMensagem(payload.dataAjuizamento)}', Status '${this.formatarStatusMensagem(payload.status)}'.`;
    this.registrarAuditoria(id, mensagem);
  }

  private registrarAuditoriaEdicao(anterior: ProcessoDetalhe, atual: SalvarProcessoPayload): void {
    const campos: Array<[string, string | null | undefined, string | null | undefined]> = [
      ['Número', anterior.numeroProcesso, atual.numeroProcesso],
      ['Autor', anterior.autor, atual.autor],
      ['Réu', anterior.reu, atual.reu],
      ['Tribunal', anterior.tribunal ?? '', atual.tribunal ?? ''],
      ['Data de ajuizamento', anterior.dataAjuizamento, atual.dataAjuizamento],
      ['Status', anterior.status, atual.status],
      ['Descrição', anterior.descricao ?? '', atual.descricao ?? '']
    ];

    const alteracoes = campos
      .filter(([campo, antes, depois]) => this.valorAlterado(campo, antes, depois))
      .map(([campo, antes, depois]) => `${campo}: '${this.formatarCampoParaMensagem(campo, antes)}' → '${this.formatarCampoParaMensagem(campo, depois)}'`);

    if (!alteracoes.length) {
      return;
    }

    const mensagem = `Atualização (${new Date().toLocaleString('pt-BR')}): ${alteracoes.join(' | ')}`;
    this.registrarAuditoria(anterior.id, mensagem);
  }

  private registrarAuditoria(id: number, descricao: string): void {
    const payload: SalvarHistoricoPayload = { descricao };
    this.processosService.criarHistorico(id, payload).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  badgeClasse(status: StatusProcesso): string {
    const item = this.statusOpcoes.find((s) => s.valor === status);
    return item ? `badge-status ${item.classe}` : 'badge-status';
  }

  mascararNumeroDisplay(valor: string | null | undefined): string {
    const apenasDigitos = this.limparNumero(valor);
    return this.aplicarMascaraCnj(apenasDigitos);
  }

  private normalizarValorComparacao(valor: string | null | undefined): string {
    return (valor ?? '').toString().trim();
  }

  private valorAlterado(campo: string, antes: string | null | undefined, depois: string | null | undefined): boolean {
    if (campo === 'Número') {
      return this.limparNumero(antes) !== this.limparNumero(depois);
    }
    return this.normalizarValorComparacao(antes) !== this.normalizarValorComparacao(depois);
  }

  private formatarValorMensagem(valor: string | null | undefined): string {
    const texto = this.normalizarValorComparacao(valor);
    if (!texto) return '—';
    if (texto.length > 120) return `${texto.slice(0, 117)}...`;
    return texto;
  }

  private formatarDataMensagem(valor: string | null | undefined): string {
    const texto = this.normalizarValorComparacao(valor);
    if (!texto) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      const [ano, mes, dia] = texto.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    return texto;
  }

  private formatarStatusMensagem(valor: string | null | undefined): string {
    const texto = this.normalizarValorComparacao(valor);
    if (!texto) return '—';
    const item = this.statusOpcoes.find((s) => s.valor === texto);
    return item?.rotulo ?? texto;
  }

  private formatarCampoParaMensagem(campo: string, valor: string | null | undefined): string {
    switch (campo) {
      case 'Data de ajuizamento':
        return this.formatarDataMensagem(valor);
      case 'Status':
        return this.formatarStatusMensagem(valor);
      case 'Número':
        return this.normalizarValorComparacao(valor)
          ? this.mascararNumeroDisplay(valor)
          : '—';
      default:
        return this.formatarValorMensagem(valor);
    }
  }

  buscarInformacoesCnj(): void {
    const numero = this.limparNumero(this.processoForm.value.numeroProcesso ?? '');
    if (!numero) {
      this.limparCamposCnj();
      return;
    }
    this.buscarInformacoesCnjPorNumero(numero);
  }

  private buscarInformacoesCnjPorNumero(numero: string, fallbackTribunal: string | null = null): void {
    if (numero.length !== 20) {
      this.limparCamposCnj(fallbackTribunal);
      return;
    }

    if (numero === this.ultimoNumeroCnjConsultado) {
      return;
    }

    this.consultandoCnj.set(true);
    this.processosService
      .obterInformacoesCnj(numero)
      .pipe(finalize(() => this.consultandoCnj.set(false)))
      .subscribe({
        next: (info) => {
          if (!info || info.sigla === 'DESCONHECIDO') {
            this.ultimoNumeroCnjConsultado = null;
            this.atualizarCamposCnj(null, fallbackTribunal);
            return;
          }
          this.ultimoNumeroCnjConsultado = numero;
          this.atualizarCamposCnj(info, fallbackTribunal);
        },
        error: () => {
          this.ultimoNumeroCnjConsultado = null;
          this.atualizarCamposCnj(null, fallbackTribunal);
        }
      });
  }

  private atualizarCamposCnj(info: CnjInfo | null, fallbackTribunal: string | null = null): void {
    this.cnjInfo.set(info);
    const tribunal = info?.sigla ?? fallbackTribunal ?? '';
    this.processoForm.patchValue(
      {
        tribunal,
        estado: info?.uf ?? ''
      },
      { emitEvent: false }
    );
  }

  private limparCamposCnj(fallbackTribunal: string | null = null): void {
    this.ultimoNumeroCnjConsultado = null;
    this.atualizarCamposCnj(null, fallbackTribunal);
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
    if (apenasDigitos.length === 20) {
      this.buscarInformacoesCnjPorNumero(apenasDigitos);
    } else if (this.cnjInfo() || this.ultimoNumeroCnjConsultado) {
      this.limparCamposCnj();
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

  private limparNumero(valor: string | null | undefined): string {
    if (!valor) {
      return '';
    }
    return valor.replace(/\D/g, '');
  }
}
