import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
                <span class="badge bg-primary-subtle text-primary px-3 py-2 rounded-pill fw-semibold">Integrativa</span>
                <h1 class="mt-3 fw-bold">Acesse o painel</h1>
                <p class="text-secondary">Gerencie processos judiciais com uma experiência fluida e moderna.</p>
              </div>

              <form [formGroup]="formulario" (ngSubmit)="submeter()" novalidate>
                <div class="mb-4">
                  <label class="form-label fw-semibold text-secondary">Usuário</label>
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Informe seu usuário"
                    formControlName="usuario"
                    [class.is-invalid]="campoInvalido('usuario')"
                  />
                  <div *ngIf="campoInvalido('usuario')" class="invalid-feedback">Usuário é obrigatório.</div>
                </div>

                <div class="mb-4">
                  <label class="form-label fw-semibold text-secondary">Senha</label>
                  <input
                    type="password"
                    class="form-control"
                    placeholder="Digite a senha"
                    formControlName="senha"
                    [class.is-invalid]="campoInvalido('senha')"
                  />
                  <div *ngIf="campoInvalido('senha')" class="invalid-feedback">Senha é obrigatória.</div>
                </div>

                <div *ngIf="mensagemErro()" class="alert alert-danger rounded-4 border-0">{{ mensagemErro() }}</div>

                <button
                  class="btn btn-primary w-100 btn-rounded py-3 fw-semibold shadow-sm"
                  type="submit"
                  [disabled]="carregando()"
                >
                  <span *ngIf="!carregando(); else carregandoTpl">Entrar</span>
                </button>
                <ng-template #carregandoTpl>
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Validando dados...
                </ng-template>
              </form>
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
  `]
})
export class LoginComponent {
  carregando = signal(false);
  mensagemErro = signal('');

  formulario = this.fb.group({
    usuario: ['', [Validators.required]],
    senha: ['', [Validators.required, Validators.minLength(4)]]
  });

  constructor(private readonly fb: FormBuilder, private readonly authService: AuthService, private readonly router: Router) {}

  submeter(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.mensagemErro.set('');
    this.carregando.set(true);

    const credenciais = {
      usuario: this.formulario.value.usuario!,
      senha: this.formulario.value.senha!
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

  campoInvalido(nome: 'usuario' | 'senha'): boolean {
    const campo = this.formulario.get(nome);
    return !!campo && campo.invalid && (campo.dirty || campo.touched);
  }
}
