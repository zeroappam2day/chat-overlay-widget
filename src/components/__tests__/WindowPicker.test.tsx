// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WindowPicker } from '../WindowPicker';
import type { WindowThumbnail } from '../../protocol';

afterEach(() => {
  cleanup();
});

const mockWindows: WindowThumbnail[] = [
  { title: 'Google Chrome', processName: 'chrome.exe', thumbnail: 'iVBORw0KGgo=' },
  { title: 'VS Code', processName: 'code.exe', thumbnail: 'iVBORw0KGgo=' },
  { title: 'File Explorer', processName: 'explorer.exe', thumbnail: 'iVBORw0KGgo=' },
  { title: 'Broken Window', processName: 'broken.exe', error: 'MINIMIZED' },
];

// ============================================================
// PICK-01: Grid rendering
// ============================================================
describe('PICK-01: Grid rendering', () => {
  it('renders one card per window', () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const cards = screen.getAllByTestId('picker-card');
    expect(cards).toHaveLength(4);
  });

  it('each card shows title and processName text', () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    expect(screen.getByText('Google Chrome')).toBeInTheDocument();
    expect(screen.getByText('chrome.exe')).toBeInTheDocument();
    expect(screen.getByText('VS Code')).toBeInTheDocument();
    expect(screen.getByText('code.exe')).toBeInTheDocument();
  });

  it('card with thumbnail renders an img with base64 src', () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const images = screen.getAllByRole('img');
    // First 3 windows have thumbnails
    expect(images.length).toBeGreaterThanOrEqual(3);
    images.forEach((img) => {
      expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    });
  });

  it('card with error field renders error text placeholder', () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    expect(screen.getByText('MINIMIZED')).toBeInTheDocument();
  });
});

// ============================================================
// PICK-02: Keyboard navigation
// ============================================================
describe('PICK-02: Keyboard navigation', () => {
  it('ArrowRight moves selectedIndex from 0 to 1 (second card gets highlight class)', () => {
    const { container } = render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const picker = container.firstChild as HTMLElement;
    fireEvent.keyDown(picker, { key: 'ArrowRight' });
    const cards = screen.getAllByTestId('picker-card');
    expect(cards[1].className).toContain('border-[#007acc]');
    expect(cards[0].className).not.toContain('border-[#007acc]');
  });

  it('ArrowLeft at index 0 stays at 0 (does not go negative)', () => {
    const { container } = render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const picker = container.firstChild as HTMLElement;
    fireEvent.keyDown(picker, { key: 'ArrowLeft' });
    const cards = screen.getAllByTestId('picker-card');
    expect(cards[0].className).toContain('border-[#007acc]');
  });

  it('ArrowDown moves selectedIndex by cols (3) — from 0 to 3', () => {
    const { container } = render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const picker = container.firstChild as HTMLElement;
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    const cards = screen.getAllByTestId('picker-card');
    expect(cards[3].className).toContain('border-[#007acc]');
  });

  it('ArrowUp from index 3 moves back to index 0', () => {
    const { container } = render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const picker = container.firstChild as HTMLElement;
    // First go down to index 3
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    // Then go back up
    fireEvent.keyDown(picker, { key: 'ArrowUp' });
    const cards = screen.getAllByTestId('picker-card');
    expect(cards[0].className).toContain('border-[#007acc]');
  });

  it('Escape calls onClose mock', () => {
    const onClose = vi.fn();
    const { container } = render(
      <WindowPicker windows={mockWindows} onClose={onClose} onRefresh={vi.fn()} />
    );
    const picker = container.firstChild as HTMLElement;
    fireEvent.keyDown(picker, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('arrow key events call stopPropagation (wrapper spy not called)', () => {
    const wrapperSpy = vi.fn();
    const { container } = render(
      <div onKeyDown={wrapperSpy}>
        <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
      </div>
    );
    const picker = container.firstChild?.firstChild as HTMLElement;
    fireEvent.keyDown(picker, { key: 'ArrowRight' });
    // stopPropagation prevents the event from bubbling to the wrapper
    expect(wrapperSpy).not.toHaveBeenCalled();
  });
});

// ============================================================
// PICK-03: Refresh button
// ============================================================
describe('PICK-03: Refresh button', () => {
  it('clicking Refresh button calls onRefresh mock', async () => {
    const onRefresh = vi.fn();
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={onRefresh} />
    );
    const user = userEvent.setup();
    await user.click(screen.getByText('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('clicking Refresh button does NOT call onClose mock', async () => {
    const onClose = vi.fn();
    const onRefresh = vi.fn();
    render(
      <WindowPicker windows={mockWindows} onClose={onClose} onRefresh={onRefresh} />
    );
    const user = userEvent.setup();
    await user.click(screen.getByText('Refresh'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ============================================================
// THUMB-04: Search filter
// ============================================================
describe('THUMB-04: Search filter', () => {
  it('typing "chrome" filters to only windows containing chrome (case-insensitive)', async () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Filter by title or process...');
    await user.type(input, 'chrome');
    const cards = screen.getAllByTestId('picker-card');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('Google Chrome')).toBeInTheDocument();
  });

  it('typing a string matching no windows shows "No matching windows"', async () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Filter by title or process...');
    await user.type(input, 'xyzzy_no_match_999');
    expect(screen.getByText('No matching windows')).toBeInTheDocument();
    expect(screen.queryAllByTestId('picker-card')).toHaveLength(0);
  });

  it('clearing search shows all windows again', async () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Filter by title or process...');
    await user.type(input, 'chrome');
    expect(screen.getAllByTestId('picker-card')).toHaveLength(1);
    await user.clear(input);
    expect(screen.getAllByTestId('picker-card')).toHaveLength(4);
  });

  it('filter matches on processName (explorer matches explorer.exe)', async () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Filter by title or process...');
    await user.type(input, 'explorer');
    const cards = screen.getAllByTestId('picker-card');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('File Explorer')).toBeInTheDocument();
  });

  it('search is case-insensitive (CHROME matches Google Chrome)', async () => {
    render(
      <WindowPicker windows={mockWindows} onClose={vi.fn()} onRefresh={vi.fn()} />
    );
    const user = userEvent.setup();
    const input = screen.getByPlaceholderText('Filter by title or process...');
    await user.type(input, 'CHROME');
    const cards = screen.getAllByTestId('picker-card');
    expect(cards).toHaveLength(1);
    expect(screen.getByText('Google Chrome')).toBeInTheDocument();
  });
});
