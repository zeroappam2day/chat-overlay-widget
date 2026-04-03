import { createPortal } from 'react-dom';
import { usePlanStore } from '../store/planStore';
import { useFeatureFlagStore } from '../store/featureFlagStore';

/** Simple regex-based markdown renderer — no external deps required. */
function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const output: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLanguage = '';

  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;');

  const renderInline = (s: string): string => {
    // Inline code: `code`
    s = s.replace(/`([^`]+)`/g, '<code class="bg-[#333] text-gray-300 px-1 rounded text-xs font-mono">$1</code>');
    // Bold: **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-gray-200 font-semibold">$1</strong>');
    // Italic: *text*
    s = s.replace(/\*([^*]+)\*/g, '<em class="text-gray-300 italic">$1</em>');
    return s;
  };

  for (const rawLine of lines) {
    const line = rawLine;

    // Code block start/end
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        const codeContent = escapeHtml(codeLines.join('\n'));
        const langClass = codeLanguage ? ` data-lang="${escapeHtml(codeLanguage)}"` : '';
        output.push(`<pre class="bg-[#1a1a1a] border border-[#333] rounded p-2 my-1.5 overflow-x-auto text-xs"${langClass}><code class="text-gray-300 font-mono">${codeContent}</code></pre>`);
        codeLines = [];
        codeLanguage = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      output.push(`<h3 class="text-gray-200 font-semibold text-sm mt-3 mb-1">${renderInline(escapeHtml(line.slice(4)))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      output.push(`<h2 class="text-gray-100 font-semibold text-base mt-4 mb-1.5 border-b border-[#333] pb-0.5">${renderInline(escapeHtml(line.slice(3)))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      output.push(`<h1 class="text-gray-100 font-bold text-lg mt-4 mb-2">${renderInline(escapeHtml(line.slice(2)))}</h1>`);
      continue;
    }

    // Checkbox list items
    if (line.match(/^- \[x\] /i)) {
      const text = renderInline(escapeHtml(line.slice(6)));
      output.push(`<div class="flex items-start gap-1.5 text-xs text-gray-500 line-through ml-2 my-0.5"><span class="mt-0.5 text-green-500">&#10003;</span><span>${text}</span></div>`);
      continue;
    }
    if (line.match(/^- \[ \] /)) {
      const text = renderInline(escapeHtml(line.slice(6)));
      output.push(`<div class="flex items-start gap-1.5 text-xs text-gray-400 ml-2 my-0.5"><span class="mt-0.5 text-gray-600">&#9633;</span><span>${text}</span></div>`);
      continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = renderInline(escapeHtml(line.slice(2)));
      output.push(`<div class="flex items-start gap-1.5 text-xs text-gray-400 ml-2 my-0.5"><span class="text-gray-600 mt-0.5">•</span><span>${text}</span></div>`);
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === '') {
      output.push('<div class="h-1.5"></div>');
      continue;
    }

    // Default paragraph
    output.push(`<p class="text-xs text-gray-400 my-0.5 leading-relaxed">${renderInline(escapeHtml(line))}</p>`);
  }

  return output.join('\n');
}

export function PlanPanel() {
  const planWatcher = useFeatureFlagStore((s) => s.planWatcher);
  const { content, fileName, visible, toggleVisible } = usePlanStore();

  // Gate: if flag is OFF, render nothing
  if (!planWatcher) return null;
  // Gate: if not visible or no content, render nothing
  if (!visible || content === null) return null;

  const renderedHtml = renderMarkdown(content);

  const panel = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 320,
        height: '100vh',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
      className="bg-[#1e1e1e] border-l border-[#404040] shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#404040] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#007acc" className="shrink-0">
            <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
          </svg>
          <span
            className="text-xs text-gray-300 font-medium truncate"
            title={fileName ?? 'Plan'}
          >
            {fileName ?? 'Plan'}
          </span>
        </div>
        <button
          onClick={toggleVisible}
          className="text-gray-600 hover:text-gray-300 transition-colors ml-2 shrink-0"
          title="Close plan panel"
          aria-label="Close plan panel"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        <div
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
