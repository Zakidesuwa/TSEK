import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ScanService } from '../../core/services/scan';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';

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
export class ScanResults implements OnInit, OnDestroy {
  scanService = inject(ScanService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  http = inject(HttpClient);

  // Staging state — files queued but not yet scanned
  isStaging = true;
  stagedFiles: File[] = [];
  stagedPreviewUrls: string[] = [];

  // Source selector modal state
  showScanSourceModal = false;
  isAddingPage = false;

  isLoading = false;
  isGrading = false;
  error: string | null = null;
  rawText: any = null;
  imagePreviewUrls: string[] = [];
  pageCount = 1;
  uploadProgress = 0;
  uploadProgressLabel = 'Preparing images...';

  exams: any[] = [];
  selectedExamId: number | null = null;
  autoMatchedExam: any = null;
  scanId: string | null = null;
  gradeResult: any = null;
  selectedPreviewIndex = 0;
  private scanUploadSub: Subscription | null = null;

  get selectedExam(): any {
    return this.exams.find(e => e.id === Number(this.selectedExamId)) || null;
  }

  get scannedItemCount(): number {
    return this.rawText?.answers ? Object.keys(this.rawText.answers).length : 0;
  }

  get isItemCountMismatch(): boolean {
    if (!this.selectedExam || !this.scannedItemCount) return false;
    return Number(this.selectedExam.total_items) !== this.scannedItemCount;
  }

  matchExamFromScan() {
    if (!this.exams || this.exams.length === 0 || !this.rawText) return;

    const scannedTitle = String(this.rawText.examTitle || '').toLowerCase().trim();
    const scannedAnswers = this.rawText.answers || {};
    const scannedCount = Object.keys(scannedAnswers).length;

    if (scannedTitle) {
      // 1. Try finding an exam matching title AND item count
      const exactMatch = this.exams.find(e => {
        const title = String(e.name || '').toLowerCase().trim();
        const matchesTitle = title.includes(scannedTitle) || scannedTitle.includes(title);
        return matchesTitle && (scannedCount === 0 || Number(e.total_items) === scannedCount);
      });

      if (exactMatch) {
        this.selectedExamId = exactMatch.id;
        this.autoMatchedExam = exactMatch;
        this.cdr.detectChanges();
        return;
      }

      // 2. Try matching title alone
      const titleMatch = this.exams.find(e => {
        const title = String(e.name || '').toLowerCase().trim();
        return title.includes(scannedTitle) || scannedTitle.includes(title);
      });

      if (titleMatch) {
        this.selectedExamId = titleMatch.id;
        this.autoMatchedExam = titleMatch;
        this.cdr.detectChanges();
        return;
      }
    }

    // 3. Fallback: match by item count if only one exam matches that count
    if (scannedCount > 0) {
      const countMatches = this.exams.filter(e => Number(e.total_items) === scannedCount);
      if (countMatches.length === 1) {
        this.selectedExamId = countMatches[0].id;
        this.autoMatchedExam = countMatches[0];
        this.cdr.detectChanges();
        return;
      }
    }
  }
  
  // Dynamic Live Scanner Animation State
  scanElapsedSeconds = 0;
  scanCurrentPhaseIndex = 0;
  private scanTimerInterval: any = null;
  readonly scanPhases = [
    { title: 'Uploading Answer Sheet', desc: 'Enhancing document resolution & verifying page integrity', icon: 'cloud_upload' },
    { title: 'Aligning OMR Template', desc: 'Detecting corner markers & LRN identifier boxes', icon: 'crop_free' },
    { title: 'Scanning Shaded Bubbles', desc: 'Measuring optical density & identifying double shades', icon: 'radio_button_checked' },
    { title: 'Transcribing Handwriting', desc: 'Reading student names and identification responses', icon: 'edit_note' },
    { title: 'Finalizing Evaluation', desc: 'Validating data points & preparing grading view', icon: 'auto_awesome' }
  ];

  startScanTimer() {
    this.stopScanTimer();
    this.scanElapsedSeconds = 0;
    this.scanCurrentPhaseIndex = 0;
    this.scanTimerInterval = setInterval(() => {
      this.scanElapsedSeconds++;
      if (this.scanElapsedSeconds < 4) {
        this.scanCurrentPhaseIndex = 0;
      } else if (this.scanElapsedSeconds < 10) {
        this.scanCurrentPhaseIndex = 1;
      } else if (this.scanElapsedSeconds < 20) {
        this.scanCurrentPhaseIndex = 2;
      } else if (this.scanElapsedSeconds < 30) {
        this.scanCurrentPhaseIndex = 3;
      } else {
        this.scanCurrentPhaseIndex = 4;
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  stopScanTimer() {
    if (this.scanTimerInterval) {
      clearInterval(this.scanTimerInterval);
      this.scanTimerInterval = null;
    }
  }

  // Webcam scanner state
  showWebcamModal = false;
  videoStream: MediaStream | null = null;

  // Enrollment Prompt State
  showEnrollmentPrompt = false;
  isEnrolling = false;
  tempEnrollData: any = null;

  // SVG ring constants
  readonly circumference = 2 * Math.PI * 52; // r=52

  ngOnInit() {
    this.fetchExams();
    const files = this.scanService.getPendingFiles();

    if (files.length === 0) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Stage the files instead of immediately scanning
    this.addStagedFiles(files);
    this.scanService.clearPendingFiles();
  }

  // --- Staging methods ---

  addStagedFiles(files: File[]) {
    const validationError = this.scanService.validateFiles([...this.stagedFiles, ...files]);
    if (validationError) {
      this.error = validationError;
      this.cdr.detectChanges();
      return;
    }

    for (const file of files) {
      this.stagedFiles.push(file);
      this.stagedPreviewUrls.push(URL.createObjectURL(file));
    }
    this.cdr.detectChanges();
  }

  removeStagedFile(index: number) {
    URL.revokeObjectURL(this.stagedPreviewUrls[index]);
    this.stagedFiles.splice(index, 1);
    this.stagedPreviewUrls.splice(index, 1);

    // If all files removed, go back to dashboard
    if (this.stagedFiles.length === 0) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.cdr.detectChanges();
  }

  onAddMoreFiles(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.addStagedFiles(files);
    }
    event.target.value = '';
  }

  startScanning() {
    if (this.stagedFiles.length === 0) return;

    const validationError = this.scanService.validateFiles(this.stagedFiles);
    if (validationError) {
      this.error = validationError;
      this.cdr.detectChanges();
      return;
    }

    this.isStaging = false;
    this.isLoading = true;
    this.uploadProgress = 0;
    this.uploadProgressLabel = 'Preparing images...';
    this.startScanTimer();

    this.imagePreviewUrls = [...this.stagedPreviewUrls];
    this.pageCount = this.stagedFiles.length;
    this.selectedPreviewIndex = 0;

    // Send all images in one request
    this.scanUploadSub = this.scanService.scanImagesWithProgress(this.stagedFiles).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Sent) {
          this.uploadProgress = 1;
          this.uploadProgressLabel = 'Uploading pages...';
        }

        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total || 1;
          this.uploadProgress = Math.min(99, Math.round((event.loaded / total) * 100));
          this.uploadProgressLabel = `Uploading pages... ${this.uploadProgress}%`;
        }

        if (event.type === HttpEventType.Response) {
          const response = event.body;
          this.stopScanTimer();
          this.isLoading = false;
          this.uploadProgress = 100;
          this.uploadProgressLabel = 'Upload complete';
          this.rawText = response?.rawText || { error: 'No data returned' };
          this.scanId = response?.scanId || null;

          if (this.rawText && this.rawText.pagesMatchStudent === false) {
            this.error = 'Verification Warning: Scanned pages do not appear to belong to the same student. Please verify handwriting, names, and page order.';
          }
          this.matchExamFromScan();
          this.scanUploadSub = null;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.stopScanTimer();
        this.isLoading = false;
        const backendMessage = err?.error?.error || err?.error?.message || err?.message || 'Failed to process image.';
        this.error = `Backend Error: ${backendMessage}`;
        this.scanUploadSub = null;
        console.error('Scan Error:', err);
        this.cdr.detectChanges();
      }
    });
  }

