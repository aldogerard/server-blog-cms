import supabase from "@supabase/supabase-js";
import "dotenv/config";

const db = supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
);

export default db;
