import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ScanService {
  private http = inject(HttpClient);
  
  // Store the file temporarily when selected from the dashboard
  private pendingScanFile: File | null = null;

  setPendingFile(file: File) {
    this.pendingScanFile = file;
  }

  getPendingFile(): File | null {
    return this.pendingScanFile;
  }

  clearPendingFile() {
    this.pendingScanFile = null;
  }

  scanImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);

    return this.http.post('http://localhost:3000/api/scan', formData);
  }
}
