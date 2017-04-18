var GitHubApi = require("github");
var env = require('node-env-file');
var Queue = require('promise-queue');
var _ = require('lodash');
var db = require('./db');
var program = require('commander');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'app'});
var moment = require('moment');

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

function transateToPersistedIssue(gi) {
  var issue = {
    number: gi.number,
    title: gi.title,
    state: gi.state,
    comments: gi.comments,
    labels: _.map(gi.labels, 'name'),
    milestone: _.get(gi, "milestone.title", null),
    created_at: gi.created_at,
    updated_at: gi.updated_at,
    closed_at: gi.closed_at,
    user_login: _.get(gi, "user.login", null),
    assignee: _.get(gi, 'assignee.login', null),
    is_pull_request: gi.pull_request !== undefined,
    id: gi.id,
    reactions_total: gi.reactions.total_count,
    reactions_plus1: gi.reactions['+1'],
    reactions_minus1: gi.reactions['-1'],
    reactions_heart: gi.reactions.heart,
  };
  return issue;
}

function issueListHandler(res) {
  log.info('got issues', {
   'rate-limit-remainign': res.meta['x-ratelimit-remaining'],
    count: res.data.length
  });

  for (let gi of res.data) {
    var issue = transateToPersistedIssue(gi);
    db.saveIssue(issue);
  }

  if (github.hasNextPage(res)) {
    setTimeout(() => {
      queue.add(() => {
        log.info('github issues getting next page');
        return github.getNextPage(res).then(issueListHandler);
      });
    }, 1000);
  }
}

function startIssueSync() {
  log.info('issue sync started');

  return github.issues.getForRepo({
    owner: "grafana",
    repo: "grafana",
    direction: "asc",
    state: 'all',
    per_page: 100,
  }).then(issueListHandler);
}

function commentsListHandler(res) {
  log.info('got comments', {
   'rate-limit-remaining': res.meta['x-ratelimit-remaining'],
    count: res.data.length
  });

  for (let gc of res.data) {
    let issueNr = gc.issue_url.substr(gc.issue_url.lastIndexOf('/') + 1);
    var comment = {
      id: gc.id,
      issue: issueNr,
      created_at: gc.created_at,
      user_login: gc.user.login,
      reactions_total: gc.reactions.total_count,
      reactions_plus1: gc.reactions['+1'],
      reactions_minus1: gc.reactions['-1'],
      reactions_heart: gc.reactions.heart,
    }
    db.saveComment(comment);
  }

  if (github.hasNextPage(res)) {
    setTimeout(() => {
      queue.add(() => {
        log.info('github comments getting next page');
        return github.getNextPage(res).then(commentsListHandler);
      });
    }, 1000);
  }
}
function startCommentsSync() {
  log.info('comments sync started');

  let params = {
    owner: "grafana",
    repo: "grafana",
    sort: 'updated',
    direction: "asc",
    per_page: 100,
  };

  if (program.sinceDays) {
    params.since = moment().subtract(parseInt(program.sinceDays), 'days').utc().format();
  }

  return github.issues.getCommentsForRepo(params).then(commentsListHandler);
}

program
  .version('0.0.1')
  .option('--sinceDays <sinceDays>', 'Date range back in time')
  .command('issues')
  .action(function () {
    queue.add(startIssueSync);
  });

program
  .command('comments')
  .action(function() {
    queue.add(startCommentsSync);
  });

program
  .command('init')
  .action(function () {
    db.resetIndex();
  });

program
  .command('create-index')
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
