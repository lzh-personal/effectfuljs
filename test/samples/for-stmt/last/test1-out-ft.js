function _1(_v) {
  if (_v.j < _v.len) return _2(_v);else return M.pure();
}

function _2(_v) {
  _v.i = _v.ref[_v.j];
  return M.jMB1(eff(_v.i), _3, _v);
}

function _3(a, _v) {
  if (a) return M.pure();else {
    _v.j++;
    return M.jNR(_1, _v);
  }
}

(function () {
  var _v;

  _v = {
    i: undefined,
    j: undefined,
    len: undefined,
    ref: undefined
  };
  _v.ref = [1, 2, 3];
  _v.j = 0, _v.len = _v.ref.length;
  return _1(_v);
});