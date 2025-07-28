
'use server';

import { getSupabase } from '@/lib/supabase';
import { Agent, PauseLog, DailyReport } from '@/lib/types';
import { format } from 'date-fns';

export async function clearAndSeedAgents(agents: Agent[]) {
  const supabase = getSupabase();
  // Clear existing agents
  const { error: deleteError } = await supabase
    .from('agents')
    .delete()
    .neq('id', 'this-is-a-placeholder-to-delete-all-rows');
  
  if (deleteError) {
      console.error("Error clearing agents:", deleteError);
      throw deleteError;
  }
  
  console.log("Existing agents cleared.");

  // Seed new agents
  const { error: insertError } = await supabase
    .from('agents')
    .insert(agents);

  if (insertError) {
      console.error("Error seeding agents:", insertError);
      throw insertError;
  }
  
  console.log("New agents seeded.");
}


export async function updateAgent(agentId: string, data: Partial<Agent>) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('agents')
    .update(data)
    .eq('id', agentId);
    
  if (error) {
    console.error(`Error updating agent ${agentId}:`, error);
    throw error;
  }
}

export async function addPauseLog(log: Omit<PauseLog, 'id'>) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('pause_logs')
    .insert([log]);

  if (error) {
    console.error('Error adding pause log:', error);
    throw error;
  }
}

export async function getPauseLogsInRange(startDate: Date, endDate: Date): Promise<PauseLog[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('pause_logs')
        .select('*')
        .gte('pause_start_time', startDate.toISOString())
        .lte('pause_start_time', endDate.toISOString());

    if (error) {
        console.error('Error fetching pause logs:', error);
        return [];
    }

    return data;
}

export async function addDailyReport(report: Omit<DailyReport, 'date'>) {
    const supabase = getSupabase();
    const today = format(new Date(), 'yyyy-MM-dd');
    const reportWithDate: DailyReport = {
        ...report,
        date: today,
    };

    // Use upsert to create or overwrite the report for the same day
    const { error } = await supabase
        .from('daily_reports')
        .upsert(reportWithDate, { onConflict: 'date' });

    if (error) {
        console.error('Error adding daily report:', error);
        throw error;
    }
}

export async function getDailyReports(days = 30): Promise<DailyReport[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .order('date', { ascending: false })
        .limit(days);
    
    if (error) {
        console.error('Error fetching daily reports:', error);
        return [];
    }

    return data;
}
