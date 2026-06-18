# Changelog

## [Unreleased]

### Added
- Structured logging via ctx.logger in lifecycle hooks

### Changed
- Renamed manifest file from `cortex.json` to `manifest.json` for consistency with Cortex standard
- Standardized UI section structure to `ui.settings` format
- Normalized parameter naming: `defaultValue` → `default`, `options` → `enum`
- Added `homepage` field with repository URL
- Added `dependencies` field to manifest

## [1.0.1] — 2026-06-15

### Added
- Initial release
## [1.0.1] — 2026-06-17

### Added

- Initial project setup

## [1.0.0] — 2026-06-15

### Added

- Initial release of cortex-plugin-cicd-guardian
- `cicd_monitor` — Monitor pipeline runs
- `cicd_detect_flaky` — Detect flaky tests
- `cicd_analyze_failure` — Analyze build failure
- `cicd_suggest_fix` — Suggest fix for failure
- `cicd_auto_merge` — Auto-merge passing PRs
