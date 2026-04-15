# Zsh prompt integration

Drop the `5h:42% 7d:88%` segment into your zsh `RPROMPT`.

## Inline version

Add to `~/.zshrc`:

```zsh
_claude_usage_segment() {
  if (( $+commands[claude-usage] )); then
    claude-usage prompt --no-color 2>/dev/null
  fi
}

setopt PROMPT_SUBST
RPROMPT='%F{244}$(_claude_usage_segment)%f'
```

## Async (zsh-async required)

If you have [zsh-async](https://github.com/mafredri/zsh-async), avoid
blocking the prompt:

```zsh
async_init
async_start_worker claude_usage_worker -n
async_register_callback claude_usage_worker _claude_usage_done

_claude_usage_done() {
  local segment="$3"
  RPROMPT="%F{244}${segment}%f"
  zle && zle reset-prompt
}

precmd() {
  if (( $+commands[claude-usage] )); then
    async_job claude_usage_worker claude-usage prompt --no-color
  fi
}
```
