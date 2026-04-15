# Fish prompt integration

Append a `5h:42% 7d:88%` segment to your fish prompt.

Add to `~/.config/fish/functions/fish_prompt.fish` (or wherever you
define `fish_prompt`):

```fish
function _claude_usage_segment
  if type -q claude-usage
    claude-usage prompt --no-color --cache 60 2>/dev/null
  end
end

function fish_prompt
  set -l usage (_claude_usage_segment)
  echo (whoami)@(hostname) (prompt_pwd) $usage
  echo -n '> '
end
```

For an asynchronous version that does not block the prompt, write the
result to a temp file from a background task and read the cached value:

```fish
function _claude_usage_refresh --on-event fish_prompt
  if not set -q _claude_usage_pid
    fish -c 'while true; claude-usage prompt --no-color > /tmp/claude-usage.txt 2>/dev/null; sleep 60; end' &
    set -g _claude_usage_pid (jobs -lp)
  end
end

function _claude_usage_segment
  test -r /tmp/claude-usage.txt; and cat /tmp/claude-usage.txt
end
```
