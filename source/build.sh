#!/bin/sh
cd "$(dirname "$0")"
{
  cat head.html body.html
  echo "<script>"
  cat langs.js engine.js render.js
  echo "(function () { 'use strict';"
  cat app-core.js app-ui.js app-lang.js app-lib.js app-book.js app-ai.js app-init.js
  echo "})();"
  echo "</script>"
} > index.html
# test copy wrapped the way the publish step wraps the page
{
  echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  cat index.html
  echo '</body></html>'
} > test.html
wc -c index.html
