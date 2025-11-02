
import { Component, ChangeDetectionStrategy, input, output, signal, inject, ViewChild, ElementRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiService } from '../../services/gemini.service';
import { TtsService } from '../../services/tts.service';
import { ChatMessage } from '../../models/dream';

@Component({
  selector: 'app-chat-modal',
  templateUrl: './chat-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  standalone: true
})
export class ChatModalComponent {
  dreamText = input.required<string>();
  
  close = output<void>();

  geminiService = inject(GeminiService);
  ttsService = inject(TtsService);

  messages = signal<ChatMessage[]>([]);
  userInput = signal('');
  isThinking = signal(false);
  isRecording = signal(false);

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  private recognition: any | null = null;
  
  constructor() {
    afterNextRender(() => {
        this.geminiService.startChat(this.dreamText());
        const initialMessage: ChatMessage = { role: 'model', text: 'Ask me anything about your dream...' };
        this.messages.set([initialMessage]);
        this.ttsService.speak(initialMessage.text);
        this.setupSpeechRecognition();
    });
  }

  async sendMessage(): Promise<void> {
    const text = this.userInput().trim();
    if (!text || this.isThinking()) return;

    this.messages.update(m => [...m, { role: 'user', text }]);
    this.userInput.set('');
    this.isThinking.set(true);
    this.scrollToBottom();

    try {
      const response = await this.geminiService.continueChat(text);
      const modelText = response.text;
      this.messages.update(m => [...m, { role: 'model', text: modelText }]);
      this.ttsService.speak(modelText);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = { role: 'model' as const, text: 'I seem to have lost my train of thought. Please try again.' };
      this.messages.update(m => [...m, errorMessage]);
    } finally {
      this.isThinking.set(false);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    try {
        setTimeout(() => {
            this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
        }, 0);
    } catch (err) { }
  }
  
  closeModal(): void {
    this.ttsService.stop();
    this.close.emit();
  }

  private setupSpeechRecognition(): void {
    // FIX: Cast window to any to access browser-specific SpeechRecognition APIs without TypeScript errors.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.userInput.set(transcript);
        this.sendMessage();
      };
      
      this.recognition.onend = () => {
        this.isRecording.set(false);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        alert(`Speech recognition error: ${event.error}.`);
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
        this.isRecording.set(false);
      }
    }
  }
}
