

import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JournalEntry } from '../../models/dream';
import { TtsService } from '../../services/tts.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Declare the docx global object provided by the script in index.html
declare var docx: any;

@Component({
  selector: 'app-analysis-view',
  templateUrl: './analysis-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true,
})
export class AnalysisViewComponent {
  entry = input.required<JournalEntry>();
  
  back = output<void>();
  openChat = output<void>();

  ttsService = inject(TtsService);
  sanitizer = inject(DomSanitizer);
  
  activeAccordion = signal<string | null>(null);

  formattedArticle = computed((): SafeHtml => {
    const article = this.entry().analysis.article;
    if (!article) {
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    
    // Block Elements: Process text blocks separated by double line breaks
    const blocks = article.split(/\n\s*\n/);

    let html = blocks.map(block => {
        block = block.trim();
        if (block.length === 0) return '';
        
        // Headings
        if (block.startsWith('## ')) {
            return block.replace(/^## (.*)/, '<h2 class="text-2xl font-serif font-bold mt-6 mb-3 text-gray-800 dark:text-gray-200">$1</h2>');
        }
        
        // Lists
        if (/^\s*[-*] /.test(block)) {
            const listItems = block.split('\n').map(item => 
                item.replace(/^\s*[-*] (.*)/, '<li>$1</li>')
            ).join('');
            return `<ul class="list-disc list-inside space-y-2 my-4">${listItems}</ul>`;
        }
        
        // Default: Paragraph
        return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    }).join('');

    // Inline Elements (applied to the whole generated HTML)
    html = html
        // Bold must be processed before italics.
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italics
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  });
  
  toggleAccordion(id: string): void {
    this.activeAccordion.update(current => (current === id ? null : id));
  }

  toggleReadAloud(): void {
    if (this.ttsService.isSpeaking()) {
      this.ttsService.stop();
    } else {
      const entryData = this.entry();
      const textToRead = `
        Dream analysis titled: ${entryData.analysis.title}.
        
        ${entryData.analysis.article}
        
        Key Jungian Concepts:
        ${entryData.analysis.jungianConcepts.map(c => `${c.term}. ${c.explanation}`).join('. ')}
        
        Mythological Parallels:
        ${entryData.analysis.mythologicalConnections.map(m => `${m.parallel}. ${m.explanation}`).join('. ')}
      `;
      this.ttsService.speak(textToRead);
    }
  }

  printAnalysis(): void {
    window.print();
  }

  async exportToWord(): Promise<void> {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = docx;
    const entryData = this.entry();
    
    // Fetch image and convert to buffer
    const response = await fetch(entryData.imageUrl);
    const blob = await response.blob();
    const imageBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: entryData.analysis.title,
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
             children: [new TextRun({ text: `Dream Date: ${new Date(entryData.date).toLocaleDateString()}`, italics: true })]
          }),
          new Paragraph({
             children: [new ImageRun({ data: imageBuffer, transformation: { width: 400, height: 400 } })]
          }),
          new Paragraph({ text: "Your Dream:", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: entryData.dreamText }),
          new Paragraph({ text: "Interpretation:", heading: HeadingLevel.HEADING_1 }),
          ...entryData.analysis.article.split('\n').map(p => new Paragraph(p)),

          new Paragraph({ text: "Key Jungian Concepts", heading: HeadingLevel.HEADING_1 }),
          ...entryData.analysis.jungianConcepts.flatMap(c => [
            new Paragraph({ text: c.term, heading: HeadingLevel.HEADING_2 }),
            new Paragraph(c.explanation)
          ]),

          new Paragraph({ text: "Mythological Parallels", heading: HeadingLevel.HEADING_1 }),
          ...entryData.analysis.mythologicalConnections.flatMap(m => [
            new Paragraph({ text: m.parallel, heading: HeadingLevel.HEADING_2 }),
            new Paragraph(m.explanation)
          ]),
        ],
      }],
    });

    Packer.toBlob(doc).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entryData.analysis.title.replace(/ /g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}
