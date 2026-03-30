# Build Environment — Lessons Learned

Target audience: LLM agents executing build, test, or deploy tasks on this codebase.

## ISSUE-001: Windows Defender locks cargo build artifacts (os error 32)

### Symptom

```
error: failed to remove ...\target\debug\build\...\build_script_build-....rcgu.o:
The process cannot access the file because it is being used by another process. (os error 32)
```

Cargo build fails intermittently. Clean builds fail ~80% of the time. Incremental builds fail ~30%.

### Root Cause

Windows Defender real-time scanning locks `.rcgu.o` object files during the write → link → delete cycle. Even with `codegen-units=1` (one `.o` per crate), Defender grabs the file in the millisecond window between write and delete.

### Mitigation Protocol

**When invoking any cargo command (build, check, clippy, test) or `tauri dev`/`tauri build`:**

#### Step 1 — Set environment variables (MANDATORY)

```bash
export CARGO_INCREMENTAL=0
export RUSTFLAGS="-C codegen-units=1"
```

These reduce file churn from ~256 `.o` files per crate to 1, and prevent incremental cache removal.
Success rate with env vars alone: ~70% on clean builds.

#### Step 2 — Wrap in retry loop (MANDATORY for clean builds)

```bash
MAX_RETRIES=5
for i in $(seq 1 $MAX_RETRIES); do
    cargo build --manifest-path src-tauri/Cargo.toml 2>&1 && break
    echo "Attempt $i failed (Defender lock). Retrying..."
    sleep 3
done
```

Each failed attempt caches successfully compiled crates. By attempt 2-3, enough is cached that the remaining crates compile without hitting a lock.
Success rate with env vars + retry: 100% (verified across 6 consecutive clean builds).

#### Step 3 — Use project scripts (PREFERRED)

```bash
# Instead of: npx tauri dev
bash scripts/tauri-dev.sh

# Instead of: cargo build --manifest-path src-tauri/Cargo.toml
bash scripts/cargo-build.sh build --manifest-path src-tauri/Cargo.toml
```

These scripts set env vars and implement the retry loop.

### Permanent Fix (user action required)

The root cause is eliminated by adding Defender exclusions. Run once in admin PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-defender-exclusions.ps1
```

Or manually:

```powershell
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.cargo"
Add-MpPreference -ExclusionPath "$env:USERPROFILE\.rustup"
Add-MpPreference -ExclusionPath "C:\Users\anujd\Documents\01_AI\214_Chat_overlay_widget\src-tauri\target"
Add-MpPreference -ExclusionProcess "rustc.exe"
Add-MpPreference -ExclusionProcess "cargo.exe"
```

Status: **not yet applied** — user has not run the admin script.

### Defense-in-Depth Configuration

These are already committed to the repo:

| Layer | File | Setting | Effect |
|-------|------|---------|--------|
| Global cargo | `~/.cargo/config.toml` | `incremental = false`, `rustflags = ["-C", "codegen-units=1"]` | Reduces file operations system-wide |
| Project cargo | `src-tauri/Cargo.toml` | `[profile.dev] codegen-units = 1`, `[profile.dev.build-override] codegen-units = 1` | Applies to dev builds AND build scripts |
| Project cargo | `.cargo/config.toml` | Same as global | Redundant safety net |
| Scripts | `scripts/cargo-build.sh` | Env vars + 5-attempt retry | Reliable standalone builds |
| Scripts | `scripts/tauri-dev.sh` | Env vars + 5-attempt retry around `npx tauri dev` | Reliable dev server |
| Scripts | `scripts/setup-defender-exclusions.ps1` | Defender path + process exclusions | Permanent root-cause fix |

### Anti-Patterns (DO NOT)

- **Do not** run `cargo build` or `npx tauri dev` without setting `CARGO_INCREMENTAL=0` and `RUSTFLAGS="-C codegen-units=1"`.
- **Do not** assume a single cargo invocation will succeed on a clean build.
- **Do not** use `cargo clean` as a fix — it makes things worse by removing cached artifacts that buffer against Defender locks.
- **Do not** set `jobs = 1` in cargo config — it doesn't help (Defender locks even single-file operations) and makes builds 5x slower.
- **Do not** move `target-dir` to another location — it breaks Tauri's `externalBin` binary discovery.

### References

- [rust-lang/cargo#5028](https://github.com/rust-lang/cargo/issues/5028) — Windows Defender slowdown
- [rust-lang/cargo#2650](https://github.com/rust-lang/cargo/issues/2650) — Spurious file lock failures
- [tauri-apps/tauri#14745](https://github.com/tauri-apps/tauri/issues/14745) — Defender causes recompilation
