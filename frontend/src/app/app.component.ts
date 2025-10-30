import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell d-flex flex-column min-vh-100">
      <header *ngIf="autenticado() && !navegandoParaLogin()" class="shadow-sm bg-white">
        <div class="container py-3 d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-3">
            <img src="assets/horizontal-complete-logo.webp" alt="Integrativa" class="logo-header" />
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
        <ng-container *ngIf="exibirLayoutPrincipal(); else conteudoSimples">
          <div class="container-fluid py-4">
            <div class="row g-4">
              <div class="col-12 col-lg-3 col-xl-2">
                <aside class="sidebar rounded-4 shadow-sm p-4">
                  <div class="text-uppercase text-secondary small fw-semibold mb-3">Navegação</div>
                  <nav class="nav flex-column gap-2">
                    <a
                      routerLink="/processos"
                      routerLinkActive="active"
                      [routerLinkActiveOptions]="{ exact: true }"
                      class="nav-link"
                    >
                      Cadastrar processos
                    </a>
                    <a
                      routerLink="/processos/busca"
                      routerLinkActive="active"
                      class="nav-link"
                    >
                      Buscar processos
                    </a>
                    <a
                      routerLink="/painel"
                      routerLinkActive="active"
                      class="nav-link"
                    >
                      Visão geral
                    </a>
                  </nav>
                </aside>
              </div>
              <div class="col">
                <div class="conteudo">
                  <router-outlet></router-outlet>
                </div>
              </div>
            </div>
          </div>
        </ng-container>
        <ng-template #conteudoSimples>
          <router-outlet></router-outlet>
        </ng-template>
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

    .logo-header {
      height: 42px;
      background: #0f172a;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
    }

    .btn-outline-danger {
      border-radius: 999px;
      border-width: 2px;
    }

    .sidebar {
      background: rgba(255, 255, 255, 0.95);
    }

    .sidebar .nav-link {
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      color: #475569;
      font-weight: 500;
      transition: background 0.2s ease, color 0.2s ease;
    }

    .sidebar .nav-link:hover {
      background: rgba(99, 102, 241, 0.12);
      color: #4f46e5;
    }

    .sidebar .nav-link.active {
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      box-shadow: 0 15px 35px rgba(79, 70, 229, 0.25);
    }

    .conteudo {
      min-height: 100%;
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

  exibirLayoutPrincipal(): boolean {
    return this.autenticado() && !this.navegandoParaLogin();
  }
}
