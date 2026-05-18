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
  deadline?: string;
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
  protected Math = Math;
  
  allRecords: HistoryRecord[] = [];
  historyRecords: HistoryRecord[] = [];
  isInitialLoading = true;
  isUpdating = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  currentSortBy = 'date';
  currentSortOrder = 'DESC';

  ngOnInit() {
    this.fetchHistory(true);
  }

  fetchHistory(isInitial = false) {
    if (isInitial) {
      this.isInitialLoading = true;
    } else {
      this.isUpdating = true;
    }
    this.cdr.detectChanges();
    this.http.get<HistoryRecord[]>(`${environment.apiUrl}/api/history`, {
      params: {
        sortBy: this.currentSortBy,
        sortOrder: this.currentSortOrder
      }
    }).subscribe({
      next: (data) => {
        this.allRecords = data;
        this.totalPages = Math.max(1, Math.ceil(this.allRecords.length / this.itemsPerPage));
        this.updatePaginatedRecords();
        this.isInitialLoading = false;
        this.isUpdating = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch history', err);
        this.isInitialLoading = false;
        this.isUpdating = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleSort(field: string): void {
    if (this.currentSortBy === field) {
      this.currentSortOrder = this.currentSortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.currentSortBy = field;
      this.currentSortOrder = 'DESC';
    }
    this.currentPage = 1; // Reset to page 1 when sort changes
    this.fetchHistory(false);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedRecords();
    }
  }

  private updatePaginatedRecords(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.historyRecords = this.allRecords.slice(start, end);
    this.cdr.detectChanges();
  }
}

