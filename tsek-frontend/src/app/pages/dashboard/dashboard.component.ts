import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

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

  statCards: StatCard[] = [];
  recentExams: RecentExam[] = [];
  classBlocks: ClassBlock[] = [];

  isLoadingStats = true;
  isLoadingExams = true;
  isLoadingClasses = true;

  ngOnInit() {
    // Fetch dashboard stats
    this.http.get<any>('http://localhost:3000/api/dashboard/stats').subscribe(data => {
      this.statCards = [
        { title: 'TOTAL SHEETS CHECKED', value: data.totalSheets.toString(), subtitle: 'Live Data', icon: 'fact_check' },
        { title: 'SYSTEM ACCURACY', value: data.accuracy, subtitle: '', icon: 'verified' },
        { title: 'ACTIVE EXAMS', value: data.activeExams.toString(), subtitle: 'Live Data', icon: 'assignment' },
        { title: 'CLASSES', value: data.classesCount.toString(), subtitle: 'Live Data', icon: 'school' }
      ];
      this.isLoadingStats = false;
      this.cdr.detectChanges();
    });

    // Fetch recent exams
    this.http.get<RecentExam[]>('http://localhost:3000/api/dashboard/recent-exams').subscribe(data => {
      this.recentExams = data;
      this.isLoadingExams = false;
      this.cdr.detectChanges();
    });

    // Fetch classes list for the right sidebar
    this.http.get<ClassBlock[]>('http://localhost:3000/api/dashboard/classes').subscribe(data => {
      this.classBlocks = data;
      this.isLoadingClasses = false;
      this.cdr.detectChanges();
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'status-completed';
      case 'IN PROGRESS': return 'status-progress';
      case 'PENDING': return 'status-pending';
      default: return '';
    }
  }
}
