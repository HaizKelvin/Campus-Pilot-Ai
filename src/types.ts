export type Mood = 'Light' | 'Moderate' | 'Heavy' | 'Critical';
export type BudgetRisk = 'Low' | 'Medium' | 'High';
export type StressLevel = 'Low' | 'Medium' | 'High';
export type FocusState = 'Good' | 'Distracted' | 'Overloaded';

export interface AcademicData {
  courses: { id: string; name: string; credit: number; grade: string }[];
  assignments: { id: string; title: string; deadline: string; priority: number }[];
  gpa: number;
}

export interface FinancialData {
  rent: number;
  food: number;
  transport: number;
  study: number;
  income: number;
}

export interface HealthData {
  weight: number;
  activityLevel: 'low' | 'medium' | 'high';
  mealsToday: string[];
}

export interface WellbeingData {
  stress: StressLevel;
  focus: FocusState;
  sleepHours: number;
}

export interface StudentProfile {
  name: string;
  university: string;
  year: number;
  isInternational: boolean;
}

export interface AppState {
  profile: StudentProfile;
  academics: AcademicData;
  finance: FinancialData;
  health: HealthData;
  wellbeing: WellbeingData;
  subscription?: {
    status: 'trial' | 'active' | 'expired';
    startDate: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface UserAuthData {
  uid: string;
  email: string;
  webauthnCredentials?: string[]; // IDs of credentials
}
