var $M = require("@effectful/debugger/api");

$M.module("file.js", null, module, null, "$");
var $s$1 = [{
  a: "$0"
}, null, false];
$M.fun("m$0", "file", null, [], 32, function () {
  for (;;) {
    switch ($.state = $.goto) {
      case 0:
        $.$.$0 = $c.a($);
        return $M.ret();

      case 1:
        return $M.ret($.value);

      case 2:
        throw $.value;

      default:
        throw new Error("Invalid state");
    }
  }
}, null, null, [[], [], []]);
$M.fun("m$1", "a", "m$0", [], 0, function () {
  for (;;) {
    switch ($.state = $.goto) {
      case 0:
        if (true) {
          1 + 1;
          $.state = 1;
        } else {
          $.state = 1;
        }

      case 1:
        $.goto = 2;
        $p = ($M.context.call = M.pure).dbg$call(M);
        continue;

      case 2:
        return $M.ret($p);

      case 3:
        return $M.ret($.value);

      case 4:
        throw $.value;

      default:
        throw new Error("Invalid state");
    }
  }
}, null, null, [[], ["3:9-3:17", "e", $s$1], [], [], []]);
module.exports = $M.exports();