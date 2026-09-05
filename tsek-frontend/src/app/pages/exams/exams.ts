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
  sectionCode?: string;
  date: string;
  deadline?: string;
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
  selectedExamClassInfo = '';

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
    this.selectedExamClassInfo = exam.sectionCode ? exam.sectionCode : exam.subject;
    this.http.get<ExamStats>(`${environment.apiUrl}/api/exams/${exam.id}/statistics`).subscribe({
      next: (data) => {
        this.selectedExamStats = data;
        this.showStatsModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load stats:', err);
        alert('Failed to load statistics for this exam.');
        this.cdr.detectChanges();
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
    this.http.get<{ examTitle: string; totalItems: number; config: Array<{ label: string; key: string; enabled: boolean; selected: number; pointName: string; defaultPoints: number; numberOfChoices?: number; }>; }>(`${environment.apiUrl}/api/exams/${examId}/format`).subscribe({
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
        this.cdr.detectChanges();
      }
    });
  }

  closeFormatModal(): void {
    this.showFormatModal = false;
    this.selectedExamFormat = null;
  }

  getGridBlocks(count: number, type: 'mc' | 'id') {
    const itemsPerColumn = type === 'mc' ? 10 : 15;
    const columnsPerBlock = type === 'mc' ? 3 : 2;

    const blocks: number[][][] = [];
    let currentItem = 1;

    while (currentItem <= count) {
      const block: number[][] = [];
      for (let c = 0; c < columnsPerBlock; c++) {
        const column: number[] = [];
        for (let r = 0; r < itemsPerColumn; r++) {
          if (currentItem <= count) {
            column.push(currentItem);
            currentItem++;
          }
        }
        if (column.length > 0) block.push(column);
      }
      blocks.push(block);
    }
    return blocks;
  }

  exportFormatPdf(): void {
    if (!this.selectedExamFormat) return;

    const title = this.selectedExamFormat.examTitle || 'Untitled Exam';
    const totalPoints = this.selectedExamFormat.config.reduce((acc, curr) => curr.enabled ? acc + (curr.selected * curr.defaultPoints) : acc, 0);

    const mcSection = this.selectedExamFormat.config.find(s => s.key === 'multipleChoice');
    const idSection = this.selectedExamFormat.config.find(s => s.key === 'identification');
    const enumSection = this.selectedExamFormat.config.find(s => s.key === 'enumeration');
    const tfSection = this.selectedExamFormat.config.find(s => s.key === 'trueOrFalse');

    const mcBlocks = mcSection && mcSection.enabled ? this.getGridBlocks(mcSection.selected, 'mc') : [];
    const idBlocks = idSection && idSection.enabled ? this.getGridBlocks(idSection.selected, 'id') : [];
    const enumBlocks = enumSection && enumSection.enabled ? this.getGridBlocks(enumSection.selected, 'id') : [];
    const tfBlocks = tfSection && tfSection.enabled ? this.getGridBlocks(tfSection.selected, 'mc') : [];

    let bodyHtml = '';

    if (mcBlocks.length > 0) {
      bodyHtml += `<div class="print-section"><h2 class="print-section-title">PART I: MULTIPLE CHOICE</h2><div class="mc-blocks-container">`;
      mcBlocks.forEach(block => {
        bodyHtml += `<div class="mc-grid">`;
        block.forEach(col => {
          bodyHtml += `<div class="mc-column">`;
          col.forEach(item => {
            bodyHtml += `<div class="mc-item"><span class="item-num">${item}.</span><div class="bubbles">`;
            const numChoices = mcSection?.numberOfChoices || 4;
            const choiceLetters = ['A', 'B', 'C', 'D', 'E'].slice(0, numChoices);
            choiceLetters.forEach(letter => {
              bodyHtml += `<div class="bubble-group"><div class="print-bubble"></div><span class="bubble-label">${letter}</span></div>`;
            });
            bodyHtml += `</div></div>`;
          });
          bodyHtml += `</div>`;
        });
        bodyHtml += `</div>`;
      });
      bodyHtml += `</div></div>`;
    }

    if (idBlocks.length > 0) {
      bodyHtml += `<div class="print-section pt-4"><h2 class="print-section-title">PART II: IDENTIFICATION</h2><div class="id-blocks-container">`;
      idBlocks.forEach(block => {
        bodyHtml += `<div class="id-grid">`;
        block.forEach(col => {
          bodyHtml += `<div class="id-column">`;
          col.forEach(item => {
            bodyHtml += `<div class="id-item"><span class="item-num">${item}.</span><div class="id-box"></div></div>`;
          });
          bodyHtml += `</div>`;
        });
        bodyHtml += `</div>`;
      });
      bodyHtml += `</div></div>`;
    }

    if (enumBlocks.length > 0) {
      bodyHtml += `<div class="print-section pt-4"><h2 class="print-section-title">PART III: ENUMERATION</h2><div class="id-blocks-container">`;
      enumBlocks.forEach(block => {
        bodyHtml += `<div class="id-grid">`;
        block.forEach(col => {
          bodyHtml += `<div class="id-column">`;
          col.forEach(item => {
            bodyHtml += `<div class="id-item"><span class="item-num">${item}.</span><div class="id-box"></div></div>`;
          });
          bodyHtml += `</div>`;
        });
        bodyHtml += `</div>`;
      });
      bodyHtml += `</div></div>`;
    }

    if (tfBlocks.length > 0) {
      bodyHtml += `<div class="print-section pt-4"><h2 class="print-section-title">PART IV: TRUE OR FALSE</h2><div class="mc-blocks-container">`;
      tfBlocks.forEach(block => {
        bodyHtml += `<div class="mc-grid">`;
        block.forEach(col => {
          bodyHtml += `<div class="mc-column">`;
          col.forEach(item => {
            bodyHtml += `<div class="mc-item"><span class="item-num">${item}.</span><div class="bubbles">`;
            ['T','F'].forEach(letter => {
              bodyHtml += `<div class="bubble-group"><div class="print-bubble"></div><span class="bubble-label">${letter}</span></div>`;
            });
            bodyHtml += `</div></div>`;
          });
          bodyHtml += `</div>`;
        });
        bodyHtml += `</div>`;
      });
      bodyHtml += `</div></div>`;
    }

    const htmlContent = `
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 10mm; color: #000; }
          .print-header { margin-bottom: 20px; }
          .print-title { font-size: 20pt; font-weight: bold; margin-bottom: 15px; margin-top: 0; margin-left: 35px; }
          .student-info-grid { display: flex; justify-content: space-between; gap: 20px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 15px 0; margin-bottom: 20px; }
          .info-left { flex: 1.5; display: flex; flex-direction: column; gap: 15px; }
          .info-field { display: flex; flex-direction: column; gap: 4px; }
          .info-field label { font-size: 8pt; font-weight: bold; color: #333; }
          .info-box { height: 28px; border: 1px solid #333; background: transparent; }
          .student-id-section { flex: 1.2; display: flex; flex-direction: column; }
          .id-boxes-row { display: flex; gap: 4px; margin-top: 6px; }
          .digit-box { width: 22px; height: 28px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; font-family: monospace; }
          .print-score-box { width: 80px; border: 2px dashed #333; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; background: #fff; min-height: 90px; margin-left: 15px; }
          .print-section { margin-top: 5mm; }
          .pt-4 { padding-top: 15px; }
          .print-section-title { font-size: 9pt; color: #666; border-bottom: 1.5px solid #333; padding-bottom: 4px; margin-bottom: 15px; margin-left: 5px; text-transform: uppercase; break-after: avoid; }
          .mc-blocks-container, .id-blocks-container { display: block; }
          .mc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; break-inside: avoid; margin-bottom: 30px; }
          .mc-item { display: flex; align-items: center; margin-bottom: 14px; break-inside: avoid; }
          .item-num { width: 25px; font-size: 10pt; font-weight: bold; text-align: right; margin-right: 12px; }
          .bubbles { display: flex; gap: 8px; }
          .bubble-group { display: flex; justify-content: center; align-items: center; position: relative; width: 18px; height: 18px; }
          .print-bubble { position: absolute; top: 0; left: 0; width: 18px; height: 18px; border: 2px solid black; border-radius: 50%; box-sizing: border-box; }
          .bubble-label { position: relative; font-size: 8pt; font-weight: bold; color: #333; z-index: 1; }
          .id-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px 40px; break-inside: avoid; margin-bottom: 30px; }
          .id-item { display: flex; align-items: center; margin-bottom: 4px; break-inside: avoid; }
          .id-box { flex: 1; height: 25px; border: 1px solid #555; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1 class="print-title">${title}</h1>
          <div class="student-info-grid">
            <div class="info-left">
              <div class="info-field"><label>FULL NAME (LN, FN, MI.)</label><div class="info-box"></div></div>
              <div class="info-field"><label>GRADE LEVEL, SECTION & STRAND</label><div class="info-box"></div></div>
              <div class="info-field"><label>DATE</label><div class="info-box"></div></div>
            </div>
            <div class="student-id-section">
              <div class="info-field" style="height: 100%; display: flex; flex-direction: column;">
                <label>LEARNER REFERENCE NUMBER (LRN)</label>
                <div class="id-boxes-row">
                  ${Array(12).fill(0).map(() => '<div class="digit-box"></div>').join('')}
                </div>
              </div>
            </div>
            <div class="print-score-box">
              <span style="font-size: 8pt; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 8px;">SCORE</span>
              <div style="font-size: 16pt; font-weight: 800; color: #ccc; border-top: 1px solid #ddd; width: 100%; text-align: center; padding-top: 6px; margin-top: auto;">/ ${totalPoints}</div>
            </div>
          </div>
          ${bodyHtml}
      </body>
      </html>
    `;

    this.printViaIframe(htmlContent);
  }

  printViaIframe(htmlContent: string) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      alert('Unable to generate PDF. Please try again.');
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Slight delay to allow CSS rendering before calling print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Cleanup iframe after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
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
        this.cdr.detectChanges();
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

    this.printViaIframe(body);
  }

  getStatusColor(status: string): string {
    return status === 'ACTIVE' ? '#4a6741' : '#999';
  }
}