  cancelScanning() {
    if (this.scanUploadSub) {
      this.scanUploadSub.unsubscribe();
      this.scanUploadSub = null;
    }
    this.stopScanTimer();
    this.isLoading = false;
    this.isStaging = true;
    this.uploadProgress = 0;
    this.uploadProgressLabel = 'Scan canceled';
    this.cdr.detectChanges();
  }

  fetchExams() {
    this.http.get<any[]>(`${environment.apiUrl}/api/exams`).subscribe({
      next: (data) => {
        this.exams = data;
        if (this.exams.length > 0) {
          this.selectedExamId = this.exams[0].id;
        }
        this.matchExamFromScan();
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
      studentName: this.rawText.studentName || '',
      answers: this.rawText.answers,
      scanId: this.scanId,
      page_count: this.pageCount
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
        
        // Update the active scan text to the edited values
        if (this.rawText) {
          this.rawText.studentId = this.tempEnrollData.studentId;
          this.rawText.studentName = this.tempEnrollData.studentName;
        }

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

  recordUnderSimilar(similar: any): void {
    this.showEnrollmentPrompt = false;
    this.tempEnrollData = null;

    // Update the rawText student details to the corrected values
    this.rawText.studentId = similar.student_id_number;
    this.rawText.studentName = similar.name;

    // Trigger processBubbles again with the corrected info
    this.processBubbles();
  }

  openScanSourceModal(addingPage: boolean = false) {
    this.isAddingPage = addingPage;
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

  resetToStaging(files: File[]) {
    // Reset everything and go back to staging
    this.gradeResult = null;
    this.error = null;
    this.rawText = null;
    this.isLoading = false;
    this.overrides.clear();
    this.overrideSaved = false;

    // Revoke old preview URLs
    for (const url of this.imagePreviewUrls) {
      URL.revokeObjectURL(url);
    }
    for (const url of this.stagedPreviewUrls) {
      URL.revokeObjectURL(url);
    }

    // Reset staged state with new files
    this.stagedFiles = [];
    this.stagedPreviewUrls = [];
    this.imagePreviewUrls = [];
    this.isStaging = true;
    this.addStagedFiles(files);
    this.cdr.detectChanges();
  }

  onNewFileSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.resetToStaging(files);
    }
    event.target.value = '';
  }

  onNewCameraSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.resetToStaging(files);
    }
    event.target.value = '';
  }

  onAddPageCameraSelected(event: any) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.addStagedFiles(files);
    }
    event.target.value = '';
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

