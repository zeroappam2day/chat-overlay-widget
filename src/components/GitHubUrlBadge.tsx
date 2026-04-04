import { useState, useMemo, useEffect } from 'react';
import { extractGitHubUrl, parseGitHubUrl, formatGitHubRef } from '../lib/githubUrl';
import { useFeatureFlagStore } from '../store/featureFlagStore';

interface GitHubUrlBadgeProps {
  text: string;
}

export function GitHubUrlBadge({ text }: GitHubUrlBadgeProps) {
  const enabled = useFeatureFlagStore((s) => s.githubUrlDetection);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    const url = extractGitHubUrl(text);
    if (!url) return null;
    return parseGitHubUrl(url);
  }, [text]);

  // Reset copied state when text changes
  useEffect(() => {
    setCopied(false);
  }, [text]);

  if (!enabled || !parsed) return null;

  const formatted = formatGitHubRef(parsed);

  const handleClick = () => {
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex items-center px-2 shrink-0">
      <button
        onClick={handleClick}
        className="flex items-center gap-1 px-2 rounded-full text-xs cursor-pointer transition-opacity hover:opacity-80"
        style={{
          height: '20px',
          backgroundColor: '#1a3a5c',
          color: '#58a6ff',
        }}
        title={copied ? 'Copied!' : `Click to copy: ${formatted}`}
      >
        <span>🔗</span>
        <span>{copied ? 'Copied!' : formatted}</span>
      </button>
    </div>
  );
}
