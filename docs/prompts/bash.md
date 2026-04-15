# Bash prompt integration

Adds a compact `5h:42% 7d:88%` segment to your bash `$PS1`.

## One-shot version (cached, no async)

Add to `~/.bashrc`:

```bash
_claude_usage_segment() {
  if command -v claude-usage >/dev/null 2>&1; then
    claude-usage prompt --no-color 2>/dev/null
  fi
}

export PS1='\u@\h \w $(_claude_usage_segment)\n\$ '
```

Each new prompt invokes the CLI synchronously. Use `--interval`-aware
caching below if your account is slow.

## Cached background version

Refreshes the segment in the background every 60 seconds and stores
the result in `/tmp/claude-usage.txt`. The prompt only reads the
cached file, so it never blocks.

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
