export interface Photo {
  id: string;
  user_id: string;
  url: string;
  storage_path: string;
  king_color: string | null;
  queen_color: string | null;
  is_valid: boolean;
  vote_score: number;
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
  photo_id: string | null;
  updated_at: string;
}

export interface AnalysisResult {
  kingColor: string;
  queenColor: string;
  isValid: boolean;
  confidence: number;
}

export interface BuildingColors {
  king: string;
  queen: string;
}

export interface UserVotes {
  [photoId: string]: 1 | -1;
}
