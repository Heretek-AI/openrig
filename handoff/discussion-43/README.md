# Discussion #43: session continuity for community agent apps

This folder holds a hand-off for mvschwarz/openrig discussion #43 (provider-neutral harness plug-ins). These files are
plans and prompts, not product code. Don't merge them upstream.

- `IMPLEMENTATION_PROMPT.md` is a step-by-step brief for a coding agent. It adds agent-app preset **format 2**: a
  preset can declare `session` commands, so an app such as OpenCode 1.x or 2.0 resumes its conversation through
  `rig launch` or a restore. The brief has 12 milestones, each with a tested patch against upstream commit `ca1ee698`.
  Give it to the agent with:
  "Read IMPLEMENTATION_PROMPT.md fully, then do it milestone by milestone."
- `PROMPT_ADVERSARIAL_FLEET_AUDIT.md` verifies the finished branch against real OpenCode, a real daemon and tmux.
  Copy it into the root of a checkout of `feat/agent-app-session-continuity`, then run:
  "Read PROMPT_ADVERSARIAL_FLEET_AUDIT.md and execute the three-subagent adversarial audit as instructed. Write
  findings to AUDIT_REPORT_FINDINGS.md."
