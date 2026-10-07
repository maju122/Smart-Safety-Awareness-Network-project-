import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mdvlqvwwzeuztybrwsga.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_udSzQL-MPZQDgDHupm_UPw_SEUAgqDY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
