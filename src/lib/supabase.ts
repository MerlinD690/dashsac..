
import { createClient } from '@supabase/supabase-js'
import type { Agent, PauseLog, DailyReport } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Type definition for Supabase schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Omit<Agent, 'id'> & { id?: string };
        Update: Partial<Agent>;
      }
      pause_logs: {
        Row: PauseLog;
        Insert: Omit<PauseLog, 'id'> & { id?: number };
        Update: Partial<PauseLog>;
      }
      daily_reports: {
        Row: DailyReport;
        Insert: DailyReport;
        Update: Partial<DailyReport>;
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
