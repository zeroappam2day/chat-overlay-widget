// @vitest-environment jsdom
/**
 * ConsentDialog.test.tsx — Unit tests for Agent Runtime Phase 6 (frontend)
 *
 * Tests ConsentDialog React component:
 * - Renders action details (description, type, coordinates, target)
 * - Calls onApprove on Allow click
 * - Calls onDeny on Deny click
 * - Keyboard shortcuts: Enter = Allow, Escape = Deny
 * - Only fires callback once (resolvedRef guard)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConsentDialog } from '../ConsentDialog';

afterEach(cleanup);

const defaultProps = {
  requestId: 'req-123',
  action: {
    type: 'click',
    description: 'Click the Save button',
    coordinates: { x: 500, y: 300 },
    target: 'Save',
  },
  onApprove: vi.fn(),
  onDeny: vi.fn(),
};

describe('ConsentDialog', () => {
  it('renders the action description', () => {
    render(<ConsentDialog {...defaultProps} />);
    expect(screen.getByText('Click the Save button')).toBeTruthy();
  });

  it('renders the action type', () => {
    render(<ConsentDialog {...defaultProps} />);
    expect(screen.getByText('click')).toBeTruthy();
  });

  it('renders coordinates', () => {
    render(<ConsentDialog {...defaultProps} />);
    expect(screen.getByText('(500, 300)')).toBeTruthy();
  });

  it('renders target', () => {
    render(<ConsentDialog {...defaultProps} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders "Action Consent Required" header', () => {
    render(<ConsentDialog {...defaultProps} />);
    expect(screen.getByText('Action Consent Required')).toBeTruthy();
  });

  it('calls onApprove when Allow button is clicked', () => {
    const onApprove = vi.fn();
    render(<ConsentDialog {...defaultProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByText(/Allow/));
    expect(onApprove).toHaveBeenCalledWith('req-123');
  });

  it('calls onDeny when Deny button is clicked', () => {
    const onDeny = vi.fn();
    render(<ConsentDialog {...defaultProps} onDeny={onDeny} />);
    fireEvent.click(screen.getByText(/Deny/));
    expect(onDeny).toHaveBeenCalledWith('req-123');
  });

  it('calls onApprove on Enter key', () => {
    const onApprove = vi.fn();
    render(<ConsentDialog {...defaultProps} onApprove={onApprove} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).toHaveBeenCalledWith('req-123');
  });

  it('calls onDeny on Escape key', () => {
    const onDeny = vi.fn();
    render(<ConsentDialog {...defaultProps} onDeny={onDeny} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDeny).toHaveBeenCalledWith('req-123');
  });

  it('only fires callback once (double-click guard)', () => {
    const onApprove = vi.fn();
    render(<ConsentDialog {...defaultProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByText(/Allow/));
    fireEvent.click(screen.getByText(/Allow/));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('has role=alertdialog for accessibility', () => {
    render(<ConsentDialog {...defaultProps} />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('renders without coordinates and target when not provided', () => {
    const action = { type: 'type', description: 'Type hello' };
    render(<ConsentDialog {...defaultProps} action={action} />);
    expect(screen.getByText('Type hello')).toBeTruthy();
    expect(screen.queryByText('Coordinates:')).toBeNull();
    expect(screen.queryByText('Target:')).toBeNull();
  });
});
