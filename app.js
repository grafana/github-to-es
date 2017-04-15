var GitHubApi = require("github");
var env = require('node-env-file');
var Queue = require('promise-queue');

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
    "user-agent": "github-es-exporter" // GitHub is happy with a unique user agent
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

var queue = new Queue(1, 1000);

function issueListHandler(res) {
  for (let issue of res.data) {
    console.log("number", issue.number);
    console.log("number", issue.number);
  }

  if (github.hasNextPage(res)) {
    setTimeout(() => {
      queue.add(() => {
        console.log('issueListHandler next page');
        return github.getNextPage(res).then(issueListHandler);
      });
    }, 1000);
  }
}

function startIssueWalker() {
  console.log('issue walker start');

  return github.issues.getForRepo({
    owner: "grafana",
    repo: "grafana",
    direction: "asc",
    state: 'all',
  }).then(issueListHandler);
}

queue.add(startIssueWalker);

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
