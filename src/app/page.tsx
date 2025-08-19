'use client';

import { useState } from 'react';

// --- TYPE DEFINITIONS ---
type ResultCard = {
  title: string;
  content: string;
};

// --- HELPER COMPONENTS ---

const ResultCardDisplay = ({ title, content }: ResultCard) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <button
          onClick={handleCopy}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap">{content}</div>
    </div>
  );
};

const Loader = () => (
    <div className="flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500">Processing with AI... This may take a moment.</p>
    </div>
);

// --- MAIN PAGE COMPONENT ---

export default function HomePage() {
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<ResultCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An unknown error occurred.');
      }

      setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800">AI Transcript Enhancer</h1>
          <p className="mt-4 text-lg text-gray-500">Paste a transcript and get AI-powered enhancements based on a local template library.</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 space-y-6">
            <div>
              <label htmlFor="transcript" className="block text-sm font-medium text-gray-700 mb-2">Transcript</label>
              <textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste your full transcript text here..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                rows={12}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
              {isLoading ? 'Processing...' : 'Generate'}
            </button>
          </form>
        </div>

        {isLoading && (
          <div className="mt-12">
            <Loader />
          </div>
        )}

        {error && (
          <div className="mt-12 max-w-2xl mx-auto p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg">
            <p><span className="font-bold">Error:</span> {error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-16 grid gap-8 max-w-4xl mx-auto">
            {results.map((result, index) => (
              <ResultCardDisplay key={index} title={result.title} content={result.content} />
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
