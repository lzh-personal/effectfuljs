var path = require("path");

if (typeof EDBG === "undefined") require("@babel/register")({
  ignore: ["@effectful/**/*"]
});
global.expect = require("chai").expect;