# Production tasks
To take this sample based on https://probot.github.io/docs/ and move to production you need to do the following:
- update code handle branches which have a default branch not named main e.g. old name of master
- improve monitoring and logging
- handle where a repo cannot have branch protection added due to licensing constraints (e.g. private in user or non GHE acccount)
- consider using CODEOWNERS to protect the default settings in github.com/{orgname}/.github/.github/settings.yml file or restrict who can push
- consider updating this code to either use CODEOWNERS to protect github.com/{reponame}/.github/settings.yml or updating this code since any user who can push to the repo essentially has admin to the repo or ability to grant this
- handle when a user creates a file when creating a repo - we don't want to add readme if it alredy exists

- handle existing repos
    - loop through all branches
    - find default branch
    - if no protection then add the defaults, add issue, skip readme