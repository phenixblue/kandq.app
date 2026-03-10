export interface Photo {
  id: string;
  user_id: string;
  url: string;
  storage_path: string;
  king_color: string | null;
  queen_color: string | null;
  color_reason: string | null;
  is_valid: boolean;
  vote_score: number;
  reason_vote_score: number;
  submitted_at: string;
  analyzed_at: string | null;
  user_email?: string;
}

export interface Vote {
  id: string;
  user_id: string;
  photo_id: string;
  vote: 1 | -1;
  created_at: string;
}

export interface ColorHistory {
  id: string;
  date: string;
  king_color: string | null;
  queen_color: string | null;
  reason: string | null;
  photo_id: string | null;
  photo_locked?: boolean;
  reason_locked?: boolean;
  updated_at: string;
}

export interface AnalysisResult {
  kingColor: string;
  queenColor: string;
  isValid: boolean;
  confidence: number;
  diagnostics?: AnalysisDiagnostics;
  debug?: AnalysisDebugData;
}

export interface AnalysisBuildingDiagnostic {
  building: 'king' | 'queen';
  passed: boolean;
  reason: string;
  saturation: number;
  coloredPixels: number;
  confidence: number;
  candidateComponents: number;
  selectedComponents: number;
}

export interface AnalysisDiagnostics {
  king: AnalysisBuildingDiagnostic;
  queen: AnalysisBuildingDiagnostic;
}

export interface AnalysisDebugRegion {
  building: 'king' | 'queen';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sampleColor: string;
  saturation: number;
  coloredPixels: number;
}

export interface AnalysisDebugPixel {
  building: 'king' | 'queen';
  label: string;
  x: number;
  y: number;
  used: boolean;
}

export interface AnalysisDebugData {
  canvasWidth: number;
  canvasHeight: number;
  regions: AnalysisDebugRegion[];
  pixels: AnalysisDebugPixel[];
}

export interface BuildingColors {
  king: string;
  queen: string;
}

export interface UserVotes {
  [photoId: string]: 1 | -1;
}

export interface UserReasonVotes {
  [photoId: string]: 1 | -1;
}
