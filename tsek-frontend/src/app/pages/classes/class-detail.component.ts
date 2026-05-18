import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface StudentRow {
  name: string;
  number: string;
  scores: Array<{ value: string; imageUrl: string | null }>;
}

interface ClassInfo {
  id: number;
  subject: string;
  section: string;
  students: number;
  nextQuiz: string;
}

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './class-detail.component.html',
  styleUrl: './class-detail.component.css'
})
export class ClassDetailComponent implements OnInit {
  http = inject(HttpClient);
  route = inject(ActivatedRoute);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);

  classId = '';
  classInfo: ClassInfo | null = null;
  examNames: string[] = [];
  students: StudentRow[] = [];
  activeTab: 'list' | 'exams' | 'summary' = 'summary';
  postContent = '';
  isLoading = true;
  errorMessage = '';

  ngOnInit() {
    this.classId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.classId) {
      this.errorMessage = 'Invalid class selected.';
      this.isLoading = false;
      return;
    }

    const navigationState = window.history.state;
    if (navigationState && navigationState.classInfo && navigationState.classInfo.id?.toString() === this.classId) {
      this.classInfo = navigationState.classInfo as ClassInfo;
    }

    this.loadClassInfo();
  }

  private loadClassInfo(): void {
    if (this.classInfo) {
      this.loadClassDetails();
      return;
    }

    this.http.get<ClassInfo[]>(`${environment.apiUrl}/api/classes`).subscribe({
      next: (classes) => {
        this.classInfo = classes.find(c => c.id?.toString() === this.classId) || null;
        if (!this.classInfo) {
          this.errorMessage = 'Class not found.';
          this.isLoading = false;
          return;
        }
        this.loadClassDetails();
      },
      error: (err) => {
        console.error('Failed to fetch class list', err);
        this.errorMessage = 'Unable to load class information.';
        this.isLoading = false;
      }
    });
  }

  private loadClassDetails(): void {
    this.isLoading = true;
    this.http.get<{ exams: string[]; students: StudentRow[] }>(`${environment.apiUrl}/api/classes/${this.classId}/students`).subscribe({
      next: (data) => {
        this.examNames = data.exams;
        this.students = data.students;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load class detail', err);
        this.errorMessage = 'Unable to load class details.';
        this.isLoading = false;
      }
    });
  }

  setActiveTab(tab: 'list' | 'exams' | 'summary'): void {
    this.activeTab = tab;
  }

  onTabClick(tabId: any): void {
    const validTabs = ['list', 'exams', 'summary'];
    if (validTabs.includes(tabId)) {
      this.setActiveTab(tabId);
    }
  }

  createPost(): void {
    if (!this.postContent.trim()) {
      return;
    }
    this.postContent = '';
  }

  get tabItems() {
    return [
      { id: 'summary', label: 'Summary', icon: 'dashboard' },
      { id: 'exams', label: 'Exams', icon: 'assignment' },
      { id: 'list', label: 'Class List', icon: 'group' }
    ];
  }
}
