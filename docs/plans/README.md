# Implementation Plans

This directory contains implementation plans for complex features and improvements.

## Purpose

Implementation plans provide:

- Detailed task breakdown
- File-level guidance
- TDD step-by-step instructions
- Verification checkpoints

## When to Create a Plan

Create a plan when:

- Task requires 2+ steps
- Multiple files/modules affected
- Complex logic or architecture changes
- Significant refactoring

## Quick Start

1. Copy `TEMPLATE.md` to `YYYY-MM-DD-feature-name.md`
2. Fill in the plan following TDD principles
3. Reference `superpowers:executing-plans` skill for implementation
4. Execute task-by-task with verification

## Existing Plans

| Date | Plan | Status | Description  |
| ---- | ---- | ------ | ------------ |
| -    | -    | -      | No plans yet |

## Plan Naming Convention

```
YYYY-MM-DD-<kebab-case-feature-name>.md
```

Examples:

- `2026-02-13-add-user-authentication.md`
- `2026-02-14-refactor-database-layer.md`
- `2026-02-15-implement-workflow-engine.md`

## Integration with Superpowers

All plans should reference required skills:

- `superpowers:writing-plans` - Create this plan
- `superpowers:using-git-worktrees` - Set up isolated workspace
- `superpowers:test-driven-development` - Follow TDD for each task
- `superpowers:executing-plans` - Implement task-by-task
- `superpowers:verification-before-completion` - Verify each step
- `superpowers:finishing-a-development-branch` - Complete and merge

See [CLAUDE.md](../CLAUDE.md) for full development workflow.
