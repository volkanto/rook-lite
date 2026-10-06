#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';

/**
 * Categorizes a PR or commit item based on labels and Conventional Commit prefix.
 */
export function categorizeItem(item) {
  const labels = (item.labels || []).map((l) => (typeof l === 'string' ? l.toLowerCase() : l.name?.toLowerCase() || ''));
  const title = (item.title || item.subject || '').trim();

  // Check labels first
  if (labels.some((l) => ['feature', 'feat', 'enhancement'].includes(l))) {
    return 'features';
  }
  if (labels.some((l) => ['bug', 'fix', 'bugfix'].includes(l))) {
    return 'fixes';
  }
  if (labels.some((l) => ['perf', 'performance', 'refactor', 'style', 'cleanup'].includes(l))) {
    return 'improvements';
  }
  if (labels.some((l) => ['documentation', 'docs', 'doc'].includes(l))) {
    return 'docs';
  }
  if (labels.some((l) => ['chore', 'ci', 'build', 'dependencies', 'deps'].includes(l))) {
    return 'internal';
  }

  // Fallback to Conventional Commit prefix in title
  const match = title.match(/^([a-z0-9_-]+)(?:\([^)]+\))?(!)?:\s*(.+)$/i);
  if (match) {
    const type = match[1].toLowerCase();
    switch (type) {
      case 'feat':
        return 'features';
      case 'fix':
        return 'fixes';
      case 'perf':
      case 'refactor':
      case 'style':
        return 'improvements';
      case 'docs':
        return 'docs';
      case 'chore':
      case 'ci':
      case 'build':
      case 'test':
        return 'internal';
      default:
        return 'other';
    }
  }

  return 'other';
}

/**
 * Filter PRs for AI prompt: remove internal/chore PRs unless ALL PRs are internal.
 */
export function filterPRsForPrompt(prs) {
  const meaningful = prs.filter((pr) => pr.category !== 'internal');
  return meaningful.length > 0 ? meaningful : prs;
}

/**
 * Formats Qwen2.5 chat template prompt.
 */
export function buildPrompt({ prs, currentTag, prevTag }) {
  const prListString = prs
    .map((pr) => {
      const categoryTag = pr.category ? `[${pr.category}] ` : '';
      return `- #${pr.number}: ${categoryTag}${pr.title}`;
    })
    .join('\n');

  const rangeDescription = prevTag ? `${prevTag}...${currentTag}` : currentTag;

  return `<|im_start|>system
You are a software release note assistant for Rook Lite.
Summarize the provided pull requests into concise, user-facing release notes.

Strict Rules:
1. Truthfulness: Use ONLY the provided PR titles and categories. Do not invent, extrapolate, or hallucinate features, fixes, or details.
2. Tone: Factual, professional, and clear.
3. Anti-Fluff: DO NOT include motivational cheerleading (e.g., "Great job team!", "We are thrilled to announce").
4. Anti-Exaggeration: Do not describe minor tweaks or routine maintenance as major overhauls.
5. Organization: Group bullets under Markdown headers (e.g. "### ✨ What's New", "### ⚡ Improvements", "### 🐛 Bug Fixes"). Omit any empty headers.
6. PR Attribution: Every bullet MUST end with its PR reference in the exact format: (#<number>).
7. Format: Output raw Markdown only. Do not wrap the output in \`\`\`markdown code fences.<|im_end|>
<|im_start|>user
Here are the merged pull requests for release ${rangeDescription}:
${prListString}

Generate the release notes now:<|im_end|>
<|im_start|>assistant
`;
}

/**
 * Sanitizes llama.cpp output by stripping timing headers, turn tokens, and code fences.
 */
