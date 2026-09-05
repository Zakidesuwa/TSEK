import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { driver } from 'driver.js';

interface ClassCard {
  id: number;
  subject: string;
  section: string;
  students: number;
  nextQuiz: string;
}

interface StudentRow {
  name: string;
  number: string;
  scores: Array<{ value: string; imageUrl: string | null }>;
}

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './classes.component.html',
  styleUrl: './classes.component.css',
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
export class ClassesComponent implements OnInit {
  http = inject(HttpClient);
  router = inject(Router);

  constructor(private cdr: ChangeDetectorRef) {}

  // ===== Add Class Modal =====
  showAddClassModal = false;
  newClass = { name: '', course: '', size: null as number | null };

  // ===== Delete Class Confirmation Modal =====
  showDeleteClassModal = false;
  classToDelete: any = null;
  isDeletingClass = false;

  // ===== Remove Student Confirmation Modal =====
  showRemoveStudentModal = false;
  studentToRemove: { name: string, number: string } | null = null;

  // ===== Scanned Image Modal =====
  showScanModal = false;
  selectedScanUrl: string | null = null;

  viewScan(url: string) {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      this.selectedScanUrl = url;
      this.showScanModal = true;
      this.cdr.detectChanges();
      return;
    }

    let fetchUrl = url;
    if (url.startsWith('/')) {
      fetchUrl = `${environment.apiUrl}${url}`;
    } else if (url.startsWith('http://tsek-backend.onrender.com') || url.startsWith('http://tsek.onrender.com')) {
      fetchUrl = url.replace('http://', 'https://');
    }

    // Fetch securely to include auth headers
    this.http.get(fetchUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.selectedScanUrl = URL.createObjectURL(blob);
        this.showScanModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load scanned image:', err);
        alert('Failed to load the scanned image.');
      }
    });
  }

  closeScanModal() {
    this.showScanModal = false;
    if (this.selectedScanUrl && this.selectedScanUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.selectedScanUrl);
    }
    this.selectedScanUrl = null;
    this.cdr.detectChanges();
  }

  isLoadingClasses = true;
  isRemovingStudent = false;

  classes: any[] = [];
  searchQuery = '';

  get filteredClasses() {
    if (!this.searchQuery?.trim()) {
      return this.classes;
    }
    const query = this.searchQuery.trim().toLowerCase();
    return this.classes.filter(c =>
      c.subject.toLowerCase().includes(query) ||
      c.section.toLowerCase().includes(query)
    );
  }

  ngOnInit() {
    this.isLoadingClasses = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/classes`).subscribe({
      next: (data) => {
        this.classes = data;
        this.isLoadingClasses = false;
        this.cdr.detectChanges();
        // Run tour check once classes are loaded and rendered
        setTimeout(() => this.checkAndRunTour(), 300);
      },
      error: () => {
        this.isLoadingClasses = false;
        this.cdr.detectChanges();
      }
    });
  }

  checkAndRunTour() {
    const tourState = localStorage.getItem('tourState');
    if (tourState === 'classes') {
      const driverObj = driver({
        showProgress: true,
        steps: [
          {
            element: '.classes-page',
            popover: {
              title: 'Your Classes 🏫',
              description: 'This is where all your classes are listed. You can click on any class card to view its student roster and exam scores.',
              side: "bottom",
              align: 'start'
            }
          },
          {
            element: '.classes-search-wrapper',
            popover: {
              title: 'Quick Search 🔍',
              description: 'Quickly filter your classes by subject name or section code here.',
              side: "bottom",
              align: 'start'
            }
          },
          {
            element: '.add-class-btn',
            popover: {
              title: 'Create a Class ➕',
              description: 'Click this button to add a new class section. You can enroll students manually or they will be enrolled automatically when you scan their first exam sheet.',
              side: "top",
              align: 'center'
            }
          },
          {
            element: 'a[routerLink="/generate-exam"]', // Target the sidebar link or custom navigation
            popover: {
              title: 'Generate Answer Sheets 📝',
              description: 'Let\'s go to the Answer Sheet Generator next to see how to create custom printable OMR sheets!',
              side: "right",
              align: 'center',
              doneBtnText: 'Go to Generator ➡️'
            }
          }
        ],
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep()) {
            localStorage.setItem('tourState', 'generate');
            this.router.navigate(['/generate-exam']);
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
    }
  }


  // ===== Add Class Modal Methods =====
  openAddClassModal(): void {
    this.newClass = { name: '', course: '', size: null };
    this.showAddClassModal = true;
  }

  closeAddClassModal(): void {
    this.showAddClassModal = false;
  }

  addClass(): void {
    if (this.newClass.name && this.newClass.course) {
      this.http.post<any>(`${environment.apiUrl}/api/classes`, {
        class_name: this.newClass.course,
        section_code: this.newClass.name
      }).subscribe({
        next: (res) => {
          this.classes.push({
            id: res.id,
            subject: res.subject,
            section: res.section,
            students: 0,
            nextQuiz: 'TBD'
          });
          this.closeAddClassModal();
          this.cdr.detectChanges();
          setTimeout(() => this.updateScrollState(), 100);
        },
        error: (err) => {
          console.error('Failed to add class:', err);
          alert('Failed to add class. Please try again.');
          this.cdr.detectChanges();
        }
      });
    }
  }

  // ===== Class Detail Route Navigation =====
  openClassDetail(cls: any): void {
    this.router.navigate(['/classes', cls.id], { state: { classInfo: cls } });
  }

  private updateScrollState(): void {
    // Placeholder for future logic if the class list layout requires scroll state updates.
  }

  // ===== Delete Class Methods =====
  deleteClass(cls: any): void {
    this.classToDelete = cls;
    this.showDeleteClassModal = true;
  }

  confirmDeleteClass(): void {
    if (!this.classToDelete) return;

    this.isDeletingClass = true;
    this.http.delete(`${environment.apiUrl}/api/classes/${this.classToDelete.id}`).subscribe({
      next: () => {
        this.classes = this.classes.filter(c => c.id !== this.classToDelete.id);
        this.isDeletingClass = false;
        this.closeDeleteClassModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isDeletingClass = false;
        console.error('Failed to delete class:', err);
        alert('Failed to delete class. Please try again.');
        this.closeDeleteClassModal();
        this.cdr.detectChanges();
      }
    });
  }

  closeDeleteClassModal(): void {
    this.showDeleteClassModal = false;
    this.classToDelete = null;
  }
}
