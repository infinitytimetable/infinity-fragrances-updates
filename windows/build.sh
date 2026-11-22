#!/usr/bin/env bash
# Builds the Windows PC package: Infinity-Fragrances-Hub-<version>-Windows.zip (in out/).
# Run from anywhere. Needs: unzip, zip, curl (or ELECTRON_ZIP=<path to the Electron zip>).
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(tr -d ' \r\n' < windows/VERSION)
EL_VER=33.2.1
EL_SHA=c325a6d905c67107e166267813ea2151ae7fd316c0a88de0081db0b9851a9946
EZ=${ELECTRON_ZIP:-electron.zip}
if [ ! -f "$EZ" ]; then curl -fsSL -o "$EZ" "https://github.com/electron/electron/releases/download/v$EL_VER/electron-v$EL_VER-win32-x64.zip"; fi
echo "$EL_SHA  $EZ" | sha256sum -c -
[ -f "desktop-$VER.html" ] || { echo "desktop-$VER.html is missing"; exit 1; }
grep -q "const APP_VERSION = '$VER'" "desktop-$VER.html" || { echo "desktop-$VER.html is not version $VER"; exit 1; }
rm -rf build out; mkdir -p out
D="build/Infinity Fragrances Hub"; mkdir -p "$D"
unzip -q "$EZ" -d "$D"
mv "$D/electron.exe" "$D/Infinity Fragrances Hub.exe"
rm -f "$D/resources/default_app.asar"
find "$D/locales" -type f ! -name 'en-US.pak' ! -name 'en-GB.pak' -delete
mkdir -p "$D/resources/app"
cp windows/app/main.js windows/app/preload.js windows/app/icon.png windows/app/icon.ico "$D/resources/app/"
cp "desktop-$VER.html" "$D/resources/app/index.html"
printf '{\n "name": "infinity-fragrances-hub",\n "productName": "Infinity Fragrances Hub",\n "version": "%s",\n "description": "Business hub for Infinity Fragrances",\n "author": "Infinity Fragrances",\n "main": "main.js"\n}\n' "$VER" > "$D/resources/app/package.json"
sed "s/__VER__/$VER/g; s/\$/\r/" windows/READ-ME-FIRST.txt > "$D/READ ME FIRST.txt"
(cd build && zip -r -9 -q "../out/Infinity-Fragrances-Hub-$VER-Windows.zip" "Infinity Fragrances Hub")
ls -l "out/Infinity-Fragrances-Hub-$VER-Windows.zip"
