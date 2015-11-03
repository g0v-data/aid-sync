var jsdom = require('jsdom');
require('shelljs/global');


var userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
var username = env.RVIS_USERNAME;
var password = env.RVIS_PASSWORD;
var baseUrl = 'http://rvis-manage.mohw.gov.tw';
var loginUrl = baseUrl + '/login.do';
var downloadUrl = baseUrl + '/jsp/sg/sg2/sg25020_rpt.jsp';
var htmlFilename = 'aid.html';
var csvFilename = 'aid.csv';
var RE_COOKIE = /Set-Cookie: (.+?)=(.+?);/;
var repo = env.AID_GH_REF;
var token = env.AID_GH_TOKEN;

var loginCommand = [
  'curl',
  '--user-agent "' + userAgent + '" ',
  '--data "user_id=' + username + '&user_pwd='+ password + '"',
  '--connect-timeout 5 --max-time 5 --retry 15',
  '-i',
  loginUrl
].join(' ');

echo('login');
var ret = exec(loginCommand, {silent: true});
var cookies = [];
ret.output.split('\n').forEach(function(line) {
  var matched = RE_COOKIE.exec(line);
  if (matched) {
    cookies.push([matched[1]] + '=' + matched[2]);
  }
});

var downloadCommand = [
  'curl -X POST',
  '-b "' + cookies.join('&') + '"',
  '-H "Cookie: ' + cookies.join('; ') + '"',
  '--user-agent "' + userAgent + '" ',
  '--connect-timeout 5 --max-time 30 --retry 15',
  '-o ' + htmlFilename,
  downloadUrl
].join(' ');

echo('downloading html');
exec(downloadCommand, {silent: true});

var html = cat(htmlFilename);

var finish = function() {
  var email = exec('git config user.email').output;
  if (!email) {
    exec('git config user.email aid@g0v.tw');
    exec('git config user.name "aid-sync project"');
  }

  rm('-rf', 'out');
  exec('git clone "https://' + token +
       '@' + repo + '" --depth 1 -b gh-pages out');
  cp('-f', csvFilename, 'out');
  cd('out');
  exec('git add .');
  exec('git commit -m "Automatic commit: ' + Date() + '"');
  exec('git push "https://' + token +
       '@' + repo + '" gh-pages', {silent: true});
  exit(0);
}

jsdom.env(
  html,
  ['http://code.jquery.com/jquery.js'],
  function (err, window) {
    echo('parsing to csv file');
    var $ = window.$;

    var csv = [];
    var rows = $('tr').toArray();
    rows.forEach(function(row, i) {
      if (i === 0) return;

      var line = $(row).find('td').toArray().map(function(val) {
        var text = val.textContent.replace(/(?:\r\n|\r|\n)/g, ' ');
        return '"' + text + '"';
      }).join(',');
      csv.push(line);
    });
    csv.join('\n').to(csvFilename);
    finish();
  }
);
