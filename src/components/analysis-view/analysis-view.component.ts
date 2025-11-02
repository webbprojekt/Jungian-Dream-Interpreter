import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JournalEntry } from '../../models/dream';
import { TtsService } from '../../services/tts.service';
import { JournalService } from '../../services/journal.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
  journalService = inject(JournalService);
  
  activeAccordion = signal<string | null>(null);
  isExporting = signal(false);

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
    if (this.isExporting()) return;
    this.isExporting.set(true);
    try {
      await this.journalService.exportSingleEntryToWord(this.entry());
    } catch (e) {
      console.error('Failed to export entry:', e);
      alert('An error occurred while exporting your journal. Please try again.');
    } finally {
      this.isExporting.set(false);
    }
  }
}