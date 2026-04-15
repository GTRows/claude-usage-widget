# Bash prompt integration

Adds a compact `5h:42% 7d:88%` segment to your bash `$PS1`.

## One-shot version with built-in cache

Add to `~/.bashrc`:

```bash
_claude_usage_segment() {
  if command -v claude-usage >/dev/null 2>&1; then
    claude-usage prompt --no-color --cache 60 2>/dev/null
  fi
}

export PS1='\u@\h \w $(_claude_usage_segment)\n\$ '
```

`--cache 60` reuses the last response for up to 60 seconds, so most
prompt redraws are served from a local file (no network round-trip).
Drop the flag for always-fresh data, or raise it for slower accounts.

## Background variant (only if --cache is not enough)

If even reading the cached JSON adds noticeable latency, run the CLI
in the background and read a plain-text file instead:

```bash
_claude_usage_cache=/tmp/claude-usage.txt
_claude_usage_pid=

_claude_usage_refresh() {
  while true; do
    claude-usage prompt --no-color > "$_claude_usage_cache" 2>/dev/null
    sleep 60
  done
}

if [ -z "$_claude_usage_pid" ] && command -v claude-usage >/dev/null 2>&1; then
  _claude_usage_refresh &
  _claude_usage_pid=$!
fi

_claude_usage_segment() {
  [ -r "$_claude_usage_cache" ] && cat "$_claude_usage_cache"
}

export PS1='\u@\h \w $(_claude_usage_segment)\n\$ '
```

Kill the helper with `kill $_claude_usage_pid` or by closing the shell.
