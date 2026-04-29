import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  user = { name: '', email: '', prefix: '' };

  // Password change
  passwords = { current: '', newPass: '', confirm: '' };
  passwordError: string | null = null;
  passwordSuccess = false;
  isChangingPassword = false;

  ngOnInit() {
    const token = this.auth.getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.user.name = payload.name || 'Instructor';
        this.user.email = payload.email || '';
      } catch {}
    }
  }

  changePassword() {
    this.passwordError = null;
    this.passwordSuccess = false;

    if (!this.passwords.current || !this.passwords.newPass || !this.passwords.confirm) {
      this.passwordError = 'All fields are required.';
      return;
    }
    if (this.passwords.newPass.length < 6) {
      this.passwordError = 'New password must be at least 6 characters.';
      return;
    }
    if (this.passwords.newPass !== this.passwords.confirm) {
      this.passwordError = 'New passwords do not match.';
      return;
    }

    this.isChangingPassword = true;
    this.http.post<any>('http://localhost:3000/api/change-password', {
      currentPassword: this.passwords.current,
      newPassword: this.passwords.newPass
    }).subscribe({
      next: () => {
        this.isChangingPassword = false;
        this.passwordSuccess = true;
        this.passwords = { current: '', newPass: '', confirm: '' };
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isChangingPassword = false;
        this.passwordError = err.error?.error || 'Failed to change password.';
        this.cdr.detectChanges();
      }
    });
  }
}
