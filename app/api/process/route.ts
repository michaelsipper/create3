import { NextResponse } from 'next/server'

const OCR_API_KEY = 'YOUR_API_KEY' // Replace with your key from ocr.space

export async function POST(req: Request) {
  console.log('API endpoint hit')
  
  try {
    const formData = await req.formData()
    console.log('FormData received')
    
    const file = formData.get('image') as File | null
    const url = formData.get('url') as string | null
    
    console.log('File:', file?.name)
    console.log('URL:', url)

    if (file) {
      console.log('Processing image file:', file.name)
      
      // Convert File to base64
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64Image = buffer.toString('base64')

      // Call OCR.space API
      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': OCR_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Image: `data:${file.type};base64,${base64Image}`,
          language: 'eng',
          detectOrientation: true,
          scale: true,
          isTable: false,
        }),
      })

      const ocrData = await ocrResponse.json()
      console.log('OCR Response:', ocrData)

      const extractedText = ocrData.ParsedResults?.[0]?.ParsedText || ''
      console.log('Extracted text:', extractedText)

      return NextResponse.json({
        title: "Extracted Event",
        datetime: new Date().toISOString(),
        location: {
          name: "Extracted Location",
        },
        description: extractedText
      })
    }

    if (url) {
      // Handle URL processing later
      return NextResponse.json({
        title: "Event from URL",
        datetime: new Date().toISOString(),
        location: {
          name: "URL Location",
        },
        description: "URL processing to be implemented"
      })
    }

    return NextResponse.json(
      { error: 'No image or URL provided' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}