"use client";

import { useState } from "react";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { cli } from "@/lib/cli";
import { useWalletMode } from "@/lib/wallet/useWalletMode";

interface SearchResult {
  id: string;
  score: number;
  content: string;
}

export default function KnowledgePage() {
  const { connected } = useWalletMode();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || !connected) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const result = await cli.rag.search({ query: query.trim(), topK: 5 });
      if (result.success) {
        setResults(result.results || []);
      } else {
        setError(result.error || "Search failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-light tracking-tight text-[#0a0a5c]">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search company documents and knowledge base via P2P.
        </p>
      </div>

      {!connected ? (
        <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
          <BookOpen size={24} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 m-0">
            Connect your wallet to search the knowledge base.
          </p>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="bg-white border border-gray-200 rounded-md p-4 mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
                placeholder="Search documents..."
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 font-sans text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1A1AE8] rounded-md hover:bg-[#1515c0] disabled:opacity-50 transition"
              >
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Search
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={r.id || i} className="bg-white border border-gray-200 rounded-md p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700">
                      {(r.score * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-gray-400">match</span>
                  </div>
                  <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap">{r.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {results.length === 0 && !searching && !error && query && (
            <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
              <p className="text-sm text-gray-500 m-0">No results found</p>
            </div>
          )}

          {/* Initial state */}
          {results.length === 0 && !searching && !error && !query && (
            <div className="bg-white border border-gray-200 rounded-md p-10 text-center">
              <BookOpen size={24} className="mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500 m-0">
                Enter a query to search the knowledge base
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
