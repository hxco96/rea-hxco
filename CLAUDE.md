@AGENTS.md

## Permanent skills in cloud sessions

Cloud containers are reset between sessions, so anything installed under `~` is lost. Persist skills in the repo:

- **Project skills:** commit them to `.claude/skills/<name>/SKILL.md`. They load automatically. REA's own workflow skill is authored in `.agents/skills/reverse-engineer-anything/` (see AGENTS.md).
- **Third-party plugins:** declare them in `.claude/settings.json`, for example `"enabledPlugins": { "superpowers@anthropic-plugin-directory": true }`, or install them from `.claude/hooks/session-start.sh`. The marketplace name here is `anthropic-plugin-directory`; `claude-plugins-official` is not configured in cloud containers.
- **Personal skills for every repo:** add the install commands to the cloud environment's setup script in claude.ai settings.

`.claude/hooks/session-start.sh` restores the REA MCP registration, the REA skill, and the pinned JADX engine JAR (`REA_JADX_MCP_JAR`) in cloud sessions. Extend it rather than adding a second hook.
