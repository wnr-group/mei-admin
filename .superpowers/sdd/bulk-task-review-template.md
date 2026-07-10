# Task Review Template (used per task)

## Context

This is a task review dispatch for subagent-driven development. You will:
1. Read the task brief (requirement specification)
2. Read the implementation report (what was done)
3. Read the diff package (code changes)
4. Verify spec compliance and code quality
5. Report: ✅ APPROVED or ❌ needs fixes

## Your verdicts must cover:
- **Spec Compliance** (✅ or ❌): Did the implementer deliver exactly what the brief required? No more, no less?
- **Code Quality** (✅ or ❌): Is the code clean, typed, tested, documented per this project's standards?

Both must be ✅ for the task to pass. If either is ❌, list specific findings (Critical/Important/Minor severity).

## Findings format

If there are issues:
```
**Spec Compliance:** ❌

**Critical** (blocks approval):
- [Finding 1: what's wrong, why it matters]

**Important** (should fix before merge):
- [Finding 2]

**Minor** (nice to have):
- [Finding 3]

**Code Quality:** [✅ or ❌ with findings]
```

If all clear:
```
**Spec Compliance:** ✅ — all requirements met, nothing extra added

**Code Quality:** ✅ — clean, well-tested, follows project conventions

**Overall:** APPROVED ✅
```

## Do NOT pre-judge or suggest severity — let the findings speak for themselves
