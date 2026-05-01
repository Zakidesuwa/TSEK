import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ScanService } from '../../core/services/scan';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-scan-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan-results.html',
  styleUrl: './scan-results.css',
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
export class ScanResults implements OnInit {
  scanService = inject(ScanService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  http = inject(HttpClient);

  isLoading = true;
  isGrading = false;
  error: string | null = null;
  rawText: any = null;
  imagePreviewUrl: string | null = null;

  exams: any[] = [];
  selectedExamId: number | null = null;
  gradeResult: any = null;

  // Enrollment Prompt State
  showEnrollmentPrompt = false;
  isEnrolling = false;
  tempEnrollData: any = null;

  // SVG ring constants
  readonly circumference = 2 * Math.PI * 52; // r=52

  ngOnInit() {
    this.fetchExams();
    const file = this.scanService.getPendingFile();

    if (!file) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.imagePreviewUrl = URL.createObjectURL(file);

    this.scanService.scanImage(file).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.rawText = response.rawText || { error: 'No data returned' };
        this.scanService.clearPendingFile();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        const backendMessage = err.error?.error || err.error?.message || 'Failed to process image.';
        this.error = `Backend Error: ${backendMessage}`;
        console.error('Scan Error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  fetchExams() {
    this.http.get<any[]>(`${environment.apiUrl}/api/exams`).subscribe({
      next: (data) => {
        this.exams = data;
        if (this.exams.length > 0) {
          this.selectedExamId = this.exams[0].id;
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load exams', err)
    });
  }

  processBubbles() {
    if (!this.selectedExamId || !this.rawText?.answers) return;

    this.isGrading = true;
    this.error = null;
    const payload = {
      exam_id: this.selectedExamId,
      studentId: this.rawText.studentId,
      answers: this.rawText.answers
    };

    this.http.post(`${environment.apiUrl}/api/scan/grade`, payload).subscribe({
      next: (res: any) => {
        this.isGrading = false;
        this.gradeResult = res;

        if (!res.isEnrolled) {
          this.tempEnrollData = {
            classId: res.classId,
            studentId: this.rawText.studentId,
            studentName: this.rawText.studentName || 'Unknown Student'
          };
          this.showEnrollmentPrompt = true;
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isGrading = false;
        const backendMessage = err.error?.message || 'Failed to grade exam.';
        this.error = `Grading Error: ${backendMessage}`;
        this.cdr.detectChanges();
      }
    });
  }

  enrollStudent() {
    if (!this.tempEnrollData) return;

    this.isEnrolling = true;
    const payload = {
      full_name: this.tempEnrollData.studentName,
      student_id_number: this.tempEnrollData.studentId
    };

    this.http.post(`${environment.apiUrl}/api/classes/${this.tempEnrollData.classId}/students`, payload).subscribe({
      next: () => {
        this.isEnrolling = false;
        this.showEnrollmentPrompt = false;
        // Re-run grading now that they are enrolled
        this.processBubbles();
      },
      error: (err) => {
        this.isEnrolling = false;
        alert('Failed to enroll student: ' + (err.error?.error || 'Unknown error'));
        this.cdr.detectChanges();
      }
    });
  }

  cancelEnrollment() {
    this.showEnrollmentPrompt = false;
    this.tempEnrollData = null;
  }

  onNewFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.scanService.setPendingFile(file);
      // Reset state and re-run the pipeline
      this.gradeResult = null;
      this.error = null;
      this.rawText = null;
      this.isLoading = true;
      this.overrides.clear();
      this.overrideSaved = false;

      // Update image preview
      if (this.imagePreviewUrl) {
        URL.revokeObjectURL(this.imagePreviewUrl);
      }
      this.imagePreviewUrl = URL.createObjectURL(file);

      // Start scanning the new file
      this.scanService.scanImage(file).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.rawText = response.rawText || { error: 'No data returned' };
          this.scanService.clearPendingFile();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoading = false;
          const backendMessage = err.error?.error || err.error?.message || 'Failed to process image.';
          this.error = `Backend Error: ${backendMessage}`;
          this.cdr.detectChanges();
        }
      });

      // Reset the input so the same file can be re-selected
      event.target.value = '';
    }
  }
  // --- Computed properties ---

  get answersCount(): number {
    if (!this.rawText?.answers) return 0;
    return Object.keys(this.rawText.answers).length;
  }

  get sortedDetails(): { key: number; value: any }[] {
    if (!this.gradeResult?.details) return [];
    return Object.entries(this.gradeResult.details)
      .map(([key, value]) => ({ key: parseInt(key, 10), value }))
      .sort((a, b) => a.key - b.key);
  }

  // --- Override system ---
  overrides: Set<number> = new Set();
  isSavingOverrides = false;
  overrideSaved = false;

  isOverridden(itemKey: number): boolean {
    return this.overrides.has(itemKey);
  }

  isEffectivelyCorrect(item: { key: number; value: any }): boolean {
    return item.value.isCorrect || this.overrides.has(item.key);
  }

  overrideItem(itemKey: number) {
    this.overrides.add(itemKey);
    this.overrideSaved = false;
    this.cdr.detectChanges();
  }

  undoOverride(itemKey: number) {
    this.overrides.delete(itemKey);
    this.overrideSaved = false;
    this.cdr.detectChanges();
  }

  get hasOverrides(): boolean {
    return this.overrides.size > 0;
  }

  get adjustedScore(): number {
    if (!this.gradeResult) return 0;
    let bonus = 0;
    for (const item of this.sortedDetails) {
      if (!item.value.isCorrect && this.overrides.has(item.key)) {
        bonus += item.value.maxPoints || 1;
      }
    }
    return this.gradeResult.score + bonus;
  }

  get correctCount(): number {
    return this.sortedDetails.filter(d => this.isEffectivelyCorrect(d)).length;
  }

  get incorrectCount(): number {
    return this.sortedDetails.filter(d => !this.isEffectivelyCorrect(d)).length;
  }

  get maxScore(): number {
    return this.gradeResult?.totalPossible || 0;
  }

  get scorePercent(): number {
    const max = this.maxScore;
    if (max === 0) return 0;
    return Math.round((this.adjustedScore / max) * 100);
  }

  get scoreOffset(): number {
    const pct = this.scorePercent / 100;
    return this.circumference * (1 - pct);
  }

  saveOverrides() {
    if (!this.gradeResult || !this.hasOverrides) return;
    this.isSavingOverrides = true;

    // If student was found, update their score in the DB
    const payload = {
      exam_id: this.selectedExamId,
      studentId: this.rawText?.studentId,
      adjustedScore: this.adjustedScore,
      overriddenItems: Array.from(this.overrides)
    };

    this.http.post(`${environment.apiUrl}/api/scan/grade/override`, payload).subscribe({
      next: () => {
        this.isSavingOverrides = false;
        this.overrideSaved = true;

        // Capture the adjusted score BEFORE modifying details
        const finalScore = this.adjustedScore;

        // Permanently update the gradeResult details so the UI stays correct
        for (const itemKey of this.overrides) {
          const detail = this.gradeResult.details[itemKey];
          if (detail) {
            detail.isCorrect = true;
            detail.pointsAwarded = detail.maxPoints || 1;
          }
        }
        this.gradeResult.score = finalScore;
        this.overrides.clear();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSavingOverrides = false;
        console.error('Failed to save overrides', err);
        this.cdr.detectChanges();
      }
    });
  }
}
