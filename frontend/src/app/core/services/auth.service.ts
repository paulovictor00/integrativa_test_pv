import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

const API_URL = resolverApiBase();

function resolverApiBase(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5000';
  }

  const origin = window.location.origin;
  const porta = window.location.port;

  if (porta === '4200') {
    return 'http://localhost:5000';
  }

  return origin || 'http://localhost:5000';
}

export interface CredenciaisLogin {
  usuario: string;
  senha: string;
}

export interface CadastroUsuario {
  nome: string;
  usuario: string;
  senha: string;
}

export interface RespostaLogin {
  token: string;
  expiraEm: string;
  usuario: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly chaveToken = 'integrativa_token';
  private readonly chaveExpiracao = 'integrativa_token_expira';
  private readonly chaveUsuario = 'integrativa_usuario';

  private readonly autenticadoSubject = new BehaviorSubject<boolean>(this.possuiTokenValido());
  private readonly usuarioSubject = new BehaviorSubject<string | null>(this.obterUsuarioLocal());

  autenticado$ = this.autenticadoSubject.asObservable();
  usuario$ = this.usuarioSubject.asObservable();

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  login(credenciais: CredenciaisLogin): Observable<RespostaLogin> {
    const url = `${API_URL}/api/auth/login`;
    return this.http.post<RespostaLogin>(url, credenciais).pipe(
      tap((resposta) => {
        this.guardarSessao(resposta);
        this.autenticadoSubject.next(true);
        this.usuarioSubject.next(resposta.usuario);
      })
    );
  }

  registrar(dados: CadastroUsuario): Observable<{ resultado: string }> {
    const url = `${API_URL}/api/auth/register`;
    return this.http.post<{ resultado: string }>(url, dados);
  }

  sair(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.chaveToken);
      localStorage.removeItem(this.chaveExpiracao);
      localStorage.removeItem(this.chaveUsuario);
    }
    this.autenticadoSubject.next(false);
    this.usuarioSubject.next(null);
    this.router.navigate(['/login']);
  }

  obterToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const token = localStorage.getItem(this.chaveToken);
    const expira = localStorage.getItem(this.chaveExpiracao);
    if (!token || !expira) {
      return null;
    }
    const expiraData = new Date(expira);
    if (Number.isNaN(expiraData.getTime()) || expiraData < new Date()) {
      this.sair();
      return null;
    }
    return token;
  }

  estaAutenticado(): boolean {
    return this.possuiTokenValido();
  }

  private guardarSessao(resposta: RespostaLogin): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.chaveToken, resposta.token);
    localStorage.setItem(this.chaveExpiracao, resposta.expiraEm);
    localStorage.setItem(this.chaveUsuario, resposta.usuario);
  }

  private obterUsuarioLocal(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.chaveUsuario);
  }

  private possuiTokenValido(): boolean {
    return this.obterToken() !== null;
  }
}
