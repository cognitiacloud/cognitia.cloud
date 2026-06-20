export interface SignalInput {
  type: string;
  value: Record<string, unknown>;
  weight: number;
}

export interface AccountInput {
  domain: string;
  displayName: string;
  industry?: string | null;
  employeeRange?: string | null;
}

export interface ScoreInput {
  account: AccountInput;
  signals: SignalInput[];
}

export interface ScoreResult {
  score: number; // 0–100
  breakdown: Record<string, number>;
  rationale: string;
}

export interface BriefInput {
  account: AccountInput;
  score: ScoreResult;
  signals: SignalInput[];
}

export interface Objection {
  objection: string;
  response: string;
}

export interface BriefResult {
  summary: string;
  painPoints: string[];
  valueProps: string[];
  talkTrack: string[];
  objections: Objection[];
  recommendedChannel: 'email' | 'linkedin' | 'voice' | 'sms';
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  scoreAccount(input: ScoreInput): Promise<ScoreResult>;
  generateBrief(input: BriefInput): Promise<BriefResult>;
}
