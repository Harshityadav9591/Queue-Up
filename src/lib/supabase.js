import { createClient } from '@supabase/supabase-js'
import { createSampleClient } from './demo/supabaseDemo'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Without Supabase keys the app runs on a sample account kept in this browser (see lib/demo)
export const isSampleAccount = !supabaseUrl || !supabaseAnonKey

export const supabase = isSampleAccount ? createSampleClient() : createClient(supabaseUrl, supabaseAnonKey)
