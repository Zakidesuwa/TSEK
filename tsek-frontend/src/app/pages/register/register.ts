import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
  animations: [
    trigger('slideDownAnim', [
      transition(':enter', [
        style({ opacity: 0, height: '0', overflow: 'hidden', margin: '0', padding: '0' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, height: '*', margin: '*', padding: '*' }))
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, height: '0', margin: '0', padding: '0' }))
      ])
    ]),
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
export class Register {
  fullName = '';
  prefix = 'Mr.';
  email = '';
  password = '';
  confirmPassword = '';
  agreedToTerms = false;

  errorMessage = '';
  successMessage = '';
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;

  showTermsModal = false;
  showPrivacyModal = false;

  http = inject(HttpClient);
  authService = inject(AuthService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  openTermsModal(event: Event) {
    event.preventDefault();
    this.showTermsModal = true;
  }

  closeTermsModal() {
    this.showTermsModal = false;
  }

  openPrivacyModal(event: Event) {
    event.preventDefault();
    this.showPrivacyModal = true;
  }

  closePrivacyModal() {
    this.showPrivacyModal = false;
  }

  register() {
    if (!this.fullName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill out all required fields.';
      return;
    }

    if (!this.agreedToTerms) {
      this.errorMessage = 'You must agree to the Terms of Service to create an account.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.edu(\.[a-z]{2})?$/i;
    if (!emailRegex.test(this.email)) {
      this.errorMessage = 'You must use a valid school email address (.edu or .edu.ph).';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.http.post<{ message: string }>(`${environment.apiUrl}/api/register`, {
      prefix: this.prefix,
      full_name: this.fullName.trim(),
      email: this.email,
      password: this.password
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res.message;
        // Navigate to login after successful registration
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error || 'Registration failed. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}