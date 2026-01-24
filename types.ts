
export enum FunnelStage {
  STAGE_0_WELCOME = 'welcome',
  STAGE_1_COMMITMENT = 'commitment',
  STAGE_2_PROBLEM = 'problem',
  STAGE_3_EXPLANATION = 'explanation',
  STAGE_4_TREATMENT = 'treatment',
  STAGE_5_DECISION = 'decision',
  HANDOFF = 'handoff'
}

export enum MessageType {
  TEXT = 'text',
  AUDIO = 'audio',
  VIDEO = 'video'
}

export enum ChatStatus {
  BOT = 'bot',
  HUMAN = 'human'
}

export interface Message {
  id: string;
  sender: 'bot' | 'customer' | 'agent';
  type: MessageType;
  content: string; // URL ou texto
  timestamp: Date;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  funnelStage: FunnelStage;
  status: ChatStatus;
  lastMessageAt: Date;
  messages: Message[];
  notes?: string;
}

export interface IntentResponse {
  intent: 'continue' | 'question' | 'objection' | 'handoff' | 'payment_difficulty';
  confidence: number;
  reasoning: string;
}
