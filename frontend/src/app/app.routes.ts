import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { ProcessosComponent } from './features/processos/processos.component';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'processos', component: ProcessosComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];
