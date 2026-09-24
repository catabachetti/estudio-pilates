# Registro de prompts

Bitácora de uso de IA durante el desarrollo. Incluye los prompts usados,
los resultados, los fallos detectados y las correcciones aplicadas.

---

## 2026-09-18 — Punto de partida

Configuración de git, creación del repositorio en GitHub y definición
del modelo de datos. Sin uso de IA para generación de código todavía.

**Decisión propia:** elegir un modelo de créditos (paquetes de N clases)
en lugar de un carrito de compras tradicional, porque separa la
transacción (compra) de la operación (reserva) y le da un rol real al
webhook: acreditar clases cuando el pago se confirma.

---

## 2026-09-18 — Vite sobrescribió el README

**Qué pasó:** Al correr `npm create vite@latest .` sobre la carpeta del
repo, elegí "Ignore files and continue" para conservar los archivos
existentes. La plantilla de React igual reemplazó el README.md por el suyo.

**Cómo lo detecté:** `git status` mostraba `modified: README.md` cuando yo
no había tocado ese archivo.

**Corrección:** `git restore README.md` para recuperar la versión del
último commit. El .gitignore que generó Vite sí lo conservé, porque
incluye node_modules, dist y los archivos .env.

**Aprendizaje:** "Ignore files" no garantiza que no se pisen archivos.
Conviene commitear antes de correr cualquier scaffolding, justamente para
poder revertir.

---

## Plantilla

### AAAA-MM-DD — Título

**Prompt:**

**Resultado:**

**Fallo detectado:**

**Cómo lo detecté:**

**Corrección aplicada:**