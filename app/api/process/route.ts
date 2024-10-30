import { NextResponse } from 'next/server';
import vision from '@google-cloud/vision';
import OpenAI from 'openai';
import path from 'path';

// Initialize Google Vision Client
const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(process.cwd(), 'google-vision-key.json'),
});

// Initialize OpenAI with environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  console.log('API endpoint hit');

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (file) {
      console.log('Processing file:', file.name);

      // Convert the uploaded file to a buffer for processing
      const buffer = Buffer.from(await file.arrayBuffer());

      // Use Google Vision API to detect text in the image
      const [result] = await client.textDetection(buffer);
      const detections = result.textAnnotations;
      const text = detections ? detections[0].description : '';

      console.log('Extracted text from image:', text);

      // Send the extracted text to GPT to parse event details
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts event details from text descriptions.",
          },
          {
            role: "user",
            content: `Extract event information from this text. Return a JSON object with the following fields:
             title, dates (array of all dates), location, description, and type (based of vibe of post issue a type.
                 some examples (though not limited to are: 'social', 'business', or 'entertainment'). Here is the text:\n\n${text}`,
          },
        ],
        max_tokens: 500,
      });

      // Parse GPT response
      const gptContent = response.choices[0]?.message?.content;
      const eventData = JSON.parse(gptContent || '{}');

      console.log('Parsed event data:', eventData);

      return NextResponse.json(eventData);
    }

    return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
