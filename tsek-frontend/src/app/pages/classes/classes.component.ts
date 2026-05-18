import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
    this.selectedScanUrl = url;
    this.showScanModal = true;
    this.cdr.detectChanges();
  }

  closeScanModal() {
    this.showScanModal = false;
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
      },
      error: () => {
        this.isLoadingClasses = false;
      }
    });
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
          setTimeout(() => this.updateScrollState(), 100);
        },
        error: (err) => {
          console.error('Failed to add class:', err);
          alert('Failed to add class. Please try again.');
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
