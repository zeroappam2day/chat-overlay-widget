/**
 * Quote a Windows file path for injection into the active shell's input bar.
 *
 * Shell rules (per D-03):
 *   - powershell.exe: single-quoted; embedded ' escaped as ''
 *   - cmd.exe: double-quoted
 *   - bash.exe: drive letter lowered to /c/ prefix, backslashes to forward slashes,
 *               then single-quoted with POSIX '' escape ('\'' sequence)
 *   - null/undefined: raw path returned unchanged (Pitfall 5 guard)
 */
export function quotePathForShell(filePath: string, shell: string | null | undefined): string {
  if (!shell) return filePath;

  const s = shell.toLowerCase();

  if (s === 'bash.exe') {
    // Convert Windows path to Unix-style: C:\Users\... -> /c/Users/...
    const unixPath = filePath
      .replace(/^([A-Za-z]):\\/, (_match, d: string) => `/${d.toLowerCase()}/`)
      .replace(/\\/g, '/');
    // POSIX single-quote escape: ' -> '\''
    return `'${unixPath.replace(/'/g, "'\\''")}'`;
  }

  if (s === 'cmd.exe') {
    // cmd.exe accepts double-quoted paths
    return `"${filePath}"`;
  }

  // Default: PowerShell — single-quote, embedded ' escaped as ''
  return `'${filePath.replace(/'/g, "''")}'`;
}
