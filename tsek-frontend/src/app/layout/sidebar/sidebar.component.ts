import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
  animations: [
    trigger('modalFadeAnim', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('modalScaleAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95) translateY(10px)' }),
        animate('350ms cubic-bezier(0.175, 0.885, 0.32, 1.1)', style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'scale(0.95) translateY(10px)' }))
      ])
    ])
  ]
})
export class SidebarComponent {
  @Input() open = false;
  @Output() navClick = new EventEmitter<void>();
  @Output() logoutRequested = new EventEmitter<void>();

  authService = inject(AuthService);
  router = inject(Router);

  get user() {
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          name: payload.name || 'Instructor',
          role: 'Instructor',
          institution: payload.email?.split('@')[1] || ''
        };
      } catch { /* fallback */ }
    }
    return { name: 'Instructor', role: 'Instructor', institution: '' };
  }

  get userInitial(): string {
    const name = this.user.name;
    // Remove common prefixes case-insensitively
    const cleanName = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.)\s+/i, '');
    return cleanName.charAt(0).toUpperCase();
  }

  navItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Generate Exam', icon: 'edit_note', route: '/generate-exam' },
    { label: 'Classes', icon: 'school', route: '/classes' },
    { label: 'History', icon: 'history', route: '/history' }
  ];

  logout() {
    this.logoutRequested.emit();
  }
}
