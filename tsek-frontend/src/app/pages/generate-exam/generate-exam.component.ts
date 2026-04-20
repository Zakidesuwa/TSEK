import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient } from '@angular/common/http';

interface ExamSection {
  label: string;
  key: string;
  enabled: boolean;
  options: number[];
  selected: number;
  pointName: string;
  defaultPoints: number;
}

interface PointSection {
  key: string;
  name: string;
  itemRange: string;
  pointsPerItem: number;
}

@Component({
  selector: 'app-generate-exam',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './generate-exam.component.html',
  styleUrl: './generate-exam.component.css',
  animations: [
    trigger('pointRowAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)', maxHeight: '0px', marginBottom: '0px', padding: '0 20px', overflow: 'hidden' }),
        animate('350ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)', maxHeight: '100px', marginBottom: '12px', padding: '16px 20px' }))
      ]),
      transition(':leave', [
        style({ opacity: 1, transform: 'translateY(0)', maxHeight: '100px', overflow: 'hidden' }),
        animate('280ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateY(-10px)', maxHeight: '0px', marginBottom: '0px', padding: '0 20px' }))
      ])
    ])
  ]
})
export class GenerateExamComponent implements OnInit {
  http = inject(HttpClient);

  examTitle = '';
  paperSize = 'A4';
  examDate = '';
  numberOfChoices = 4;
  selectedClassId: number | null = null;
  classes: any[] = [];

  ngOnInit() {
    this.http.get<any[]>('http://localhost:3000/api/classes').subscribe(data => {
      this.classes = data;
      if (this.classes.length > 0) {
        this.selectedClassId = this.classes[0].id;
      }
    });
  }

  sections: ExamSection[] = [
    { label: 'MULTIPLE CHOICE ITEMS', key: 'multipleChoice', enabled: true, options: [20, 30, 50, 100], selected: 30, pointName: 'Multiple Choice', defaultPoints: 1.0 },
    { label: 'IDENTIFICATION ITEMS', key: 'identification', enabled: true, options: [10, 15, 20], selected: 10, pointName: 'Identification', defaultPoints: 2.0 },
    { label: 'ENUMERATION ITEMS', key: 'enumeration', enabled: false, options: [5, 10, 15, 20], selected: 5, pointName: 'Enumeration', defaultPoints: 1.0 },
    { label: 'TRUE OR FALSE ITEMS', key: 'trueOrFalse', enabled: false, options: [5, 10, 15, 20], selected: 5, pointName: 'True or False', defaultPoints: 1.0 }
  ];

  // Store points per item persistently so they survive toggle cycles
  private savedPoints: Record<string, number> = {
    multipleChoice: 1.0,
    identification: 2.0,
    enumeration: 1.0,
    trueOrFalse: 1.0
  };

  get pointSections(): PointSection[] {
    const enabled = this.sections.filter(s => s.enabled);
    let start = 1;

    return enabled.map(section => {
      const range = `ITEMS ${start} - ${start + section.selected - 1}`;
      start += section.selected;
      return {
        key: section.key,
        name: section.pointName,
        itemRange: range,
        pointsPerItem: this.savedPoints[section.key] ?? section.defaultPoints
      };
    });
  }

  get totalPossibleScore(): number {
    return this.pointSections.reduce((total, pt) => {
      const section = this.sections.find(s => s.key === pt.key);
      return total + (section ? section.selected * pt.pointsPerItem : 0);
    }, 0);
  }

  toggleSection(section: ExamSection) {
    section.enabled = !section.enabled;
  }

  selectOption(section: ExamSection, option: number) {
    if (section.enabled) {
      section.selected = option;
    }
  }

  onPointsChange(pt: PointSection) {
    this.savedPoints[pt.key] = pt.pointsPerItem;
  }

  clearValues() {
    Object.keys(this.savedPoints).forEach(key => this.savedPoints[key] = 0);
  }

  saveWeights() {
    console.log('Weights saved:', this.pointSections);
  }

  get choiceLetters(): string[] {
    return ['A', 'B', 'C', 'D', 'E'].slice(0, this.numberOfChoices);
  }

  // Helpers to chunk exam items for the print layout
  get mcColumns(): any[][] {
    const section = this.sections.find(s => s.key === 'multipleChoice');
    if (!section || !section.enabled) return [];
    
    // We want 10 items per column
    const items = Array.from({ length: section.selected }, (_, i) => i + 1);
    const columns = [];
    for (let i = 0; i < items.length; i += 10) {
      columns.push(items.slice(i, i + 10));
    }
    return columns;
  }

  get idColumns(): any[][] {
    const section = this.sections.find(s => s.key === 'identification');
    if (!section || !section.enabled) return [];
    
    // Start numbering after Multiple Choice
    const mcSection = this.sections.find(s => s.key === 'multipleChoice');
    const startNum = (mcSection && mcSection.enabled) ? mcSection.selected + 1 : 1;

    // We want 5 items per column
    const items = Array.from({ length: section.selected }, (_, i) => startNum + i);
    const columns = [];
    for (let i = 0; i < items.length; i += 5) {
      columns.push(items.slice(i, i + 5));
    }
    return columns;
  }

  // Group columns into blocks of 3 for Multiple Choice (preventing page breaks mid-block)
  get mcBlocks(): any[][][] {
    const cols = this.mcColumns;
    const blocks = [];
    for (let i = 0; i < cols.length; i += 3) {
      blocks.push(cols.slice(i, i + 3));
    }
    return blocks;
  }

  // Group columns into blocks of 2 for Identification
  get idBlocks(): any[][][] {
    const cols = this.idColumns;
    const blocks = [];
    for (let i = 0; i < cols.length; i += 2) {
      blocks.push(cols.slice(i, i + 2));
    }
    return blocks;
  }

  generateExam() {
    if (!this.selectedClassId || !this.examTitle) {
      alert('Please fill out the exam title and select a class.');
      return;
    }

    const payload = {
      class_id: this.selectedClassId,
      exam_title: this.examTitle,
      total_items: this.totalPossibleScore,
      config: this.sections
    };

    this.http.post('http://localhost:3000/api/exams', payload).subscribe({
      next: () => {
        window.print();
      },
      error: (err) => {
        console.error('Failed to save exam', err);
        alert('Failed to save exam to database.');
      }
    });
  }
}
