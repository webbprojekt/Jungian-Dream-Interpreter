import { Injectable, signal, computed } from '@angular/core';
import { JournalEntry } from '../models/dream';

// Declare the docx global object provided by the script in index.html
declare var docx: any;

@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly STORAGE_KEY = 'dreamJournal';
  private journal = signal<JournalEntry[]>([]);
  
  searchTerm = signal<string>('');
  hasEntries = computed(() => this.journal().length > 0);

  filteredJournal = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) {
      return this.journal();
    }
    return this.journal().filter(entry =>
      entry.analysis.title.toLowerCase().includes(term) ||
      entry.dreamText.toLowerCase().includes(term) ||
      new Date(entry.date).toLocaleDateString().includes(term)
    );
  });

  constructor() {
    this.loadJournal();
  }

  private loadJournal(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const entries: JournalEntry[] = stored ? JSON.parse(stored) : [];
      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.journal.set(entries);
    } catch (e) {
      console.error('Failed to load or parse dream journal from localStorage', e);
      this.journal.set([]);
    }
  }

  private saveJournal(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.journal()));
  }

  addEntry(entry: JournalEntry): void {
    this.journal.update(entries => [entry, ...entries]);
    this.saveJournal();
  }

  deleteEntry(id: string): void {
    this.journal.update(entries => entries.filter(e => e.id !== id));
    this.saveJournal();
  }

  async exportSingleEntryToWord(entry: JournalEntry): Promise<void> {
    const blob = await this.createDocxBlob([entry]);
    this.downloadBlob(blob, `${entry.analysis.title.replace(/ /g, '_')}.docx`);
  }

  async exportAllToWord(): Promise<void> {
    const entries = this.journal();
    if (entries.length === 0) {
      alert('Your journal is empty. Nothing to export.');
      return;
    }
    const blob = await this.createDocxBlob(entries);
    this.downloadBlob(blob, `Dream_Journal_Export_${new Date().toISOString().split('T')[0]}.docx`);
  }
  
  private downloadBlob(blob: Blob, fileName: string): void {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }

  private async createDocxBlob(entries: JournalEntry[]): Promise<Blob> {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = docx;

    const docChildren: any[] = [];

    for (const [index, entryData] of entries.entries()) {
      if (index > 0) {
        docChildren.push(new Paragraph({ pageBreakBefore: true }));
      }
      
      let imageParagraph;
      try {
        const response = await fetch(entryData.imageUrl);
        const imageBuffer = await response.arrayBuffer();
        imageParagraph = new Paragraph({
             children: [new ImageRun({ data: imageBuffer, transformation: { width: 400, height: 400 } })]
        });
      } catch (e) {
        console.error('Could not fetch or process image for entry:', entryData.id, e);
        imageParagraph = new Paragraph({
            children: [new TextRun({ text: '[Image could not be loaded]', italics: true })]
        });
      }

      docChildren.push(
        new Paragraph({
          text: entryData.analysis.title,
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
           children: [new TextRun({ text: `Dream Date: ${new Date(entryData.date).toLocaleDateString()}`, italics: true })]
        }),
        imageParagraph,
        new Paragraph({ text: "Your Dream:", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: entryData.dreamText }),
        new Paragraph({ text: "Interpretation:", heading: HeadingLevel.HEADING_1 }),
        ...entryData.analysis.article.split('\n').filter(p => p.trim() !== '').map(line => {
            if (line.startsWith('## ')) {
                return new Paragraph({ text: line.substring(3), heading: HeadingLevel.HEADING_2 });
            }
            return new Paragraph(line);
        }),
        new Paragraph({ text: "Key Jungian Concepts", heading: HeadingLevel.HEADING_1 }),
        ...entryData.analysis.jungianConcepts.flatMap(c => [
          new Paragraph({ text: c.term, heading: HeadingLevel.HEADING_2 }),
          new Paragraph(c.explanation)
        ]),
        new Paragraph({ text: "Mythological Parallels", heading: HeadingLevel.HEADING_1 }),
        ...entryData.analysis.mythologicalConnections.flatMap(m => [
          new Paragraph({ text: m.parallel, heading: HeadingLevel.HEADING_2 }),
          new Paragraph(m.explanation)
        ])
      );
    }
    
    const doc = new Document({
      sections: [{
        children: docChildren,
      }],
    });

    return Packer.toBlob(doc);
  }
}