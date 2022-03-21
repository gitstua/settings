const mergeArrayByName = require('./lib/mergeArrayByName')

/**
 * @param {import('probot').Probot} robot
 */
module.exports = (robot, _, Settings = require('./lib/settings')) => {
  async function syncSettings (context, repo = context.repo()) {
    const config = await context.config('settings.yml', {}, { arrayMerge: mergeArrayByName })
    return Settings.sync(context.octokit, repo, config)
  }

  async function addIssue(context, repo = context.repo().repo, owner=context.repo().owner) {
    robot.log('adding new Issue');
    const fs = require('fs');
    let buff = fs.readFileSync(`templates/probot-ISSUE.txt`);
    let bodyText = buff.toString().replace('{{owner}}', owner);
    robot.log(bodyText);

    await context.octokit.request(`POST /repos/${owner}/${repo}/issues`, {
      owner: owner,
      repo: repo,
      title: `probot automation run on new repo ${repo}`,
      body: bodyText
    })
  }


  async function addFile (context, repo = context.repo().repo, owner=context.repo().owner) {
    //encode file
    const fs = require('fs');
    const fileName = 'README.md';
    let buff = fs.readFileSync(`templates/${fileName}`);
    let base64data = buff.toString('base64');

    console.log('Image converted to base 64 is:\n\n' + base64data);
    //note: this option did not work so had to revert to directly using REST
    // const { data } = await context.octokit.repos.createOrUpdateFileContents({
    //         owner: owner,
    //         repo: repo,
    //         path: 'README.md',
    //         message: 'Added README.md',
    //         content: contentEncoded
    //       });

    const putCommand = `PUT /repos/${owner}/${repo}/contents/${fileName}`;
    robot.log(putCommand);

     return await context.octokit.request(putCommand, {
      owner: owner,
      repo: repo,
      path: fileName, 
      message: 'added by automation',
      content: base64data,
    })
  }
  

  robot.on('push', async context => {
    const { payload } = context
    const { repository } = payload

    const defaultBranch = payload.ref === 'refs/heads/' + repository.default_branch
    if (!defaultBranch) {
      robot.log.debug('Not working on the default branch, returning...')
      return
    }

    const settingsModified = payload.commits.find(commit => {
      return commit.added.includes(Settings.FILE_NAME) ||
        commit.modified.includes(Settings.FILE_NAME)
    })

    if (!settingsModified) {
      robot.log.debug(`No changes in '${Settings.FILE_NAME}' detected, returning...`)
      return
    }

    return syncSettings(context)
  })

  robot.on('repository.edited', async context => {
    const { payload } = context
    const { changes, repository } = payload

    if (!Object.prototype.hasOwnProperty.call(changes, 'default_branch')) {
      robot.log.debug('Repository configuration was edited but the default branch was not affected, returning...')
      return
    }

    robot.log.debug(`Default branch changed from '${changes.default_branch.from}' to '${repository.default_branch}'`)

    return syncSettings(context)
  })

  robot.on('repository.created', async context => {
    robot.log.info(`repo created`);
    return await addFile(context) && await syncSettings(context) && await addIssue(context)
  })
}
