const APP_CONFIG = {
    // 1. Supabase Project Settings -> API
    SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
    SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_PUBLIC_KEY",

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