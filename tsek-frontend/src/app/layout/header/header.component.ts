import { Component, Output, EventEmitter, inject, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  animations: [
    trigger('dropdownAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }),
        animate('150ms cubic-bezier(0.175, 0.885, 0.32, 1.1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('100ms ease-in', style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }))
      ])
    ])
  ]
})
export class HeaderComponent {
  @Output() menuToggle = new EventEmitter<void>();
  currentDate: string;
  isDropdownOpen = false;

  authService = inject(AuthService);
  router = inject(Router);

  get user() {
    const token = this.authService.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          name: payload.name || 'Instructor',
          email: payload.email || ''
        };
      } catch { /* fallback */ }
    }
    return { name: 'Instructor', email: '' };
  }

  constructor() {
    this.currentDate = this.formatDate(new Date());
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click')
  closeDropdown() {
    this.isDropdownOpen = false;
  }

  private formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    const datePart = date.toLocaleDateString('en-US', options);
    const timePart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${datePart} | ${timePart}`;
  }
}
