import type { PluginContext, Tool, ToolCallResult, ToolContext } from './types.ts';

let config: Record<string, string> = {};

export async function onLoad(ctx: PluginContext): Promise<void> {
  config = {
    defaultProvider: (await ctx.config.get('defaultProvider')) ?? 'github',
    githubToken: (await ctx.config.get('githubToken')) ?? '',
    gitlabToken: (await ctx.config.get('gitlabToken')) ?? '',
  };
}

export async function onUnload(_ctx: PluginContext): Promise<void> {}

const cicd_monitor: Tool = {
  definition: {
    name: 'cicd_monitor',
    description: 'Monitor pipeline runs',
    params: [
      { name: 'repo', type: 'string', description: 'Repository name (owner/repo)', required: true },
      { name: 'provider', type: 'string', description: 'CI provider', required: false },
      { name: 'branch', type: 'string', description: 'Branch name filter', required: false },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const repo = args.repo as string;
      if (!repo) {
        return {
          toolName: 'cicd_monitor',
          success: false,
          output: '',
          error: 'repo is required',
          durationMs: Date.now() - start,
        };
      }
      const provider = (args.provider as string) ?? config.defaultProvider;
      if (provider !== 'github') {
        return {
          toolName: 'cicd_monitor',
          success: false,
          output: '',
          error: `Provider ${provider} not yet supported. Use github.`,
          durationMs: Date.now() - start,
        };
      }

      let url = `https://api.github.com/repos/${repo}/actions/runs?per_page=10`;
      if (args.branch) url += `&branch=${encodeURIComponent(args.branch as string)}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          toolName: 'cicd_monitor',
          success: false,
          output: '',
          error: `GitHub API: ${data.message}`,
          durationMs: Date.now() - start,
        };
      }
      const runs = (data.workflow_runs || []).map((r: Record<string, unknown>) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        conclusion: r.conclusion,
        branch: r.head_branch,
        created: r.created_at,
      }));
      return {
        toolName: 'cicd_monitor',
        success: true,
        output: JSON.stringify(runs, null, 2),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cicd_monitor',
        success: false,
        output: '',
        error: `Failed to monitor: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cicd_detect_flaky: Tool = {
  definition: {
    name: 'cicd_detect_flaky',
    description: 'Detect flaky tests',
    params: [
      { name: 'repo', type: 'string', description: 'Repository name (owner/repo)', required: true },
      {
        name: 'recent_runs',
        type: 'number',
        description: 'Number of recent runs to analyze',
        required: false,
      },
      {
        name: 'threshold_percent',
        type: 'number',
        description: 'Flaky threshold percentage',
        required: false,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const repo = args.repo as string;
      if (!repo) {
        return {
          toolName: 'cicd_detect_flaky',
          success: false,
          output: '',
          error: 'repo is required',
          durationMs: Date.now() - start,
        };
      }
      const recentRuns = (args.recent_runs as number) ?? 10;
      const threshold = (args.threshold_percent as number) ?? 20;

      const res = await fetch(
        `https://api.github.com/repos/${repo}/actions/runs?per_page=${recentRuns}`,
        {
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        return {
          toolName: 'cicd_detect_flaky',
          success: false,
          output: '',
          error: `GitHub API: ${data.message}`,
          durationMs: Date.now() - start,
        };
      }

      const runs = data.workflow_runs || [];
      const testResults: Record<string, { pass: number; fail: number }> = {};

      for (const run of runs) {
        const jobsRes = await fetch(
          `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs`,
          {
            headers: {
              Authorization: `Bearer ${config.githubToken}`,
              Accept: 'application/vnd.github+json',
            },
          },
        );
        const jobsData = await jobsRes.json();
        for (const job of (jobsData.jobs || [])) {
          if (job.name) {
            const key = job.name;
            if (!testResults[key]) testResults[key] = { pass: 0, fail: 0 };
            if (job.conclusion === 'success') testResults[key].pass++;
            else if (job.conclusion === 'failure') testResults[key].fail++;
          }
        }
      }

      const flaky: Record<string, unknown>[] = [];
      for (const [name, counts] of Object.entries(testResults)) {
        const total = counts.pass + counts.fail;
        if (total > 0 && counts.fail > 0 && counts.pass > 0) {
          const failRate = (counts.fail / total) * 100;
          if (failRate > 0 && failRate < threshold) {
            flaky.push({
              test: name,
              passCount: counts.pass,
              failCount: counts.fail,
              failRate: `${failRate.toFixed(1)}%`,
            });
          }
        }
      }

      return {
        toolName: 'cicd_detect_flaky',
        success: true,
        output: flaky.length > 0 ? JSON.stringify(flaky, null, 2) : 'No flaky tests detected',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cicd_detect_flaky',
        success: false,
        output: '',
        error: `Failed to detect flaky: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cicd_analyze_failure: Tool = {
  definition: {
    name: 'cicd_analyze_failure',
    description: 'Analyze build failure',
    params: [
      { name: 'repo', type: 'string', description: 'Repository name (owner/repo)', required: true },
      { name: 'run_id', type: 'number', description: 'Pipeline run ID', required: true },
      { name: 'provider', type: 'string', description: 'CI provider', required: false },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const repo = args.repo as string;
      const runId = args.run_id as number;
      if (!repo || !runId) {
        return {
          toolName: 'cicd_analyze_failure',
          success: false,
          output: '',
          error: 'repo and run_id are required',
          durationMs: Date.now() - start,
        };
      }

      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, {
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          toolName: 'cicd_analyze_failure',
          success: false,
          output: '',
          error: `GitHub API: ${data.message}`,
          durationMs: Date.now() - start,
        };
      }

      const failedJobs = (data.jobs || []).filter((j: Record<string, unknown>) =>
        j.conclusion === 'failure'
      );
      if (!failedJobs.length) {
        return {
          toolName: 'cicd_analyze_failure',
          success: true,
          output: 'No failed jobs found in this run',
          durationMs: Date.now() - start,
        };
      }

      const analysis = failedJobs.map((job: Record<string, unknown>) => ({
        jobName: job.name,
        failureStep: job.steps
          ? (job.steps as Record<string, unknown>[]).find((s) => s.conclusion === 'failure')?.name
          : 'unknown',
      }));

      return {
        toolName: 'cicd_analyze_failure',
        success: true,
        output: JSON.stringify(analysis, null, 2),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cicd_analyze_failure',
        success: false,
        output: '',
        error: `Failed to analyze: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cicd_suggest_fix: Tool = {
  definition: {
    name: 'cicd_suggest_fix',
    description: 'Suggest fix for failure',
    params: [
      { name: 'repo', type: 'string', description: 'Repository name (owner/repo)', required: true },
      { name: 'run_id', type: 'number', description: 'Pipeline run ID', required: true },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const repo = args.repo as string;
      const runId = args.run_id as number;
      if (!repo || !runId) {
        return {
          toolName: 'cicd_suggest_fix',
          success: false,
          output: '',
          error: 'repo and run_id are required',
          durationMs: Date.now() - start,
        };
      }

      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/logs`, {
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (!res.ok) {
        return {
          toolName: 'cicd_suggest_fix',
          success: false,
          output: '',
          error: `Failed to fetch logs: ${res.status}`,
          durationMs: Date.now() - start,
        };
      }

      const logs = await res.text();
      const commonPatterns: Record<string, string> = {
        'npm ERR!': 'Check package.json dependencies and lockfile. Try `npm install`.',
        'Module not found': 'Verify import paths and that all dependencies are installed.',
        'ESLint': 'Fix linting errors shown above.',
        'Cannot find module': 'Run `npm install` or `deno cache` to install missing dependencies.',
        'timeout':
          'The job exceeded the time limit. Consider optimizing tests or increasing timeout.',
        'out of memory': 'Reduce resource usage or increase runner memory.',
        'permission denied': 'Check file permissions or add required capabilities.',
      };

      let suggestion = 'Analysis of log patterns:';
      let found = false;
      for (const [pattern, fix] of Object.entries(commonPatterns)) {
        if (logs.includes(pattern)) {
          suggestion += `\n- ${pattern}: ${fix}`;
          found = true;
        }
      }
      if (!found) {
        suggestion =
          'No common failure patterns detected. Review the full logs for custom errors.\n\nLogs:\n' +
          logs.slice(0, 2000);
      }

      return {
        toolName: 'cicd_suggest_fix',
        success: true,
        output: suggestion,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cicd_suggest_fix',
        success: false,
        output: '',
        error: `Failed to suggest fix: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

const cicd_auto_merge: Tool = {
  definition: {
    name: 'cicd_auto_merge',
    description: 'Auto-merge passing PRs',
    params: [
      { name: 'repo', type: 'string', description: 'Repository name (owner/repo)', required: true },
      { name: 'pr_number', type: 'number', description: 'Pull request number', required: true },
      {
        name: 'checks',
        type: 'string',
        description: 'Required check names (comma-separated)',
        required: false,
      },
    ],
    capabilities: ['network:fetch'],
  },
  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    try {
      const repo = args.repo as string;
      const prNumber = args.pr_number as number;
      if (!repo || !prNumber) {
        return {
          toolName: 'cicd_auto_merge',
          success: false,
          output: '',
          error: 'repo and pr_number are required',
          durationMs: Date.now() - start,
        };
      }

      const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      const pr = await res.json();
      if (!res.ok) {
        return {
          toolName: 'cicd_auto_merge',
          success: false,
          output: '',
          error: `GitHub API: ${pr.message}`,
          durationMs: Date.now() - start,
        };
      }

      if (!pr.mergeable) {
        return {
          toolName: 'cicd_auto_merge',
          success: false,
          output: '',
          error: 'PR is not mergeable. It may have conflicts or failing checks.',
          durationMs: Date.now() - start,
        };
      }

      if (args.checks) {
        const requiredChecks = (args.checks as string).split(',').map((c) => c.trim());
        const statusRes = await fetch(
          `https://api.github.com/repos/${repo}/commits/${pr.head.sha}/status`,
          {
            headers: {
              Authorization: `Bearer ${config.githubToken}`,
              Accept: 'application/vnd.github+json',
            },
          },
        );
        const statusData = await statusRes.json();
        const statuses = (statusData.statuses || []).map((s: Record<string, unknown>) => s.context);
        const missing = requiredChecks.filter((c) => !statuses.includes(c));
        if (missing.length) {
          return {
            toolName: 'cicd_auto_merge',
            success: false,
            output: '',
            error: `Missing required checks: ${missing.join(', ')}`,
            durationMs: Date.now() - start,
          };
        }
      }

      const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.githubToken}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ merge_method: 'squash' }),
      });
      const mergeData = await mergeRes.json();
      if (!mergeRes.ok) {
        return {
          toolName: 'cicd_auto_merge',
          success: false,
          output: '',
          error: `Merge failed: ${mergeData.message}`,
          durationMs: Date.now() - start,
        };
      }

      return {
        toolName: 'cicd_auto_merge',
        success: true,
        output: `PR #${prNumber} merged successfully`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName: 'cicd_auto_merge',
        success: false,
        output: '',
        error: `Failed to auto-merge: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

export const tools: Tool[] = [
  cicd_monitor,
  cicd_detect_flaky,
  cicd_analyze_failure,
  cicd_suggest_fix,
  cicd_auto_merge,
];
