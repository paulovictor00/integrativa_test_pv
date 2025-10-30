import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-visao-geral',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-5">
      <div class="card border-0 shadow-sm rounded-4 p-5 text-center text-secondary">
        <h2 class="fw-bold text-primary mb-3">Visão Geral</h2>
        <p class="mb-4">
          Esta área está reservada para novos painéis e indicadores.
        </p>
        <span class="badge bg-light text-secondary px-3 py-2 rounded-pill">Em construção</span>
      </div>
    </div>
  `,
  styles: [`
    .card {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(59, 130, 246, 0.08));
    }
  `]
})
export class VisaoGeralComponent {}
