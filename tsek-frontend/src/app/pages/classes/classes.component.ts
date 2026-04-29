import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface ClassCard {
  subject: string;
  section: string;
  students: number;
  nextQuiz: string;
}

interface ExamCard {
  id: number;
  subject: string;
  date: string;
  name: string;
  types: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface StudentRow {
  name: string;
  number: string;
  scores: string[];
}

interface ExamStats {
  totalStudents: number;
  averageScore: number;
  totalItems: number;
  distribution: { well: number; good: number; needsImprovement: number };
  mostMissed: { item: string; count: number }[];
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
export class ClassesComponent implements AfterViewInit, OnDestroy, OnInit {
  http = inject(HttpClient);
  route = inject(ActivatedRoute);
  @ViewChild('carouselTrack') carouselTrack!: ElementRef<HTMLDivElement>;

  canScrollLeft = false;
  canScrollRight = true;
  private scrollHandler = () => this.updateScrollState();

  constructor(private cdr: ChangeDetectorRef) {}

  // ===== Add Class Modal =====
  showAddClassModal = false;
  newClass = { name: '', course: '', size: null as number | null };

  // ===== Class Detail Modal =====
  showClassDetailModal = false;
  selectedClass: ClassCard | null = null;
  selectedClassExams: string[] = [];
  selectedClassStudents: StudentRow[] = [];
  currentPage = 1;
  totalPages = 1;
  private readonly studentsPerPage = 8;
  allStudents: StudentRow[] = [];

  // ===== Statistics Modal =====
  showStatsModal = false;
  selectedExamStats: ExamStats | null = null;
  selectedExamName = '';

  classes: any[] = [];
  createdExams: ExamCard[] = [];

  ngOnInit() {
    this.http.get<any[]>('http://localhost:3000/api/classes').subscribe(data => {
      this.classes = data;
      setTimeout(() => this.updateScrollState(), 100);
    });

    this.fetchExams();
  }

  fetchExams() {
    this.http.get<ExamCard[]>('http://localhost:3000/api/exams').subscribe(data => {
      this.createdExams = data;
      
      // Check if we need to open stats automatically from history page
      const openStatsId = this.route.snapshot.queryParams['openStats'];
      if (openStatsId) {
        const exam = this.createdExams.find(e => e.id === Number(openStatsId));
        if (exam) {
          this.openStatsModal(exam);
        }
      }
    });
  }

  deleteExam(id: number) {
    if (confirm('Are you sure you want to delete this exam?')) {
      this.http.delete(`http://localhost:3000/api/exams/${id}`).subscribe({
        next: () => {
          this.fetchExams();
        },
        error: (err) => {
          console.error('Failed to delete exam', err);
          alert('Failed to delete exam. Please try again.');
        }
      });
    }
  }

  // ===== Stats Modal Methods =====
  openStatsModal(exam: ExamCard): void {
    this.selectedExamName = exam.name;
    this.http.get<ExamStats>(`http://localhost:3000/api/exams/${exam.id}/statistics`).subscribe({
      next: (data) => {
        this.selectedExamStats = data;
        this.showStatsModal = true;
      },
      error: (err) => {
        console.error('Failed to load stats:', err);
        alert('Failed to load statistics for this exam.');
      }
    });
  }

  closeStatsModal(): void {
    this.showStatsModal = false;
    this.selectedExamStats = null;
  }

  ngAfterViewInit(): void {
    const track = this.carouselTrack.nativeElement;
    track.addEventListener('scroll', this.scrollHandler, { passive: true });
    // Initial check after rendering
    setTimeout(() => this.updateScrollState(), 0);
  }

  ngOnDestroy(): void {
    const track = this.carouselTrack?.nativeElement;
    track?.removeEventListener('scroll', this.scrollHandler);
  }

  updateScrollState(): void {
    const track = this.carouselTrack.nativeElement;
    this.canScrollLeft = track.scrollLeft > 2;
    this.canScrollRight = track.scrollLeft < track.scrollWidth - track.clientWidth - 2;
    this.cdr.detectChanges();
  }

  scrollCarousel(direction: 'left' | 'right'): void {
    const track = this.carouselTrack.nativeElement;
    const scrollAmount = 300;
    track.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
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
      this.http.post<any>('http://localhost:3000/api/classes', {
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
        }
      });
    }
  }

  // ===== Class Detail Modal Methods =====
  openClassDetail(cls: any): void {
    this.selectedClass = cls;
    
    this.http.get<{exams: string[], students: StudentRow[]}>(`http://localhost:3000/api/classes/${cls.id}/students`).subscribe(data => {
      this.allStudents = data.students;
      this.selectedClassExams = data.exams;
      this.currentPage = 1;
      this.totalPages = Math.max(1, Math.ceil(this.allStudents.length / this.studentsPerPage));
      this.updatePaginatedStudents();
      this.showClassDetailModal = true;
    });
  }

  closeClassDetailModal(): void {
    this.showClassDetailModal = false;
    this.selectedClass = null;
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedStudents();
    }
  }

  private updatePaginatedStudents(): void {
    const start = (this.currentPage - 1) * this.studentsPerPage;
    const end = start + this.studentsPerPage;
    this.selectedClassStudents = this.allStudents.slice(start, end);
  }

  // ===== Student Management =====
  showAddStudentForm = false;
  isAddingStudent = false;
  addStudentError: string | null = null;
  newStudent = { full_name: '', student_id_number: '' };

  toggleAddStudentForm(): void {
    this.showAddStudentForm = !this.showAddStudentForm;
    this.addStudentError = null;
    if (this.showAddStudentForm) {
      this.newStudent = { full_name: '', student_id_number: '' };
    }
  }

  addStudent(): void {
    if (!this.selectedClass || !this.newStudent.full_name || !this.newStudent.student_id_number) return;

    this.isAddingStudent = true;
    this.addStudentError = null;

    this.http.post<any>(`http://localhost:3000/api/classes/${(this.selectedClass as any).id}/students`, {
      full_name: this.newStudent.full_name,
      student_id_number: this.newStudent.student_id_number
    }).subscribe({
      next: (res) => {
        this.isAddingStudent = false;
        this.newStudent = { full_name: '', student_id_number: '' };
        this.showAddStudentForm = false;
        this.refreshClassStudents();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isAddingStudent = false;
        this.addStudentError = err.error?.error || 'Failed to add student.';
        this.cdr.detectChanges();
      }
    });
  }

  removeStudent(studentNumber: string): void {
    if (!this.selectedClass) return;
    if (!confirm('Remove this student from the class?')) return;

    this.http.delete(`http://localhost:3000/api/classes/${(this.selectedClass as any).id}/students/${studentNumber}`).subscribe({
      next: () => {
        this.refreshClassStudents();
      },
      error: (err) => {
        console.error('Failed to remove student:', err);
      }
    });
  }

  private refreshClassStudents(): void {
    if (!this.selectedClass) return;
    this.http.get<{exams: string[], students: StudentRow[]}>(`http://localhost:3000/api/classes/${(this.selectedClass as any).id}/students`).subscribe(data => {
      this.allStudents = data.students;
      this.selectedClassExams = data.exams;
      this.totalPages = Math.max(1, Math.ceil(this.allStudents.length / this.studentsPerPage));
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
      this.updatePaginatedStudents();
      // Update the student count on the class card
      (this.selectedClass as any).students = this.allStudents.length;
      this.cdr.detectChanges();
    });
  }
}
