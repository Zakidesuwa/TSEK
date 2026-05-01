import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RouterLink } from '@angular/router';

interface HistoryRecord {
  id: number;
  subject: string;
  section: string;
  name: string;
  total_items: number;
  date: string;
  scans: string; // From COUNT()
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);
  
  historyRecords: HistoryRecord[] = [];
  isLoading = true;

  ngOnInit() {
    this.http.get<HistoryRecord[]>(`${environment.apiUrl}/api/history`).subscribe({
      next: (data) => {
        this.historyRecords = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch history', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}

