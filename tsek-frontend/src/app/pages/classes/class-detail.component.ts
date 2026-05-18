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
  imports: [CommonModule, FormsModule, RouterLink],
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
  exams: Array<{ id: number; exam_title: string }> = [];
  examNames: string[] = [];
  students: StudentRow[] = [];
  activeTab: 'list' | 'exams' | 'summary' = 'summary';
  postContent = '';
  isLoading = true;
  errorMessage = '';
  showScanModal = false;
  selectedScanUrl: string | null = null;

  // Statistics Modal
  showStatsModal = false;
  selectedExamStats: any = null;
  selectedExamName = '';
  selectedExamId: number | null = null;
  selectedExamClassInfo = '';

  // Exam Format Modal
  showFormatModal = false;
  selectedExamFormat: any = null;
  isLoadingFormat = false;
  
  // Answer Sheet Modal
  showAnswerSheetModal = false;
  selectedAnswerSheet: any = null;
  isLoadingAnswerSheet = false;

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
          this.cdr.detectChanges();
          return;
        }
        this.loadClassDetails();
      },
      error: (err) => {
        console.error('Failed to fetch class list', err);
        this.errorMessage = 'Unable to load class information.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadClassDetails(): void {
    this.isLoading = true;
    this.http.get<{ exams: Array<{ id: number; exam_title: string }>; students: StudentRow[] }>(`${environment.apiUrl}/api/classes/${this.classId}/students`).subscribe({
      next: (data) => {
        this.exams = data.exams || [];
        this.examNames = (data.exams || []).map(e => e.exam_title);
        this.students = data.students;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load class detail', err);
        this.errorMessage = 'Unable to load class details.';
        this.isLoading = false;
        this.cdr.detectChanges();
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

  exportToExcel(): void {
    if (!this.students || this.students.length === 0) return;

    // Header row
    const headers = ['Student Name', 'Student ID', ...this.examNames];
    
    // Data rows
    // Data rows
    const rows = this.students.map(student => {
      const rowData = [
        student.name,
        // Wrap Student ID in an Excel text formula to force text formatting and prevent scientific notation conversion
        `="${student.number}"`,
        ...student.scores.map(s => s.value)
      ];
      // Escape commas and double quotes in fields
      return rowData.map((val, idx) => {
        if (idx === 1) return val; // Skip escaping for the formatted Excel ID formula
        const strVal = val ? val.toString() : '';
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
    });

    const csvContent = '\ufeff' + [headers, ...rows].map(e => e.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const classNameClean = this.classInfo?.subject ? this.classInfo.subject.replace(/[^a-zA-Z0-9]/g, '_') : 'Class';
    const sectionNameClean = this.classInfo?.section ? this.classInfo.section.replace(/[^a-zA-Z0-9]/g, '_') : 'Section';
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${classNameClean}_${sectionNameClean}_Scores.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  openStatsModal(examId: number, examName: string): void {
    this.selectedExamId = examId;
    this.selectedExamName = examName;
    this.selectedExamClassInfo = this.classInfo?.subject ? `${this.classInfo.subject} (${this.classInfo.section || ''})` : '';
    this.http.get<any>(`${environment.apiUrl}/api/exams/${examId}/statistics`).subscribe({
      next: (data) => {
        this.selectedExamStats = data;
        this.showStatsModal = true;
        this.cdr.detectChanges();
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
    this.selectedExamClassInfo = '';
  }

  openFormatModal(examId: number, examName: string): void {
    this.selectedExamId = examId;
    this.selectedExamName = examName;
    this.isLoadingFormat = true;
    this.selectedExamFormat = null;
    this.http.get<any>(`${environment.apiUrl}/api/exams/${examId}/format`).subscribe({
      next: (data) => {
        this.selectedExamFormat = data;
        this.showFormatModal = true;
        this.isLoadingFormat = false;
        this.cdr.detectChanges();
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
      .filter((section: any) => section.enabled)
      .map((section: any) => `
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
        this.cdr.detectChanges();
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
      this.router.navigate(['/generate-exam']);
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

  get tabItems() {
    return [
      { id: 'summary', label: 'Summary', icon: 'dashboard' },
      { id: 'exams', label: 'Exams', icon: 'assignment' },
      { id: 'list', label: 'Class List', icon: 'group' }
    ];
  }
}
