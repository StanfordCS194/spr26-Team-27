# InLecture

## Contributing Guidelines

### Want to work on a new change?

1. Ensure you're in sync with main:
   - `git checkout main`
   - `git pull origin main --rebase`
2. Checkout a new branch with the naming convention: `<your-name-or-some-alias>/<feature-this-branch-implements>`
   - `git checkout -b kkellyb/set-up-react-app`

### Ready to push your changes?

_make sure you’re on the branch where you’re working on your new change:_

1. Re-sync with main:
   - `git pull origin main --rebase`
   - resolve merge conflicts if any
2. Ensure CI passes locally
3. Stage your changes:
   - `git add .`
4. Commit your changes:
   - `git commit -m "set up react app"`
5. Push your changes to your branch
   - `git push origin kkellyb/set-up-react-app`
6. Go to the repo's webpage on Github & open up a PR to merge your branch into main

### Need to edit a PR?

1. `git add .`
2. `git commit --amend --no-edit`
3. `git push origin <branch name> --force`
