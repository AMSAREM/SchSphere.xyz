import React from 'npm:react@18.3.1'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  supabaseUrl: string
  token: string
  tokenHash: string
  redirectTo: string
  emailActionType: string
}

function MagicLinkEmail(props: MagicLinkEmailProps) {
  const href = `${props.supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(
    props.tokenHash,
  )}&type=${encodeURIComponent(
    props.emailActionType,
  )}&redirect_to=${encodeURIComponent(props.redirectTo)}`

  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(Preview, null, 'Log in to SchoolSphere'),
    React.createElement(
      Body,
      { style: { backgroundColor: '#ffffff', margin: '0', padding: '0', fontFamily: 'system-ui, -apple-system, sans-serif' } },
      React.createElement(
        Container,
        { style: { padding: '32px 16px', margin: '0 auto', maxWidth: '560px' } },
        React.createElement(
          Heading,
          { style: { fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px' } },
          'SchoolSphere Authentication',
        ),
        React.createElement(
          Text,
          { style: { fontSize: '15px', lineHeight: '1.6', color: '#334155', margin: '16px 0' } },
          'Click the secure button below to sign in to your SchoolSphere account.',
        ),
        React.createElement(
          Link,
          {
            href,
            target: '_blank',
            style: {
              display: 'inline-block',
              padding: '14px 24px',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '15px',
              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
            },
          },
          'Sign in to SchoolSphere',
        ),
        React.createElement(
          Text,
          { style: { fontSize: '14px', color: '#64748b', margin: '24px 0 8px' } },
          'Or use this direct one-time verification code:',
        ),
        React.createElement(
          Text,
          {
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '2px',
              backgroundColor: '#f1f5f9',
              color: '#1e293b',
              padding: '12px 18px',
              borderRadius: '8px',
              display: 'inline-block',
              border: '1px solid #e2e8f0',
            },
          },
          props.token,
        ),
        React.createElement(
          Text,
          { style: { fontSize: '12px', color: '#94a3b8', marginTop: '32px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' } },
          "If you didn't request this email, you can safely ignore this message.",
        ),
      ),
    ),
  )
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is required')

const HOOK_SECRET_RAW = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
if (!HOOK_SECRET_RAW)
  throw new Error('SEND_EMAIL_HOOK_SECRET is required')
const HOOK_SECRET = HOOK_SECRET_RAW.replace('v1,whsec_', '')

const resend = new Resend(RESEND_API_KEY)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  let data: any
  try {
    const wh = new Webhook(HOOK_SECRET)
    data = wh.verify(payload, headers)
  } catch (err) {
    console.error('Webhook verify error:', err)
    return new Response('unauthorized', { status: 401 })
  }

  try {
    const {
      user,
      email_data: {
        token,
        token_hash,
        redirect_to,
        email_action_type,
      },
    } = data as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    if (!supabaseUrl) throw new Error('SUPABASE_URL is missing')

    const html = await renderAsync(
      React.createElement(MagicLinkEmail, {
        supabaseUrl,
        token,
        tokenHash: token_hash,
        redirectTo: redirect_to,
        emailActionType: email_action_type,
      }),
    )

    const { error } = await resend.emails.send({
      from: 'SchoolSphere <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Login to SchoolSphere',
      html,
    })

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Email send error:', err)
    return new Response(
      JSON.stringify({ error: { message: (err as Error)?.message } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
