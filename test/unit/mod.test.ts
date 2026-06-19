// deno-lint-ignore-file require-await
import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { tools } from '../../mod.ts';
import type { PluginContext, ToolContext } from '../../types.ts';

// Mock PluginContext
const mockContext: PluginContext & ToolContext = {
  pluginId: 'cortex-plugin-cicd-guardian',
  pluginDir: '/tmp/plugins/cortex-plugin-cicd-guardian',
  state: {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: async () => ({}),
  },
  config: {
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
  },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  host: {
    registerTool: () => {},
    unregisterTool: () => {},
  },
  sessionId: 'test-session',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
};

function findTool(name: string) {
  const tool = tools.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

Deno.test('tools array — exports all tools', () => {
  assertEquals(tools.length, 4);
  assertEquals(tools[0].definition.name, 'cicd_monitor');
  assertEquals(tools[1].definition.name, 'cicd_detect_flaky');
  assertEquals(tools[2].definition.name, 'cicd_analyze_failure');
  assertEquals(tools[3].definition.name, 'cicd_suggest_fix');
});

Deno.test('cicd_monitor — rejects empty repo', async () => {
  const tool = findTool('cicd_monitor');
  const result = await tool.execute({ 'repo': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('cicd_detect_flaky — rejects empty repo', async () => {
  const tool = findTool('cicd_detect_flaky');
  const result = await tool.execute({ 'repo': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('cicd_analyze_failure — rejects empty repo', async () => {
  const tool = findTool('cicd_analyze_failure');
  const result = await tool.execute({ 'repo': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('cicd_suggest_fix — rejects empty repo', async () => {
  const tool = findTool('cicd_suggest_fix');
  const result = await tool.execute({ 'repo': '' }, mockContext);
  assertEquals(result.success, false);
  assertStringIncludes(result.error ?? '', 'non-empty string');
});

Deno.test('all tools return durationMs', async () => {
  for (const tool of tools) {
    const args: Record<string, unknown> = {};
    const result = await tool.execute(args, mockContext);
    assertEquals(typeof result.durationMs, 'number');
    assertEquals(result.durationMs >= 0, true);
  }
});
