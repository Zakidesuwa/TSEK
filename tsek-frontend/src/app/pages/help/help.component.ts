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
      answer: 'Go to "Generate Answer Sheet" from the sidebar. Select a class, name your exam, then configure your sections (Multiple Choice, True/False, Identification). Set the answer key and click "Save & Generate" to create a printable OMR sheet.',
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

  termsOfService = [
    {
      title: '1. Use License',
      content: 'Permission is granted to temporarily download one copy of the materials (information or software) on TSEK for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: (a) modify or copy the materials, (b) use the materials for any commercial purpose or for any public display, (c) attempt to decompile or reverse engineer any software contained on TSEK, (d) remove any copyright or other proprietary notations from the materials, or (e) transfer the materials to another person or "mirror" the materials on any other server.',
      open: false
    },
    {
      title: '2. Disclaimer of Warranties',
      content: 'The materials on TSEK are provided "as is" without any warranties, express or implied. We make no representations or warranties regarding the accuracy, completeness, or reliability of the content. TSEK does not warrant that the materials, functions, or services on the website will be uninterrupted or error-free.',
      open: false
    },
    {
      title: '3. Limitation of Liability',
      content: 'In no event shall TSEK be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on TSEK, even if we have been notified of the possibility of such damages.',
      open: false
    },
    {
      title: '4. Accuracy of Materials',
      content: 'The materials appearing on TSEK could include technical, typographical, or photographic errors. TSEK does not warrant that any of the materials on its website are accurate, complete, or current. We may make changes to the materials contained on our website at any time without notice.',
      open: false
    },
    {
      title: '5. Termination of Use',
      content: 'The materials on TSEK are provided for lawful purposes only, and you must agree to comply with all applicable laws and regulations. We reserve the right to refuse service, terminate accounts, and remove or edit content at our sole discretion.',
      open: false
    }
  ];

  privacyPolicy = [
    {
      title: 'Information We Collect',
      content: 'TSEK collects information you voluntarily provide when creating an account, including your name, email address, and educational institution. We also automatically collect certain information about your device and usage patterns, including IP address, browser type, and pages visited. Exam-related data, including student information and exam results, may be stored for grade tracking and reporting purposes.',
      open: false
    },
    {
      title: 'How We Use Your Information',
      content: 'We use the information collected to provide, maintain, and improve TSEK services. This includes authenticating your account, processing your requests, generating exams, scanning and grading documents, and providing customer support. We may also use aggregated, de-identified data for analytics and service improvement.',
      open: false
    },
    {
      title: 'Data Security',
      content: 'We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security of your data.',
      open: false
    },
    {
      title: 'Third-Party Services',
      content: 'TSEK may integrate with third-party services (such as authentication providers or analytics tools) to enhance functionality. These third parties have their own privacy policies, and we encourage you to review them. TSEK is not responsible for the privacy practices of third-party services.',
      open: false
    },
    {
      title: 'Data Retention',
      content: 'We retain your personal information and exam data for as long as your account is active or as needed to provide services. You may request deletion of your data at any time by contacting us. Some information may be retained for legal or compliance purposes.',
      open: false
    },
    {
      title: 'Contact Us',
      content: 'If you have questions or concerns about our Terms of Service or Privacy Policy, please contact our support team. We are committed to addressing any issues and maintaining transparency about how we handle your data.'
    }
  ];

  toggleFaq(faq: any) {
    faq.open = !faq.open;
  }

  togglePolicy(item: any) {
    item.open = !item.open;
  }
}
