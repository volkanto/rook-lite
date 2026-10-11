import { describe, it, expect } from 'vitest';
import {
  categorizeItem,
  filterPRsForPrompt,
  buildPrompt,
  sanitizeLlamaOutput,
  validateSummary,
  cleanTitleForChangelog,
  generateDeterministicReleaseNotes,
  parseArgs
} from './generate-release-summary.mjs';

describe('generate-release-summary', () => {
  describe('categorizeItem', () => {
    it('categorizes based on GitHub labels', () => {
      expect(categorizeItem({ labels: ['feature'], title: 'add dark mode' })).toBe('features');
      expect(categorizeItem({ labels: [{ name: 'enhancement' }], title: 'faster search' })).toBe('features');
      expect(categorizeItem({ labels: ['bug'], title: 'fix crash' })).toBe('fixes');
      expect(categorizeItem({ labels: ['performance'], title: 'reduce bundle' })).toBe('improvements');
      expect(categorizeItem({ labels: ['documentation'], title: 'update readme' })).toBe('docs');
      expect(categorizeItem({ labels: ['chore'], title: 'upgrade deps' })).toBe('internal');
    });

    it('categorizes based on Conventional Commit prefix when labels are empty', () => {
      expect(categorizeItem({ labels: [], title: 'feat(wikilinks): add wikilinks modal' })).toBe('features');
      expect(categorizeItem({ labels: [], title: 'feat: add note templates' })).toBe('features');
      expect(categorizeItem({ labels: [], title: 'fix(editor): prevent blank note' })).toBe('fixes');
      expect(categorizeItem({ labels: [], title: 'refactor(taxonomy): remove category UI' })).toBe('improvements');
      expect(categorizeItem({ labels: [], title: 'style(css): prune unused rules' })).toBe('improvements');
      expect(categorizeItem({ labels: [], title: 'docs(readme): add installation guide' })).toBe('docs');
      expect(categorizeItem({ labels: [], title: 'ci: unify release workflows' })).toBe('internal');
      expect(categorizeItem({ labels: [], title: 'chore(deps): bump vite to 7.1.5' })).toBe('internal');
    });

    it('falls back to other when no labels or conventional commit matches', () => {
      expect(categorizeItem({ labels: [], title: 'Updated some random stuff' })).toBe('other');
    });
  });

  describe('filterPRsForPrompt', () => {
    it('filters out internal changes when user-facing features exist', () => {
      const prs = [
        { number: 1, title: 'feat: new feature', category: 'features' },
        { number: 2, title: 'ci: update actions', category: 'internal' }
      ];
      const filtered = filterPRsForPrompt(prs);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].number).toBe(1);
    });

    it('retains internal changes if all PRs are internal', () => {
      const prs = [
        { number: 1, title: 'chore: bump dependencies', category: 'internal' },
        { number: 2, title: 'ci: update actions', category: 'internal' }
      ];
      const filtered = filterPRsForPrompt(prs);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('buildPrompt', () => {
    it('creates Qwen chat template prompt with anti-fluff and PR list', () => {
      const prs = [
        { number: 12, title: 'feat: add wikilinks', category: 'features' },
        { number: 14, title: 'fix: prevent empty save', category: 'fixes' }
      ];
      const prompt = buildPrompt({ prs, currentTag: 'v1.3.0', prevTag: 'v1.2.0' });

      expect(prompt).toContain('<|im_start|>system');
      expect(prompt).toContain('Rook Lite');
      expect(prompt).toContain('Anti-Fluff');
      expect(prompt).toContain('Anti-Exaggeration');
      expect(prompt).toContain('## Highlights');
      expect(prompt).toContain('### ✨ What\'s New');
      expect(prompt).toContain('### ⚡ Improvements & Refactoring');
      expect(prompt).toContain('<|im_start|>user');
      expect(prompt).toContain('#12: [features] feat: add wikilinks');
      expect(prompt).toContain('#14: [fixes] fix: prevent empty save');
      expect(prompt).toContain('v1.2.0...v1.3.0');
      expect(prompt).toContain('<|im_start|>assistant');
    });
  });

  describe('sanitizeLlamaOutput', () => {
    it('strips llama.cpp timing headers and turn tokens', () => {
      const raw = `[ Prompt: 35.2 t/s | Generation: 18.1 t/s ]
### ✨ What's New
- Added wikilinks and backlinks support (#12)
<|im_end|>`;
      const sanitized = sanitizeLlamaOutput(raw);
      expect(sanitized).toBe(`### ✨ What's New\n- Added wikilinks and backlinks support (#12)`);
      expect(sanitized).not.toContain('Prompt:');
      expect(sanitized).not.toContain('<|im_end|>');
    });

    it('strips markdown code fence wrappers', () => {
      const raw = `\`\`\`markdown
### ✨ What's New
- Added pre-defined note templates (#14)
\`\`\``;
      const sanitized = sanitizeLlamaOutput(raw);
      expect(sanitized).toBe(`### ✨ What's New\n- Added pre-defined note templates (#14)`);
      expect(sanitized).not.toContain('```');
    });

    it('isolates assistant reply if the prompt was echoed to stdout', () => {
      const raw = `<|im_start|>system\nYou are a software release note assistant...<|im_end|>\n<|im_start|>user\nHere are PRs...<|im_end|>\n<|im_start|>assistant\n### ✨ What's New\n- Added note grouping (#10)<|im_end|>`;
      const sanitized = sanitizeLlamaOutput(raw);
      expect(sanitized).toBe(`### ✨ What's New\n- Added note grouping (#10)`);
      expect(sanitized).not.toContain('system');
      expect(sanitized).not.toContain('Here are PRs');
    });

    it('strips llama-cli "> EOF by user" interactive artifacts', () => {
      const raw = `### ✨ What's New\n- Added note grouping (#10)\n\n> EOF by user`;
      const sanitized = sanitizeLlamaOutput(raw);
      expect(sanitized).toBe(`### ✨ What's New\n- Added note grouping (#10)`);
      expect(sanitized).not.toContain('EOF by user');
    });
  });

  describe('validateSummary', () => {
    const prs = [{ number: 10, title: 'feat: something' }];

    it('validates good release notes with headers and bullets', () => {
      const good = `### ✨ What's New\n- Added note templates and link picker (#10)`;
      expect(validateSummary(good, prs).valid).toBe(true);
    });

    it('validates notes with unicode bullets (•)', () => {
      const unicodeBullet = `### ✨ What's New\n• Added date and tag grouping in tasks (#10)`;
      expect(validateSummary(unicodeBullet, prs).valid).toBe(true);
    });

    it('rejects short or empty outputs', () => {
      expect(validateSummary('', prs).valid).toBe(false);
      expect(validateSummary('Too short', prs).valid).toBe(false);
    });

    it('rejects output without bullets or headers', () => {
      const noMarkdown = `This is just a plain paragraph talking about changes without markdown bullets or headers.`;
      expect(validateSummary(noMarkdown, prs).valid).toBe(false);
    });

    it('rejects echoed system prompt instructions', () => {
      const echo = `You are a software release note assistant for Rook Lite. Summarize the provided PRs.`;
      expect(validateSummary(echo, prs).valid).toBe(false);
    });
  });

  describe('cleanTitleForChangelog', () => {
    it('removes conventional commit prefix and trailing PR number', () => {
      expect(cleanTitleForChangelog('feat(wikilinks): add wikilinks modal (#4)')).toBe('add wikilinks modal');
      expect(cleanTitleForChangelog('fix: resolve link insertion bug')).toBe('resolve link insertion bug');
    });
  });

  describe('generateDeterministicReleaseNotes', () => {
    it('generates grouped markdown notes with compare link', () => {
      const prs = [
        { number: 4, title: 'feat(wikilinks): add wikilinks modal', category: 'features' },
        { number: 5, title: 'fix(editor): prevent blank note', category: 'fixes' },
        { number: 7, title: 'ci: unify release workflows', category: 'internal' }
      ];

      const notes = generateDeterministicReleaseNotes({
        currentTag: 'v1.3.0',
        prevTag: 'v1.2.0',
        prs,
        repoUrl: 'https://github.com/volkanto/rook-lite'
      });

      expect(notes).toContain("### ✨ What's New");
      expect(notes).toContain('- add wikilinks modal (#4)');
      expect(notes).toContain('### 🐛 Bug Fixes');
      expect(notes).toContain('- prevent blank note (#5)');
      // Internal section is suppressed when user-facing items exist
      expect(notes).not.toContain('### 🛠️ Maintenance & Chores');
      expect(notes).toContain('https://github.com/volkanto/rook-lite/compare/v1.2.0...v1.3.0');
    });

    it('handles releases with only internal changes', () => {
      const prs = [{ number: 7, title: 'ci: unify release workflows', category: 'internal' }];

      const notes = generateDeterministicReleaseNotes({
        currentTag: 'v1.3.0',
        prevTag: 'v1.2.0',
        prs,
        repoUrl: 'https://github.com/volkanto/rook-lite'
      });

      expect(notes).toContain('### 🛠️ Maintenance & Chores');
      expect(notes).toContain('- unify release workflows (#7)');
    });

    it('handles empty release with unassociated commits', () => {
      const notes = generateDeterministicReleaseNotes({
        currentTag: 'v1.3.0',
        prevTag: 'v1.2.0',
        prs: [],
        unassociatedCommits: ['chore: fixes version', 'chore(release): 1.3.0 [skip ci]'],
        repoUrl: 'https://github.com/volkanto/rook-lite'
      });

      expect(notes).toContain('### 🔧 Other Changes');
      expect(notes).toContain('- chore: fixes version');
      expect(notes).not.toContain('chore(release)');
    });
  });

  describe('parseArgs', () => {
    it('correctly parses CLI arguments', () => {
      const argv = [
        'node',
        'script.mjs',
        '--current-tag',
        'v1.3.0',
        '--prev-tag',
        'v1.2.0',
        '--llama-bin',
        '/path/to/llama-completion',
        '--dry-run',
        '--fallback-only',
        '--repo',
        'volkanto/rook-lite',
        '--output',
        'custom-notes.md'
      ];
      const parsed = parseArgs(argv);

      expect(parsed.currentTag).toBe('v1.3.0');
      expect(parsed.prevTag).toBe('v1.2.0');
      expect(parsed.llamaCli).toBe('/path/to/llama-completion');
      expect(parsed.dryRun).toBe(true);
      expect(parsed.fallbackOnly).toBe(true);
      expect(parsed.repo).toBe('volkanto/rook-lite');
      expect(parsed.output).toBe('custom-notes.md');
    });
  });
});
