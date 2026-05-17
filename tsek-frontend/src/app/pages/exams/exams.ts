import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { environment } from '../../../environments/environment';

interface ExamCard {
  id: number;
  subject: string;
  date: string;
  name: string;
  types: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface ExamStats {
  totalStudents: number;
  averageScore: number;
  totalItems: number;
  distribution: { well: number; good: number; needsImprovement: number };
  mostMissed: { item: string; count: number }[];
}

@Component({
  selector: 'app-exams',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './exams.html',
  styleUrl: './exams.css',
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
    ]),
    trigger('slideDownAnim', [
      transition(':enter', [
        style({ opacity: 0, height: '0', overflow: 'hidden', margin: '0', padding: '0' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, height: '*', margin: '*', padding: '*' }))
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', overflow: 'hidden' }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, height: '0', margin: '0', padding: '0' }))
      ])
    ])
  ]
})
export class Exams implements OnInit {
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);

  createdExams: ExamCard[] = [];
  isLoadingExams = true;
  
  // Statistics Modal
  showStatsModal = false;
  selectedExamStats: ExamStats | null = null;
  selectedExamName = '';
  selectedExamId: number | null = null;

  // Exam Format Modal
  showFormatModal = false;
  selectedExamFormat: { examTitle: string; totalItems: number; config: Array<{ label: string; key: string; enabled: boolean; selected: number; pointName: string; defaultPoints: number; }>; } | null = null;
  isLoadingFormat = false;
  
  // Answer Sheet Modal (full answer key preview)
  showAnswerSheetModal = false;
  selectedAnswerSheet: any = null;
  isLoadingAnswerSheet = false;
  
  // Delete Modal
  showDeleteModal = false;
  examToDelete: number | null = null;
  examNameToDelete: string = '';
  isDeletingExam = false;

  // Filter/Search
  searchTerm = '';
  sortBy: 'date' | 'subject' | 'status' = 'date';

  ngOnInit() {
    this.fetchExams();
  }

  fetchExams() {
    this.isLoadingExams = true;
    this.http.get<ExamCard[]>(`${environment.apiUrl}/api/exams`).subscribe({
      next: (data) => {
        this.createdExams = data;
        this.isLoadingExams = false;
        try {
          this.cdr.detectChanges();
        } catch (e) {
          // ignore - detectChanges may not be necessary in some environments
        }
      },
      error: () => {
        this.isLoadingExams = false;
        try {
          this.cdr.detectChanges();
        } catch (e) {}
      }
    });
  }

  get filteredExams(): ExamCard[] {
    let filtered = this.createdExams;

    // Search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(exam =>
        exam.name.toLowerCase().includes(term) ||
        exam.subject.toLowerCase().includes(term) ||
        exam.types.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'subject':
          return a.subject.localeCompare(b.subject);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return filtered;
  }

  deleteExam(id: number, name: string = 'this exam') {
    this.examToDelete = id;
    this.examNameToDelete = name;
    this.showDeleteModal = true;
  }

  confirmDelete() {
    if (this.examToDelete) {
      this.isDeletingExam = true;
      this.http.delete(`${environment.apiUrl}/api/exams/${this.examToDelete}`).subscribe({
        next: () => {
          this.fetchExams();
          this.isDeletingExam = false;
          this.closeDeleteModal();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isDeletingExam = false;
          console.error('Failed to delete exam', err);
          alert('Failed to delete exam. Please try again.');
          this.closeDeleteModal();
          this.cdr.detectChanges();
        }
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.examToDelete = null;
    this.examNameToDelete = '';
  }

  openStatsModal(exam: ExamCard): void {
    this.selectedExamId = exam.id;
    this.selectedExamName = exam.name;
    this.http.get<ExamStats>(`${environment.apiUrl}/api/exams/${exam.id}/statistics`).subscribe({
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

  openFormatModal(examId: number, examName: string): void {
    this.selectedExamId = examId;
    this.selectedExamName = examName;
    this.isLoadingFormat = true;
    this.selectedExamFormat = null;
    this.http.get<{ examTitle: string; totalItems: number; config: Array<{ label: string; key: string; enabled: boolean; selected: number; pointName: string; defaultPoints: number; }>; }>(`${environment.apiUrl}/api/exams/${examId}/format`).subscribe({
      next: (data) => {
        this.selectedExamFormat = data;
        this.showFormatModal = true;
        this.isLoadingFormat = false;
      },
      error: (err) => {
        this.isLoadingFormat = false;
        console.error('Failed to load exam format:', err);
        alert('Failed to load the exam format. Please try again.');
      }
    });
  }

  closeFormatModal(): void {
    this.showFormatModal = false;
    this.selectedExamFormat = null;
  }

  exportFormatPdf(): void {
    if (!this.selectedExamFormat) return;

    const title = `${this.selectedExamFormat.examTitle} Format`;
    const rows = this.selectedExamFormat.config
      .filter(section => section.enabled)
      .map(section => `
        <tr>
          <td>${section.label}</td>
          <td>${section.selected}</td>
          <td>${section.pointName}</td>
          <td>${section.defaultPoints}</td>
          <td>${section.selected * section.defaultPoints}</td>
        </tr>
      `)
      .join('');

    const body = `
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1a1a1a; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          p { margin: 4px 0 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f4f5f7; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Total Items: ${this.selectedExamFormat.totalItems}</p>
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>Item Count</th>
              <th>Item Type</th>
              <th>Points Each</th>
              <th>Total Points</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open a new window for PDF export. Please allow pop-ups and try again.');
      return;
    }

    printWindow.document.write(body);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  openAnswerSheetModal(examId: number, examName: string): void {
    this.selectedExamId = examId;
    this.selectedExamName = examName;
    this.isLoadingAnswerSheet = true;
    this.selectedAnswerSheet = null;
    this.http.get<any>(`${environment.apiUrl}/api/exams/${examId}/answersheet`).subscribe({
      next: (data) => {
        let currentGlobal = 1;
        const annotatedConfig = Array.isArray(data.config)
          ? data.config.map((section: any) => {
              const startItem = currentGlobal;
              currentGlobal += section.enabled ? section.selected : 0;
              return { ...section, startItem };
            })
          : [];

        this.selectedAnswerSheet = { ...data, config: annotatedConfig };
        this.showAnswerSheetModal = true;
        this.isLoadingAnswerSheet = false;
      },
      error: (err) => {
        this.isLoadingAnswerSheet = false;
        console.error('Failed to load answer sheet:', err);
        alert('Failed to load the answer sheet.');
      }
    });
  }

  closeAnswerSheetModal(): void {
    this.showAnswerSheetModal = false;
    this.selectedAnswerSheet = null;
  }

  editAsNewFromAnswerSheet(): void {
    if (!this.selectedAnswerSheet) return;
    const draft = {
      examTitle: this.selectedAnswerSheet.examTitle,
      totalItems: this.selectedAnswerSheet.totalItems,
      config: this.selectedAnswerSheet.config,
      answerKey: this.selectedAnswerSheet.answerKey
    };
    try {
      localStorage.setItem('importedExamDraft', JSON.stringify(draft));
      window.location.href = '/generate-exam';
    } catch (e) {
      console.error('Failed to save draft for import', e);
      alert('Failed to prepare exam for editing.');
    }
  }

  getSectionRange(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  getAnswerSheetItemAnswer(sectionKey: string, index: number): string {
    const answerKey = this.selectedAnswerSheet?.answerKey?.[sectionKey];
    if (!answerKey) {
      return '-';
    }

    const direct = answerKey[index];
    const fallback = answerKey[index - 1];
    const answer = direct ?? fallback;

    if (answer == null || (Array.isArray(answer) && answer.length === 0) || answer === '') {
      return '-';
    }

    return Array.isArray(answer) ? answer.join(', ') : String(answer);
  }

  getMostMissedLabel(item: { item: string | number; count: number }): string {
    const num = Number(item.item);
    const total = this.selectedExamStats?.totalItems ?? NaN;
    if (!Number.isNaN(num)) {
      if (num === 0 && !Number.isNaN(total) && total > 0) {
        return 'Item 1';
      }
      if (num >= 1 && num <= total) {
        return `Item ${num}`;
      }
      if (!Number.isNaN(total) && num >= 0 && num < total) {
        return `Item ${num + 1}`;
      }
      return `Item ${num + 1}`;
    }
    return String(item.item);
  }

  exportAnswerSheetPdf(): void {
    if (!this.selectedAnswerSheet) return;

    const title = `${this.selectedAnswerSheet.examTitle} — Answer Sheet`;

    // Build sections HTML
    const sectionsHtml = (this.selectedAnswerSheet.config || []).filter((s: any) => s.enabled).map((section: any) => {
      const rows: string[] = [];

      if (section.key === 'multipleChoice') {
        for (let i = 1; i <= section.selected; i++) {
          const val = this.selectedAnswerSheet.answerKey?.multipleChoice?.[i];
          let answerText = '-';
          if (Array.isArray(val)) answerText = val.join(', ');
          else if (val) answerText = String(val);
          const itemNumber = section.startItem ? section.startItem + i - 1 : i;
          rows.push(`<tr><td style="width:80px;padding:6px;border:1px solid #ddd;text-align:center">${itemNumber}</td><td style="padding:6px;border:1px solid #ddd">${answerText}</td></tr>`);
        }
      } else if (section.key === 'identification' || section.key === 'enumeration') {
        for (let i = 1; i <= section.selected; i++) {
          const val = this.selectedAnswerSheet.answerKey?.[section.key]?.[i] || '-';
          const itemNumber = section.startItem ? section.startItem + i - 1 : i;
          rows.push(`<tr><td style="width:80px;padding:6px;border:1px solid #ddd;text-align:center">${itemNumber}</td><td style="padding:6px;border:1px solid #ddd">${val}</td></tr>`);
        }
      } else if (section.key === 'trueOrFalse') {
        for (let i = 1; i <= section.selected; i++) {
          const val = this.selectedAnswerSheet.answerKey?.trueOrFalse?.[i] || '-';
          const itemNumber = section.startItem ? section.startItem + i - 1 : i;
          rows.push(`<tr><td style="width:80px;padding:6px;border:1px solid #ddd;text-align:center">${itemNumber}</td><td style="padding:6px;border:1px solid #ddd">${val}</td></tr>`);
        }
      }

      return `
        <div style="margin-bottom:18px">
          <h3 style="margin:6px 0 8px; font-size:16px">${section.label}</h3>
          <table style="width:100%; border-collapse:collapse; font-size:13px"> 
            <thead>
              <tr>
                <th style="width:80px;padding:8px;border:1px solid #ddd;background:#f5f5f5">Item</th>
                <th style="padding:8px;border:1px solid #ddd;background:#f5f5f5">Answer</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('\n');

    const body = `
      <html>
      <head>
        <title>${title}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body { font-family: Inter, Arial, sans-serif; color: #222; margin: 24px; }
          h1 { font-size: 20px; margin-bottom: 6px; }
          h3 { font-size: 15px; margin: 0 0 6px 0; }
          table { margin-top: 8px; }
          @media print { body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p style="margin:4px 0 12px">Total items: ${this.selectedAnswerSheet.totalItems}</p>
        ${sectionsHtml}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open a new window for export. Please allow pop-ups and try again.');
      return;
    }

    printWindow.document.write(body);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  getStatusColor(status: string): string {
    return status === 'ACTIVE' ? '#4a6741' : '#999';
  }
}
