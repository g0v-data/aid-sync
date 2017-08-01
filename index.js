require('shelljs/global');
require('dotenv').config();

var fs = require('fs');
var jsdom = require('jsdom');
var async = require('async');
var anticaptcha = require('anti-captcha');
var service = anticaptcha('http://anti-captcha.com', process.env.ANTI_CAPTCHA_KEY);

var userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
var username = env.RVIS_USERNAME;
var password = env.RVIS_PASSWORD;
var baseUrl = 'http://rvis-manage.mohw.gov.tw';
var loginUrl = baseUrl + '/login.do';
var downloadUrl = baseUrl + '/jsp/sg/sg2/sg25020_rpt.jsp';
var captchaUrl = baseUrl + '/ImageServlet';
var htmlFilename = 'out/aid.html';
var csvFilename = 'out/aid.csv';
var RE_COOKIE = /Set-Cookie: (.+?)=(.+?);/;

module.exports = function(finish) {
  mkdir('-p', 'out');

  var cookieJar = jsdom.createCookieJar();
  async.waterfall([
    function(done) {
      console.log('opening first page');
      jsdom.env({
        url: loginUrl,
        cookieJar,
        done: function(err, window) {
          done(null, window.document.cookie);
        }
      });
    },
    function(cookie, done) {
      console.log('download captcha');
      var downloadCaptchaCommand = `curl '${captchaUrl}' -H 'User-Agent: ${userAgent}' -H 'Cookie: ${cookie}' -o /tmp/captcha.jpg`;
      exec(downloadCaptchaCommand);
      done(null, cookie);
    },
    function(cookie, done) {
      console.log('decode...');
      var captcha = fs.readFileSync('/tmp/captcha.jpg');
      var base64 = new Buffer(captcha).toString('base64');
      service.uploadCaptcha(base64, {phrase: true})
      .then(captcha => service.getText(captcha))
      .then(captcha => {
        console.log('captcha.text', captcha.text);
        done(null, captcha.text, cookie);
      });
    },
    function(captcha, cookie, done) {
      console.log('login');
      var loginCommand = [
        'curl',
        '--user-agent "' + userAgent + '" ',
        `-H 'Cookie: ${cookie}'`,
        `--data "yn_cert=N&user_id=${process.env.ENCODED_RVIS_USERNAME}&user_pwd=${process.env.ENCODED_RVIS_PASSWORD}&checkcode=${captcha}"`,
        '--connect-timeout 5 --max-time 5 --retry 15',
        '-i',
        loginUrl
      ].join(' ');

      exec(loginCommand, {silent: true});
      done(null, cookie);
    },

    function(cookie, done) {
      echo('downloading html');
      var downloadCommand = [
        'curl',
        '-H \'Content-Type: application/x-www-form-urlencoded\'',
        '-H "Cookie: ' + cookie + '"',
        '--data \'prog_id=SG25020&qcityno=6300000000\'',
        '--connect-timeout 5 --max-time 30 --retry 15 -v',
        '-o ' + htmlFilename,
        downloadUrl
      ].join(' ');

      exec(downloadCommand);
      var html = cat(htmlFilename);
      done(null, html);
    },

    function(html, done) {
      console.log('parsing csv');
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
          rm(htmlFilename);
          done(null);
        }
      );
    }
  ], finish);
}

if (require.main === module) {
  module.exports(err => console.log(err));
}
