var $M = require("@effectful/debugger"),
    $context = $M.context,
    $ret = $M.ret,
    $unhandled = $M.unhandled,
    $m = $M.module("file.js", null, typeof module === "undefined" ? null : module, null, "$", {
  __webpack_require__: typeof __webpack_require__ !== "undefined" && __webpack_require__
}, null),
    $s$1 = [{
  a: [1, "1:9-1:10"]
}, null, 0],
    $s$2 = [{
  i: [1, "2:6-2:7"]
}, $s$1, 1],
    $m$0 = $M.fun("m$0", "file.js", null, null, [], 0, 2, "1:0-10:0", 160, function file_js($, $l, $p) {
  for (;;) switch ($.state = $.goto) {
    case 0:
      $l[1] = $m$1($);
      $.goto = 2;
      continue;

    case 1:
      $.goto = 2;
      return $unhandled($.error);

    case 2:
      return $ret($.result);

    default:
      throw new Error("Invalid state");
  }
}, null, null, 0, [[0, "1:0-9:1", $s$1], [16, "10:0-10:0", $s$1], [16, "10:0-10:0", $s$1]]),
    $m$1 = $M.fun("m$1", "a", null, $m$0, [], 0, 2, "1:0-9:1", 128, function a($, $l, $p) {
  for (;;) switch ($.state = $.goto) {
    case 0:
      $.goto = 1;
      ($context.call = eff1)();
      $.state = 1;

    case 1:
      $.goto = 2;
      $p = ($context.call = eff2)();
      $.state = 2;

    case 2:
      $l[1] = $p;
      $.state = 3;

    case 3:
      $.goto = 4;
      $p = ($context.call = eff)(3);
      $.state = 4;

    case 4:
      if ($l[1] !== $p) {
        $.goto = 5;
        ($context.call = eff5)($l[1]);
        $.state = 5;
      } else {
        $.goto = 9;
        ($context.call = eff7)($l[1]);
        continue;
      }

    case 5:
      $.goto = 6;
      ($context.call = eff6)($l[1]);
      $.state = 6;

    case 6:
      $.goto = 7;
      $p = ($context.call = eff4)($l[1]);
      $.state = 7;

    case 7:
      $l[1] = $p;
      $.goto = 3;
      continue;

    case 8:
      $.goto = 9;
      return $unhandled($.error);

    case 9:
      return $ret($.result);

    default:
      throw new Error("Invalid state");
  }
}, null, null, 1, [[2, "3:2-3:8", $s$2], [2, "4:11-4:17", $s$2], [0, "4:7-4:17", $s$2], [2, "4:25-4:31", $s$2], [2, "5:4-5:11", $s$2], [2, "6:4-6:11", $s$2], [2, "4:37-4:44", $s$2], [0, "4:33-4:44", $s$2], [16, "9:1-9:1", $s$2], [16, "9:1-9:1", $s$2]]);

$M.moduleExports();