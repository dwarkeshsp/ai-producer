import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("Missing API keys. Please set GEMINI_API_KEY in your .env.local file");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// --- HELPER FUNCTIONS ---

/**
 * Parses the template library content into individual prompts.
 * Templates are separated by H1 headers (lines starting with '# ').
 * @param content The raw text content of the template document.
 * @returns An array of template objects with titles and prompts.
 */
function parseTemplates(content: string): { title: string; prompt: string } {
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
    const { transcript } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }

    // --- Fetch and Parse Templates from local file ---
    const templatesFilePath = path.join(process.cwd(), 'prompt-templates.md');
    const templateFileContent = fs.readFileSync(templatesFilePath, 'utf8');
    const templates = parseTemplates(templateFileContent);

    if (templates.length === 0) {
        return NextResponse.json({ error: 'No templates found in prompt-templates.md. Ensure they are separated by H1 headers (e.g., "# My Template").' }, { status: 400 });
    }

    // --- Get Transcript Content ---
    const transcriptContent = transcript; // Transcript is now always raw text

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