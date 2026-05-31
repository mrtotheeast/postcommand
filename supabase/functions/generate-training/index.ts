// AI Training Content Generator — Anthropic Claude
// Given a topic and audience, generates a complete training course
// Env vars: ANTHROPIC_API_KEY

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { topic, audience = 'security officers', duration_minutes = 30, company_name = 'PostCommand' } = await req.json()
    if (!topic?.trim()) throw new Error('topic is required')

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      system: `You are a professional security training course writer specializing in private security, law enforcement support, and workplace safety.
You write clear, practical training content for ${audience} at security companies.
Your courses are professional, legally sound, and reference applicable standards and best practices.
Always include real-world scenarios and clear actionable guidance.`,
      messages: [{
        role: 'user',
        content: `Create a complete training course for ${company_name} on the topic: "${topic}"

Target audience: ${audience}
Estimated duration: ${duration_minutes} minutes

Return a JSON object with exactly these fields:
{
  "title": "Course title (concise, professional)",
  "description": "2-3 sentence summary for the course card",
  "content": "Full course text (minimum 400 words). Include: Learning Objectives, Key Concepts with explanations, Practical Guidelines, Common Mistakes to Avoid, and a Summary. Use clear headings. Write in plain text, no markdown."
}

Return ONLY the JSON object, no other text.`
      }]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Model did not return valid JSON')

    const course = JSON.parse(jsonMatch[0])
    if (!course.title || !course.description || !course.content) throw new Error('Incomplete course data from model')

    return new Response(JSON.stringify(course), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
