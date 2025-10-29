import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="app-shell d-flex flex-column min-vh-100">
      <header *ngIf="autenticado() && !navegandoParaLogin()" class="shadow-sm bg-white">
        <div class="container py-3 d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-3">
            <div class="icone rounded-circle d-flex align-items-center justify-content-center">
              <span class="fw-bold text-primary">IN</span>
            </div>
            <div>
              <h1 class="h5 mb-0 fw-semibold">Integrativa</h1>
              <small class="text-secondary">Painel de Processos Judiciais</small>
            </div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <div class="text-end">
              <div class="fw-semibold text-primary text-uppercase small">{{ usuario() ?? 'Administrador' }}</div>
              <small class="text-secondary">Sessão ativa</small>
            </div>
            <button class="btn btn-outline-danger btn-rounded" (click)="sair()">Sair</button>
          </div>
        </div>
      </header>

      <main class="flex-grow-1">
        <router-outlet></router-outlet>
      </main>

      <footer class="bg-transparent text-center py-4 text-secondary" *ngIf="autenticado() && !navegandoParaLogin()">
        &copy; {{ anoAtual }} Integrativa • Construído com Angular e Bootstrap
      </footer>
    </div>
  `,
  styles: [`
    .app-shell {
      background: linear-gradient(180deg, rgba(226, 232, 240, 0.4) 0%, rgba(255, 255, 255, 0.9) 100%);
    }

    header .icone {
      width: 48px;
      height: 48px;
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
      font-size: 1.05rem;
      font-weight: 700;
    }

    .btn-outline-danger {
      border-radius: 999px;
      border-width: 2px;
    }
  `]
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly anoAtual = new Date().getFullYear();

  autenticado = toSignal(this.authService.autenticado$, {
    initialValue: this.authService.estaAutenticado()
  });

  usuario = toSignal(this.authService.usuario$, {
    initialValue: null
  });

  sair(): void {
    this.authService.sair();
  }

  navegandoParaLogin(): boolean {
    return (this.router.url ?? '').includes('login');
  }
}
