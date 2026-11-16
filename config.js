const APP_CONFIG = {
    // 1. Supabase Project Settings -> API
    SUPABASE_URL: "https://ponfmgibzdhforflmokk.supabase.co/rest/v1/",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmZtZ2liemRoZm9yZmxtb2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NTc5MzAsImV4cCI6MjExMDMzMzkzMH0.xpdZuIJb3cz64NC3sW3c3xcUVHp7pAQ4_k9DRdKCgng",

    // 2. Optional 1-hour post-close Google Apps Script backup URL
    GOOGLE_BACKUP_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbxoEvrN09lMGnEZzOHqz4Cu6WXfTrrPS2YO5lqS4DucOuaETYzlmmcvrfbtQU8ie-FZ/exec",

    // 3. Admin security passcodes
    PASSWORD_REVEAL_KEY: "TObilobA2026",
    DELETED_ACCOUNT_DELETE_KEY: "TOBIloba2026"
};

const supabaseClient = window.supabase.createClient(
    APP_CONFIG.SUPABASE_URL,
    APP_CONFIG.SUPABASE_ANON_KEY
);