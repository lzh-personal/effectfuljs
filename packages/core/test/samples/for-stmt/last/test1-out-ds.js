var $M = require("@effectful/debugger/api");

$M.module("file.js", null, module, null, "$");
var $s$1 = [{
  i: "$0",
  j: "$1",
  len: "$2",
  ref: "$3"
}, null, false];
$M.fun("m$0", "file", null, [], 32, function () {
  for (;;) {
    switch ($.state = $.goto) {
      case 0:
        $.goto = 1;
        $M.brk(0);
        continue;

      case 1:
        $c.f($);
        return $M.ret();

      case 2:
        return $M.ret($.value);

      case 3:
        throw $.value;

      default:
        throw new Error("Invalid state");
    }
  }
}, null, null, [["1:0-8:3", "s", null], [], [], []]);
$M.fun("m$1", null, "m$0", [], 0, function () {
  for (;;) {
    switch ($.state = $.goto) {
      case 0:
        $.goto = 1;
        $M.brk(1);
        continue;

      case 1:
        $.goto = 2;
        $M.brk(2);
        continue;

      case 2:
        $M.lset($.$, "ref", [1, 2, 3]);
        $.goto = 3;
        $M.brk(3);
        continue;

      case 3:
        $M.lset($.$, "j", 0);
        $M.lset($.$, "len", $.$.$3.length);
        $.state = 4;

      case 4:
        if ($.$.$1 < $.$.$2) {
          $.goto = 6;
          $M.brk(4);
          continue;
        } else {
          $.state = 5;
        }

      case 5:
        return $M.ret();

      case 6:
        $M.lset($.$, "i", $.$.$3[$.$.$1]);
        $.goto = 7;
        $M.brk(5);
        continue;

      case 7:
        $.goto = 8;
        $p = ($M.context.call = eff)($.$.$0);
        continue;

      case 8:
        if ($p) {
          $.goto = 5;
          $M.brk(6);
          continue;
        } else {
          $.state = 9;
        }

      case 9:
        $M.lset($.$, "j", $.$.$1 + 1);
        $.goto = 4;
        continue;

      case 10:
        return $M.ret($.value);

      case 11:
        throw $.value;

      default:
        throw new Error("Invalid state");
    }
  }
}, null, null, [["2:2-2:21", "s", $s$1], ["3:2-3:18", "s", $s$1], ["4:2-7:3", "s", $s$1], [], ["5:4-5:15", "s", $s$1], [], ["6:4-6:22", "s", $s$1], ["6:8-6:14", "e", $s$1], ["6:16-6:22", "s", $s$1], [], [], []]);
module.exports = $M.exports();