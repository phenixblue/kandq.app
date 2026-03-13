SHELL := /usr/bin/env bash

.DEFAULT_GOAL := help

.PHONY: help install dev build start lint typecheck test audit preflight preflight-fast pr-check \
	supabase-start supabase-stop supabase-status db-reset clean

help:
	@echo "Common targets:"
	@echo "  make install         - Install dependencies"
	@echo "  make dev             - Run Next.js dev server"
	@echo "  make build           - Build app"
	@echo "  make start           - Start built app"
	@echo "  make lint            - Run ESLint"
	@echo "  make typecheck       - Run TypeScript typecheck"
	@echo "  make test            - Run unit tests when configured"
	@echo "  make audit           - Run npm audit report + npm audit fix"
	@echo "  make preflight       - Run checks before commit/PR"
	@echo "  make preflight-fast  - Run quick checks before commit (no build)"
	@echo "  make pr-check        - Alias for preflight"
	@echo "  make supabase-start  - Start local Supabase"
	@echo "  make supabase-stop   - Stop local Supabase"
	@echo "  make supabase-status - Show local Supabase status"
	@echo "  make db-reset        - Reset local Supabase DB"
	@echo "  make clean           - Remove local build/test artifacts"

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint -- .

typecheck:
	npx tsc --noEmit

test:
	./hack/scripts/run-tests.sh

audit:
	./hack/scripts/audit.sh

preflight: audit
	@$(MAKE) lint
	@$(MAKE) typecheck
	@$(MAKE) test
	@$(MAKE) build
	@echo "[preflight] All checks passed"

preflight-fast: audit
	@$(MAKE) lint
	@$(MAKE) typecheck
	@$(MAKE) test
	@echo "[preflight-fast] Checks passed"

pr-check: preflight

supabase-start:
	npx supabase start

supabase-stop:
	npx supabase stop

supabase-status:
	npx supabase status

db-reset:
	npx supabase db reset

clean:
	rm -rf .next coverage
