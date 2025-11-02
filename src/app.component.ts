
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { GeminiService } from './services/gemini.service';
import { JournalService } from './services/journal.service';
import { JournalEntry } from './models/dream';
import { DreamInputComponent } from './components/dream-input/dream-input.component';
import { AnalysisViewComponent } from './components/analysis-view/analysis-view.component';
import { ChatModalComponent } from './components/chat-modal/chat-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    DreamInputComponent,
    AnalysisViewComponent,
    ChatModalComponent
  ],
})
export class AppComponent {
  themeService = inject(ThemeService);
  geminiService = inject(GeminiService);
  journalService = inject(JournalService);

  view = signal<'input' | 'analysis'>('input');
  currentEntry = signal<JournalEntry | null>(null);
  isLoading = signal(false);
  loadingMessage = signal('');
  errorMessage = signal('');
  isChatOpen = signal(false);

  private loadingMessages = [
    "Consulting the collective unconscious...",
    "Decoding archetypal symbols...",
    "Traversing the psychic landscape...",
    "Unveiling subconscious narratives...",
    "Connecting with the Self...",
  ];

  constructor() {
    // This will trigger the initial effect in the service to set the theme
    this.themeService.isDark();
  }

  async onNewDream(dreamText: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.startLoadingMessages();

    try {
      this.loadingMessage.set("Analyzing dream narrative...");
      const analysis = await this.geminiService.getDreamAnalysis(dreamText);
      
      this.loadingMessage.set("Generating symbolic artwork...");
      const imageUrl = await this.geminiService.generateDreamImage(analysis.imagePrompt);
      
      const newEntry: JournalEntry = {
        id: new Date().toISOString(),
        date: new Date().toISOString(),
        dreamText: dreamText,
        analysis: analysis,
        imageUrl: imageUrl
      };

      this.journalService.addEntry(newEntry);
      this.currentEntry.set(newEntry);
      this.view.set('analysis');
    } catch (error) {
      console.error('Failed to analyze dream:', error);
      this.errorMessage.set('An error occurred during analysis. Please check your API key and try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  onViewEntry(entry: JournalEntry): void {
    this.currentEntry.set(entry);
    this.view.set('analysis');
  }

  backToInput(): void {
    this.currentEntry.set(null);
    this.view.set('input');
  }

  openChatModal(): void {
    this.isChatOpen.set(true);
  }

  closeChatModal(): void {
    this.isChatOpen.set(false);
  }
  
  private startLoadingMessages(): void {
    let i = 0;
    this.loadingMessage.set(this.loadingMessages[i]);
    const interval = setInterval(() => {
      if (!this.isLoading()) {
        clearInterval(interval);
        return;
      }
      i = (i + 1) % this.loadingMessages.length;
      this.loadingMessage.set(this.loadingMessages[i]);
    }, 2500);
  }
}
