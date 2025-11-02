
export interface JungianConcept {
  term: string;
  explanation: string;
}

export interface MythologicalConnection {
  parallel: string;
  explanation: string;
}

export interface DreamAnalysis {
  title: string;
  article: string;
  jungianConcepts: JungianConcept[];
  mythologicalConnections: MythologicalConnection[];
  imagePrompt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  dreamText: string;
  analysis: DreamAnalysis;
  imageUrl: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
