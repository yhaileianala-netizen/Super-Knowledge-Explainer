
export enum LearningMode {
  IMAGE_EXTRACTION = 'image_extraction',
  INTUITION = 'intuition_mode',
  PRINCIPLE = 'principle_mode',
  ACADEMIC = 'academic_mode',
  PAPER = 'paper_mode',
  LITERATURE = 'literature_mode',
  EXPORT = 'export_format'
}

export interface PromptConfig {
  id: string;
  name: string;
  version: string;
  model: string;
  lastModified: string;
  prompt: string;
  description: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  recommendedFor: LearningMode[];
  supportsThinking: boolean;
  maxThinkingBudget: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: LearningMode;
  timestamp: number;
  type: 'text' | 'image' | 'file';
  imageUrls?: string[];
  groundingLinks?: { uri: string; title: string }[];
}

export interface SessionContext {
  instructorName: string;
  researchField: string;
  institution: string;
  courseName: string;
  theoreticalFramework: string;
  thinkingBudget: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  context: SessionContext;
  history: Message[];
  currentMode: LearningMode;
  lastActive: number;
}