export function sanitizeLlamaOutput(raw) {
  if (!raw) return '';

  return (
    raw
      // Strip llama.cpp timing headers (e.g. "[ Prompt: ... | Generation: ... ]")
      .replace(/^\[\s*Prompt:[\s\S]*?Generation:[\s\S]*?\]\r?\n?/gm, '')
      // Strip model turn markers & EOS tokens
      .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>|\[end of text\]/gi, '')
      // Strip leading/trailing code fences
      .replace(/^\s*```(?:markdown)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()
  );
}

/**
 * Validates that AI output contains meaningful release notes.
 */
export function validateSummary(sanitized, prs = []) {
  if (!sanitized || sanitized.length < 25) {
    return false;
  }

  // Must have at least one header or bullet
  const hasBullet = /^[-*]\s+/m.test(sanitized);
  const hasHeader = /^#{1,4}\s+/m.test(sanitized);
  if (!hasBullet && !hasHeader) {
    return false;
  }

  // If we had PRs, output should ideally mention at least one (#<num>)
  if (prs.length > 0) {
    const hasPrRef = /\(#[0-9]+\)/.test(sanitized);
    if (!hasPrRef) {
      return false;
    }
  }

  return true;
}

/**
 * Cleans a PR title for user-facing deterministic changelog display.
 */
export function cleanTitleForChangelog(title) {
  return title
    .replace(/^([a-z0-9_-]+)(?:\([^)]+\))?(!)?:\s*/i, '')
    .replace(/\s*\(#[0-9]+\)\s*$/, '')
    .trim();
}

/**
 * Deterministic release notes generator (used as fallback or when --fallback-only is set).
 */
export function generateDeterministicReleaseNotes({
  currentTag,
  prevTag,
  gitRef,
  prs = [],
  unassociatedCommits = [],
  repoUrl = '',
  method = 'deterministic'
}) {
  const sections = {
    features: { title: "### ✨ What's New", items: [] },
    fixes: { title: "### 🐛 Bug Fixes", items: [] },
    improvements: { title: "### ⚡ Improvements & Polish", items: [] },
    docs: { title: "### 📚 Documentation", items: [] },
    other: { title: "### 🔧 Other Changes", items: [] },
    internal: { title: "### 🛠️ Maintenance & Chores", items: [] }
  };

  for (const pr of prs) {
    const cat = sections[pr.category] ? pr.category : 'other';
    const displayTitle = cleanTitleForChangelog(pr.title);
    const prRef = pr.number ? `(#${pr.number})` : '';
    sections[cat].items.push(`- ${displayTitle} ${prRef}`.trim());
  }

  // Filter out internal section if other sections have content
  const hasUserFacingItems =
    sections.features.items.length > 0 ||
    sections.fixes.items.length > 0 ||
    sections.improvements.items.length > 0 ||
    sections.docs.items.length > 0;

  if (hasUserFacingItems) {
    sections.internal.items = [];
  }

  // If unassociated commits exist and no PRs matched, surface them under 'other'
  if (prs.length === 0 && unassociatedCommits.length > 0) {
    for (const commit of unassociatedCommits) {
      if (!commit.toLowerCase().startsWith('chore(release)')) {
        sections.other.items.push(`- ${commit}`);
      }
    }
  }

  const outputParts = [];

  for (const key of ['features', 'improvements', 'fixes', 'docs', 'other', 'internal']) {
    const section = sections[key];
    if (section.items.length > 0) {
      outputParts.push(`${section.title}\n${section.items.join('\n')}`);
    }
  }

  if (outputParts.length === 0) {
    outputParts.push('_No significant changes detected for this release._');
  }

  let finalMarkdown = outputParts.join('\n\n');

  if (prevTag && repoUrl) {
    const targetRefForUrl = gitRef || currentTag;
    finalMarkdown += `\n\n---\n**Full Changelog**: ${repoUrl}/compare/${prevTag}...${targetRefForUrl}`;
  }

  return finalMarkdown;
}

/**
 * Resolves repository URL from environment or git remote.
 */
export function resolveRepoUrl(repoSlug) {
  if (repoSlug) {
    return `https://github.com/${repoSlug}`;
  }
  try {
    const remote = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const match = remote.match(/github\.com[:/]([^/.]+\/[^/.]+?)(?:\.git)?$/);
    if (match) {
      return `https://github.com/${match[1]}`;
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Resolves tag range: previous tag and current tag.
 */
export function detectTagRange({ currentTag, prevTag }) {
  const isDryRunPlaceholder = currentTag === 'dry-run';
  let current = isDryRunPlaceholder ? 'HEAD' : currentTag || process.env.GITHUB_REF_NAME || 'HEAD';
  let previous = prevTag || null;

  if (!previous) {
    try {
      if (current && current !== 'HEAD') {
        previous = execSync(`git describe --tags --abbrev=0 "${current}^" 2>/dev/null`, {
          encoding: 'utf-8'
        }).trim();
      }
    } catch {
      // describe failed, try sorting all tags
    }

    if (!previous) {
      try {
        const allTags = execSync('git tag --sort=-v:refname', { encoding: 'utf-8' })
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);
        const candidate = allTags.find((t) => t !== current && t !== 'dry-run');
        if (candidate) {
          previous = candidate;
        }
      } catch {
        // no tags found
      }
    }
  }

  return {
    currentTag: isDryRunPlaceholder ? 'dry-run (HEAD)' : current,
    gitRef: current,
    prevTag: previous
  };
}

/**
 * Extracts merged PR numbers and unassociated commits from Git log.
 */
export function extractCommitsAndPRs({ prevTag, currentTag, gitRef, repo }) {
  const targetRef = gitRef || (currentTag === 'dry-run' ? 'HEAD' : currentTag) || 'HEAD';
  const range = prevTag ? `${prevTag}..${targetRef}` : targetRef;
  let gitLogOutput = '';

  try {
    gitLogOutput = execSync(`git log ${range} --format="%H%x09%s"`, { encoding: 'utf-8' }).trim();
  } catch (err) {
    console.warn(`[AI Summary] Warning: git log failed for range ${range}: ${err.message}`);
    return { prs: [], unassociatedCommits: [] };
  }

  if (!gitLogOutput) {
    return { prs: [], unassociatedCommits: [] };
  }

  const lines = gitLogOutput.split('\n').filter(Boolean);
  const prNumbers = new Set();
  const unassociatedCommits = [];
  const commitSubjectsByPr = new Map();

  for (const line of lines) {
    const [hash, ...rest] = line.split('\t');
    const subject = rest.join('\t').trim();

    // Check squash PR pattern: "title (#123)"
    const squashMatch = subject.match(/\(#([0-9]+)\)$/);
    if (squashMatch) {
      const num = parseInt(squashMatch[1], 10);
      prNumbers.add(num);
      commitSubjectsByPr.set(num, subject);
      continue;
    }

    // Check merge PR pattern: "Merge pull request #123 from ..."
    const mergeMatch = subject.match(/Merge pull request #([0-9]+) from/i);
    if (mergeMatch) {
      const num = parseInt(mergeMatch[1], 10);
      prNumbers.add(num);
      continue;
    }

    unassociatedCommits.push(subject);
  }

  // Fetch PR metadata from GitHub CLI
  const prs = [];
  for (const prNum of prNumbers) {
    let prData = null;
    try {
      const repoArg = repo ? `--repo "${repo}"` : '';
      const json = execSync(`gh pr view ${prNum} ${repoArg} --json number,title,labels,url`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      prData = JSON.parse(json);
    } catch {
      // Fallback: use commit subject if gh command fails or is offline
      const fallbackTitle = commitSubjectsByPr.get(prNum) || `Pull Request #${prNum}`;
      prData = {
        number: prNum,
        title: fallbackTitle,
        labels: [],
        url: ''
      };
    }

    if (prData) {
      const category = categorizeItem(prData);
      prs.push({
        number: prData.number,
        title: prData.title,
        labels: (prData.labels || []).map((l) => (typeof l === 'string' ? l : l.name)),
        category,
        url: prData.url || ''
      });
    }
  }

  return { prs, unassociatedCommits };
}

/**
 * Runs local inference via llama-cli.
 */
export function runLlamaInference({ llamaCliPath, modelPath, prompt, timeoutMs = 60000 }) {
  if (!llamaCliPath || !fs.existsSync(llamaCliPath)) {
    throw new Error(`llama-cli executable not found at: ${llamaCliPath}`);
  }
  if (!modelPath || !fs.existsSync(modelPath)) {
    throw new Error(`GGUF model file not found at: ${modelPath}`);
  }

  const tmpPromptPath = path.join(os.tmpdir(), `release-prompt-${Date.now()}.txt`);
  fs.writeFileSync(tmpPromptPath, prompt, 'utf-8');

  try {
    const startTime = Date.now();
    const args = [
      '--model',
      modelPath,
      '--file',
      tmpPromptPath,
      '--ctx-size',
      '2048',
      '--n-predict',
      '512',
      '--threads',
      '2',
      '--temp',
      '0.1',
      '--no-display-prompt',
      '-no-cnv'
    ];

    const cliDir = path.dirname(llamaCliPath);
    const ldLibPath = [cliDir, path.join(cliDir, '..', 'lib'), process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(':');

    const rawOutput = execFileSync(llamaCliPath, args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: ldLibPath
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const durationMs = Date.now() - startTime;
    return { rawOutput, durationMs, success: true };
  } finally {
    try {
      if (fs.existsSync(tmpPromptPath)) {
        fs.unlinkSync(tmpPromptPath);
      }
    } catch {
      // ignore tmp cleanup error
    }
  }
}

/**
 * Command line arguments parser.
 */
export function parseArgs(argv) {
  const args = {
    currentTag: '',
    prevTag: '',
    repo: process.env.GITHUB_REPOSITORY || '',
    llamaCli: process.env.LLAMA_CLI_PATH || '',
    model: process.env.LLAMA_MODEL_PATH || '',
    output: 'release-notes.md',
    contextOutput: 'release-context.json',
    dryRun: false,
    fallbackOnly: false,
    verbose: false
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--current-tag' && argv[i + 1]) {
      args.currentTag = argv[++i];
    } else if (arg === '--prev-tag' && argv[i + 1]) {
      args.prevTag = argv[++i];
    } else if (arg === '--repo' && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (arg === '--llama-cli' && argv[i + 1]) {
      args.llamaCli = argv[++i];
    } else if (arg === '--model' && argv[i + 1]) {
      args.model = argv[++i];
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[++i];
    } else if (arg === '--context-output' && argv[i + 1]) {
      args.contextOutput = argv[++i];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--fallback-only') {
      args.fallbackOnly = true;
    } else if (arg === '--verbose') {
      args.verbose = true;
    }
  }

  // Resolve default llama paths if not provided
  if (!args.llamaCli) {
    const homeDir = os.homedir();
    const candidatePaths = [
      path.join(homeDir, 'llama', 'llama-cli'),
      path.join(homeDir, 'llama', 'build', 'bin', 'llama-cli'),
      '/usr/local/bin/llama-cli',
      'llama-cli'
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        args.llamaCli = p;
        break;
      }
    }
  }

  if (!args.model) {
    const homeDir = os.homedir();
    const candidateModels = [
      path.join(homeDir, 'models', 'qwen2.5-0.5b-instruct-q4_k_m.gguf'),
      path.join(homeDir, 'models', 'model.gguf')
    ];
    for (const m of candidateModels) {
      if (fs.existsSync(m)) {
        args.model = m;
        break;
      }
    }
  }

  return args;
}

/**
 * Main execution orchestration.
 */
export async function main() {
  const args = parseArgs(process.argv);
  const repoUrl = resolveRepoUrl(args.repo);
  const { currentTag, prevTag, gitRef } = detectTagRange(args);

  console.log(`[AI Summary] Target: ${currentTag} (Previous: ${prevTag || 'none'})`);
  console.log(`[AI Summary] Repository: ${args.repo || repoUrl || 'local'}`);
  if (args.dryRun) {
    console.log('[AI Summary] ℹ️ DRY-RUN MODE: Release publishing and Docker push will be skipped.');
  }

  // Extract PRs and commits
  const { prs, unassociatedCommits } = extractCommitsAndPRs({
    prevTag,
    currentTag,
    gitRef,
    repo: args.repo
  });

  console.log(`[AI Summary] Found ${prs.length} pull request(s) and ${unassociatedCommits.length} unassociated commit(s).`);

  // Write intermediate context JSON
  if (args.contextOutput) {
    const contextData = {
      currentTag,
      prevTag,
      repoUrl,
      prs,
      unassociatedCommits
    };
    fs.writeFileSync(args.contextOutput, JSON.stringify(contextData, null, 2), 'utf-8');
    if (args.verbose) {
      console.log(`[AI Summary] Wrote context data to ${args.contextOutput}`);
    }
  }

  let finalNotesBody = '';
  let generatorMethod = 'deterministic';
  let executionStats = '';

  const meaningfulPRs = filterPRsForPrompt(prs);

  // Attempt local LLM inference if conditions permit
  if (!args.fallbackOnly && meaningfulPRs.length > 0 && args.llamaCli && args.model) {
    try {
      console.log(`[AI Summary] Running local inference via llama-cli...`);
      console.log(`[AI Summary] Model: ${args.model}`);
      console.log(`[AI Summary] Binary: ${args.llamaCli}`);

      const prompt = buildPrompt({ prs: meaningfulPRs, currentTag, prevTag });
      const { rawOutput, durationMs } = runLlamaInference({
        llamaCliPath: args.llamaCli,
        modelPath: args.model,
        prompt
      });

      const sanitized = sanitizeLlamaOutput(rawOutput);
      const isValid = validateSummary(sanitized, meaningfulPRs);

      if (isValid) {
        finalNotesBody = sanitized;
        generatorMethod = 'llm';
        executionStats = `Generated in ${(durationMs / 1000).toFixed(1)}s via local Qwen2.5-0.5B-Instruct`;
        console.log(`[AI Summary] ✅ Local LLM generation succeeded (${executionStats}).`);
      } else {
        console.warn('[AI Summary] ⚠️ LLM output failed validation checks. Falling back to deterministic generator.');
      }
    } catch (err) {
      console.warn(`[AI Summary] ⚠️ LLM inference failed: ${err.message}. Falling back to deterministic generator.`);
    }
  } else {
    if (args.fallbackOnly) {
      console.log('[AI Summary] --fallback-only requested; using deterministic generator.');
    } else if (!args.llamaCli || !args.model) {
      console.log('[AI Summary] llama-cli binary or model not found; using deterministic generator.');
    } else if (meaningfulPRs.length === 0) {
      console.log('[AI Summary] No pull requests to summarize; using deterministic generator.');
    }
  }

  // Fallback generation if LLM was not used or failed validation
  if (!finalNotesBody) {
    generatorMethod = 'deterministic';
    finalNotesBody = generateDeterministicReleaseNotes({
      currentTag,
      prevTag,
      gitRef,
      prs,
      unassociatedCommits,
      repoUrl
    });
  }

  // Build the complete release notes document
  const provenanceFooter =
    generatorMethod === 'llm'
      ? `\n\n---\n*Release notes generated by local AI (\`Qwen/Qwen2.5-0.5B-Instruct\` via \`llama.cpp\` on CPU). ${executionStats}*`
      : `\n\n---\n*Release notes generated via deterministic changelog engine (fallback).*`;

  const dryRunBanner = args.dryRun
    ? `> ℹ️ **Dry-Run Mode**: Generated on-the-fly. GitHub Release and Docker publishing skipped.\n\n`
    : '';

  const fullReleaseNotes = `${dryRunBanner}${finalNotesBody}${provenanceFooter}\n`;

  // Write to output file
  fs.writeFileSync(args.output, fullReleaseNotes, 'utf-8');
  console.log(`[AI Summary] Release notes successfully written to: ${args.output}`);

  // If in dry-run or verbose mode, print notes to stdout
  if (args.dryRun || args.verbose) {
    console.log('\n=================== RELEASE NOTES PREVIEW ===================');
    console.log(fullReleaseNotes);
    console.log('=============================================================\n');
  }

  // Output to GitHub Actions Step Summary if available
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      const summaryContent = `## Release Notes (${currentTag})\n\n**Generation Method**: \`${generatorMethod.toUpperCase()}\`\n\n${fullReleaseNotes}`;
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryContent, 'utf-8');
      console.log('[AI Summary] Appended release notes to $GITHUB_STEP_SUMMARY.');
    } catch (err) {
      console.warn(`[AI Summary] Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
    }
  }

  return {
    success: true,
    method: generatorMethod,
    currentTag,
    prevTag,
    outputFile: args.output
  };
}

// Only execute main when called directly from CLI
const isDirectExecution =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname));

if (isDirectExecution) {
  main().catch((err) => {
    console.error(`[AI Summary] Fatal error: ${err.message}`);
    process.exit(1);
  });
}
