import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates summaries and extracts key points from text. Provide: 1) A concise summary 2) Key points in bullet points 3) If applicable, suggest hooks or memorable quotes."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
    });

    return NextResponse.json({
      summary: completion.choices[0].message.content
    });
  } catch (error) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      { error: 'Summarization failed' },
      { status: 500 }
    );
  }
} 