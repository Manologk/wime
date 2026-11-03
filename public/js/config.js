// Site configuration — the only file you need to edit to go live.
// The Supabase anon key is meant to be public; Row Level Security protects the data.

export const config = {
  storeName: 'Wime Innovation',

  // Supabase → Project Settings → API
  supabaseUrl: 'https://tpxobgpkggxhzwufrddg.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRweG9iZ3BrZ2d4aHp3dWZyZGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NTE3NTIsImV4cCI6MjEwOTEyNzc1Mn0.tRixEyEdO0bbpopX0sW__JGyD0BL4LsitI736R5D-0A',

  // WhatsApp number that receives orders: international format, digits only,
  // no "+" or leading zero. e.g. Zambia 097 123 4567 → '260971234567'
  whatsappNumber: '260975800939',

  // ISO 4217 currency code + locale used to format prices
  currency: 'ZMW',
  locale: 'en-ZM',
};
