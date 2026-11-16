const APP_CONFIG = {
    SUPABASE_URL: "https://ponfmgibzdhforflmokk.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmZtZ2liemRoZm9yZmxtb2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTc5MzAsImV4cCI6MjExMDMzMzkzMH0.xpdZuIJb3cz64NC3sW3c3xcUVHp7pAQ4_k9DRdKCgng"
};

const supabaseClient = window.supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
);