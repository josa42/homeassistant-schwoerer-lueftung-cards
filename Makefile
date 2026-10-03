.PHONY: help release

help:
	@echo "Available commands:"
	@echo ""
	@echo "Release:"
	@echo "  make release  - Start the release workflow: minor if a feat commit"
	@echo "                  landed since the last release, else patch."
	@echo "                  Override with VERSION=1.2.3, major, minor or patch"

release:
	@# The workflow releases origin/main, so that is what the bump is read from.
	@git fetch --quiet --tags origin main
	@if [ -n "$$(git status --porcelain --untracked-files=no)" ]; then \
		echo "Uncommitted changes would not be released. Commit and push them first." >&2; \
		exit 1; \
	fi
	@ahead=$$(git rev-list --count origin/main..HEAD); \
	if [ "$$ahead" -gt 0 ]; then \
		echo "$$ahead local commit(s) not on origin/main would not be released. Push them first." >&2; \
		exit 1; \
	fi
	@version="$(VERSION)"; \
	if [ -z "$$version" ]; then \
		last=$$(git describe --tags --abbrev=0 --match 'v*' origin/main 2>/dev/null); \
		if [ -z "$$last" ]; then \
			echo "No release yet, pass the first version: make release VERSION=1.2.3" >&2; \
			exit 1; \
		fi; \
		if git log --format=%s "$$last..origin/main" | grep -qE '^feat(\(.*\))?!?:'; then \
			version=minor; \
		else \
			version=patch; \
		fi; \
		echo "Releasing a $$version: commits since $$last decide it"; \
	fi; \
	gh workflow run release.yml -f version="$$version"
	@echo "Release workflow started. Follow it with: gh run watch"
