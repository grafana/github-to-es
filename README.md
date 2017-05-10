# GitHub Elasticsearch Analytics

This node.js app will crawl the GitHub issues and comments API to then save them in Elasticsearch. 

![](https://github.com/torkelo/github-to-es/blob/master/img/issue_trends.png)

## Install

```
git clone https://github.com/torkelo/github-to-es.git
cd github-to-es
npm install
```

## Configure

Copy config.sample.json to config.json.

```json
{
  "github_token": "mytoken",
  "elasticsearch": {
    "host": "localhost",
    "port": 9200
  },
  "repos": [
    {
      "repo": "grafana/grafana-docker",
      "comments": true,
      "issues": true,
      "sinceDays": 2
    }
  ]
}
```

Specify your Elasticsearch details (no auth options available at this point). For the repository entries you can specify if
comments and/or issues should be fetched. If you want a complete (from the start) import of all issues and comments remove
the sinceDays option or set it to 0. After the complete import is done you can do incremental updates by setting this to 1. 

## Init & Create Elasticsearch index

```
node app.js init | bunyan
```

The above command will create an Elasticsearch index named `github`. The `| bunyan` part is optional. It's to get nicer console logging (instead of the default json logger). To use bunyan install
it first using `npm install -g bunyan`. 

You can reset (remove and recreates) the index using:
```
node app.js reset | bunyan
```

## Start import

```
node app.js start | bunyan
```

### Grafana Dashboards

- [GitHub Repo Issues](http://play.grafana.org/dashboard/db/github-repo-trends-issues).
- [GitHub Repo Comments](http://play.grafana.org/dashboard/db/github-repo-trends-comments).


# Limitations & Possible improvements

Currently GitHub API limits the number of pages you can fetch to 400. So there is a limit for the initial complete
import of issues & comments to 40000 issues and 40000 comments. 

It would be nice to get stars & other repo stats as well.






