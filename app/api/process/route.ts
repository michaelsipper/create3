import { NextResponse } from 'next/server';
import vision from '@google-cloud/vision';
import OpenAI from 'openai';
import puppeteer from 'puppeteer';

// Check for required environment variables
if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
  throw new Error('GOOGLE_CLOUD_PROJECT_ID is not defined');
}
if (!process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
  throw new Error('GOOGLE_CLOUD_PRIVATE_KEY is not defined');
}
if (!process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
  throw new Error('GOOGLE_CLOUD_CLIENT_EMAIL is not defined');
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined');
}

// Initialize Google Vision Client using environment variables
const client = new vision.ImageAnnotatorClient({
  credentials: {
    project_id: process.env.GOOGLE_CLOUD_PROJECT_ID as string,
    private_key: (process.env.GOOGLE_CLOUD_PRIVATE_KEY as string).replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL as string,
  },
});

// Initialize OpenAI with environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to parse dates and times into ISO format
function parseDateTimeString(dateTimeString: string): string | null {
  try {
    const currentYear = new Date().getFullYear();
    
    // Handle short date formats like "10/25" or "10/25/19"
    const shortDateRegex = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
    const match = dateTimeString.match(shortDateRegex);
    
    if (match) {
      const [_, month, day, yearPart] = match;
      let year = yearPart ? parseInt(yearPart) : currentYear;
      
      // Convert 2-digit year to full year
      if (year < 100) {
        // If the 2-digit year would result in a past date, assume it's for the next occurrence
        year = year + 2000;
        const proposedDate = new Date(year, parseInt(month) - 1, parseInt(day));
        if (proposedDate < new Date()) {
          year = currentYear;
        }
      }
      
      // For any date that's already passed this year, assume next year
      const proposedDate = new Date(year, parseInt(month) - 1, parseInt(day));
      if (proposedDate < new Date()) {
        year = currentYear + 1;
      }
      
      // Default time based on event type (will be overridden if time is specified)
      let defaultHour = 19; // 7 PM default
      let defaultMinute = 0;
      
      // Look for time in the original string
      const timeMatch = dateTimeString.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if (timeMatch) {
        const [_, hours, minutes, meridiem] = timeMatch;
        let hour = parseInt(hours);
        if (meridiem?.toLowerCase() === 'pm' && hour < 12) hour += 12;
        if (meridiem?.toLowerCase() === 'am' && hour === 12) hour = 0;
        defaultHour = hour;
        defaultMinute = parseInt(minutes);
      }
      
      const finalDate = new Date(year, parseInt(month) - 1, parseInt(day), defaultHour, defaultMinute);
      return finalDate.toISOString();
    }
    
    // If no match, try direct parsing
    const date = new Date(dateTimeString);
    if (!isNaN(date.getTime())) {
      // If the parsed date is in the past, adjust to next year
      if (date < new Date()) {
        date.setFullYear(currentYear + 1);
      }
      return date.toISOString();
    }

    return null;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
}

export async function POST(req: Request) {
  console.log('API endpoint hit');

  try {
    const formData = await req.formData();
    const url = formData.get('url') as string | null;
    const file = formData.get('image') as File | null;

    const currentYear = new Date().getFullYear();
    
    const systemPrompt = `You are a helpful assistant that extracts event details from text descriptions. 
    Pay special attention to dates and times:
    - Always look for both date AND time information
    - Today's date is ${new Date().toLocaleDateString()} and the current year is ${currentYear}
    - If a year isn't specified, ask yourself what year is it at this moment, and use the current year.
    - If the event includes dates that have already passed, use the next nearest date from today's.
    - For dates without times specified, use contextual clues about the event type:
      * Evening events (parties, shows): default to 7:00 PM
      * Morning events (brunches, races): default to 9:00 AM
      * Business events: default to 10:00 AM
    - Look for time zone information, defaulting to local time if none is specified
    - Handle relative dates like "tomorrow", "next Friday", etc.
    - Recognize various time formats (12-hour, 24-hour, written out)
    
    Return a JSON object with these fields:
    - title: string (the event name)
    - dates: string[] (array of all mentioned dates with times, in formats like "March 15, ${currentYear} 7:30 PM" or "${currentYear}-03-15 19:30")
    - location: { name: string, address?: string }
    - description: string
    - type: "social" | "business" | "entertainment"
    `;

    let extractedText = '';

    // Handle URL processing with Puppeteer
    if (url) {
      console.log('Processing URL:', url);
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });
      extractedText = await page.evaluate(() => document.body.innerText);
      await browser.close();
    }

    // Handle Image processing with Google Vision
    if (file) {
      console.log('Processing file:', file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      const [result] = await client.textDetection(buffer);
      const detections = result.textAnnotations;
      extractedText = detections ? detections[0].description : '';
    }

    if (!extractedText) {
      return NextResponse.json({ error: 'No text could be extracted' }, { status: 400 });
    }

    console.log('Extracted text:', extractedText);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Extract event information from this text:\n\n${extractedText}`,
        },
      ],
      max_tokens: 500,
    });

    const gptContent = response.choices[0]?.message?.content;
    const rawEventData = JSON.parse(gptContent || '{}');

    // Process and format the dates
    const processedEventData = {
      ...rawEventData,
      datetime: rawEventData.dates && rawEventData.dates.length > 0 
        ? parseDateTimeString(rawEventData.dates[0])
        : null,
      // Keep the original dates array for reference
      allDates: rawEventData.dates?.map((date: string) => ({
        original: date,
        parsed: parseDateTimeString(date)
      }))
    };

    console.log('Processed event data:', processedEventData);

    if (!processedEventData.datetime) {
      console.warn('Could not parse any valid dates from:', rawEventData.dates);
    }

    return NextResponse.json(processedEventData);

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}