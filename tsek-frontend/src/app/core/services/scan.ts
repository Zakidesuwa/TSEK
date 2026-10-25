import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, from } from 'rxjs';
import { filter } from 'rxjs/operators';
import { map, switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ScanService {
  private http = inject(HttpClient);
  readonly maxFiles = 5;
  readonly maxFileSizeBytes = 10 * 1024 * 1024;
  
  // Store files temporarily when selected from the dashboard
  private pendingScanFiles: File[] = [];

  // Global scan state
  public isScanningMasterKey = new BehaviorSubject<boolean>(false);
  public scanReady = new BehaviorSubject<boolean>(false);
  public parsedScanAnswers = new BehaviorSubject<any>(null);
  public parsedScanResult = new BehaviorSubject<any>(null);
  public scanError = new BehaviorSubject<string | null>(null);
  public showGlobalWidget = new BehaviorSubject<boolean>(false);
  public examConfigCache: any = null;

  // Actions triggered from global widget or UI
  public requestOpenScanModal = new Subject<void>();
  public requestPopulateAnswers = new Subject<void>();

  triggerOpenScanModal() {
    this.requestOpenScanModal.next();
  }

  triggerPopulateAnswers() {
    this.requestPopulateAnswers.next();
  }

  startGlobalScan(files: File[]) {
    const validationError = this.validateFiles(files);
    if (validationError) {
      this.isScanningMasterKey.next(false);
      this.scanReady.next(false);
      this.scanError.next(validationError);
      return;
    }

    this.isScanningMasterKey.next(true);
    this.scanReady.next(false);
    this.parsedScanAnswers.next(null);
    this.parsedScanResult.next(null);
    this.scanError.next(null);

    this.scanImages(files).subscribe({
      next: (res) => {
        const parsedAnswers = res.rawText?.answers;
        if (parsedAnswers) {
          this.parsedScanAnswers.next(parsedAnswers);
          this.parsedScanResult.next(res.rawText);
          this.isScanningMasterKey.next(false);
          this.scanReady.next(true);
        } else {
          this.isScanningMasterKey.next(false);
          this.scanError.next('Could not find any answers on the master key.');
        }
      },
      error: (err) => {
        this.isScanningMasterKey.next(false);
        this.scanError.next(err?.error?.error || err?.error?.message || err?.message || 'Failed to process image.');
      }
    });
  }

  clearGlobalScanState() {
    this.isScanningMasterKey.next(false);
    this.scanReady.next(false);
    this.parsedScanAnswers.next(null);
    this.parsedScanResult.next(null);
    this.scanError.next(null);
    this.showGlobalWidget.next(false);
    this.examConfigCache = null;
  }

  setPendingFiles(files: File[]) {
    this.pendingScanFiles = files;
  }

  // Convenience wrapper for single file
  setPendingFile(file: File) {
    this.pendingScanFiles = [file];
  }

  getPendingFiles(): File[] {
    return this.pendingScanFiles;
  }

  // Legacy single-file getter (returns first file or null)
  getPendingFile(): File | null {
    return this.pendingScanFiles.length > 0 ? this.pendingScanFiles[0] : null;
  }

  clearPendingFiles() {
    this.pendingScanFiles = [];
  }

  clearPendingFile() {
    this.clearPendingFiles();
  }

  // Scan multiple images in one API call
  scanImages(files: File[]): Observable<any> {
    return this.scanImagesWithProgress(files).pipe(
      filter((event: HttpEvent<any>) => event.type === HttpEventType.Response),
      map((event: any) => event.body)
    );
  }

  scanImagesWithProgress(files: File[]): Observable<HttpEvent<any>> {
    return from(this.prepareFilesForUpload(files)).pipe(
      switchMap((preparedFiles) => {
        const formData = new FormData();
        for (const file of preparedFiles) {
          formData.append('images', file);
        }
        return this.http.post<any>(`${environment.apiUrl}/api/scan`, formData, {
          observe: 'events',
          reportProgress: true
        });
      })
    );
  }

  // Legacy single-image scan (still uses the new multi endpoint)
  scanImage(file: File): Observable<any> {
    return this.scanImages([file]);
  }

  validateFiles(files: File[]): string | null {
    if (!files || files.length === 0) {
      return 'Please select at least one image.';
    }

    if (files.length > this.maxFiles) {
      return `You can upload up to ${this.maxFiles} pages per scan.`;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return `Unsupported file type: ${file.name}`;
      }
      if (file.size > this.maxFileSizeBytes) {
        return `${file.name} exceeds the 10MB limit.`;
      }
    }

    return null;
  }

  private async prepareFilesForUpload(files: File[]): Promise<File[]> {
    const compressedFiles: File[] = [];
    for (const file of files) {
      compressedFiles.push(await this.compressImage(file));
    }
    return compressedFiles;
  }

  private async compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
      return file;
    }

    const image = await this.loadImage(file);
    const maxDimension = 1600;
    const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78);
    });

    if (!blob) {
      return file;
    }

    if (blob.size >= file.size) {
      return file;
    }

    const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], compressedName, { type: 'image/jpeg' });
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to load image: ${file.name}`));
      };
      image.src = objectUrl;
    });
  }
}
