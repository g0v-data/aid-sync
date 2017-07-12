'use strict';

const func = require('./index');

module.exports.fetch = (event, context, callback) => {
  func(callback);
};
