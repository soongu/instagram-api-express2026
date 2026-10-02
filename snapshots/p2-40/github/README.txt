# 2026-09-14 soongu/p2-40-ruleset-probe 실측 (공개 임시 저장소, GitHub Free · SSH 원격 — p1-13 이 가르친 형태)
# 룰셋: 기본 브랜치 · Restrict deletions · Block force pushes · Require a pull request before merging(승인 0)
# 병합 설정: Allow squash merging 만 · Automatically delete head branches
#
# 실측 사실 (gh · GraphQL)
issue-and-pr-share-numbers: 이슈 #1 을 만든 뒤 연 PR 이 #2 로 붙었다
closes-keyword: PR 본문 "Closes #1" → Squash 병합 뒤 이슈 #1 state=CLOSED stateReason=COMPLETED
squash-commit-message: "이슈와 PR 템플릿을 더한다 (#2)" — PR 제목 뒤에 (#번호)
auto-delete-head-branch: 병합 뒤 원격 브랜치 목록 ["main"]
templates-before-merge: 기능 브랜치에만 있을 때 issueTemplates=[] pullRequestTemplates=[]
templates-after-merge: pullRequestTemplates=[pull_request_template.md]
issue-template-name-length: name "기능"(2자)·"버그"(2자)는 issueTemplates 에 안 잡힘 · "기능 하나 만들기"는 잡힘
approvals-1-self: gh pr review --approve → "Review Can not approve your own pull request"
approvals-1-merge: mergeStateStatus=BLOCKED reviewDecision=REVIEW_REQUIRED · "the base branch policy prohibits the merge"
conflict-pr-state: 먼저 합쳐진 PR 과 같은 줄을 고친 PR → mergeable=CONFLICTING mergeStateStatus=DIRTY
feature-branch-force-with-lease: 룰셋이 기본 브랜치만 겨누므로 기능 브랜치의 --force-with-lease 는 통과("+ 7fbecc3...63a4657 … (forced update)")
contributing: CONTRIBUTING.md 를 main 에 합치면 contributingGuidelines.resourcePath=/…/blob/main/CONTRIBUTING.md
#
# 룰셋 화면 (Settings → Rulesets → New branch ruleset, 2026-09-14 브라우저로 읽음)
ui-ruleset-fields: "Ruleset Name" · "Enforcement status" 기본값 "Disabled" · "Bypass list" · "Target branches" → "Add target"
ui-add-target-options: "Include default branch" · "Include all branches" · "Include by pattern" · "Exclude by pattern"
ui-branch-rules: "Restrict creations" · "Restrict updates" · "Restrict deletions" · "Require linear history" · "Require deployments to succeed" · "Require signed commits" · "Require a pull request before merging" · "Require status checks to pass" · "Block force pushes" …
ui-default-checked: "Restrict deletions" · "Block force pushes" 는 처음부터 체크 · "Require a pull request before merging" 은 체크 안 됨
ui-pr-rule-settings: 체크하면 "Required approvals" 기본값 "0" · "Dismiss stale pull request approvals when new commits are pushed" · "Require approval of the most recent reviewable push" · "Require conversation resolution before merging" · "Allowed merge methods" 기본 "Merge, Squash, Rebase"
#
# 조직 권한 (github/docs 원문, 2026-09-14)
org-base-permission-default: "By default, members of an organization will have **Read** permissions to the organization's public repositories."
org-base-permission-path: 조직 Settings → "Member privileges" → "Base permissions" 드롭다운 → "Change default permission to PERMISSION"
org-invite-path: 조직 페이지 "People" → "Invite member" → 사용자 이름이나 이메일 → 초대 링크가 든 이메일
#
# 직접 해보기 3 (로컬 실측 — test/p2-40.test.js 가 매번 다시 잰다)
rebase-drops-emptied-commit: 충돌을 동료 값으로만 풀면 `rebase --continue` 가 "Successfully rebased" 로 끝나고 내 커밋이 사라진다(`--skip` 은 "fatal: no rebase in progress")
#
# 규칙 4(브랜치 이름)를 GitHub 에 맡길 수 있나 — 과제 [응용]
branch-name-pattern-rule: 룰셋 규칙 branch_name_pattern 을 API 로 만들면 422 "Invalid rule 'branch_name_pattern': " (무료 공개 저장소) · 화면의 Branch rules 목록에도 이름을 보는 규칙이 없다
restrict-creations-by-name: 그래도 막을 수는 있다 — 대상 "Include all branches" + "Exclude by pattern" feat/** · fix/** · docs/** 에 "Restrict creations" 를 걸면 wip-test 는 거절(push-bad-branch-name.txt · "- Cannot create ref due to creations being restricted."), feat/list-page 는 올라간다. 확인 뒤 룰셋 23299474 삭제
