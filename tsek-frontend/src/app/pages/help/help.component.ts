import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css'
})
export class HelpComponent {
  faqs = [
    {
      question: 'How do I create an exam?',
      answer: 'Go to "Generate Exam" from the sidebar. Select a class, name your exam, then configure your sections (Multiple Choice, True/False, Identification). Set the answer key and click "Save & Generate" to create a printable OMR sheet.',
      open: false
    },
    {
      question: 'How do I scan a student\'s answer sheet?',
      answer: 'Click the "TSEK NOW" button on the dashboard (or use the camera button on mobile). Take a photo or upload an image of the filled-out OMR sheet. The AI will read the bubbles and handwritten answers automatically.',
      open: false
    },
    {
      question: 'How does the grading work?',
      answer: 'After scanning, select the exam from the dropdown and click "Grade Exam." The system compares the student\'s answers against the stored answer key and calculates the score automatically. If the student\'s ID is found in the database, the score is saved.',
      open: false
    },
    {
      question: 'What if the AI misreads an answer?',
      answer: 'Use the Override system on the scan results page. Click "Accept" on any incorrectly marked item to manually mark it as correct. Then click "Save Overrides" to update the score in the database.',
      open: false
    },
    {
      question: 'How do I add students to a class?',
      answer: 'Go to "Classes" from the sidebar, click on a class card to open it, then click "Add Student." Enter the student\'s full name and ID number. Students are automatically matched during grading by their ID number.',
      open: false
    },
    {
      question: 'What image formats are supported for scanning?',
      answer: 'TSEK supports JPEG, PNG, and WebP images. For best results, ensure the answer sheet is well-lit, flat, and the entire sheet is visible in the frame. Avoid shadows and glare.',
      open: false
    },
    {
      question: 'Can I edit an exam after creating it?',
      answer: 'Currently, exams cannot be edited after creation. If you need to change the answer key or configuration, delete the exam from the Classes page and create a new one.',
      open: false
    },
    {
      question: 'How is the system accuracy calculated?',
      answer: 'The accuracy stat on the dashboard is the average student performance across all exams. It\'s calculated as: (total points scored by all students) ÷ (total possible points across all exams) × 100%.',
      open: false
    }
  ];

  toggleFaq(faq: any) {
    faq.open = !faq.open;
  }
}
