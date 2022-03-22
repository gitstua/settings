const mergeArrayByName = require('./lib/mergeArrayByName')

/**
 * @param {import('probot').Probot} robot
 */
module.exports = (robot, _, Settings = require('./lib/settings')) => {
  async function syncSettings (context, repo = context.repo()) {
    robot.log('syncSettings');
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

    robot.log('file converted to base 64 is:\n' + base64data);
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

//When settings.yml is pushed to github.com/orgname/.github/.github then we initialise all repos
//we do NOT update any other repo or any with branch protection already enabled 
  robot.on('push', async context => {
    const { payload } = context
    const { repository } = payload
    let owner = context.repo().owner
    let repo = context.repo().repo

    robot.log(`Got a push for ${repository.full_name}`)

    if (!repository.full_name.toLowerCase().endsWith('/.github')){
      robot.log.info('push only initializes all existing when a push is made to template repo in organization or account root named /.github')
      return true;
    }

    const defaultBranch = payload.ref === 'refs/heads/' + repository.default_branch
    if (!defaultBranch) {
      robot.log.debug('Not working on the default branch, returning...')
      return
    }

    const settingsModified = payload.commits.find(commit => {
      return commit.added.includes(Settings.FORCE_OCTO_REPO_INIT) ||
        commit.modified.includes(Settings.FORCE_OCTO_REPO_INIT)
    })

    if (!settingsModified) {
      robot.log.debug(`No changes in '${Settings.FORCE_OCTO_REPO_INIT}' detected, returning...`)
      return
    }

    //loop through all repos and add settings.yml where they have no issue with the title OCTO_REPO_ISSUE_TITLE
    robot.log('InstallationId is ' + context.payload.installation.id);


   // await octokit.request('GET /app/installations');


//    const installationOctokit = new ProbotOctokit({
  const { Octokit } = require("@octokit/core");
  const { createProbotAuth } = require("octokit-auth-probot");
    //const installationOctokit = 
    new Octokit({
        auth: {
        id: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY,
        installationId: context.payload.installation.id,
      },
      authStrategy: createProbotAuth
    });
  
    const repoList = await installationOctokit.repos
      .get({
        owner: owner,
        repo: repo,
      })
      .catch(console.warn);
      console.log("repo", repoList);
      //res.json(repo);

    // data.forEach(element => {
    //     const name = element.name;
    //     octokit.repos.listCommits({
    //         owner,
    //         name,
    //     }).then(r => {
    //         total += r.data.length;
    //     }).catch(error => console.log(error));
    // })
    // console.log(total);

    // await octokit.request('GET /repos/{owner}/{repo}/issues', {
    //   owner: 'octocat',
    //   repo: 'hello-world'
    // }) 

    return syncSettings(context)
   })

  robot.on('repository.created', async context => {
    robot.log.info(`repo created`);
    return await addFile(context) && await syncSettings(context) && await addIssue(context)
  })

}
