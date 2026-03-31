import type { WindowThumbnail } from './protocol.js';
export declare function resetCache(): void;
export declare function buildBatchThumbnailScript(): string;
export declare function listWindowsWithThumbnails(): Promise<WindowThumbnail[]>;
