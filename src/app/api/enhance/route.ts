
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURATION ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GOOGLE_API_KEY || !GEMINI_API_KEY) {
  throw new Error("Missing API keys. Please set GOOGLE_API_KEY and GEMINI_API_KEY in your .env.local file");
}

const docs = google.docs({
  version: 'v1',
  auth: GOOGLE_API_KEY,
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- HELPER FUNCTIONS ---

/**
 * Extracts the Google Doc ID from a URL.
 * @param url The Google Doc URL.
 * @returns The document ID or null if not found.
 */
function extractGoogleDocId(url: string): string | null {
  const match = /\/document\/d\/([a-zA-Z0-9-_]+)/.exec(url);
  return match ? match[1] : null;
}

/**
 * Fetches the content of a public Google Doc.
 * @param docId The ID of the Google Doc.
 * @returns The text content of the document.
 */
async function getGoogleDocContent(docId: string): Promise<string> {
  try {
    const response = await docs.documents.get({
      documentId: docId,
    });
    const content = response.data.body?.content;
    if (!content) {
      return "";
    }
    return content
      .map((element) => {
        if (element.paragraph) {
          return element.paragraph.elements?.map((el) => el.textRun?.content || '').join('');
        }
        return '';
      })
      .join('');
  } catch (error) {
    console.error(`Error fetching Google Doc (ID: ${docId}):`, error);
    throw new Error(`Failed to fetch content from Google Doc. Please ensure it's public and the URL is correct.`);
  }
}

/**
 * Parses the template library content into individual prompts.
 * Templates are separated by H1 headers (lines starting with '# ').
 * @param content The raw text content of the template document.
 * @returns An array of template objects with titles and prompts.
 */
function parseTemplates(content: string): { title: string; prompt: string }[] {
  const templates: { title: string; prompt: string }[] = [];
  const lines = content.split('\n');
  let currentPrompt = '';
  let currentTitle = '';

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (currentTitle && currentPrompt) {
        templates.push({ title: currentTitle.trim(), prompt: currentPrompt.trim() });
      }
      currentTitle = line.substring(2);
      currentPrompt = '';
    } else {
      currentPrompt += line + '\n';
    }
  }

  if (currentTitle && currentPrompt) {
    templates.push({ title: currentTitle.trim(), prompt: currentPrompt.trim() });
  }

  return templates;
}

/**
 * The main handler for the /api/enhance endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const { transcript, templateDocUrl } = await req.json();

    if (!transcript || !templateDocUrl) {
      return NextResponse.json({ error: 'Missing transcript or templateDocUrl' }, { status: 400 });
    }

    const templateDocId = extractGoogleDocId(templateDocUrl);
    if (!templateDocId) {
      return NextResponse.json({ error: 'Invalid template Google Doc URL' }, { status: 400 });
    }

    // --- Fetch and Parse Templates ---
    const templateDocContent = await getGoogleDocContent(templateDocId);
    const templates = parseTemplates(templateDocContent);

    if (templates.length === 0) {
        return NextResponse.json({ error: 'No templates found in the document. Ensure they are separated by H1 headers (e.g., "# My Template").' }, { status: 400 });
    }

    // --- Get Transcript Content ---
    let transcriptContent = '';
    const transcriptDocId = extractGoogleDocId(transcript);
    if (transcriptDocId) {
      transcriptContent = await getGoogleDocContent(transcriptDocId);
    } else {
      transcriptContent = transcript; // Assume it's raw text
    }

    // --- Run AI Processing in Parallel ---
    const enhancementPromises = templates.map(async (template) => {
      const fullPrompt = `
        ${template.prompt}

        ---
        TRANSCRIPT:
        ---
        ${transcriptContent}
      `;
      
      try {
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        return { title: template.title, content: text };
      } catch (error) {
        console.error(`Error processing template "${template.title}":`, error);
        return { title: template.title, content: "Error: Could not process this template." };
      }
    });

    const results = await Promise.all(enhancementPromises);

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error("Error in /api/enhance:", error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
