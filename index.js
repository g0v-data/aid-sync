require('shelljs/global');
require('dotenv').config();

var fs = require('fs');
var jsdom = require('jsdom');
var async = require('async');
var path = require('path');
var os = require('os');
var anticaptcha = require('anti-captcha');
var service = anticaptcha('http://anti-captcha.com', process.env.ANTI_CAPTCHA_KEY);

var userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
var username = env.RVIS_USERNAME;
var password = env.RVIS_PASSWORD;
var baseUrl = 'https://rvis-manage.mohw.gov.tw';
var loginUrl = baseUrl + '/login.do';
var downloadUrl = baseUrl + '/jsp/sg/sg2/sg25020_rpt.jsp';
var captchaUrl = baseUrl + '/ImageServlet';
var htmlFilename = 'out/aid.html';
var csvFilename = 'out/aid.csv';
var RE_COOKIE = /Set-Cookie: (.+?)=(.+?);/;
var captchaFile = path.join(os.tmpdir(), 'captcha.jpg')

module.exports = function(finish) {
  mkdir('-p', 'out');

  var cookieJar = jsdom.createCookieJar();
  async.waterfall([
    function(done) {
      console.log('opening first page');
      jsdom.env({
        url: loginUrl,
        strictSSL: false,
        cookieJar,
        done: function(err, window) {
          done(err);
        }
      });
    },
    function(done) {
      const cookie = cookieJar.store.idx['rvis-manage.mohw.gov.tw']['/']['JSESSIONID'].value;
      console.log('download captcha');
      const command = [
        'curl',
        captchaUrl,
        `-H 'User-Agent: ${userAgent}'`,
        `-H 'Cookie: JSESSIONID=${cookie}'`,
        `-o ${captchaFile}`,
        '--insecure'
      ];
      var downloadCaptchaCommand = command.join(' ');
      exec(downloadCaptchaCommand);
      console.log(downloadCaptchaCommand);
      done(null, cookie);
    },
    function(cookie, done) {
      console.log('decode...');
      var captcha = fs.readFileSync(captchaFile);
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
        `-H 'Cookie: JSESSIONID=${cookie}'`,
        `--data "yn_cert=N&user_id=${process.env.ENCODED_RVIS_USERNAME}&user_pwd=${process.env.ENCODED_RVIS_PASSWORD}&checkcode=${captcha}"`,
        '--connect-timeout 5 --max-time 5 --retry 15',
        '--insecure',
        '-i',
        loginUrl
      ].join(' ');

      exec(loginCommand, {silent: true});
      done(null, cookie);
    },

    function(cookie, done) {
      echo('downloading html');
      const headers = cat('headers.txt').trim().split('\n').map(h => `-H "${h.trim()}"`);
      const json = JSON.parse(cat('params.json'));
      const params = Object.keys(json).map(k => `${k}=${json[k]}`);
      var downloadCommand = [
        'curl',
        headers.join(' '),
        `-H 'Cookie: JSESSIONID=${cookie}'`,
        `--data "${params.join('&')}"`,
        '--connect-timeout 60 --max-time 60 --retry 15',
        '--insecure',
        '-o ' + htmlFilename,
        downloadUrl
      ].join(' ');

      exec(downloadCommand);
      var html = cat(htmlFilename);
      done(null, html);
    },

    function(html, done) {
      console.log('parsing csv');
      jsdom.env({
        html,
        features: { ProcessExternalResources : ['script']},
        scripts: ['http://code.jquery.com/jquery.js'],
        done: function(error, window) {
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
      });
    }
  ], finish);
}

if (require.main === module) {
  module.exports(err => console.log(err));
}
