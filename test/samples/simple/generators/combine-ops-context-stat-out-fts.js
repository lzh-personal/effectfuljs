function a6_1(ctx) {
  return ctx.yldM(1, a6_2);
}

function a6_2(ctx) {
  return ctx.yldM(2, a6_3);
}

function a6_3(ctx) {
  return ctx.yldMB(3, a6_4);
}

function a6_4(ctx, a) {
  if (a) return a6_5(ctx);else {
    return ctx._cb = a6_7, ctx._cb1 = a6_8, ctx.yldM(4, a6_6);
  }
}

function a6_5(ctx) {
  return ctx._cb = a6_7, ctx._cb1 = a6_9, ctx._r = 10, a6_6(ctx);
}

function a6_6(ctx) {
  var cb = ctx._cb;
  return ctx._cb = undefined, ctx.yldM('f1', cb);
}

function a6_7(ctx) {
  var cb = ctx._cb1;
  return ctx._cb1 = undefined, ctx.yldM('f2', cb);
}

function a6_8(ctx) {
  return ctx.yldM(5, ctx.pure);
}

function a6_9(ctx) {
  var r = ctx._r;
  return ctx.pure(r);
}

/*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function* d(i) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       var j = 0;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       return yield (yield i++), j++;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function* d(i) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       var j = 0;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       yield (yield i++,j++);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       if (yield (yield* some(i+=2,j) + j)) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         return (yield* i+=3);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       } else {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         return i
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       yield 2;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function* a4() {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       yield 1
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       try {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield 2
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield 3
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       } catch(e) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield "excep"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield e
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       } finally {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield "f"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield "e"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       yield a1(yield* a2(), yield* a3())
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     } 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     function* a5() {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       for(const i of a4())
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         yield i
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */function a6() {
  var ctx = M.context();
  return ctx.scope(a6_1);
}