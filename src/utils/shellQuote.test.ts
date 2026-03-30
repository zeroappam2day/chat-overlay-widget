import { describe, it, expect } from 'vitest';
import { quotePathForShell } from './shellQuote';

describe('quotePathForShell', () => {
  // PowerShell: single-quoted with '' escape for embedded single quotes
  it('PowerShell: wraps path in single quotes', () => {
    expect(quotePathForShell('C:\\Users\\test\\image.png', 'powershell.exe'))
      .toBe("'C:\\Users\\test\\image.png'");
  });

  it('PowerShell: escapes embedded single quote as \'\'', () => {
    expect(quotePathForShell("C:\\Users\\it's\\image.png", 'powershell.exe'))
      .toBe("'C:\\Users\\it''s\\image.png'");
  });

  it('PowerShell: case-insensitive shell name match', () => {
    expect(quotePathForShell('C:\\Users\\test\\image.png', 'PowerShell.exe'))
      .toBe("'C:\\Users\\test\\image.png'");
  });

  // cmd.exe: double-quoted
  it('cmd.exe: wraps path in double quotes', () => {
    expect(quotePathForShell('C:\\Users\\test\\image.png', 'cmd.exe'))
      .toBe('"C:\\Users\\test\\image.png"');
  });

  // bash.exe: forward-slash with /c/ drive prefix, single-quoted with POSIX escape
  it('bash.exe: converts drive letter to /c/ prefix and backslashes to forward slashes', () => {
    expect(quotePathForShell('C:\\Users\\test\\image.png', 'bash.exe'))
      .toBe("'/c/Users/test/image.png'");
  });

  it('bash.exe: handles D: drive', () => {
    expect(quotePathForShell('D:\\My Folder\\img.png', 'bash.exe'))
      .toBe("'/d/My Folder/img.png'");
  });

  it('bash.exe: POSIX single-quote escape for embedded single quote', () => {
    expect(quotePathForShell("C:\\Users\\it's\\image.png", 'bash.exe'))
      .toBe("'/c/Users/it'\\''s/image.png'");
  });

  // null/undefined guard: raw path returned unchanged
  it('null shell: returns raw path without quoting', () => {
    expect(quotePathForShell('C:\\Users\\test\\image.png', null))
      .toBe('C:\\Users\\test\\image.png');
  });

  it('undefined shell: returns raw path without quoting', () => {
    expect(quotePathForShell('C:\\Users\\test\\image.png', undefined as any))
      .toBe('C:\\Users\\test\\image.png');
  });
});
