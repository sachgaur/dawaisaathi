import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing. Add it to .env.local' }, { status: 500 });
    }

    // 1. Download the image from Supabase to send to Gemini
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("Failed to fetch image from Supabase public URL");
    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // 2. Construct the Gemini payload
    const prompt = `You are an expert medical assistant reading a handwritten doctor's prescription from India.
Extract the distinct medicines from the image and return a strict JSON array. Each object should have exactly:
- "name": string (Medicine name along with dosage like 500mg if visible)
- "dosage": string (e.g. 1 tablet, 5ml, 2 drops)
- "frequency": string (e.g. Morning, Night, Twice a day, After food)
- "instructions": string (Any specific notes, or empty string)

If the handwriting is completely illegible or it is not a prescription at all, just return an empty array [].
CRITICAL: Respond ONLY with the raw JSON array. Do not include markdown formatting like \`\`\`json.`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1, // Low temperature for high precision reading
      }
    };

    // 3. Call Gemini 2.5 Flash Multimodal (Super Fast for UX)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await geminiResponse.json();
    if (!geminiResponse.ok) throw new Error(data.error?.message || 'Gemini API failed');

    let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Defensive cleanup just in case the LLM returned markdown
    textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

    return NextResponse.json({ rawText: textResponse, success: true });
  } catch (error: any) {
    console.error('Gemini OCR Error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred during AI extraction' }, { status: 500 });
  }
}
