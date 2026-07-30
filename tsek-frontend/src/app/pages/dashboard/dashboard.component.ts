import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { ScanService } from '../../core/services/scan';
import { environment } from '../../../environments/environment';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

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
    this.isLoadingNotifications = false;

    // Fetch dashboard stats
    this.http.get<any>(`${environment.apiUrl}/api/dashboard/stats`).subscribe(data => {
      this.statCards = [
        { title: 'TOTAL SHEETS CHECKED', value: data.totalSheets.toString(), subtitle: 'You have scanned ' + data.totalSheets.toString() + ' sheets', icon: 'fact_check' },
        { title: 'STUDENT PERFORMANCE', value: data.accuracy, subtitle: 'Average grade is ' + data.accuracy, icon: 'verified' },
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

  ngAfterViewInit() {
    this.checkAndRunTour();
  }

  checkAndRunTour() {
    const hasSeenTour = localStorage.getItem('hasSeenDashboardTour');
    const tourState = localStorage.getItem('tourState');
    if (!hasSeenTour && (!tourState || tourState === 'dashboard')) {
      setTimeout(() => {
        const driverObj = driver({
          showProgress: true,
          steps: [
            {
              element: '.dashboard',
              popover: {
                title: 'Welcome to TSEK! 🎓',
                description: 'TSEK makes grading exams effortless using AI. Let\'s show you around!',
                side: "bottom",
                align: 'start'
              }
            },
            {
              element: '.classes-panel',
              popover: {
                title: 'Classes Quick-View 🏫',
                description: 'Keep track of your classes and see student enrollment counts at a glance.',
                side: "left",
                align: 'start'
              }
            },
            {
              element: '.recent-exams-card',
              popover: {
                title: 'Recent Exams & Progress 📊',
                description: 'See exams you have created and monitor their grading progress.',
                side: "top",
                align: 'start'
              }
            },
            {
              element: '.sidebar-btn.tsek-now-btn',
              popover: {
                title: 'TSEK NOW Scanner 📷',
                description: 'When you are ready to grade, upload student answer sheet photos here. The AI will do the grading instantly!',
                side: "left",
                align: 'center'
              }
            },
            {
              element: '.view-all-btn',
              popover: {
                title: 'Manage Classes ➡️',
                description: 'Next, let\'s look at how to manage students and class lists on the Classes page.',
                side: "bottom",
                align: 'center',
                doneBtnText: 'Go to Classes ➡️'
              }
            }
          ],
          onDestroyStarted: () => {
            if (!driverObj.hasNextStep()) {
              localStorage.setItem('tourState', 'classes');
              this.router.navigate(['/classes']);
              driverObj.destroy();
            } else {
              if (confirm("Are you sure you want to skip the tour?")) {
                localStorage.setItem('hasSeenDashboardTour', 'true');
                localStorage.removeItem('tourState');
                driverObj.destroy();
              }
            }
          }
        });
        driverObj.drive();
      }, 500); // Wait for animations
    }
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
