# Forgotten Letters — Dev Container zshrc
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"

plugins=(
  git
  zsh-autosuggestions
  zsh-syntax-highlighting
  zsh-completions
)

source $ZSH/oh-my-zsh.sh

# Node / npm
export PATH="$HOME/.local/bin:$PATH"

# Aliases
alias ll="ls -lah"
alias gs="git status"
alias gd="git diff"
alias dev="npm run dev"
alias build="npm run build"
alias lint="npm run lint"
