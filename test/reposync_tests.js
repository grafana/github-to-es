const assert = require('assert');
const RepoSync = require('../reposync');

describe('RepoSync', function() {

  describe('creating a new repo sync', function() {

    it('should init options', function() {
      const rs = new RepoSync({
        queue: {},
        repo: 'grafana/grafana'
      });

      assert.equal(rs.owner, 'grafana');
      assert.equal(rs.repo, 'grafana');
    });
  });

});
