import { Component, ChangeDetectionStrategy, signal, inject, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JournalService } from '../../services/journal.service';
import { JournalEntry } from '../../models/dream';

@Component({
  selector: 'app-dream-input',
  templateUrl: './dream-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class DreamInputComponent {
  journalService = inject(JournalService);
  dreamText = signal('');
  
  @Output() newDream = new EventEmitter<string>();
  @Output() viewEntry = new EventEmitter<JournalEntry>();

  isRecording = signal(false);
  isExporting = signal(false);
  private recognition: any | null = null;
  
  isDreamTextValid = computed(() => this.dreamText().trim().length >= 10);
  
  constructor() {
    this.setupSpeechRecognition();
  }

  submitDream(): void {
    if (this.isDreamTextValid()) {
      this.newDream.emit(this.dreamText());
    }
  }

  loadEntry(entry: JournalEntry): void {
    this.viewEntry.emit(entry);
  }

  deleteEntry(event: MouseEvent, id: string): void {
    event.stopPropagation(); // Prevent card click
    if (confirm('Are you sure you want to delete this dream from your journal?')) {
      this.journalService.deleteEntry(id);
    }
  }

  async exportAll(): Promise<void> {
    if (!this.journalService.hasEntries() || this.isExporting()) return;
    
    this.isExporting.set(true);
    try {
      await this.journalService.exportAllToWord();
    } catch (e) {
      console.error('Failed to export journal:', e);
      alert('An error occurred while exporting your journal. Please try again.');
    } finally {
      this.isExporting.set(false);
    }
  }
  
  private setupSpeechRecognition(): void {
    // FIX: Cast window to any to access browser-specific SpeechRecognition APIs without TypeScript errors.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let finalTranscript = this.dreamText();
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        // For a better UX, only update the signal with final results
        // but you could show interim results elsewhere if needed.
        this.dreamText.set(finalTranscript);
      };
      
      this.recognition.onend = () => {
        this.isRecording.set(false);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        alert(`Speech recognition error: ${event.error}. Please ensure microphone permissions are granted.`);
        this.isRecording.set(false);
      };
    }
  }

  toggleRecording(): void {
    if (!this.recognition) {
        alert('Voice dictation is not supported by your browser.');
        return;
    }

    if (this.isRecording()) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
        this.isRecording.set(true);
      } catch(e) {
        console.error("Error starting recognition", e);
        alert("Could not start voice recognition. It might be already active or permissions are denied.");
        this.isRecording.set(false);
      }
    }
  }

  clearSearch(): void {
    this.journalService.searchTerm.set('');
  }

  onSearchInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.journalService.searchTerm.set(inputElement.value);
  }
}
