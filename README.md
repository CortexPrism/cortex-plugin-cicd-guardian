# cortex-plugin-cicd-guardian

Monitor CI/CD pipelines, detect flaky tests, analyze failures across GitHub Actions, GitLab CI, and Jenkins.

## Installation

```bash
cortex plugin install marketplace:cortex-plugin-cicd-guardian
cortex plugin install github:CortexPrism/cortex-plugin-cicd-guardian
cortex plugin install ./manifest.json
```

## Quick Start

```bash
cortex tools list
cortex chat --plugin cortex-plugin-cicd-guardian
```

## Tools

### cicd_monitor — Monitor pipeline runs
- `repo` (string, required — owner/repo)
- `provider` (enum: github/gitlab/jenkins, github)
- `branch` (string)

### cicd_detect_flaky — Detect flaky tests
- `repo` (string, required)
- `recent_runs` (number, 10)
- `threshold_percent` (number, 20)

### cicd_analyze_failure — Analyze build failure
- `repo` (string, required)
- `run_id` (number, required)
- `provider` (string)

### cicd_suggest_fix — Suggest fix for failure
- `repo` (string, required)
- `run_id` (number, required)

### cicd_auto_merge — Auto-merge passing PRs
- `repo` (string, required)
- `pr_number` (number, required)
- `checks` (string, comma-separated)

## Configuration

```json
{
  "plugins": {
    "cortex-plugin-cicd-guardian": {
      "enabled": true,
      "config": {
        "defaultProvider": "github",
        "githubToken": "",
        "gitlabToken": ""
      }
    }
  }
}
```

## Development

```bash
deno task test
deno task lint
deno task validate
```

## License

MIT
