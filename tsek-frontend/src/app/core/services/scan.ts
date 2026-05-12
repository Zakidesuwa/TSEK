import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ScanService {
  private http = inject(HttpClient);
  
  // Store files temporarily when selected from the dashboard
  private pendingScanFiles: File[] = [];

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
