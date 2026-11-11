#!/usr/bin/env bash
# Instala zsh en el runner de GitHub, que no lo trae, para los arneses de
# supabase/ y de docs/ejemplos/.
#
# POR QUE HAY DOS CAMINOS. El 11 de noviembre de 2026 el runner no pudo resolver
# azure.archive.ubuntu.com durante horas: apt-get se colgaba mas de cinco
# minutos y cortaba con "Temporary failure resolving", y con eso se caian dos
# jobs sin que hubiera nada mal en el proyecto. Reintentar no lo arreglaba:
# fallo igual en dos corridas separadas por veinte minutos.
#
#   1. apt-get, con tiempo limite. Es lo mas rapido cuando anda (~10 s).
#   2. Homebrew, que viene en la imagen ubuntu-24.04 sin estar en el PATH y baja
#      sus paquetes de ghcr.io, o sea de GitHub, no de los servidores de Ubuntu.
#
# El PATH nuevo va a $GITHUB_PATH, que vale para los pasos SIGUIENTES del job,
# no para este: por eso la instalacion es un paso propio.
set -u

if command -v zsh > /dev/null; then
  echo "zsh ya estaba: $(zsh --version)"
  exit 0
fi

if timeout 120 bash -c 'sudo apt-get update -o Acquire::Retries=2 && sudo apt-get install -y -o Acquire::Retries=2 zsh'; then
  echo "zsh instalado con apt-get: $(zsh --version)"
  exit 0
fi

echo "::warning::apt-get no pudo instalar zsh en 120 s; se prueba con Homebrew"
BREW=/home/linuxbrew/.linuxbrew/bin/brew
if [ ! -x "$BREW" ]; then
  echo "::error::apt-get fallo y no hay Homebrew en $BREW: no hay de donde sacar zsh"
  exit 1
fi
if ! HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 "$BREW" install zsh; then
  echo "::error::Homebrew tampoco pudo instalar zsh"
  exit 1
fi
DIR="$("$BREW" --prefix)/bin"
echo "$DIR" >> "$GITHUB_PATH"
echo "zsh instalado con Homebrew: $("$DIR/zsh" --version)"
