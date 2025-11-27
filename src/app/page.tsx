'use client';

import { useState } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // For now, just show a placeholder
      // In the future, this will call the MCP API or use shared functions directly
      setResults({
        message: 'Query interface coming soon. MCP server is available at /{guid}/mcp (requires MCP_GUID)',
        query: query,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            BIC Grants MCP Server
          </h1>

          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              MCP server for querying grant transaction data from Beloved In Christ Foundation.
            </p>
            <div className="text-sm text-gray-500 space-y-2">
              <p>
                MCP endpoint: <code className="bg-gray-100 px-2 py-1 rounded">/{'{guid}'}/mcp</code>
                <br />
                <span className="text-xs text-gray-400">Requires MCP_GUID environment variable</span>
              </p>
              <p>
                <a 
                  href="/api/status" 
                  target="_blank"
                  className="text-indigo-600 hover:text-indigo-800 underline text-xs"
                >
                  Check endpoint status →
                </a>
                <span className="text-xs text-gray-400 ml-2">(Shows your configured endpoint URL)</span>
              </p>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Query Interface
            </h2>
            <p className="text-gray-600 mb-4">
              Web UI coming soon. For now, use ChatGPT Desktop or Cursor to interact with the MCP server.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                  Query
                </label>
                <input
                  id="query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
                  placeholder="Enter your query..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleQuery}
                disabled={loading || !query.trim()}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Querying...' : 'Query'}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {results && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="border-t mt-8 pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Available Tools
            </h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <strong>list_transactions</strong> - Search and filter grant transactions with advanced filtering, sorting, and grouping options
              </li>
              <li>
                <strong>list_grantees</strong> - List all grantees with aggregated totals, transaction counts, and summary data
              </li>
              <li>
                <strong>show_grantee</strong> - Show detailed grantee information including metadata and all transaction history
              </li>
              <li>
                <strong>aggregate_transactions</strong> - Aggregate transactions by category, grantee, year, international status, or status with summary statistics
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

