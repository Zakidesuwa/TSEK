import { Component, inject, ChangeDetectorRef, AfterViewInit } from '@angular/core';
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
export class Register implements AfterViewInit {
  step: 'REGISTER' | 'VERIFY_OTP' = 'REGISTER';

  fullName = '';
  prefix = 'Mr.';
  email = '';
  password = '';
  confirmPassword = '';
  agreedToTermsAndPrivacy = false;

  otp = '';

  errorMessage = '';
  passwordError = '';
  successMessage = '';
  isLoading = false;
  isVerifyingOtp = false;
  isResendingOtp = false;
  showPassword = false;
  showConfirmPassword = false;

  resendCooldown = 0;
  resendTimer: any = null;

  showTermsModal = false;
  showPrivacyModal = false;

  http = inject(HttpClient);
  authService = inject(AuthService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  ngAfterViewInit() {
    this.renderRecaptcha();
  }

  renderRecaptcha() {
    // Wait until grecaptcha is available
    const interval = setInterval(() => {
      if ((window as any).grecaptcha && (window as any).grecaptcha.render) {
        clearInterval(interval);
        try {
          const container = document.getElementById('recaptcha-container');
          if (container) {
            // Clear container before rendering (to prevent duplicate render errors)
            container.innerHTML = '';
            (window as any).grecaptcha.render('recaptcha-container', {
              'sitekey': '6Ldnl2wtAAAAAB8IopLpFDV6p3hZguggzr-rhNHD'
            });
          }
        } catch (e) {
          console.log('reCAPTCHA already rendered or failed to render:', e);
        }
      }
    }, 100);
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
    this.passwordError = '';
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.fullName || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Please fill out all required fields.';
      return;
    }

    if (!this.agreedToTermsAndPrivacy) {
      this.errorMessage = 'You must agree to the Terms of Service and Privacy Policy to create an account.';
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

    if (this.password.length < 8) {
      this.passwordError = 'Password must be at least 8 characters long.';
      return;
    }

    if (!/[A-Z]/.test(this.password) || !/[a-z]/.test(this.password) || !/\d/.test(this.password)) {
      this.passwordError = 'Password must contain at least one uppercase letter, one lowercase letter, and one number.';
      return;
    }

    const captchaToken = (window as any).grecaptcha?.getResponse();
    if (!captchaToken) {
      this.errorMessage = 'Please verify that you are not a robot.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.http.post<{ message: string; email: string }>(`${environment.apiUrl}/api/register`, {
      prefix: this.prefix,
      full_name: this.fullName.trim(),
      email: this.email.trim(),
      password: this.password,
      recaptcha_token: captchaToken
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.step = 'VERIFY_OTP';
        this.successMessage = res.message || 'Verification code sent to your email.';
        this.startResendTimer();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error || 'Registration failed. Please try again.';
        try {
          (window as any).grecaptcha?.reset();
        } catch (e) {}
        this.cdr.detectChanges();
      }
    });
  }

  verifyOtp() {
    if (!this.otp || this.otp.trim().length !== 6) {
      this.errorMessage = 'Please enter the 6-digit verification code.';
      return;
    }

    this.isVerifyingOtp = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.http.post<{ message: string }>(`${environment.apiUrl}/api/verify-otp`, {
      email: this.email.trim(),
      otp: this.otp.trim()
    }).subscribe({
      next: (res) => {
        this.isVerifyingOtp = false;
        this.successMessage = res.message || 'Email verified and account created!';
        
        // Reset onboarding tour flags for the new account
        localStorage.removeItem('hasSeenDashboardTour');
        localStorage.removeItem('hasSeenClassesTour');
        localStorage.removeItem('hasSeenGenerateTour');
        localStorage.removeItem('tourState');
        
        this.cdr.detectChanges();
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        this.isVerifyingOtp = false;
        this.errorMessage = err.error?.error || 'Verification failed. Please check the code and try again.';
        this.cdr.detectChanges();
      }
    });
  }

  resendOtp() {
    if (this.resendCooldown > 0 || this.isResendingOtp) return;

    this.isResendingOtp = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.http.post<{ message: string }>(`${environment.apiUrl}/api/resend-otp`, {
      email: this.email.trim()
    }).subscribe({
      next: (res) => {
        this.isResendingOtp = false;
        this.successMessage = res.message || 'A new verification code has been sent.';
        this.startResendTimer();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isResendingOtp = false;
        this.errorMessage = err.error?.error || 'Failed to resend verification code.';
        this.cdr.detectChanges();
      }
    });
  }

  startResendTimer() {
    this.resendCooldown = 60;
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendTimer);
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  backToRegister() {
    this.step = 'REGISTER';
    this.otp = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();
    this.renderRecaptcha();
  }
}