    // Permanently update the gradeResult details first so we can persist the full item breakdown
    for (const itemKey of this.overrides) {
      const detail = this.gradeResult.details[itemKey];
      if (detail) {
        detail.isCorrect = true;
        detail.pointsAwarded = detail.maxPoints || 1;
      }
    }
    const finalScore = this.adjustedScore;
    this.gradeResult.score = finalScore;

    // If student was found, update their score in the DB
    const payload = {
      exam_id: this.selectedExamId,
      studentId: this.rawText?.studentId,
      adjustedScore: finalScore,
      overriddenItems: Array.from(this.overrides),
      details: this.gradeResult.details,
      page_count: this.pageCount,
      scanId: this.scanId
    };

    this.http.post(`${environment.apiUrl}/api/scan/grade/override`, payload).subscribe({
      next: () => {
        this.isSavingOverrides = false;
        this.overrideSaved = true;
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

  // Webcam Capture Methods
  async openWebcamModal() {
    this.showWebcamModal = true;
    this.cdr.detectChanges();
    try {
      setTimeout(async () => {
        const videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
        this.videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoEl && this.videoStream) {
          videoEl.srcObject = this.videoStream;
        }
      }, 100);
    } catch (err) {
      console.error('Error accessing webcam:', err);
      alert('Could not access camera. Please ensure camera permissions are granted.');
      this.closeWebcamModal();
    }
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
    const videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
    if (!videoEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1280;
    canvas.height = videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `webcam-scan-${Date.now()}.png`, { type: 'image/png' });
          if (this.isAddingPage) {
            this.addStagedFiles([file]);
          } else {
            this.resetToStaging([file]);
          }
        }
      }, 'image/png');
    }
    this.closeWebcamModal();
  }

  ngOnDestroy() {
    if (this.scanUploadSub) {
      this.scanUploadSub.unsubscribe();
      this.scanUploadSub = null;
    }
    this.stopScanTimer();
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
    }
  }
}
