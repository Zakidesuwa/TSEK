import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ScanService {
  private http = inject(HttpClient);
  
  // Store files temporarily when selected from the dashboard
  private pendingScanFiles: File[] = [];

  // Global scan state
  public isScanningMasterKey = new BehaviorSubject<boolean>(false);
  public scanReady = new BehaviorSubject<boolean>(false);
  public parsedScanAnswers = new BehaviorSubject<any>(null);
  public scanError = new BehaviorSubject<string | null>(null);
  public showGlobalWidget = new BehaviorSubject<boolean>(false);

  startGlobalScan(files: File[]) {
    this.isScanningMasterKey.next(true);
    this.scanReady.next(false);
    this.parsedScanAnswers.next(null);
    this.scanError.next(null);

    this.scanImages(files).subscribe({
      next: (res) => {
        const parsedAnswers = res.rawText?.answers;
        if (parsedAnswers) {
          this.scanReady.next(true);
          this.parsedScanAnswers.next(parsedAnswers);
        } else {
          this.isScanningMasterKey.next(false);
          this.scanError.next('Could not find any answers on the master key.');
        }
      },
      error: (err) => {
        this.isScanningMasterKey.next(false);
        this.scanError.next(err.error?.error || err.error?.message || 'Failed to process image.');
      }
    });
  }

  clearGlobalScanState() {
    this.isScanningMasterKey.next(false);
    this.scanReady.next(false);
    this.parsedScanAnswers.next(null);
    this.scanError.next(null);
    this.showGlobalWidget.next(false);
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
    const formData = new FormData();
    for (const file of files) {
      formData.append('images', file);
    }
    return this.http.post(`${environment.apiUrl}/api/scan`, formData);
  }

  // Legacy single-image scan (still uses the new multi endpoint)
  scanImage(file: File): Observable<any> {
    return this.scanImages([file]);
  }
}
