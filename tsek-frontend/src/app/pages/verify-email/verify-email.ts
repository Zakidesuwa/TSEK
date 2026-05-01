import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css'
})
export class VerifyEmailComponent implements OnInit {
  route = inject(ActivatedRoute);
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);

  status: 'LOADING' | 'SUCCESS' | 'ERROR' = 'LOADING';
  message = 'Verifying your email...';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (!token) {
        this.status = 'ERROR';
        this.message = 'Invalid or missing verification token.';
        this.cdr.detectChanges();
        return;
      }

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
    });
  }
}
