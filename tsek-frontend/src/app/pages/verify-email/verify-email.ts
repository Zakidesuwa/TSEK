import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmailComponent implements OnInit {
  route = inject(ActivatedRoute);
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);

  email = '';
  otp = '';

  status: 'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR' = 'IDLE';
  message = '';
  isSubmitting = false;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (params['email']) {
        this.email = params['email'];
      }

      if (token) {
        this.status = 'LOADING';
        this.message = 'Verifying your email...';
        this.http.get<{message: string}>(`${environment.apiUrl}/api/verify-email?token=${token}`).subscribe({
          next: (res) => {
            this.status = 'SUCCESS';
            this.message = res.message || 'Email successfully verified!';
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.status = 'ERROR';
            this.message = err.error?.error || 'Verification failed. The token may be expired or invalid.';
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  verifyOtp() {
    if (!this.email || !this.otp) {
      this.status = 'ERROR';
      this.message = 'Please enter both your email address and 6-digit verification code.';
      return;
    }

    if (this.otp.trim().length !== 6) {
      this.status = 'ERROR';
      this.message = 'Verification code must be 6 digits.';
      return;
    }

    this.isSubmitting = true;
    this.status = 'LOADING';
    this.message = 'Verifying your code...';
    this.cdr.detectChanges();

    this.http.post<{message: string}>(`${environment.apiUrl}/api/verify-otp`, {
      email: this.email.trim(),
      otp: this.otp.trim()
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.status = 'SUCCESS';
        this.message = res.message || 'Email successfully verified and account created!';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.status = 'ERROR';
        this.message = err.error?.error || 'Verification failed. Please check your code and try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
