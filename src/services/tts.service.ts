
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TtsService {
  isSpeaking = signal(false);
  private utterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    speechSynthesis.onvoiceschanged = () => {}; // Ensure voices are loaded
  }

  speak(text: string): void {
    if (speechSynthesis.speaking) {
      this.stop();
    }

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.onstart = () => this.isSpeaking.set(true);
    this.utterance.onend = () => this.isSpeaking.set(false);
    this.utterance.onerror = () => this.isSpeaking.set(false);
    
    // A small delay can help ensure voices are loaded on some browsers
    setTimeout(() => {
        const voices = speechSynthesis.getVoices();
        // Prefer a Google US English voice if available for quality
        const preferredVoice = voices.find(voice => voice.name === 'Google US English');
        if (preferredVoice) {
            this.utterance!.voice = preferredVoice;
        }
        speechSynthesis.speak(this.utterance!);
    }, 100);
  }

  stop(): void {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      this.isSpeaking.set(false);
    }
  }
}
