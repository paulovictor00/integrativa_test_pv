import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, CredenciaisLogin, CadastroUsuario } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-shell container px-4 py-5 min-vh-100 d-flex align-items-center justify-content-center">
      <div class="row w-100 justify-content-center">
        <div class="col-lg-5 col-md-8">
          <div class="card border-0 overflow-hidden">
            <div class="card-body p-5">
              <div class="text-center mb-4">
                <img src="assets/horizontal-complete-logo.webp" alt="Integrativa" class="logo mb-3" />
                <h1 class="mt-3 fw-bold">{{ modoCadastro() ? 'Crie sua conta' : 'Acesse o painel' }}</h1>
                <p class="text-secondary">
                  {{ modoCadastro() ? 'Preencha os dados para começar a usar a plataforma.' : 'Gerencie processos judiciais com uma experiência fluida e moderna.' }}
                </p>
              </div>

              <ng-container *ngIf="!modoCadastro(); else cadastroTpl">
                <form [formGroup]="formLogin" (ngSubmit)="submeter()" novalidate>
                  <div class="mb-4">
                    <label class="form-label fw-semibold text-secondary">Usuário</label>
                    <input
                      type="text"
                      class="form-control"
                      placeholder="Informe seu usuário"
                      formControlName="usuario"
                      [class.is-invalid]="campoInvalido(formLogin, 'usuario')"
                    />
                    <div *ngIf="campoInvalido(formLogin, 'usuario')" class="invalid-feedback">Usuário é obrigatório.</div>
                  </div>

                  <div class="mb-4">
                    <label class="form-label fw-semibold text-secondary">Senha</label>
                    <input
                      type="password"
                      class="form-control"
                      placeholder="Digite a senha"
                      formControlName="senha"
                      [class.is-invalid]="campoInvalido(formLogin, 'senha')"
                    />
                    <div *ngIf="campoInvalido(formLogin, 'senha')" class="invalid-feedback">Senha é obrigatória.</div>
                  </div>

                  <div *ngIf="mensagemSucesso()" class="alert alert-success rounded-4 border-0">{{ mensagemSucesso() }}</div>
                  <div *ngIf="mensagemErro()" class="alert alert-danger rounded-4 border-0">{{ mensagemErro() }}</div>

                  <button class="btn btn-primary w-100 btn-rounded py-3 fw-semibold shadow-sm" type="submit" [disabled]="carregando()">
                    <span *ngIf="!carregando(); else carregandoTpl">Entrar</span>
                  </button>
                </form>
              </ng-container>

              <ng-template #cadastroTpl>
                <form [formGroup]="formCadastro" (ngSubmit)="registrar()" novalidate>
                  <div class="mb-3">
                    <label class="form-label fw-semibold text-secondary">Nome completo</label>
                    <input
                      type="text"
                      class="form-control"
                      placeholder="Informe seu nome"
                      formControlName="nome"
                      [class.is-invalid]="campoInvalido(formCadastro, 'nome')"
                    />
                    <div *ngIf="campoInvalido(formCadastro, 'nome')" class="invalid-feedback">Nome é obrigatório.</div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-semibold text-secondary">Usuário</label>
                    <input
                      type="text"
                      class="form-control"
                      placeholder="Defina um usuário"
                      formControlName="usuario"
                      [class.is-invalid]="campoInvalido(formCadastro, 'usuario')"
                    />
                    <div *ngIf="campoInvalido(formCadastro, 'usuario')" class="invalid-feedback">Escolha um usuário.</div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-semibold text-secondary">Senha</label>
                    <input
                      type="password"
                      class="form-control"
                      placeholder="Crie uma senha"
                      formControlName="senha"
                      [class.is-invalid]="campoInvalido(formCadastro, 'senha')"
                    />
                    <div *ngIf="campoInvalido(formCadastro, 'senha')" class="invalid-feedback">Senha deve ter ao menos 4 caracteres.</div>
                  </div>
                  <div class="mb-4">
                    <label class="form-label fw-semibold text-secondary">Confirmar senha</label>
                    <input
                      type="password"
                      class="form-control"
                      placeholder="Repita a senha"
                      formControlName="confirmarSenha"
                      [class.is-invalid]="campoInvalido(formCadastro, 'confirmarSenha') || senhasNaoConferem()"
                    />
                    <div *ngIf="campoInvalido(formCadastro, 'confirmarSenha')" class="invalid-feedback">Confirme a senha.</div>
                    <div *ngIf="senhasNaoConferem()" class="invalid-feedback">As senhas não conferem.</div>
                  </div>

                  <div *ngIf="mensagemErro()" class="alert alert-danger rounded-4 border-0">{{ mensagemErro() }}</div>

                  <button class="btn btn-primary w-100 btn-rounded py-3 fw-semibold shadow-sm" type="submit" [disabled]="carregando()">
                    <span *ngIf="!carregando(); else carregandoTpl">Cadastrar</span>
                  </button>
                </form>
              </ng-template>

              <ng-template #carregandoTpl>
                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                Processando...
              </ng-template>

              <div class="text-center mt-4">
                <button type="button" class="btn btn-link toggle" (click)="alternarModo()" [disabled]="carregando()">
                  {{ modoCadastro() ? 'Já tenho uma conta' : 'Criar uma conta' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-shell .card {
      background: #ffffff;
      border-radius: 1.5rem;
      box-shadow: 0 25px 55px rgba(15, 23, 42, 0.15);
    }

    .login-shell .btn-primary {
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      border: none;
    }

    .login-shell .btn-primary:hover {
      background: linear-gradient(135deg, #4338ca, #4f46e5);
    }

    .login-shell .badge {
      background: rgba(99, 102, 241, 0.12) !important;
    }

    .logo {
      max-width: 220px;
      background: #0f172a;
      padding: 1rem 1.5rem;
      border-radius: 1.25rem;
    }

    .toggle {
      font-weight: 600;
      color: #4f46e5;
    }
  `]
})
export class LoginComponent {
  carregando = signal(false);
  mensagemErro = signal('');
  mensagemSucesso = signal('');
  modoCadastro = signal(false);

  formLogin = this.fb.group({
    usuario: ['', [Validators.required]],
    senha: ['', [Validators.required, Validators.minLength(4)]]
  });

  formCadastro = this.fb.group({
    nome: ['', [Validators.required]],
    usuario: ['', [Validators.required]],
    senha: ['', [Validators.required, Validators.minLength(4)]],
    confirmarSenha: ['', [Validators.required]]
  });

  constructor(private readonly fb: FormBuilder, private readonly authService: AuthService, private readonly router: Router) {}

  submeter(): void {
    if (this.formLogin.invalid) {
      this.formLogin.markAllAsTouched();
      return;
    }

    this.mensagemErro.set('');
    this.carregando.set(true);

    const credenciais: CredenciaisLogin = {
      usuario: this.formLogin.value.usuario!,
      senha: this.formLogin.value.senha!
    };

    this.authService.login(credenciais).subscribe({
      next: () => {
        this.carregando.set(false);
        this.router.navigate(['/processos']);
      },
      error: (erro) => {
        const mensagem = erro?.error?.erro || 'Não foi possível autenticar. Verifique os dados informados.';
        this.mensagemErro.set(mensagem);
        this.carregando.set(false);
      }
    });
  }

  registrar(): void {
    if (this.formCadastro.invalid || this.senhasNaoConferem()) {
      this.formCadastro.markAllAsTouched();
      this.mensagemErro.set(this.senhasNaoConferem() ? 'As senhas não conferem.' : 'Preencha os campos corretamente.');
      return;
    }

    this.mensagemErro.set('');
    this.carregando.set(true);

    const dados: CadastroUsuario = {
      nome: this.formCadastro.value.nome!,
      usuario: this.formCadastro.value.usuario!,
      senha: this.formCadastro.value.senha!
    };

    this.authService.registrar(dados).subscribe({
      next: (resposta) => {
        this.carregando.set(false);
        this.mensagemErro.set('');
        this.mensagemSucesso.set(resposta?.resultado || 'Conta criada com sucesso! Faça login.');
        this.formCadastro.reset();
        this.modoCadastro.set(false);
      },
      error: (erro) => {
        const mensagem = erro?.error?.erro || 'Não foi possível criar a conta.';
        this.mensagemErro.set(mensagem);
        this.carregando.set(false);
      }
    });
  }

  campoInvalido(form: FormGroup, nome: string): boolean {
    const campo = form.get(nome);
    return !!campo && campo.invalid && (campo.dirty || campo.touched);
  }

  senhasNaoConferem(): boolean {
    const senha = this.formCadastro.value.senha;
    const confirmar = this.formCadastro.value.confirmarSenha;
    return !!senha && !!confirmar && senha !== confirmar;
  }

  alternarModo(): void {
    this.modoCadastro.update((valor) => !valor);
    this.mensagemErro.set('');
    this.mensagemSucesso.set('');
    this.carregando.set(false);
    this.formLogin.reset();
    this.formCadastro.reset();
  }
}
