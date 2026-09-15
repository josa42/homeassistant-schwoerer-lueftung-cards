#!/usr/bin/env bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ -z "$1" ]; then
    print_error "Usage: $0 <version>"
    print_error "Example: $0 1.0.0"
    exit 1
fi

VERSION=$1
TAG="v${VERSION}"

CHANGELOG_FILE="CHANGELOG.md"
CARD_FILE="schwoerer-lueftung-cards.js"

cd "$(dirname "$0")/.."

# This script edits tracked files before it commits them, so a failure part way
# through would otherwise leave the working tree dirty for the user to clean up
# by hand. Put everything back instead. Only safe because the working directory
# is verified clean below.
TREE_VERIFIED_CLEAN=0
CHANGES_COMMITTED=0
restore_on_failure() {
    local status=$?
    if [ "$status" -ne 0 ] && [ "$TREE_VERIFIED_CLEAN" -eq 1 ] && [ "$CHANGES_COMMITTED" -eq 0 ]; then
        if ! git diff-index --quiet HEAD --; then
            print_warn "Aborting, reverting the edits this script made"
            git checkout -- "$CHANGELOG_FILE" "$CARD_FILE" 2>/dev/null || true
        fi
    fi
    exit $status
}
trap restore_on_failure EXIT

if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format. Please use semantic versioning (e.g., 1.0.0)"
    exit 1
fi

print_info "Preparing release ${TAG}..."

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

if ! git diff-index --quiet HEAD --; then
    print_error "Working directory is not clean. Please commit or stash your changes."
    exit 1
fi
TREE_VERIFIED_CLEAN=1

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warn "You are not on the main branch (current: ${CURRENT_BRANCH})"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
    print_error "Tag ${TAG} already exists"
    exit 1
fi

if [ ! -f "$CHANGELOG_FILE" ]; then
    print_error "Changelog not found: $CHANGELOG_FILE"
    exit 1
fi

# Dots are literal, and the heading must end or continue with a non-digit, so
# that 1.0.1 does not match a "## 1.0.10" section.
ESCAPED_VERSION=${VERSION//./\\.}

# Work in progress collects under "## Unreleased" between releases. Promote it
# to this version rather than making the release editor do it by hand. The
# checks below then run against the result, so a promoted section is held to
# exactly the same standard as a hand-written one.
if grep -qiE "^## +unreleased *$" "$CHANGELOG_FILE"; then
    if grep -qE "^## +${ESCAPED_VERSION}([^0-9]|$)" "$CHANGELOG_FILE"; then
        print_error "CHANGELOG.md has both an Unreleased section and a ${VERSION} one"
        print_error "Merge them before releasing ${TAG}"
        exit 1
    fi

    # A heading with nothing under it would tag a release documenting nothing,
    # which is the same failure the "still marked unreleased" check exists to
    # catch. Look at what sits between this heading and the next one.
    UNRELEASED_BODY=$(awk '
        /^## +[Uu]nreleased *$/ { collecting = 1; next }
        /^## / { collecting = 0 }
        collecting && NF { print }
    ' "$CHANGELOG_FILE")
    if [ -z "$UNRELEASED_BODY" ]; then
        print_error "The Unreleased section in CHANGELOG.md is empty"
        print_error "Describe what ${VERSION} changes before releasing it"
        exit 1
    fi

    RELEASE_DATE=$(date +%Y-%m-%d)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' -E "s/^## +[Uu]nreleased *$/## ${VERSION} - ${RELEASE_DATE}/" "$CHANGELOG_FILE"
    else
        sed -i -E "s/^## +[Uu]nreleased *$/## ${VERSION} - ${RELEASE_DATE}/" "$CHANGELOG_FILE"
    fi
    print_info "Promoted the Unreleased section to ${VERSION} - ${RELEASE_DATE}"
fi

if ! grep -qE "^## +${ESCAPED_VERSION}([^0-9]|$)" "$CHANGELOG_FILE"; then
    print_error "CHANGELOG.md has no '## ${VERSION}' section"
    print_error "Add one before releasing ${TAG}"
    exit 1
fi

# A section still marked unreleased documents the tag in name only.
if grep -iqE "^## +${ESCAPED_VERSION}([^0-9]|$).*unreleased" "$CHANGELOG_FILE"; then
    print_error "The ${VERSION} section in CHANGELOG.md is still marked unreleased"
    exit 1
fi

print_info "CHANGELOG.md documents ${VERSION}"

# The card reports CARD_VERSION to the browser console, which is the only way a
# user can tell which build they are running. A stale value there makes bug
# reports lie, so treat a failed bump as a failed release.
print_info "Updating CARD_VERSION in ${CARD_FILE}..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -E "s/^const CARD_VERSION = \"[^\"]*\";/const CARD_VERSION = \"${VERSION}\";/" "$CARD_FILE"
else
    sed -i -E "s/^const CARD_VERSION = \"[^\"]*\";/const CARD_VERSION = \"${VERSION}\";/" "$CARD_FILE"
fi

NEW_VERSION=$(grep -oE '^const CARD_VERSION = "[^"]*"' "$CARD_FILE" | cut -d'"' -f2)
if [ "$NEW_VERSION" != "$VERSION" ]; then
    print_error "Failed to update CARD_VERSION in ${CARD_FILE}"
    exit 1
fi
print_info "CARD_VERSION set to ${VERSION}"

# The card ships unbundled, so a syntax error would reach users as a card that
# silently fails to register. This is the only gate that catches it.
print_info "Checking syntax..."
node --check "$CARD_FILE"

print_info "Committing version bump..."
git add "$CARD_FILE" "$CHANGELOG_FILE"
git commit -m "chore: bump version to ${VERSION}"
CHANGES_COMMITTED=1

print_info "Creating tag ${TAG}..."
git tag -a "$TAG" -m "Release ${TAG}"

print_info "Publishing..."
git push origin "$CURRENT_BRANCH"
git push origin "$TAG"

print_info ""
print_info "Release ${TAG} created successfully."
print_info ""
print_info "Next steps:"
print_info "  1. GitHub Actions attaches ${CARD_FILE} to the release"
print_info "  2. https://github.com/josa42/homeassistant-schwoerer-lueftung-cards/releases"
print_info "  3. HACS offers the new version once that release exists"
