import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
import { ScanService } from '../../core/services/scan';
import { environment } from '../../../environments/environment';
import { driver, Driver } from 'driver.js';
import { trigger, transition, style, animate } from '@angular/animations';

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
  styleUrl: './dashboard.component.css',
  animations: [
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
export class DashboardComponent implements OnInit, OnDestroy {
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);
  router = inject(Router);
  scanService = inject(ScanService);

  showScanSourceModal = false;
  showWebcamModal = false;
  videoStream: MediaStream | null = null;

  statCards: StatCard[] = [];
  recentExams: RecentExam[] = [];
  classBlocks: ClassBlock[] = [];
  notifications: any[] = [];

  isLoadingStats = true;
  isLoadingExams = true;
  isLoadingClasses = true;
  isLoadingNotifications = true;
  showTourSkipModal = false;
  private activeTour: Driver | null = null;
  private completingTour = false;
  private dashboardListsLoaded = 0;

  ngOnInit() {
    this.isLoadingNotifications = false;

    // Fetch dashboard stats
    this.http.get<any>(`${environment.apiUrl}/api/dashboard/stats`).subscribe(data => {
      const studentsChecked = (data.totalStudentsChecked ?? data.totalStudents ?? data.totalSheets ?? 0).toString();
      this.statCards = [
        { title: 'TOTAL STUDENTS CHECKED', value: studentsChecked, subtitle: 'You have checked ' + studentsChecked + ' students', icon: 'fact_check' },
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
      this.checkAndRunTourWhenReady();
    });

    // Fetch classes list for the right sidebar
    this.http.get<ClassBlock[]>(`${environment.apiUrl}/api/dashboard/classes`).subscribe(data => {
      this.classBlocks = data;
      this.isLoadingClasses = false;
      this.cdr.detectChanges();
      this.checkAndRunTourWhenReady();
    });
  }

  ngAfterViewInit() {
    // Wait for existing classes and exams before deciding whether onboarding is needed.
  }

  private checkAndRunTourWhenReady() {
    this.dashboardListsLoaded++;
    if (this.dashboardListsLoaded >= 2) {
      this.checkAndRunTour();
    }
  }

  checkAndRunTour() {
    if (this.classBlocks.length > 0 || this.recentExams.length > 0) {
      this.completeOnboarding();
      return;
    }
    const hasSeenTour = localStorage.getItem('hasSeenDashboardTour');
    const tourState = localStorage.getItem('tourState');
    if (!hasSeenTour && (!tourState || tourState === 'dashboard')) {
      setTimeout(() => {
        const driverObj = driver({
          showProgress: true,
          popoverClass: 'tsek-tour-popover',
          showButtons: ['previous', 'next', 'close'],
          onPopoverRender: (popover) => {
            popover.closeButton.textContent = 'Skip tutorial';
          },
          steps: [
            {
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
            if (this.completingTour) {
              driverObj.destroy();
              return;
            }
            if (!driverObj.hasNextStep()) {
              localStorage.setItem('tourState', 'classes');
              this.router.navigate(['/classes']);
              driverObj.destroy();
            } else {
              this.activeTour = driverObj;
              this.showTourSkipModal = true;
            }
          }
        });
        this.activeTour = driverObj;
        driverObj.drive();
      }, 500); // Wait for animations
    }
  }

  continueTour(): void {
    this.showTourSkipModal = false;
    this.activeTour?.drive();
  }

  skipTour(): void {
    this.completingTour = true;
    this.completeOnboarding();
    this.showTourSkipModal = false;
    this.activeTour?.setConfig({ onDestroyStarted: () => undefined });
    this.activeTour?.destroy();
    this.activeTour = null;
    this.completingTour = false;
  }

  private completeOnboarding() {
    localStorage.setItem('hasSeenDashboardTour', 'true');
    localStorage.removeItem('tourState');
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

  openScanSourceModal() {
    this.showScanSourceModal = true;
    this.cdr.detectChanges();
  }

  closeScanSourceModal() {
    this.showScanSourceModal = false;
    this.cdr.detectChanges();
  }

  isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
  }

  chooseCamera(cameraInput: HTMLInputElement) {
    this.closeScanSourceModal();
    if (this.isMobileDevice()) {
      cameraInput.click();
    } else {
      this.openWebcamModal();
    }
  }

  chooseGallery(galleryInput: HTMLInputElement) {
    this.closeScanSourceModal();
    galleryInput.click();
  }

  openWebcamModal() {
    this.showWebcamModal = true;
    this.cdr.detectChanges();
    setTimeout(async () => {
      try {
        const videoEl = document.getElementById('dashboard-webcam-video') as HTMLVideoElement;
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoEl && this.videoStream) {
          videoEl.srcObject = this.videoStream;
        }
      } catch (err) {
        console.error('Error accessing webcam on dashboard:', err);
        alert('Could not access camera. Please ensure camera permissions are granted or upload your file using Gallery.');
        this.closeWebcamModal();
      }
    }, 100);
  }

  closeWebcamModal() {
    this.showWebcamModal = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    this.cdr.detectChanges();
  }

  captureWebcamSnapshot() {
    const videoEl = document.getElementById('dashboard-webcam-video') as HTMLVideoElement;
    if (!videoEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `dashboard-scan-${Date.now()}.png`, { type: 'image/png' });
          this.scanService.setPendingFiles([file]);
          this.closeWebcamModal();
          this.router.navigate(['/scan-results']);
        }
      }, 'image/png');
    }
  }

  onFileSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      const validationError = this.scanService.validateFiles(files);
      if (validationError) {
        alert(validationError);
        event.target.value = '';
        return;
      }
      this.scanService.setPendingFiles(files);
      event.target.value = '';
      this.router.navigate(['/scan-results']);
    }
  }

  ngOnDestroy() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
  }
}
