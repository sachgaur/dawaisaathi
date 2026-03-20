import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 });

    const VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!VISION_API_KEY || VISION_API_KEY === 'your-api-key') {
      return NextResponse.json({ error: 'Google Cloud Vision API key is missing. Ensure you have added it to your .env.local file.' }, { status: 500 });
    }

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Vision API failed');

    const textAnnotations = data.responses[0]?.textAnnotations;
    // The first item in textAnnotations contains the entire string of extracted text
    const rawText = textAnnotations && textAnnotations.length > 0 ? textAnnotations[0].description : '';

    return NextResponse.json({ rawText, success: true });
  } catch (error: any) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred during OCR' }, { status: 500 });
  }
}
