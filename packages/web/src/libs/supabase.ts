import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  return createSupabaseClient(supabaseUrl, supabaseKey);
};
