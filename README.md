# InLecture

<p align="center">
  <img src="./InLectureLogo.svg" alt="InLecture - Your favorite class companion" width="680" />
</p>

**Learn More Through Our [Wiki](https://github.com/StanfordCS194/spr26-Team-27/wiki)**

## Repo Layout

This repo is an npm-workspaces monorepo:

```
apps/
  web/        # React + Vite frontend (@spr26/web)
packages/     # shared TypeScript packages (add new ones here)
```

Run scripts from the repo root — `npm run dev` starts the web app, `npm run build` builds every workspace, and `npm run lint` / `npm run format` cover the whole tree. To add a new package, create `packages/<name>/` with its own `package.json` (use `"name": "@spr26/<name>"`); workspaces will pick it up on the next `npm install`.

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
2. Ensure CI passes locally:
   - `npm run format`
   - `npm run lint`
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

Zara Rutherford

### Authors

- Kelly Bonilla Guzmán
- Amrit Baveja
- Vedant Singh
