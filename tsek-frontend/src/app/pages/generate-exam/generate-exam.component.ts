import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient } from '@angular/common/http';

type QuestionType = 'multipleChoice' | 'identification' | 'enumeration' | 'trueOrFalse';

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

interface AnswerTabConfig {
  key: QuestionType;
  label: string;
  icon: string;
  itemCount: number;
  pointsPerItem: number;
  options: string[];
}

@Component({
  selector: 'app-generate-exam',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
    ]),
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class GenerateExamComponent implements OnInit {
  http = inject(HttpClient);
  cdr = inject(ChangeDetectorRef);

  /* ============================
     STEP MANAGEMENT & MODALS
     ============================ */
  currentStep: 'configure' | 'answerKey' = 'configure';

  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalType: 'success' | 'error' = 'success';

  closeModal() {
    this.showModal = false;
    if (this.modalType === 'success') {
      // Full reset of the form and state
      this.currentStep = 'configure';
      this.examTitle = '';
      this.paperSize = 'A4';
      this.examDate = '';
      this.numberOfChoices = 4;
      this.selectedClassId = this.classes.length > 0 ? this.classes[0].id : null;
      
      this.sections = [
        { label: 'MULTIPLE CHOICE ITEMS', key: 'multipleChoice', enabled: true, options: [20, 30, 50, 100], selected: 30, pointName: 'Multiple Choice', defaultPoints: 1.0 },
        { label: 'IDENTIFICATION ITEMS', key: 'identification', enabled: true, options: [10, 15, 20], selected: 10, pointName: 'Identification', defaultPoints: 2.0 },
        { label: 'ENUMERATION ITEMS', key: 'enumeration', enabled: false, options: [5, 10, 15, 20], selected: 5, pointName: 'Enumeration', defaultPoints: 1.0 },
        { label: 'TRUE OR FALSE ITEMS', key: 'trueOrFalse', enabled: false, options: [5, 10, 15, 20], selected: 5, pointName: 'True or False', defaultPoints: 1.0 }
      ];

      this.savedPoints = {
        multipleChoice: 1.0,
        identification: 2.0,
        enumeration: 1.0,
        trueOrFalse: 1.0
      };

      // Wipe previous answers so the next exam starts fresh
      this.answers = {};
      this.textAnswers = {};
      this.answerTabs = [];
    }
  }

  /* ============================
     STEP 1 — Configuration
     ============================ */
  examTitle = '';
  paperSize = 'A4';
  examDate = '';
  numberOfChoices = 4;
  selectedClassId: number | null = null;
  classes: any[] = [];

  sections: ExamSection[] = [
    { label: 'MULTIPLE CHOICE ITEMS', key: 'multipleChoice', enabled: true, options: [20, 30, 50, 100], selected: 30, pointName: 'Multiple Choice', defaultPoints: 1.0 },
    { label: 'IDENTIFICATION ITEMS', key: 'identification', enabled: true, options: [10, 15, 20], selected: 10, pointName: 'Identification', defaultPoints: 2.0 },
    { label: 'ENUMERATION ITEMS', key: 'enumeration', enabled: false, options: [5, 10, 15, 20], selected: 5, pointName: 'Enumeration', defaultPoints: 1.0 },
    { label: 'TRUE OR FALSE ITEMS', key: 'trueOrFalse', enabled: false, options: [5, 10, 15, 20], selected: 5, pointName: 'True or False', defaultPoints: 1.0 }
  ];

  private savedPoints: Record<string, number> = {
    multipleChoice: 1.0,
    identification: 2.0,
    enumeration: 1.0,
    trueOrFalse: 1.0
  };

  ngOnInit() {
    this.http.get<any[]>('http://localhost:3000/api/classes').subscribe({
      next: data => {
        this.classes = data;
        if (this.classes.length > 0) {
          this.selectedClassId = this.classes[0].id;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

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
  get studentIdDigits(): number[] {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }

  get studentIdColumnsArray(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8]; // 8 digit ID
  }

  get mcColumns(): any[][] {
    const section = this.sections.find(s => s.key === 'multipleChoice');
    if (!section || !section.enabled) return [];
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
    const mcSection = this.sections.find(s => s.key === 'multipleChoice');
    const startNum = (mcSection && mcSection.enabled) ? mcSection.selected + 1 : 1;
    const items = Array.from({ length: section.selected }, (_, i) => startNum + i);
    const columns = [];
    for (let i = 0; i < items.length; i += 5) {
      columns.push(items.slice(i, i + 5));
    }
    return columns;
  }

  get mcBlocks(): any[][][] {
    const cols = this.mcColumns;
    const blocks = [];
    for (let i = 0; i < cols.length; i += 3) {
      blocks.push(cols.slice(i, i + 3));
    }
    return blocks;
  }

  get idBlocks(): any[][][] {
    const cols = this.idColumns;
    const blocks = [];
    for (let i = 0; i < cols.length; i += 2) {
      blocks.push(cols.slice(i, i + 2));
    }
    return blocks;
  }

  get enumColumns(): any[][] {
    const section = this.sections.find(s => s.key === 'enumeration');
    if (!section || !section.enabled) return [];
    
    let startNum = 1;
    const mcSection = this.sections.find(s => s.key === 'multipleChoice');
    const idSection = this.sections.find(s => s.key === 'identification');
    if (mcSection && mcSection.enabled) startNum += mcSection.selected;
    if (idSection && idSection.enabled) startNum += idSection.selected;

    const items = Array.from({ length: section.selected }, (_, i) => startNum + i);
    const columns = [];
    for (let i = 0; i < items.length; i += 5) {
      columns.push(items.slice(i, i + 5));
    }
    return columns;
  }

  get tfColumns(): any[][] {
    const section = this.sections.find(s => s.key === 'trueOrFalse');
    if (!section || !section.enabled) return [];
    
    let startNum = 1;
    const mcSection = this.sections.find(s => s.key === 'multipleChoice');
    const idSection = this.sections.find(s => s.key === 'identification');
    const enumSection = this.sections.find(s => s.key === 'enumeration');
    if (mcSection && mcSection.enabled) startNum += mcSection.selected;
    if (idSection && idSection.enabled) startNum += idSection.selected;
    if (enumSection && enumSection.enabled) startNum += enumSection.selected;

    const items = Array.from({ length: section.selected }, (_, i) => startNum + i);
    const columns = [];
    for (let i = 0; i < items.length; i += 10) {
      columns.push(items.slice(i, i + 10));
    }
    return columns;
  }

  get enumBlocks(): any[][][] {
    const cols = this.enumColumns;
    const blocks = [];
    for (let i = 0; i < cols.length; i += 2) {
      blocks.push(cols.slice(i, i + 2));
    }
    return blocks;
  }

  get tfBlocks(): any[][][] {
    const cols = this.tfColumns;
    const blocks = [];
    for (let i = 0; i < cols.length; i += 3) {
      blocks.push(cols.slice(i, i + 3));
    }
    return blocks;
  }

  /** Advance from Step 1 → Step 2 */
  proceedToAnswerKey() {
    if (!this.selectedClassId || !this.examTitle) {
      this.modalTitle = 'Missing Information';
      this.modalMessage = 'Please fill out the exam title and select a class before proceeding.';
      this.modalType = 'error';
      this.showModal = true;
      return;
    }

    // Build answer-key tabs from the enabled sections
    this.answerTabs = this.sections
      .filter(s => s.enabled)
      .map(s => ({
        key: s.key as QuestionType,
        label: s.pointName,
        icon: this.tabIconMap[s.key] || 'quiz',
        itemCount: s.selected,
        pointsPerItem: this.savedPoints[s.key] ?? s.defaultPoints,
        options: this.getOptionsForKey(s.key)
      }));

    // Initialize answer structures (preserve existing)
    if (!this.answers) this.answers = {};
    if (!this.textAnswers) this.textAnswers = {};

    for (const tab of this.answerTabs) {
      if (!this.answers[tab.key]) this.answers[tab.key] = {};
      if (!this.textAnswers[tab.key]) this.textAnswers[tab.key] = {};

      for (let i = 1; i <= tab.itemCount; i++) {
        if (!this.answers[tab.key][i]) this.answers[tab.key][i] = new Set<string>();
        if (this.textAnswers[tab.key][i] === undefined) this.textAnswers[tab.key][i] = '';
      }
    }

    this.activeAnswerTab = this.answerTabs[0]?.key ?? 'multipleChoice';
    this.currentStep = 'answerKey';
  }

  private tabIconMap: Record<string, string> = {
    multipleChoice: 'radio_button_checked',
    identification: 'edit',
    enumeration: 'format_list_numbered',
    trueOrFalse: 'compare_arrows'
  };

  private getOptionsForKey(key: string): string[] {
    if (key === 'multipleChoice') return ['A', 'B', 'C', 'D', 'E'].slice(0, this.numberOfChoices);
    if (key === 'trueOrFalse') return ['T', 'F'];
    return []; // identification / enumeration use text input
  }

  /** Go back to Step 1 */
  goBackToConfig() {
    this.currentStep = 'configure';
  }

  /* ============================
     STEP 2 — Answer Key Generator
     ============================ */
  activeAnswerTab: QuestionType = 'multipleChoice';
  answerTabs: AnswerTabConfig[] = [];
  answers: Record<string, Record<number, Set<string>>> = {};
  textAnswers: Record<string, Record<number, string>> = {};

  get currentAnswerTab(): AnswerTabConfig {
    return this.answerTabs.find(t => t.key === this.activeAnswerTab)!;
  }

  get currentTabItemNumbers(): number[] {
    return Array.from({ length: this.currentAnswerTab.itemCount }, (_, i) => i + 1);
  }

  get leftColumnItems(): number[] {
    const items = this.currentTabItemNumbers;
    return items.slice(0, Math.ceil(items.length / 2));
  }

  get rightColumnItems(): number[] {
    const items = this.currentTabItemNumbers;
    return items.slice(Math.ceil(items.length / 2));
  }

  get currentTabTotal(): number {
    return this.currentAnswerTab.itemCount * this.currentAnswerTab.pointsPerItem;
  }

  get completedItems(): number {
    const tab = this.currentAnswerTab;
    let count = 0;
    if (tab.key === 'identification' || tab.key === 'enumeration') {
      for (let i = 1; i <= tab.itemCount; i++) {
        if (this.textAnswers[tab.key]?.[i]?.trim()) count++;
      }
    } else {
      for (let i = 1; i <= tab.itemCount; i++) {
        if (this.answers[tab.key]?.[i]?.size > 0) count++;
      }
    }
    return count;
  }

  get completionPercent(): number {
    if (this.currentAnswerTab.itemCount === 0) return 0;
    return Math.round((this.completedItems / this.currentAnswerTab.itemCount) * 100);
  }

  get remainingItems(): number {
    return this.currentAnswerTab.itemCount - this.completedItems;
  }

  isAnswerSelected(itemNum: number, option: string): boolean {
    return this.answers[this.activeAnswerTab]?.[itemNum]?.has(option) ?? false;
  }

  selectAnswer(itemNum: number, option: string) {
    const set = this.answers[this.activeAnswerTab][itemNum];
    if (set.has(option)) {
      set.delete(option);
    } else {
      set.clear();
      set.add(option);
    }
  }

  toggleMultiAnswer(itemNum: number, option: string, event: MouseEvent) {
    event.preventDefault();
    const set = this.answers[this.activeAnswerTab][itemNum];
    if (set.has(option)) {
      set.delete(option);
    } else {
      set.add(option);
    }
  }

  onTextChange(itemNum: number) {
    const text = this.textAnswers[this.activeAnswerTab][itemNum];
    const set = this.answers[this.activeAnswerTab][itemNum];
    if (text?.trim()) {
      set.clear();
      set.add('answered');
    } else {
      set.clear();
    }
  }

  switchAnswerTab(key: QuestionType) {
    this.activeAnswerTab = key;
  }

  finalizeAnswerKey() {
    let allComplete = true;
    for (const tab of this.answerTabs) {
      for (let i = 1; i <= tab.itemCount; i++) {
        if (tab.key === 'identification' || tab.key === 'enumeration') {
          if (!this.textAnswers[tab.key]?.[i]?.trim()) { allComplete = false; break; }
        } else {
          if (!this.answers[tab.key]?.[i]?.size) { allComplete = false; break; }
        }
      }
      if (!allComplete) break;
    }

    if (!allComplete) {
      this.modalTitle = 'Incomplete Key';
      this.modalMessage = 'Please complete all items in all sections before finalizing the answer key.';
      this.modalType = 'error';
      this.showModal = true;
      return;
    }

    const answerKey: Record<string, any> = {};
    for (const tab of this.answerTabs) {
      answerKey[tab.key] = {};
      for (let i = 1; i <= tab.itemCount; i++) {
        if (tab.key === 'identification' || tab.key === 'enumeration') {
          answerKey[tab.key][i] = this.textAnswers[tab.key][i];
        } else {
          answerKey[tab.key][i] = Array.from(this.answers[tab.key][i]);
        }
      }
    }

    const payload = {
      class_id: this.selectedClassId,
      exam_title: this.examTitle,
      total_items: this.answerTabs.reduce((sum, t) => sum + t.itemCount, 0),
      config: this.sections,
      answer_key: answerKey
    };

    this.http.post('http://localhost:3000/api/exams', payload).subscribe({
      next: () => {
        this.modalTitle = 'Success!';
        this.modalMessage = 'Answer key finalized and saved successfully.';
        this.modalType = 'success';
        this.showModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to finalize answer key', err);
        this.modalTitle = 'Error';
        this.modalMessage = 'Failed to finalize answer key. Please try again.';
        this.modalType = 'error';
        this.showModal = true;
        this.cdr.detectChanges();
      }
    });
  }

  printExam() {
    window.print();
  }
}
