export interface UserInput {
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female';
  name: string;
}

export interface Pillar {
  stem: string; // Hanja
  stemKorean: string;
  stemTenGod: string; // E.g., "상관", "비견"
  branch: string; // Hanja
  branchKorean: string;
  branchTenGod: string; // E.g., "정재", "편관"
  element: 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';
  color: string;
}

export interface LuckyDay {
  date: string; // Combined Month and Day e.g., "3월 15일 (갑자일)"
  time: string;
  direction: string;
}

export interface SajuAnalysisResult {
  yearPillar: Pillar;
  monthPillar: Pillar;
  dayPillar: Pillar;
  hourPillar: Pillar;
  elementCounts: {
    Wood: number;
    Fire: number;
    Earth: number;
    Metal: number;
    Water: number;
  };
  missingElements: {
    element: string;
    priority: number; // 1 or 2
  }[];
  dayMasterReading: string; 
  chaeumAdvice: {
    summary: string;
    color: string;
    direction: string;
    items: string;
  };
  healthAnalysis: {
    weakOrgans: string;
    symptoms: string;
    medicalAdvice: string;
    foodRecommendation: string;
  };
  fortune2026: {
    overall: string;
    wealth: string;
    career: string;
    health: string;
    love: string;
  };
  luckyTable: LuckyDay[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}