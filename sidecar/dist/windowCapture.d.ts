export type CaptureResult = {
    ok: true;
    path: string;
} | {
    ok: false;
    error: string;
};
export declare function buildCaptureScript(titleQuery: string, outputPath: string): string;
export declare function captureWindow(titleQuery: string): CaptureResult;
export interface CaptureMetadata {
    path: string;
    bounds: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    captureSize: {
        w: number;
        h: number;
    };
    dpiScale: number;
}
export type CaptureWithMetadataResult = {
    ok: true;
    data: CaptureMetadata;
} | {
    ok: false;
    error: string;
};
export declare function buildCaptureScriptWithMetadata(titleQuery: string, outputPath: string): string;
export declare function captureWindowWithMetadata(titleQuery: string): CaptureWithMetadataResult;
export declare function buildCaptureByHwndScript(hwnd: number, pid: number, outputPath: string): string;
export declare function captureWindowByHwnd(hwnd: number, pid: number, titleLabel: string): CaptureWithMetadataResult;
