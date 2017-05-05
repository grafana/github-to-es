var GitHubApi = require("github");
var env = require('node-env-file');
var Queue = require('promise-queue');
var _ = require('lodash');
var db = require('./db');
var program = require('commander');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'app'});
var moment = require('moment');
var RepoSync = require('./reposync');

log.info("Starting");

// set promise
Queue.configure(require('bluebird'));

// load env
env(__dirname + '/.env');

var github = new GitHubApi({
  // optional
  debug: false,
  protocol: "https",
  host: "api.github.com", // should be api.github.com for GitHub
  pathPrefix: "", // for some GHEs; none for GitHub
  headers: {
    "user-agent": "github-es-exporter",
    "Accept": "application/vnd.github.squirrel-girl-preview",
  },
  Promise: require('bluebird'),
  followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
  timeout: 5000
});

// user token
github.authenticate({
  type: "token",
  token: process.env.GITHUB_TOKEN,
});

// db = db.connect('data', ['issues', 'comments', 'commits']);
var queue = new Queue(1, 1000);


function startRepoSync() {
  const config = require('./config.json');

  for (let repoSyncOptions of config.repos) {
    const rs = new RepoSync(repoSyncOptions, queue);
    rs.start();
  }
}

program
  .version('0.0.1')
  .command('start')
  .action(startRepoSync);

program
  .command('reset')
  .action(function () {
    db.resetIndex();
  });

program
  .command('init')
  .action(function () {
    db.createIndex();
  });

program.parse(process.argv);

// console.log("res", res);
// for (var i = 0; i <= res.length; i++) {
//   var issue = res[i];
//   console.log('number', issue.number);
// }

// if (github.hasNextPage(res)) {
//   github.getNextPage(res, customHeaders, function(err, res) {
//     showIssueIds(res);
//   });
// }
