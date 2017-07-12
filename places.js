require('shelljs/global');

var places = {};
var content = cat('out/aid.csv');
var names = content.split('\n')
.map(function(line) {
  return line.split(',')[1].slice(1,-1).trim().replace('臺', '台');
})
.filter(function(col) {
  return col !== '' && col !== '物資存放點';
});

console.log(names);

names.forEach(function(name) {
  if (places[name]) return;

  var cmd = 'curl --silent "https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(name) + '&key=AIzaSyCTCRUGT_xpBq3MygZXiO5B4-IWqmx5rsY&language=zh-TW"';
  var ret = JSON.parse(exec(cmd, {silent: true}).output);
  if (ret && ret.results.length > 0) {
    places[name] = ret.results[0];
    console.log(name, ret.results[0].formatted_address);
  }
});

JSON.stringify(places, null, 2).to('out/places.json');
