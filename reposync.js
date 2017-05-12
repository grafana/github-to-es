var _ = require('lodash');
var db = require('./db');
var bunyan = require('bunyan');
var log = bunyan.createLogger({name: 'RepoSync'});
var config = require('./config.json');
var GitHubApi = require("github");
var moment = require('moment');

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
  timeout: 50000
});

log.info("github_token", config.github_token);

// user token
github.authenticate({
  type: "token",
  token: config.github_token,
});

class RepoSync {

  constructor(options, queue) {
    this.options = options;
    this.queue = queue;

    const repoParts = options.repo.split('/');
    this.owner = repoParts[0];
    this.repo = repoParts[1];
  }

  start() {
    log.info('Staring repo sync instance', {repo: this.options.repo});

    if (this.options.issues) {
      this.queue.add(() => this.startIssueSync());
    }

    if (this.options.comments) {
      this.queue.add(() => this.startCommentsSync());
    }
  }

  startIssueSync() {
    let params = {
      owner: this.owner,
      repo: this.repo,
      direction: "asc",
      state: 'all',
      page: this.options.page || 0,
      per_page: 100,
    };

    if (this.options.sinceDays) {
      params.since = moment().subtract(parseInt(this.options.sinceDays), 'days').utc().format();
    }

    return github.issues.getForRepo(params).then(this.issueListHandler.bind(this));
  }

  startCommentsSync() {
    log.info('Comments sync started');

    let params = {
      owner: this.owner,
      repo: this.repo,
      sort: 'updated',
      direction: "asc",
      page: this.options.page || 0,
      per_page: 100,
    };

    if (this.options.sinceDays) {
      params.since = moment().subtract(parseInt(this.options.sinceDays), 'days').utc().format();
    }

    return github.issues.getCommentsForRepo(params).then(this.commentsListHandler.bind(this));
  }

  saveComment(comment) {
    this.queue.add(() => db.saveComment(comment));
  }

  commentsListHandler(res) {
    log.info('Got comments', {
      'rate-limit-remaining': res.meta['x-ratelimit-remaining'],
      count: res.data.length
    });

    for (let gc of res.data) {
      let issueNr = gc.issue_url.substr(gc.issue_url.lastIndexOf('/') + 1);
      var comment = {
        id: gc.id,
        issue: issueNr,
        repo: this.options.repo,
        created_at: gc.created_at,
        user_login: gc.user.login,
        reactions_total: gc.reactions.total_count,
        reactions_plus1: gc.reactions['+1'],
        reactions_minus1: gc.reactions['-1'],
        reactions_heart: gc.reactions.heart,
      }
      this.saveComment(comment);
    }

    if (github.hasNextPage(res)) {
      this.nextCommentsPage(res);
    } else {
      log.info("Got last comments page", res.meta.link);
    }
  }

  nextCommentsPage(res) {
    setTimeout(() => {
      this.queue.add(() => {
        log.info('Github comments getting next page');
        return github.getNextPage(res).then(this.commentsListHandler.bind(this));
      });
    }, 1000);
  }

  nextIssuePage(res) {
    setTimeout(() => {
      this.queue.add(() => {
        log.info('Github issues getting next page');
        return github.getNextPage(res).then(this.issueListHandler.bind(this));
      });
    }, 1000);
  }

  saveIssue(issue) {
    this.queue.add(() => db.saveIssue(issue));
  }

  issueListHandler(res) {
    log.info('Got issues', {
      'rate-limit-remainign': res.meta['x-ratelimit-remaining'],
      count: res.data.length
    });

    for (let gi of res.data) {
      var issue = this.transformIssueToElasticDoc(gi);
      this.saveIssue(issue);
    }

    if (github.hasNextPage(res)) {
      this.nextIssuePage(res);
    } else {
      log.info("Got last issues page", res.meta.link);
    }
  }

  transformIssueToElasticDoc(gi) {
    var issue = {
      number: gi.number,
      title: gi.title,
      state: gi.state,
      repo: this.options.repo,
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
      created_iso_week_day: moment(gi.created_at).isoWeekday(),
    };

    // calculate time opnen
    if (gi.closed_at) {
      var span = moment.duration(moment(gi.closed_at).diff(moment(gi.created_at)));
      issue.minutes_open = span.asMinutes();
    }

    if (gi.closed_by) {
      issue.closed_by = gi.closed_by.login;
    }


    return issue;
  }
}

module.exports = RepoSync;
