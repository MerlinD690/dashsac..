
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Agent, PauseLog, DailyReport } from './types';

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

let supabaseClient: SupabaseClient<Database> | null = null;

export const getSupabase = () => {
    if (supabaseClient) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'YOUR_SUPABASE_URL') {
        throw new Error('Supabase URL and anonymous key are required. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.');
    }
    
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
    return supabaseClient;
}
