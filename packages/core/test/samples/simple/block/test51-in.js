function a() {
  eff1(1);
  a;
  if (test) {
    b;
    eff(3);
    c;
    eff(4);
  } else eff(5);
  eff(6);
}
