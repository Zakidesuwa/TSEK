import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { ScanService } from '../../core/services/scan';
import { environment } from '../../../environments/environment';

interface StatCard {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
}

interface RecentExam {
  name: string;
  subject: string;
  volume: number;
  status: 'COMPLETED' | 'IN PROGRESS' | 'PENDING';
  progress: number;
}

interface ClassBlock {
  block: string;
  students: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);
  scanService = inject(ScanService);

  statCards: StatCard[] = [];
  recentExams: RecentExam[] = [];
  classBlocks: ClassBlock[] = [];
  notifications: any[] = [];

  isLoadingStats = true;
  isLoadingExams = true;
  isLoadingClasses = true;
  isLoadingNotifications = true;

  ngOnInit() {
    // Fetch deadline notifications
    this.http.get<any[]>(`${environment.apiUrl}/api/dashboard/notifications`).subscribe({
      next: (data) => {
        this.notifications = data;
        this.isLoadingNotifications = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load notifications', err);
        this.isLoadingNotifications = false;
      }
    });

    // Fetch dashboard stats
    this.http.get<any>(`${environment.apiUrl}/api/dashboard/stats`).subscribe(data => {
      this.statCards = [
        { title: 'TOTAL SHEETS CHECKED', value: data.totalSheets.toString(), subtitle: 'You have scanned ' + data.totalSheets.toString() + ' sheets', icon: 'fact_check' },
        { title: 'STUDENT ACCURACY', value: data.accuracy, subtitle: 'Your students have a ' + data.accuracy + ' accuracy rate', icon: 'verified' },
        { title: 'ACTIVE EXAMS', value: data.activeExams.toString(), subtitle: 'You have ' + data.activeExams.toString() + ' active exams', icon: 'assignment' },
        { title: 'CLASSES', value: data.classesCount.toString(), subtitle: 'You have ' + data.classesCount.toString() + ' total classes', icon: 'school' }
      ];
      this.isLoadingStats = false;
      this.cdr.detectChanges();
    });

    // Fetch recent exams
    this.http.get<RecentExam[]>(`${environment.apiUrl}/api/dashboard/recent-exams`).subscribe(data => {
      this.recentExams = data.slice(0, 5);
      this.isLoadingExams = false;
      this.cdr.detectChanges();
    });

    // Fetch classes list for the right sidebar
    this.http.get<ClassBlock[]>(`${environment.apiUrl}/api/dashboard/classes`).subscribe(data => {
      this.classBlocks = data;
      this.isLoadingClasses = false;
      this.cdr.detectChanges();
    });
  }

  dismissNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.cdr.detectChanges();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'IN PROGRESS': return 'status-progress';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
  }

  getProgress(exam: RecentExam | any): number {
    if (!exam) return 0;
    let p = Number(exam.progress ?? 0);
    if (Number.isNaN(p)) p = 0;
    // If API returns 0..1 fractional progress, convert to percent
    if (p > 0 && p <= 1) p = p * 100;
    // Clamp to 0-100 and round
    p = Math.round(Math.max(0, Math.min(100, p)));
    return p;
  }

  onFileSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.scanService.setPendingFiles(files);
      this.router.navigate(['/scan-results']);
    }
  }
}
