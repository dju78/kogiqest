import '@testing-library/jest-dom/vitest';

// The app reads these at import time; tests supply their own client anyway.
import.meta.env.VITE_SUPABASE_URL ||= 'https://test.supabase.co';
import.meta.env.VITE_SUPABASE_ANON_KEY ||= 'test-anon-key';
