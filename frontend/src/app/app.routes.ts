import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { ProcessosComponent } from './features/processos/processos.component';
import { ProcessosBuscaComponent } from './features/processos/busca-processos.component';
import { VisaoGeralComponent } from './features/dashboard/visao-geral.component';
import { MovimentacoesProcessoComponent } from './features/processos/movimentacoes-processo.component';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'processos', component: ProcessosComponent, canActivate: [authGuard] },
  { path: 'processos/:id/movimentacoes', component: MovimentacoesProcessoComponent, canActivate: [authGuard] },
  { path: 'processos/busca', component: ProcessosBuscaComponent, canActivate: [authGuard] },
  { path: 'painel', component: VisaoGeralComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];
