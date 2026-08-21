import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { name } = await req.json().catch(() => ({ name: 'World' }))
  const data = {
    message: `Hello ${name}! Supabase Edge Function operational.`,
    timestamp: new Date().toISOString(),
  }

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  )
})
