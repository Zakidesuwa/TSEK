import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  @Input() open = false;
  @Output() navClick = new EventEmitter<void>();

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

  navItems = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Generate Exam', icon: 'edit_note', route: '/generate-exam' },
    { label: 'Classes', icon: 'school', route: '/classes' },
    { label: 'History', icon: 'history', route: '/history' }
  ];

  logout() {
    this.authService.logout();
  }
}
