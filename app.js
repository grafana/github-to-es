var Queue = require('promise-queue');
var program = require('commander');
var RepoSync = require('./reposync');
var db = require('./db');

// set promise
Queue.configure(require('bluebird'));

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
