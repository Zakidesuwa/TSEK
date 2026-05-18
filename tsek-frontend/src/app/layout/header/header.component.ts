import { Component, OnInit, Output, EventEmitter, inject, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
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
export class HeaderComponent implements OnInit {
  @Output() menuToggle = new EventEmitter<void>();
  @Output() logoutRequested = new EventEmitter<void>();
  currentDate: string;
  isDropdownOpen = false;
  isNotificationsOpen = false;
  notifications: any[] = [];
  isLoadingNotifications = true;

  authService = inject(AuthService);
  router = inject(Router);
  http = inject(HttpClient);

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

  ngOnInit() {
    this.fetchNotifications();
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    this.isNotificationsOpen = false;
  }

  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.isNotificationsOpen = !this.isNotificationsOpen;
    this.isDropdownOpen = false;
    if (this.isNotificationsOpen) {
      this.fetchNotifications();
    }
  }

  fetchNotifications() {
    this.isLoadingNotifications = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/dashboard/notifications`).subscribe({
      next: (data) => {
        this.notifications = data;
        this.isLoadingNotifications = false;
      },
      error: (err) => {
        console.error('Failed to load notifications', err);
        this.isLoadingNotifications = false;
      }
    });
  }

  dismissNotification(id: string, event: Event) {
    event.stopPropagation();
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  logout() {
    this.logoutRequested.emit();
    this.isDropdownOpen = false;
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.isDropdownOpen = false;
    this.isNotificationsOpen = false;
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
