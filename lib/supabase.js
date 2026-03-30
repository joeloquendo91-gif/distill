import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isConfigured =
  supabaseUrl?.startsWith("http") && supabaseKey && supabaseKey !== "your_supabase_anon_key";

// Returns a no-op stub when Supabase credentials aren't configured (local dev without DB)
function createStub() {
  const stub = { data: null, error: { message: "Supabase not configured" } };
  const chain = { select: () => chain, eq: () => chain, single: () => Promise.resolve(stub), then: (fn) => Promise.resolve(stub).then(fn) };
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signOut: () => Promise.resolve(),
    },
    from: () => ({ select: () => chain, update: () => ({ eq: () => Promise.resolve(stub) }), insert: () => Promise.resolve(stub) }),
    rpc: () => Promise.resolve(stub),
  };
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createStub();
