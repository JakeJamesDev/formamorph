#!/usr/bin/env bash
# Post-deploy contract check for https://formamorph.ai. Run from the repo root with the assembled
# upload root at ./out (the deploy step's own directory), or point OUT_DIR elsewhere.
#
# Invoked as `bash scripts/checkLiveSite.sh` so a missing executable bit never matters, and kept in a
# file rather than inline YAML so tests exercise the shipped text instead of a copy.
#
# Actions runs `run:` blocks as `bash -e {0}`, which would abort at the first unreachable URL and skip
# the rest. Every probe must report, so error-exit and pipefail are off and `fail` is the verdict.
set +e +o pipefail
set -u

# Cloudflare answers the deploy API before every edge node serves the new build, and the `_redirects`
# rules land after the assets beside them do. Probing once is a coin flip: the first run of this check
# fired 429 ms after "Deployment complete" and read 522 on the two rule-only paths while the assets
# were already correct. So the whole battery retries, not just the readiness probe.
ATTEMPTS="${ATTEMPTS:-8}"
DELAY="${DELAY:-15}"
# Overridable so the same script can run against a local emulator; CI always uses the real hosts.
BASE_AI="${BASE_AI:-https://formamorph.ai}"
BASE_COM="${BASE_COM:-https://formamorph.com}"
OUT_DIR="${OUT_DIR:-out}"
# Committed with the site and never content-hashed, so it is the right witness for the site cache rule.
SITE_ASSET="${SITE_ASSET:-/site/icon.png}"

# Read the hashed name out of the deployed index.html so this follows every rebuild. An empty result is
# a broken build rather than a slow edge, so it fails now instead of burning the retry budget.
ASSET=$(grep -o 'assets/[A-Za-z0-9._-]*[.]js' "$OUT_DIR/play/index.html" | head -1)
if [ -z "$ASSET" ]; then
  echo "::error::No hashed asset found in $OUT_DIR/play/index.html"
  exit 1
fi

REPORT=$(mktemp)
fail=0

# Collects verdicts rather than printing them. A failure on a non-final attempt only means "not settled
# yet", and annotating it would flag a run that goes on to pass.
check() {
  if [ "$2" = "$3" ]; then
    echo "ok    $1 -> $3" >> "$REPORT"
  else
    echo "FAIL  $1 - expected '$2', got '$3'" >> "$REPORT"
    fail=1
  fi
}

# Same, for a header whose exact value is not ours to pin.
check_glob() {
  case "$3" in
    $2) echo "ok    $1 -> $3" >> "$REPORT" ;;
    *) echo "FAIL  $1 - expected '$2', got '$3'" >> "$REPORT"; fail=1 ;;
  esac
}

content_type() {
  curl -sSI --max-time 20 "$1" | tr -d '\r' | awk 'tolower($1)=="content-type:"{print tolower($2)}' | cut -d';' -f1
}

cache_control() {
  curl -sSI --max-time 20 "$1" | tr -d '\r' | sed -n 's/^[Cc]ache-[Cc]ontrol: //p'
}

battery() {
  fail=0
  : > "$REPORT"

  # The app.
  check "/play/ status" "200" "$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$BASE_AI/play/")"
  check "/play/ content-type" "text/html" "$(content_type "$BASE_AI/play/")"
  check "/play redirect" "301 $BASE_AI/play/" "$(curl -sS --max-time 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE_AI/play")"
  check ".com redirect" "301 $BASE_AI/play/" "$(curl -sS --max-time 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE_COM/play/")"
  check_glob "$ASSET cache-control" "*max-age=31536000*immutable*" "$(cache_control "$BASE_AI/play/$ASSET")"

  # The site. The root serves the landing page itself now — a redirect here is the old contract.
  check "/ status" "200" "$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$BASE_AI/")"
  check "/ content-type" "text/html" "$(content_type "$BASE_AI/")"
  ROOT_BODY=$(curl -sS --max-time 20 "$BASE_AI/")
  case "$ROOT_BODY" in
    *Formamorph*) echo "ok    / names Formamorph" >> "$REPORT" ;;
    *) echo "FAIL  / names Formamorph - the served root does not mention it" >> "$REPORT"; fail=1 ;;
  esac
  check_glob "$SITE_ASSET cache-control" "*max-age=86400*" "$(cache_control "$BASE_AI$SITE_ASSET")"
}

attempt=1
while [ "$attempt" -le "$ATTEMPTS" ]; do
  battery
  [ "$fail" -eq 0 ] && break
  [ "$attempt" -eq "$ATTEMPTS" ] && break
  echo "--- attempt $attempt/$ATTEMPTS: not settled, retrying in ${DELAY}s ---"
  cat "$REPORT"
  sleep "$DELAY"
  attempt=$((attempt + 1))
done

cat "$REPORT"
if [ "$fail" -ne 0 ]; then
  # Annotate only now that the verdict is final, so a run that settles late stays clean.
  sed -n 's/^FAIL  /::error::/p' "$REPORT"
  echo "::error::Live checks still failing after $ATTEMPTS attempts over $(( (ATTEMPTS - 1) * DELAY ))s."
  exit 1
fi
