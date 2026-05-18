import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
      this.examDeadline = '';
      this.numberOfChoices = 4;
      this.selectedClassIds = this.classes.length > 0 ? [this.classes[0].id] : [];

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
  examDeadline = '';
  numberOfChoices = 4;
  isLoading = true;
  selectedClassIds: number[] = [];
  classes: any[] = [];
  
  // Validation errors
  formErrors: { title?: string; class?: string; date?: string; deadline?: string } = {};

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
    this.isLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/classes`).subscribe({
      next: data => {
        this.classes = data;
        if (this.classes.length > 0) {
          this.selectedClassIds = [this.classes[0].id];
        }
        this.isLoading = false;
        this.cdr.detectChanges();
        // Try loading an imported exam draft (if user clicked Edit as New)
        this.loadImportedDraft();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleAssignClass(classId: number) {
    const index = this.selectedClassIds.indexOf(classId);
    if (index > -1) {
      this.selectedClassIds.splice(index, 1);
    } else {
      this.selectedClassIds.push(classId);
    }
  }

  /** Load an imported exam draft saved in localStorage by the exams page */
  loadImportedDraft() {
    try {
      const raw = localStorage.getItem('importedExamDraft');
      if (!raw) return;
      const draft = JSON.parse(raw);

      // Apply basic fields
      this.examTitle = draft.examTitle || this.examTitle;

      // Map config -> sections
      if (Array.isArray(draft.config)) {
        this.sections = draft.config.map((c: any) => ({
          label: c.label || c.key,
          key: c.key,
          enabled: !!c.enabled,
          options: c.options || (c.key === 'multipleChoice' ? [20,30,50,100] : [5,10,15]),
          selected: c.selected || 0,
          pointName: c.pointName || c.label || c.key,
          defaultPoints: c.defaultPoints ?? 1
        }));

        // Restore saved points
        this.savedPoints = {};
        this.sections.forEach(s => this.savedPoints[s.key] = s.defaultPoints);
      }

      // Restore answer key into internal structures
      if (draft.answerKey) {
        // Build answerTabs like proceedToAnswerKey
        this.answerTabs = (this.sections.filter(s => s.enabled)).map(s => ({
          key: s.key as any,
          label: s.pointName,
          icon: this.tabIconMap[s.key] || 'quiz',
          itemCount: s.selected,
          pointsPerItem: this.savedPoints[s.key] ?? s.defaultPoints,
          options: this.getOptionsForKey(s.key)
        }));

        // Initialize answers/textAnswers
        this.answers = {};
        this.textAnswers = {};
        for (const tab of this.answerTabs) {
          this.answers[tab.key] = {} as any;
          this.textAnswers[tab.key] = {} as any;
          for (let i = 1; i <= tab.itemCount; i++) {
            this.answers[tab.key][i] = new Set<string>();
            this.textAnswers[tab.key][i] = '';
          }
        }

        // Fill from draft.answerKey
        const ak = draft.answerKey;
        for (const key of Object.keys(ak || {})) {
          const sectionKey = key as any;
          const items = ak[key];
          if (items) {
            for (const idxStr of Object.keys(items)) {
              const idx = parseInt(idxStr, 10);
              const val = items[idxStr];
              if (Array.isArray(val)) {
                // multiple choice stored as array
                this.answers[sectionKey][idx] = new Set(val.map(String));
              } else if (typeof val === 'string') {
                this.textAnswers[sectionKey][idx] = val;
                this.answers[sectionKey][idx].clear();
                if (val.trim()) this.answers[sectionKey][idx].add('answered');
              }
            }
          }
        }

        // Move to answer key step so user can edit
        this.currentStep = 'answerKey';
        this.activeAnswerTab = this.answerTabs[0]?.key ?? 'multipleChoice';
      }

      // Remove the imported draft to avoid accidental reuse
      localStorage.removeItem('importedExamDraft');
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Failed to load imported exam draft', e);
    }
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

  /** Validate date input */
  validateExamDate(): string | null {
    if (!this.examDate) {
      return 'Please select an exam date.';
    }

    const examDateObj = new Date(this.examDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(examDateObj.getTime())) {
      return 'Invalid date format.';
    }

    if (examDateObj < today) {
      return 'Exam date cannot be in the past. Please select a future date.';
    }

    return null;
  }

  /** Validate deadline input */
  validateExamDeadline(): string | null {
    if (!this.examDeadline) {
      return 'Please select a quiz deadline.';
    }

    const deadlineObj = new Date(this.examDeadline);
    const today = new Date();

    if (isNaN(deadlineObj.getTime())) {
      return 'Invalid deadline format.';
    }

    if (deadlineObj < today) {
      return 'Deadline cannot be in the past. Please select a future time.';
    }

    if (this.examDate) {
      const examDateObj = new Date(this.examDate);
      examDateObj.setHours(0, 0, 0, 0);
      if (deadlineObj < examDateObj) {
        return 'Deadline must be on or after the exam date.';
      }
    }

    return null;
  }

  /** Validate all form fields before proceeding */
  validateForm(): boolean {
    this.formErrors = {};

    // Validate class selection
    if (!this.selectedClassIds || this.selectedClassIds.length === 0) {
      this.formErrors.class = 'Please select at least one class.';
    }

    // Validate exam title
    if (!this.examTitle || this.examTitle.trim() === '') {
      this.formErrors.title = 'Please enter an exam title.';
    } else if (this.examTitle.trim().length < 3) {
      this.formErrors.title = 'Exam title must be at least 3 characters long.';
    }

    // Validate exam date
    const dateError = this.validateExamDate();
    if (dateError) {
      this.formErrors.date = dateError;
    }

    // Validate exam deadline
    const deadlineError = this.validateExamDeadline();
    if (deadlineError) {
      this.formErrors.deadline = deadlineError;
    }

    return Object.keys(this.formErrors).length === 0;
  }

  // Helpers to chunk exam items for the print layout
  get studentIdDigits(): number[] {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  }

  get studentIdColumnsArray(): number[] {
    return Array.from({ length: 12 }, (_, i) => i + 1); // 12-digit LRN
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
    if (!this.validateForm()) {
      const errorMessages = Object.values(this.formErrors).filter(err => err);
      this.modalTitle = 'Validation Error';
      this.modalMessage = errorMessages.join('\n\n');
      this.modalType = 'error';
      this.showModal = true;
      this.cdr.detectChanges();
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

    // Update sections with saved points before sending
    const finalConfig = this.sections.map(s => ({
      ...s,
      defaultPoints: this.savedPoints[s.key] ?? s.defaultPoints
    }));

    const payload = {
      class_id: this.selectedClassIds[0], // backward compatibility
      class_ids: this.selectedClassIds,
      exam_title: this.examTitle,
      total_items: this.answerTabs.reduce((sum, t) => sum + t.itemCount, 0),
      config: finalConfig,
      answer_key: answerKey,
      exam_date: this.examDate,
      deadline: this.examDeadline
    };

    this.http.post(`${environment.apiUrl}/api/exams`, payload).subscribe({
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
