(() => {
  var zu = Object.create;
  var { getPrototypeOf: Ou, defineProperty: _r, getOwnPropertyNames: $u } = Object;
  var Bo = Object.prototype.hasOwnProperty;
  function _u(e) {
    return this[e];
  }
  var qu,
    Uu,
    No = (e, n, t) => {
      var r = e != null && typeof e === "object";
      if (r) {
        var i = n ? (qu ??= new WeakMap()) : (Uu ??= new WeakMap()),
          o = i.get(e);
        if (o) return o;
      }
      t = e != null ? zu(Ou(e)) : {};
      let s =
        n || !e || !e.__esModule || !Bo.call(e, "default")
          ? _r(t, "default", { value: e, enumerable: !0 })
          : t;
      if ((e && typeof e === "object") || typeof e === "function") {
        for (let a of $u(e)) if (!Bo.call(s, a)) _r(s, a, { get: _u.bind(e, a), enumerable: !0 });
      }
      if (r) i.set(e, s);
      return s;
    };
  var Un = (e, n) => () => (n || e((n = { exports: {} }).exports, n), n.exports);
  var Vu = (e) => e;
  function Hu(e, n) {
    this[e] = Vu.bind(null, n);
  }
  var ju = (e, n) => {
    for (var t in n) _r(e, t, { get: n[t], enumerable: !0, configurable: !0, set: Hu.bind(n, t) });
  };
  var qr = ((e) =>
    typeof require < "u"
      ? require
      : typeof Proxy < "u"
        ? new Proxy(e, { get: (n, t) => (typeof require < "u" ? require : n)[t] })
        : e)(function (e) {
    if (typeof require < "u") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + e + '" is not supported');
  });
  var ua = Un(function (xy, aa) {
    var fn = 1000,
      dn = fn * 60,
      pn = dn * 60,
      Zt = pn * 24,
      Rd = Zt * 7,
      Pd = Zt * 365.25;
    aa.exports = function (e, n) {
      n = n || {};
      var t = typeof e;
      if (t === "string" && e.length > 0) return Ld(e);
      else if (t === "number" && isFinite(e)) return n.long ? Bd(e) : Dd(e);
      throw Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(e));
    };
    function Ld(e) {
      if (((e = String(e)), e.length > 100)) return;
      var n =
        /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
          e,
        );
      if (!n) return;
      var t = parseFloat(n[1]),
        r = (n[2] || "ms").toLowerCase();
      switch (r) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return t * Pd;
        case "weeks":
        case "week":
        case "w":
          return t * Rd;
        case "days":
        case "day":
        case "d":
          return t * Zt;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return t * pn;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return t * dn;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return t * fn;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return t;
        default:
          return;
      }
    }
    function Dd(e) {
      var n = Math.abs(e);
      if (n >= Zt) return Math.round(e / Zt) + "d";
      if (n >= pn) return Math.round(e / pn) + "h";
      if (n >= dn) return Math.round(e / dn) + "m";
      if (n >= fn) return Math.round(e / fn) + "s";
      return e + "ms";
    }
    function Bd(e) {
      var n = Math.abs(e);
      if (n >= Zt) return mr(e, n, Zt, "day");
      if (n >= pn) return mr(e, n, pn, "hour");
      if (n >= dn) return mr(e, n, dn, "minute");
      if (n >= fn) return mr(e, n, fn, "second");
      return e + " ms";
    }
    function mr(e, n, t, r) {
      var i = n >= t * 1.5;
      return Math.round(e / t) + " " + r + (i ? "s" : "");
    }
  });
  var ca = Un(function (wy, la) {
    function Nd(e) {
      ((t.debug = t),
        (t.default = t),
        (t.coerce = u),
        (t.disable = s),
        (t.enable = i),
        (t.enabled = a),
        (t.humanize = ua()),
        (t.destroy = l),
        Object.keys(e).forEach((c) => {
          t[c] = e[c];
        }),
        (t.names = []),
        (t.skips = []),
        (t.formatters = {}));
      function n(c) {
        let f = 0;
        for (let p = 0; p < c.length; p++) ((f = (f << 5) - f + c.charCodeAt(p)), (f |= 0));
        return t.colors[Math.abs(f) % t.colors.length];
      }
      t.selectColor = n;
      function t(c) {
        let f,
          p = null,
          h,
          g;
        function k(...C) {
          if (!k.enabled) return;
          let b = k,
            F = Number(new Date()),
            M = F - (f || F);
          if (
            ((b.diff = M),
            (b.prev = f),
            (b.curr = F),
            (f = F),
            (C[0] = t.coerce(C[0])),
            typeof C[0] !== "string")
          )
            C.unshift("%O");
          let q = 0;
          ((C[0] = C[0].replace(/%([a-zA-Z%])/g, (E, _) => {
            if (E === "%%") return "%";
            q++;
            let te = t.formatters[_];
            if (typeof te === "function") {
              let X = C[q];
              ((E = te.call(b, X)), C.splice(q, 1), q--);
            }
            return E;
          })),
            t.formatArgs.call(b, C),
            (b.log || t.log).apply(b, C));
        }
        if (
          ((k.namespace = c),
          (k.useColors = t.useColors()),
          (k.color = t.selectColor(c)),
          (k.extend = r),
          (k.destroy = t.destroy),
          Object.defineProperty(k, "enabled", {
            enumerable: !0,
            configurable: !1,
            get: () => {
              if (p !== null) return p;
              if (h !== t.namespaces) ((h = t.namespaces), (g = t.enabled(c)));
              return g;
            },
            set: (C) => {
              p = C;
            },
          }),
          typeof t.init === "function")
        )
          t.init(k);
        return k;
      }
      function r(c, f) {
        let p = t(this.namespace + (typeof f > "u" ? ":" : f) + c);
        return ((p.log = this.log), p);
      }
      function i(c) {
        (t.save(c), (t.namespaces = c), (t.names = []), (t.skips = []));
        let f = (typeof c === "string" ? c : "")
          .trim()
          .replace(/\s+/g, ",")
          .split(",")
          .filter(Boolean);
        for (let p of f)
          if (p[0] === "-") t.skips.push(p.slice(1));
          else t.names.push(p);
      }
      function o(c, f) {
        let p = 0,
          h = 0,
          g = -1,
          k = 0;
        while (p < c.length)
          if (h < f.length && (f[h] === c[p] || f[h] === "*"))
            if (f[h] === "*") ((g = h), (k = p), h++);
            else (p++, h++);
          else if (g !== -1) ((h = g + 1), k++, (p = k));
          else return !1;
        while (h < f.length && f[h] === "*") h++;
        return h === f.length;
      }
      function s() {
        let c = [...t.names, ...t.skips.map((f) => "-" + f)].join(",");
        return (t.enable(""), c);
      }
      function a(c) {
        for (let f of t.skips) if (o(c, f)) return !1;
        for (let f of t.names) if (o(c, f)) return !0;
        return !1;
      }
      function u(c) {
        if (c instanceof Error) return c.stack || c.message;
        return c;
      }
      function l() {
        console.warn(
          "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
        );
      }
      return (t.enable(t.load()), t);
    }
    la.exports = Nd;
  });
  var fa = Un(function (qe, gr) {
    qe.formatArgs = Od;
    qe.save = $d;
    qe.load = _d;
    qe.useColors = zd;
    qe.storage = qd();
    qe.destroy = (() => {
      let e = !1;
      return () => {
        if (!e)
          ((e = !0),
            console.warn(
              "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
            ));
      };
    })();
    qe.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33",
    ];
    function zd() {
      if (
        typeof window < "u" &&
        window.process &&
        (window.process.type === "renderer" || window.process.__nwjs)
      )
        return !0;
      if (
        typeof navigator < "u" &&
        navigator.userAgent &&
        navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)
      )
        return !1;
      let e;
      return (
        (typeof document < "u" &&
          document.documentElement &&
          document.documentElement.style &&
          document.documentElement.style.WebkitAppearance) ||
        (typeof window < "u" &&
          window.console &&
          (window.console.firebug || (window.console.exception && window.console.table))) ||
        (typeof navigator < "u" &&
          navigator.userAgent &&
          (e = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) &&
          parseInt(e[1], 10) >= 31) ||
        (typeof navigator < "u" &&
          navigator.userAgent &&
          navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/))
      );
    }
    function Od(e) {
      if (
        ((e[0] =
          (this.useColors ? "%c" : "") +
          this.namespace +
          (this.useColors ? " %c" : " ") +
          e[0] +
          (this.useColors ? "%c " : " ") +
          "+" +
          gr.exports.humanize(this.diff)),
        !this.useColors)
      )
        return;
      let n = "color: " + this.color;
      e.splice(1, 0, n, "color: inherit");
      let t = 0,
        r = 0;
      (e[0].replace(/%[a-zA-Z%]/g, (i) => {
        if (i === "%%") return;
        if ((t++, i === "%c")) r = t;
      }),
        e.splice(r, 0, n));
    }
    qe.log = console.debug || console.log || (() => {});
    function $d(e) {
      try {
        if (e) qe.storage.setItem("debug", e);
        else qe.storage.removeItem("debug");
      } catch (n) {}
    }
    function _d() {
      let e;
      try {
        e = qe.storage.getItem("debug") || qe.storage.getItem("DEBUG");
      } catch (n) {}
      if (!e && typeof process < "u" && "env" in process) e = process.env.DEBUG;
      return e;
    }
    function qd() {
      try {
        return localStorage;
      } catch (e) {}
    }
    gr.exports = ca()(qe);
    var { formatters: Ud } = gr.exports;
    Ud.j = function (e) {
      try {
        return JSON.stringify(e);
      } catch (n) {
        return "[UnexpectedJSONParseError]: " + n.message;
      }
    };
  });
  var Ma = Un(function (fS, Aa) {
    var xr = Object.prototype.hasOwnProperty,
      va = Object.prototype.toString,
      { defineProperty: ya, getOwnPropertyDescriptor: Sa } = Object,
      Ca = function (n) {
        if (typeof Array.isArray === "function") return Array.isArray(n);
        return va.call(n) === "[object Array]";
      },
      Ea = function (n) {
        if (!n || va.call(n) !== "[object Object]") return !1;
        var t = xr.call(n, "constructor"),
          r =
            n.constructor &&
            n.constructor.prototype &&
            xr.call(n.constructor.prototype, "isPrototypeOf");
        if (n.constructor && !t && !r) return !1;
        var i;
        for (i in n);
        return typeof i > "u" || xr.call(n, i);
      },
      Ia = function (n, t) {
        if (ya && t.name === "__proto__")
          ya(n, t.name, { enumerable: !0, configurable: !0, value: t.newValue, writable: !0 });
        else n[t.name] = t.newValue;
      },
      Ta = function (n, t) {
        if (t === "__proto__") {
          if (!xr.call(n, t)) return;
          else if (Sa) return Sa(n, t).value;
        }
        return n[t];
      };
    Aa.exports = function e() {
      var n,
        t,
        r,
        i,
        o,
        s,
        a = arguments[0],
        u = 1,
        l = arguments.length,
        c = !1;
      if (typeof a === "boolean") ((c = a), (a = arguments[1] || {}), (u = 2));
      if (a == null || (typeof a !== "object" && typeof a !== "function")) a = {};
      for (; u < l; ++u)
        if (((n = arguments[u]), n != null)) {
          for (t in n)
            if (((r = Ta(a, t)), (i = Ta(n, t)), a !== i)) {
              if (c && i && (Ea(i) || (o = Ca(i)))) {
                if (o) ((o = !1), (s = r && Ca(r) ? r : []));
                else s = r && Ea(r) ? r : {};
                Ia(a, { name: t, newValue: e(c, s, i) });
              } else if (typeof i < "u") Ia(a, { name: t, newValue: i });
            }
        }
      return a;
    };
  });
  function Vn(e, n) {
    let t = [...n].sort((o, s) => s.start - o.start),
      r = e,
      i = e.length + 1;
    for (let o of t) {
      if (o.end > i) throw Error(`overlapping edits at ${o.start}..${o.end} and ${i}`);
      if (o.start < 0 || o.end > r.length || o.start > o.end)
        throw Error(`edit out of range: ${o.start}..${o.end}`);
      ((r = r.slice(0, o.start) + o.text + r.slice(o.end)), (i = o.start));
    }
    return r;
  }
  /*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   */ var rn = 9000000000000000,
    It = 1e9,
    Ur = "0123456789abcdef",
    Wn =
      "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058",
    Gn =
      "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789",
    Vr = {
      precision: 20,
      rounding: 4,
      modulo: 1,
      toExpNeg: -7,
      toExpPos: 21,
      minE: -rn,
      maxE: rn,
      crypto: !1,
    },
    _o,
    pt,
    ee = !0,
    Qn = "[DecimalError] ",
    Et = Qn + "Invalid argument: ",
    qo = Qn + "Precision limit exceeded",
    Uo = Qn + "crypto unavailable",
    Vo = "[object Decimal]",
    { floor: Re, pow: ye } = Math,
    Wu = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i,
    Gu = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i,
    Zu = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i,
    Ho = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
    Ze = 1e7,
    Y = 7,
    Qu = 9007199254740991,
    Yu = Wn.length - 1,
    Hr = Gn.length - 1,
    L = { toStringTag: Vo };
  L.absoluteValue = L.abs = function () {
    var e = new this.constructor(this);
    if (e.s < 0) e.s = 1;
    return j(e);
  };
  L.ceil = function () {
    return j(new this.constructor(this), this.e + 1, 2);
  };
  L.clampedTo = L.clamp = function (e, n) {
    var t,
      r = this,
      i = r.constructor;
    if (((e = new i(e)), (n = new i(n)), !e.s || !n.s)) return new i(NaN);
    if (e.gt(n)) throw Error(Et + n);
    return ((t = r.cmp(e)), t < 0 ? e : r.cmp(n) > 0 ? n : new i(r));
  };
  L.comparedTo = L.cmp = function (e) {
    var n,
      t,
      r,
      i,
      o = this,
      s = o.d,
      a = (e = new o.constructor(e)).d,
      u = o.s,
      l = e.s;
    if (!s || !a) return !u || !l ? NaN : u !== l ? u : s === a ? 0 : !s ^ (u < 0) ? 1 : -1;
    if (!s[0] || !a[0]) return s[0] ? u : a[0] ? -l : 0;
    if (u !== l) return u;
    if (o.e !== e.e) return (o.e > e.e) ^ (u < 0) ? 1 : -1;
    ((r = s.length), (i = a.length));
    for (n = 0, t = r < i ? r : i; n < t; ++n)
      if (s[n] !== a[n]) return (s[n] > a[n]) ^ (u < 0) ? 1 : -1;
    return r === i ? 0 : (r > i) ^ (u < 0) ? 1 : -1;
  };
  L.cosine = L.cos = function () {
    var e,
      n,
      t = this,
      r = t.constructor;
    if (!t.d) return new r(NaN);
    if (!t.d[0]) return new r(1);
    return (
      (e = r.precision),
      (n = r.rounding),
      (r.precision = e + Math.max(t.e, t.sd()) + Y),
      (r.rounding = 1),
      (t = Ku(r, Qo(r, t))),
      (r.precision = e),
      (r.rounding = n),
      j(pt == 2 || pt == 3 ? t.neg() : t, e, n, !0)
    );
  };
  L.cubeRoot = L.cbrt = function () {
    var e,
      n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c = this,
      f = c.constructor;
    if (!c.isFinite() || c.isZero()) return new f(c);
    if (((ee = !1), (o = c.s * ye(c.s * c, 0.3333333333333333)), !o || Math.abs(o) == 1 / 0)) {
      if (((t = ve(c.d)), (e = c.e), (o = (e - t.length + 1) % 3)))
        t += o == 1 || o == -2 ? "0" : "00";
      if (
        ((o = ye(t, 0.3333333333333333)),
        (e = Re((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2))),
        o == 1 / 0)
      )
        t = "5e" + e;
      else ((t = o.toExponential()), (t = t.slice(0, t.indexOf("e") + 1) + e));
      ((r = new f(t)), (r.s = c.s));
    } else r = new f(o.toString());
    s = (e = f.precision) + 3;
    for (;;)
      if (
        ((a = r),
        (u = a.times(a).times(a)),
        (l = u.plus(c)),
        (r = ce(l.plus(c).times(a), l.plus(u), s + 2, 1)),
        ve(a.d).slice(0, s) === (t = ve(r.d)).slice(0, s))
      )
        if (((t = t.slice(s - 3, s + 1)), t == "9999" || (!i && t == "4999"))) {
          if (!i) {
            if ((j(a, e + 1, 0), a.times(a).times(a).eq(c))) {
              r = a;
              break;
            }
          }
          ((s += 4), (i = 1));
        } else {
          if (!+t || (!+t.slice(1) && t.charAt(0) == "5"))
            (j(r, e + 1, 1), (n = !r.times(r).times(r).eq(c)));
          break;
        }
    return ((ee = !0), j(r, e, f.rounding, n));
  };
  L.decimalPlaces = L.dp = function () {
    var e,
      n = this.d,
      t = NaN;
    if (n) {
      if (((e = n.length - 1), (t = (e - Re(this.e / Y)) * Y), (e = n[e]), e))
        for (; e % 10 == 0; e /= 10) t--;
      if (t < 0) t = 0;
    }
    return t;
  };
  L.dividedBy = L.div = function (e) {
    return ce(this, new this.constructor(e));
  };
  L.dividedToIntegerBy = L.divToInt = function (e) {
    var n = this,
      t = n.constructor;
    return j(ce(n, new t(e), 0, 1, 1), t.precision, t.rounding);
  };
  L.equals = L.eq = function (e) {
    return this.cmp(e) === 0;
  };
  L.floor = function () {
    return j(new this.constructor(this), this.e + 1, 3);
  };
  L.greaterThan = L.gt = function (e) {
    return this.cmp(e) > 0;
  };
  L.greaterThanOrEqualTo = L.gte = function (e) {
    var n = this.cmp(e);
    return n == 1 || n === 0;
  };
  L.hyperbolicCosine = L.cosh = function () {
    var e,
      n,
      t,
      r,
      i,
      o = this,
      s = o.constructor,
      a = new s(1);
    if (!o.isFinite()) return new s(o.s ? 1 / 0 : NaN);
    if (o.isZero()) return a;
    if (
      ((t = s.precision),
      (r = s.rounding),
      (s.precision = t + Math.max(o.e, o.sd()) + 4),
      (s.rounding = 1),
      (i = o.d.length),
      i < 32)
    )
      ((e = Math.ceil(i / 3)), (n = (1 / Kn(4, e)).toString()));
    else ((e = 16), (n = "2.3283064365386962890625e-10"));
    o = on(s, 1, o.times(n), new s(1), !0);
    var u,
      l = e,
      c = new s(8);
    for (; l--;) ((u = o.times(o)), (o = a.minus(u.times(c.minus(u.times(c))))));
    return j(o, (s.precision = t), (s.rounding = r), !0);
  };
  L.hyperbolicSine = L.sinh = function () {
    var e,
      n,
      t,
      r,
      i = this,
      o = i.constructor;
    if (!i.isFinite() || i.isZero()) return new o(i);
    if (
      ((n = o.precision),
      (t = o.rounding),
      (o.precision = n + Math.max(i.e, i.sd()) + 4),
      (o.rounding = 1),
      (r = i.d.length),
      r < 3)
    )
      i = on(o, 2, i, i, !0);
    else {
      ((e = 1.4 * Math.sqrt(r)),
        (e = e > 16 ? 16 : e | 0),
        (i = i.times(1 / Kn(5, e))),
        (i = on(o, 2, i, i, !0)));
      var s,
        a = new o(5),
        u = new o(16),
        l = new o(20);
      for (; e--;) ((s = i.times(i)), (i = i.times(a.plus(s.times(u.times(s).plus(l))))));
    }
    return ((o.precision = n), (o.rounding = t), j(i, n, t, !0));
  };
  L.hyperbolicTangent = L.tanh = function () {
    var e,
      n,
      t = this,
      r = t.constructor;
    if (!t.isFinite()) return new r(t.s);
    if (t.isZero()) return new r(t);
    return (
      (e = r.precision),
      (n = r.rounding),
      (r.precision = e + 7),
      (r.rounding = 1),
      ce(t.sinh(), t.cosh(), (r.precision = e), (r.rounding = n))
    );
  };
  L.inverseCosine = L.acos = function () {
    var e = this,
      n = e.constructor,
      t = e.abs().cmp(1),
      { precision: r, rounding: i } = n;
    if (t !== -1) return t === 0 ? (e.isNeg() ? et(n, r, i) : new n(0)) : new n(NaN);
    if (e.isZero()) return et(n, r + 4, i).times(0.5);
    return (
      (n.precision = r + 6),
      (n.rounding = 1),
      (e = new n(1).minus(e).div(e.plus(1)).sqrt().atan()),
      (n.precision = r),
      (n.rounding = i),
      e.times(2)
    );
  };
  L.inverseHyperbolicCosine = L.acosh = function () {
    var e,
      n,
      t = this,
      r = t.constructor;
    if (t.lte(1)) return new r(t.eq(1) ? 0 : NaN);
    if (!t.isFinite()) return new r(t);
    return (
      (e = r.precision),
      (n = r.rounding),
      (r.precision = e + Math.max(Math.abs(t.e), t.sd()) + 4),
      (r.rounding = 1),
      (ee = !1),
      (t = t.times(t).minus(1).sqrt().plus(t)),
      (ee = !0),
      (r.precision = e),
      (r.rounding = n),
      t.ln()
    );
  };
  L.inverseHyperbolicSine = L.asinh = function () {
    var e,
      n,
      t = this,
      r = t.constructor;
    if (!t.isFinite() || t.isZero()) return new r(t);
    return (
      (e = r.precision),
      (n = r.rounding),
      (r.precision = e + 2 * Math.max(Math.abs(t.e), t.sd()) + 6),
      (r.rounding = 1),
      (ee = !1),
      (t = t.times(t).plus(1).sqrt().plus(t)),
      (ee = !0),
      (r.precision = e),
      (r.rounding = n),
      t.ln()
    );
  };
  L.inverseHyperbolicTangent = L.atanh = function () {
    var e,
      n,
      t,
      r,
      i = this,
      o = i.constructor;
    if (!i.isFinite()) return new o(NaN);
    if (i.e >= 0) return new o(i.abs().eq(1) ? i.s / 0 : i.isZero() ? i : NaN);
    if (((e = o.precision), (n = o.rounding), (r = i.sd()), Math.max(r, e) < 2 * -i.e - 1))
      return j(new o(i), e, n, !0);
    return (
      (o.precision = t = r - i.e),
      (i = ce(i.plus(1), new o(1).minus(i), t + e, 1)),
      (o.precision = e + 4),
      (o.rounding = 1),
      (i = i.ln()),
      (o.precision = e),
      (o.rounding = n),
      i.times(0.5)
    );
  };
  L.inverseSine = L.asin = function () {
    var e,
      n,
      t,
      r,
      i = this,
      o = i.constructor;
    if (i.isZero()) return new o(i);
    if (((n = i.abs().cmp(1)), (t = o.precision), (r = o.rounding), n !== -1)) {
      if (n === 0) return ((e = et(o, t + 4, r).times(0.5)), (e.s = i.s), e);
      return new o(NaN);
    }
    return (
      (o.precision = t + 6),
      (o.rounding = 1),
      (i = i.div(new o(1).minus(i.times(i)).sqrt().plus(1)).atan()),
      (o.precision = t),
      (o.rounding = r),
      i.times(2)
    );
  };
  L.inverseTangent = L.atan = function () {
    var e,
      n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l = this,
      c = l.constructor,
      { precision: f, rounding: p } = c;
    if (!l.isFinite()) {
      if (!l.s) return new c(NaN);
      if (f + 4 <= Hr) return ((s = et(c, f + 4, p).times(0.5)), (s.s = l.s), s);
    } else if (l.isZero()) return new c(l);
    else if (l.abs().eq(1) && f + 4 <= Hr)
      return ((s = et(c, f + 4, p).times(0.25)), (s.s = l.s), s);
    ((c.precision = a = f + 10), (c.rounding = 1), (t = Math.min(28, (a / Y + 2) | 0)));
    for (e = t; e; --e) l = l.div(l.times(l).plus(1).sqrt().plus(1));
    ((ee = !1), (n = Math.ceil(a / Y)), (r = 1), (u = l.times(l)), (s = new c(l)), (i = l));
    for (; e !== -1;)
      if (
        ((i = i.times(u)),
        (o = s.minus(i.div((r += 2)))),
        (i = i.times(u)),
        (s = o.plus(i.div((r += 2)))),
        s.d[n] !== void 0)
      )
        for (e = n; s.d[e] === o.d[e] && e--;);
    if (t) s = s.times(2 << (t - 1));
    return ((ee = !0), j(s, (c.precision = f), (c.rounding = p), !0));
  };
  L.isFinite = function () {
    return !!this.d;
  };
  L.isInteger = L.isInt = function () {
    return !!this.d && Re(this.e / Y) > this.d.length - 2;
  };
  L.isNaN = function () {
    return !this.s;
  };
  L.isNegative = L.isNeg = function () {
    return this.s < 0;
  };
  L.isPositive = L.isPos = function () {
    return this.s > 0;
  };
  L.isZero = function () {
    return !!this.d && this.d[0] === 0;
  };
  L.lessThan = L.lt = function (e) {
    return this.cmp(e) < 0;
  };
  L.lessThanOrEqualTo = L.lte = function (e) {
    return this.cmp(e) < 1;
  };
  L.logarithm = L.log = function (e) {
    var n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l = this,
      c = l.constructor,
      { precision: f, rounding: p } = c,
      h = 5;
    if (e == null) ((e = new c(10)), (n = !0));
    else {
      if (((e = new c(e)), (t = e.d), e.s < 0 || !t || !t[0] || e.eq(1))) return new c(NaN);
      n = e.eq(10);
    }
    if (((t = l.d), l.s < 0 || !t || !t[0] || l.eq(1)))
      return new c(t && !t[0] ? -1 / 0 : l.s != 1 ? NaN : t ? 0 : 1 / 0);
    if (n)
      if (t.length > 1) o = !0;
      else {
        for (i = t[0]; i % 10 === 0;) i /= 10;
        o = i !== 1;
      }
    if (
      ((ee = !1),
      (a = f + h),
      (s = Ct(l, a)),
      (r = n ? Zn(c, a + 10) : Ct(e, a)),
      (u = ce(s, r, a, 1)),
      In(u.d, (i = f), p))
    )
      do
        if (
          ((a += 10), (s = Ct(l, a)), (r = n ? Zn(c, a + 10) : Ct(e, a)), (u = ce(s, r, a, 1)), !o)
        ) {
          if (+ve(u.d).slice(i + 1, i + 15) + 1 == 100000000000000) u = j(u, f + 1, 0);
          break;
        }
      while (In(u.d, (i += 10), p));
    return ((ee = !0), j(u, f, p));
  };
  L.minus = L.sub = function (e) {
    var n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c,
      f,
      p,
      h = this,
      g = h.constructor;
    if (((e = new g(e)), !h.d || !e.d)) {
      if (!h.s || !e.s) e = new g(NaN);
      else if (h.d) e.s = -e.s;
      else e = new g(e.d || h.s !== e.s ? h : NaN);
      return e;
    }
    if (h.s != e.s) return ((e.s = -e.s), h.plus(e));
    if (((l = h.d), (p = e.d), (a = g.precision), (u = g.rounding), !l[0] || !p[0])) {
      if (p[0]) e.s = -e.s;
      else if (l[0]) e = new g(h);
      else return new g(u === 3 ? -0 : 0);
      return ee ? j(e, a, u) : e;
    }
    if (((t = Re(e.e / Y)), (c = Re(h.e / Y)), (l = l.slice()), (o = c - t), o)) {
      if (((f = o < 0), f)) ((n = l), (o = -o), (s = p.length));
      else ((n = p), (t = c), (s = l.length));
      if (((r = Math.max(Math.ceil(a / Y), s) + 2), o > r)) ((o = r), (n.length = 1));
      n.reverse();
      for (r = o; r--;) n.push(0);
      n.reverse();
    } else {
      if (((r = l.length), (s = p.length), (f = r < s), f)) s = r;
      for (r = 0; r < s; r++)
        if (l[r] != p[r]) {
          f = l[r] < p[r];
          break;
        }
      o = 0;
    }
    if (f) ((n = l), (l = p), (p = n), (e.s = -e.s));
    s = l.length;
    for (r = p.length - s; r > 0; --r) l[s++] = 0;
    for (r = p.length; r > o;) {
      if (l[--r] < p[r]) {
        for (i = r; i && l[--i] === 0;) l[i] = Ze - 1;
        (--l[i], (l[r] += Ze));
      }
      l[r] -= p[r];
    }
    for (; l[--s] === 0;) l.pop();
    for (; l[0] === 0; l.shift()) --t;
    if (!l[0]) return new g(u === 3 ? -0 : 0);
    return ((e.d = l), (e.e = Yn(l, t)), ee ? j(e, a, u) : e);
  };
  L.modulo = L.mod = function (e) {
    var n,
      t = this,
      r = t.constructor;
    if (((e = new r(e)), !t.d || !e.s || (e.d && !e.d[0]))) return new r(NaN);
    if (!e.d || (t.d && !t.d[0])) return j(new r(t), r.precision, r.rounding);
    if (((ee = !1), r.modulo == 9)) ((n = ce(t, e.abs(), 0, 3, 1)), (n.s *= e.s));
    else n = ce(t, e, 0, r.modulo, 1);
    return ((n = n.times(e)), (ee = !0), t.minus(n));
  };
  L.naturalExponential = L.exp = function () {
    return jr(this);
  };
  L.naturalLogarithm = L.ln = function () {
    return Ct(this);
  };
  L.negated = L.neg = function () {
    var e = new this.constructor(this);
    return ((e.s = -e.s), j(e));
  };
  L.plus = L.add = function (e) {
    var n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c,
      f = this,
      p = f.constructor;
    if (((e = new p(e)), !f.d || !e.d)) {
      if (!f.s || !e.s) e = new p(NaN);
      else if (!f.d) e = new p(e.d || f.s === e.s ? f : NaN);
      return e;
    }
    if (f.s != e.s) return ((e.s = -e.s), f.minus(e));
    if (((l = f.d), (c = e.d), (a = p.precision), (u = p.rounding), !l[0] || !c[0])) {
      if (!c[0]) e = new p(f);
      return ee ? j(e, a, u) : e;
    }
    if (((o = Re(f.e / Y)), (r = Re(e.e / Y)), (l = l.slice()), (i = o - r), i)) {
      if (i < 0) ((t = l), (i = -i), (s = c.length));
      else ((t = c), (r = o), (s = l.length));
      if (((o = Math.ceil(a / Y)), (s = o > s ? o + 1 : s + 1), i > s)) ((i = s), (t.length = 1));
      t.reverse();
      for (; i--;) t.push(0);
      t.reverse();
    }
    if (((s = l.length), (i = c.length), s - i < 0)) ((i = s), (t = c), (c = l), (l = t));
    for (n = 0; i;) ((n = ((l[--i] = l[i] + c[i] + n) / Ze) | 0), (l[i] %= Ze));
    if (n) (l.unshift(n), ++r);
    for (s = l.length; l[--s] == 0;) l.pop();
    return ((e.d = l), (e.e = Yn(l, r)), ee ? j(e, a, u) : e);
  };
  L.precision = L.sd = function (e) {
    var n,
      t = this;
    if (e !== void 0 && e !== !!e && e !== 1 && e !== 0) throw Error(Et + e);
    if (t.d) {
      if (((n = jo(t.d)), e && t.e + 1 > n)) n = t.e + 1;
    } else n = NaN;
    return n;
  };
  L.round = function () {
    var e = this,
      n = e.constructor;
    return j(new n(e), e.e + 1, n.rounding);
  };
  L.sine = L.sin = function () {
    var e,
      n,
      t = this,
      r = t.constructor;
    if (!t.isFinite()) return new r(NaN);
    if (t.isZero()) return new r(t);
    return (
      (e = r.precision),
      (n = r.rounding),
      (r.precision = e + Math.max(t.e, t.sd()) + Y),
      (r.rounding = 1),
      (t = Ju(r, Qo(r, t))),
      (r.precision = e),
      (r.rounding = n),
      j(pt > 2 ? t.neg() : t, e, n, !0)
    );
  };
  L.squareRoot = L.sqrt = function () {
    var e,
      n,
      t,
      r,
      i,
      o,
      s = this,
      { d: a, e: u, s: l, constructor: c } = s;
    if (l !== 1 || !a || !a[0]) return new c(!l || (l < 0 && (!a || a[0])) ? NaN : a ? s : 1 / 0);
    if (((ee = !1), (l = Math.sqrt(+s)), l == 0 || l == 1 / 0)) {
      if (((n = ve(a)), (n.length + u) % 2 == 0)) n += "0";
      if (((l = Math.sqrt(n)), (u = Re((u + 1) / 2) - (u < 0 || u % 2)), l == 1 / 0)) n = "5e" + u;
      else ((n = l.toExponential()), (n = n.slice(0, n.indexOf("e") + 1) + u));
      r = new c(n);
    } else r = new c(l.toString());
    t = (u = c.precision) + 3;
    for (;;)
      if (
        ((o = r),
        (r = o.plus(ce(s, o, t + 2, 1)).times(0.5)),
        ve(o.d).slice(0, t) === (n = ve(r.d)).slice(0, t))
      )
        if (((n = n.slice(t - 3, t + 1)), n == "9999" || (!i && n == "4999"))) {
          if (!i) {
            if ((j(o, u + 1, 0), o.times(o).eq(s))) {
              r = o;
              break;
            }
          }
          ((t += 4), (i = 1));
        } else {
          if (!+n || (!+n.slice(1) && n.charAt(0) == "5"))
            (j(r, u + 1, 1), (e = !r.times(r).eq(s)));
          break;
        }
    return ((ee = !0), j(r, u, c.rounding, e));
  };
  L.tangent = L.tan = function () {
    var e,
      n,
      t = this,
      r = t.constructor;
    if (!t.isFinite()) return new r(NaN);
    if (t.isZero()) return new r(t);
    return (
      (e = r.precision),
      (n = r.rounding),
      (r.precision = e + 10),
      (r.rounding = 1),
      (t = t.sin()),
      (t.s = 1),
      (t = ce(t, new r(1).minus(t.times(t)).sqrt(), e + 10, 0)),
      (r.precision = e),
      (r.rounding = n),
      j(pt == 2 || pt == 4 ? t.neg() : t, e, n, !0)
    );
  };
  L.times = L.mul = function (e) {
    var n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c = this,
      { constructor: f, d: p } = c,
      h = (e = new f(e)).d;
    if (((e.s *= c.s), !p || !p[0] || !h || !h[0]))
      return new f(
        !e.s || (p && !p[0] && !h) || (h && !h[0] && !p) ? NaN : !p || !h ? e.s / 0 : e.s * 0,
      );
    if (((t = Re(c.e / Y) + Re(e.e / Y)), (u = p.length), (l = h.length), u < l))
      ((o = p), (p = h), (h = o), (s = u), (u = l), (l = s));
    ((o = []), (s = u + l));
    for (r = s; r--;) o.push(0);
    for (r = l; --r >= 0;) {
      n = 0;
      for (i = u + r; i > r;)
        ((a = o[i] + h[r] * p[i - r - 1] + n), (o[i--] = (a % Ze) | 0), (n = (a / Ze) | 0));
      o[i] = ((o[i] + n) % Ze) | 0;
    }
    for (; !o[--s];) o.pop();
    if (n) ++t;
    else o.shift();
    return ((e.d = o), (e.e = Yn(o, t)), ee ? j(e, f.precision, f.rounding) : e);
  };
  L.toBinary = function (e, n) {
    return Wr(this, 2, e, n);
  };
  L.toDecimalPlaces = L.toDP = function (e, n) {
    var t = this,
      r = t.constructor;
    if (((t = new r(t)), e === void 0)) return t;
    if ((_e(e, 0, It), n === void 0)) n = r.rounding;
    else _e(n, 0, 8);
    return j(t, e + t.e + 1, n);
  };
  L.toExponential = function (e, n) {
    var t,
      r = this,
      i = r.constructor;
    if (e === void 0) t = tt(r, !0);
    else {
      if ((_e(e, 0, It), n === void 0)) n = i.rounding;
      else _e(n, 0, 8);
      ((r = j(new i(r), e + 1, n)), (t = tt(r, !0, e + 1)));
    }
    return r.isNeg() && !r.isZero() ? "-" + t : t;
  };
  L.toFixed = function (e, n) {
    var t,
      r,
      i = this,
      o = i.constructor;
    if (e === void 0) t = tt(i);
    else {
      if ((_e(e, 0, It), n === void 0)) n = o.rounding;
      else _e(n, 0, 8);
      ((r = j(new o(i), e + i.e + 1, n)), (t = tt(r, !1, e + r.e + 1)));
    }
    return i.isNeg() && !i.isZero() ? "-" + t : t;
  };
  L.toFraction = function (e) {
    var n,
      t,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c,
      f,
      p,
      h = this,
      { d: g, constructor: k } = h;
    if (!g) return new k(h);
    if (
      ((l = t = new k(1)),
      (r = u = new k(0)),
      (n = new k(r)),
      (o = n.e = jo(g) - h.e - 1),
      (s = o % Y),
      (n.d[0] = ye(10, s < 0 ? Y + s : s)),
      e == null)
    )
      e = o > 0 ? n : l;
    else {
      if (((a = new k(e)), !a.isInt() || a.lt(l))) throw Error(Et + a);
      e = a.gt(n) ? (o > 0 ? n : l) : a;
    }
    ((ee = !1), (a = new k(ve(g))), (c = k.precision), (k.precision = o = g.length * Y * 2));
    for (;;) {
      if (((f = ce(a, n, 0, 1, 1)), (i = t.plus(f.times(r))), i.cmp(e) == 1)) break;
      ((t = r),
        (r = i),
        (i = l),
        (l = u.plus(f.times(i))),
        (u = i),
        (i = n),
        (n = a.minus(f.times(i))),
        (a = i));
    }
    return (
      (i = ce(e.minus(t), r, 0, 1, 1)),
      (u = u.plus(i.times(l))),
      (t = t.plus(i.times(r))),
      (u.s = l.s = h.s),
      (p =
        ce(l, r, o, 1)
          .minus(h)
          .abs()
          .cmp(ce(u, t, o, 1).minus(h).abs()) < 1
          ? [l, r]
          : [u, t]),
      (k.precision = c),
      (ee = !0),
      p
    );
  };
  L.toHexadecimal = L.toHex = function (e, n) {
    return Wr(this, 16, e, n);
  };
  L.toNearest = function (e, n) {
    var t = this,
      r = t.constructor;
    if (((t = new r(t)), e == null)) {
      if (!t.d) return t;
      ((e = new r(1)), (n = r.rounding));
    } else {
      if (((e = new r(e)), n === void 0)) n = r.rounding;
      else _e(n, 0, 8);
      if (!t.d) return e.s ? t : e;
      if (!e.d) {
        if (e.s) e.s = t.s;
        return e;
      }
    }
    if (e.d[0]) ((ee = !1), (t = ce(t, e, 0, n, 1).times(e)), (ee = !0), j(t));
    else ((e.s = t.s), (t = e));
    return t;
  };
  L.toNumber = function () {
    return +this;
  };
  L.toOctal = function (e, n) {
    return Wr(this, 8, e, n);
  };
  L.toPower = L.pow = function (e) {
    var n,
      t,
      r,
      i,
      o,
      s,
      a = this,
      u = a.constructor,
      l = +(e = new u(e));
    if (!a.d || !e.d || !a.d[0] || !e.d[0]) return new u(ye(+a, l));
    if (((a = new u(a)), a.eq(1))) return a;
    if (((r = u.precision), (o = u.rounding), e.eq(1))) return j(a, r, o);
    if (((n = Re(e.e / Y)), n >= e.d.length - 1 && (t = l < 0 ? -l : l) <= Qu))
      return ((i = Wo(u, a, t, r)), e.s < 0 ? new u(1).div(i) : j(i, r, o));
    if (((s = a.s), s < 0)) {
      if (n < e.d.length - 1) return new u(NaN);
      if ((e.d[n] & 1) == 0) s = 1;
      if (a.e == 0 && a.d[0] == 1 && a.d.length == 1) return ((a.s = s), a);
    }
    if (
      ((t = ye(+a, l)),
      (n =
        t == 0 || !isFinite(t)
          ? Re(l * (Math.log("0." + ve(a.d)) / Math.LN10 + a.e + 1))
          : new u(t + "").e),
      n > u.maxE + 1 || n < u.minE - 1)
    )
      return new u(n > 0 ? s / 0 : 0);
    if (
      ((ee = !1),
      (u.rounding = a.s = 1),
      (t = Math.min(12, (n + "").length)),
      (i = jr(e.times(Ct(a, r + t)), r)),
      i.d)
    ) {
      if (((i = j(i, r + 5, 1)), In(i.d, r, o))) {
        if (
          ((n = r + 10),
          (i = j(jr(e.times(Ct(a, n + t)), n), n + 5, 1)),
          +ve(i.d).slice(r + 1, r + 15) + 1 == 100000000000000)
        )
          i = j(i, r + 1, 0);
      }
    }
    return ((i.s = s), (ee = !0), (u.rounding = o), j(i, r, o));
  };
  L.toPrecision = function (e, n) {
    var t,
      r = this,
      i = r.constructor;
    if (e === void 0) t = tt(r, r.e <= i.toExpNeg || r.e >= i.toExpPos);
    else {
      if ((_e(e, 1, It), n === void 0)) n = i.rounding;
      else _e(n, 0, 8);
      ((r = j(new i(r), e, n)), (t = tt(r, e <= r.e || r.e <= i.toExpNeg, e)));
    }
    return r.isNeg() && !r.isZero() ? "-" + t : t;
  };
  L.toSignificantDigits = L.toSD = function (e, n) {
    var t = this,
      r = t.constructor;
    if (e === void 0) ((e = r.precision), (n = r.rounding));
    else if ((_e(e, 1, It), n === void 0)) n = r.rounding;
    else _e(n, 0, 8);
    return j(new r(t), e, n);
  };
  L.toString = function () {
    var e = this,
      n = e.constructor,
      t = tt(e, e.e <= n.toExpNeg || e.e >= n.toExpPos);
    return e.isNeg() && !e.isZero() ? "-" + t : t;
  };
  L.truncated = L.trunc = function () {
    return j(new this.constructor(this), this.e + 1, 1);
  };
  L.valueOf = L.toJSON = function () {
    var e = this,
      n = e.constructor,
      t = tt(e, e.e <= n.toExpNeg || e.e >= n.toExpPos);
    return e.isNeg() ? "-" + t : t;
  };
  function ve(e) {
    var n,
      t,
      r,
      i = e.length - 1,
      o = "",
      s = e[0];
    if (i > 0) {
      o += s;
      for (n = 1; n < i; n++) {
        if (((r = e[n] + ""), (t = Y - r.length), t)) o += St(t);
        o += r;
      }
      if (((s = e[n]), (r = s + ""), (t = Y - r.length), t)) o += St(t);
    } else if (s === 0) return "0";
    for (; s % 10 === 0;) s /= 10;
    return o + s;
  }
  function _e(e, n, t) {
    if (e !== ~~e || e < n || e > t) throw Error(Et + e);
  }
  function In(e, n, t, r) {
    var i, o, s, a;
    for (o = e[0]; o >= 10; o /= 10) --n;
    if (--n < 0) ((n += Y), (i = 0));
    else ((i = Math.ceil((n + 1) / Y)), (n %= Y));
    if (((o = ye(10, Y - n)), (a = (e[i] % o) | 0), r == null))
      if (n < 3) {
        if (n == 0) a = (a / 100) | 0;
        else if (n == 1) a = (a / 10) | 0;
        s = (t < 4 && a == 99999) || (t > 3 && a == 49999) || a == 50000 || a == 0;
      } else
        s =
          (((t < 4 && a + 1 == o) || (t > 3 && a + 1 == o / 2)) &&
            ((e[i + 1] / o / 100) | 0) == ye(10, n - 2) - 1) ||
          ((a == o / 2 || a == 0) && ((e[i + 1] / o / 100) | 0) == 0);
    else if (n < 4) {
      if (n == 0) a = (a / 1000) | 0;
      else if (n == 1) a = (a / 100) | 0;
      else if (n == 2) a = (a / 10) | 0;
      s = ((r || t < 4) && a == 9999) || (!r && t > 3 && a == 4999);
    } else
      s =
        (((r || t < 4) && a + 1 == o) || (!r && t > 3 && a + 1 == o / 2)) &&
        ((e[i + 1] / o / 1000) | 0) == ye(10, n - 3) - 1;
    return s;
  }
  function Hn(e, n, t) {
    var r,
      i = [0],
      o,
      s = 0,
      a = e.length;
    for (; s < a;) {
      for (o = i.length; o--;) i[o] *= n;
      i[0] += Ur.indexOf(e.charAt(s++));
      for (r = 0; r < i.length; r++)
        if (i[r] > t - 1) {
          if (i[r + 1] === void 0) i[r + 1] = 0;
          ((i[r + 1] += (i[r] / t) | 0), (i[r] %= t));
        }
    }
    return i.reverse();
  }
  function Ku(e, n) {
    var t, r, i;
    if (n.isZero()) return n;
    if (((r = n.d.length), r < 32)) ((t = Math.ceil(r / 3)), (i = (1 / Kn(4, t)).toString()));
    else ((t = 16), (i = "2.3283064365386962890625e-10"));
    ((e.precision += t), (n = on(e, 1, n.times(i), new e(1))));
    for (var o = t; o--;) {
      var s = n.times(n);
      n = s.times(s).minus(s).times(8).plus(1);
    }
    return ((e.precision -= t), n);
  }
  var ce = (function () {
    function e(r, i, o) {
      var s,
        a = 0,
        u = r.length;
      for (r = r.slice(); u--;) ((s = r[u] * i + a), (r[u] = (s % o) | 0), (a = (s / o) | 0));
      if (a) r.unshift(a);
      return r;
    }
    function n(r, i, o, s) {
      var a, u;
      if (o != s) u = o > s ? 1 : -1;
      else
        for (a = u = 0; a < o; a++)
          if (r[a] != i[a]) {
            u = r[a] > i[a] ? 1 : -1;
            break;
          }
      return u;
    }
    function t(r, i, o, s) {
      var a = 0;
      for (; o--;) ((r[o] -= a), (a = r[o] < i[o] ? 1 : 0), (r[o] = a * s + r[o] - i[o]));
      for (; !r[0] && r.length > 1;) r.shift();
    }
    return function (r, i, o, s, a, u) {
      var l,
        c,
        f,
        p,
        h,
        g,
        k,
        C,
        b,
        F,
        M,
        q,
        z,
        E,
        _,
        te,
        X,
        T,
        K,
        ne,
        U = r.constructor,
        W = r.s == i.s ? 1 : -1,
        H = r.d,
        Q = i.d;
      if (!H || !H[0] || !Q || !Q[0])
        return new U(
          !r.s || !i.s || (H ? Q && H[0] == Q[0] : !Q)
            ? NaN
            : (H && H[0] == 0) || !Q
              ? W * 0
              : W / 0,
        );
      if (u) ((h = 1), (c = r.e - i.e));
      else ((u = Ze), (h = Y), (c = Re(r.e / h) - Re(i.e / h)));
      ((K = Q.length), (X = H.length), (b = new U(W)), (F = b.d = []));
      for (f = 0; Q[f] == (H[f] || 0); f++);
      if (Q[f] > (H[f] || 0)) c--;
      if (o == null) ((E = o = U.precision), (s = U.rounding));
      else if (a) E = o + (r.e - i.e) + 1;
      else E = o;
      if (E < 0) (F.push(1), (g = !0));
      else {
        if (((E = (E / h + 2) | 0), (f = 0), K == 1)) {
          ((p = 0), (Q = Q[0]), E++);
          for (; (f < X || p) && E--; f++)
            ((_ = p * u + (H[f] || 0)), (F[f] = (_ / Q) | 0), (p = (_ % Q) | 0));
          g = p || f < X;
        } else {
          if (((p = (u / (Q[0] + 1)) | 0), p > 1))
            ((Q = e(Q, p, u)), (H = e(H, p, u)), (K = Q.length), (X = H.length));
          ((te = K), (M = H.slice(0, K)), (q = M.length));
          for (; q < K;) M[q++] = 0;
          if (((ne = Q.slice()), ne.unshift(0), (T = Q[0]), Q[1] >= u / 2)) ++T;
          do {
            if (((p = 0), (l = n(Q, M, K, q)), l < 0)) {
              if (((z = M[0]), K != q)) z = z * u + (M[1] || 0);
              if (((p = (z / T) | 0), p > 1)) {
                if (p >= u) p = u - 1;
                if (((k = e(Q, p, u)), (C = k.length), (q = M.length), (l = n(k, M, C, q)), l == 1))
                  (p--, t(k, K < C ? ne : Q, C, u));
              } else {
                if (p == 0) l = p = 1;
                k = Q.slice();
              }
              if (((C = k.length), C < q)) k.unshift(0);
              if ((t(M, k, q, u), l == -1)) {
                if (((q = M.length), (l = n(Q, M, K, q)), l < 1)) (p++, t(M, K < q ? ne : Q, q, u));
              }
              q = M.length;
            } else if (l === 0) (p++, (M = [0]));
            if (((F[f++] = p), l && M[0])) M[q++] = H[te] || 0;
            else ((M = [H[te]]), (q = 1));
          } while ((te++ < X || M[0] !== void 0) && E--);
          g = M[0] !== void 0;
        }
        if (!F[0]) F.shift();
      }
      if (h == 1) ((b.e = c), (_o = g));
      else {
        for (f = 1, p = F[0]; p >= 10; p /= 10) f++;
        ((b.e = f + c * h - 1), j(b, a ? o + b.e + 1 : o, s, g));
      }
      return b;
    };
  })();
  function j(e, n, t, r) {
    var i,
      o,
      s,
      a,
      u,
      l,
      c,
      f,
      p,
      h = e.constructor;
    e: if (n != null) {
      if (((f = e.d), !f)) return e;
      for (i = 1, a = f[0]; a >= 10; a /= 10) i++;
      if (((o = n - i), o < 0))
        ((o += Y), (s = n), (c = f[(p = 0)]), (u = ((c / ye(10, i - s - 1)) % 10) | 0));
      else if (((p = Math.ceil((o + 1) / Y)), (a = f.length), p >= a))
        if (r) {
          for (; a++ <= p;) f.push(0);
          ((c = u = 0), (i = 1), (o %= Y), (s = o - Y + 1));
        } else break e;
      else {
        c = a = f[p];
        for (i = 1; a >= 10; a /= 10) i++;
        ((o %= Y), (s = o - Y + i), (u = s < 0 ? 0 : ((c / ye(10, i - s - 1)) % 10) | 0));
      }
      if (
        ((r = r || n < 0 || f[p + 1] !== void 0 || (s < 0 ? c : c % ye(10, i - s - 1))),
        (l =
          t < 4
            ? (u || r) && (t == 0 || t == (e.s < 0 ? 3 : 2))
            : u > 5 ||
              (u == 5 &&
                (t == 4 ||
                  r ||
                  (t == 6 && ((o > 0 ? (s > 0 ? c / ye(10, i - s) : 0) : f[p - 1]) % 10) & 1) ||
                  t == (e.s < 0 ? 8 : 7)))),
        n < 1 || !f[0])
      ) {
        if (((f.length = 0), l))
          ((n -= e.e + 1), (f[0] = ye(10, (Y - (n % Y)) % Y)), (e.e = -n || 0));
        else f[0] = e.e = 0;
        return e;
      }
      if (o == 0) ((f.length = p), (a = 1), p--);
      else
        ((f.length = p + 1),
          (a = ye(10, Y - o)),
          (f[p] = s > 0 ? (((c / ye(10, i - s)) % ye(10, s)) | 0) * a : 0));
      if (l)
        for (;;)
          if (p == 0) {
            for (o = 1, s = f[0]; s >= 10; s /= 10) o++;
            s = f[0] += a;
            for (a = 1; s >= 10; s /= 10) a++;
            if (o != a) {
              if ((e.e++, f[0] == Ze)) f[0] = 1;
            }
            break;
          } else {
            if (((f[p] += a), f[p] != Ze)) break;
            ((f[p--] = 0), (a = 1));
          }
      for (o = f.length; f[--o] === 0;) f.pop();
    }
    if (ee) {
      if (e.e > h.maxE) ((e.d = null), (e.e = NaN));
      else if (e.e < h.minE) ((e.e = 0), (e.d = [0]));
    }
    return e;
  }
  function tt(e, n, t) {
    if (!e.isFinite()) return Zo(e);
    var r,
      i = e.e,
      o = ve(e.d),
      s = o.length;
    if (n) {
      if (t && (r = t - s) > 0) o = o.charAt(0) + "." + o.slice(1) + St(r);
      else if (s > 1) o = o.charAt(0) + "." + o.slice(1);
      o = o + (e.e < 0 ? "e" : "e+") + e.e;
    } else if (i < 0) {
      if (((o = "0." + St(-i - 1) + o), t && (r = t - s) > 0)) o += St(r);
    } else if (i >= s) {
      if (((o += St(i + 1 - s)), t && (r = t - i - 1) > 0)) o = o + "." + St(r);
    } else {
      if ((r = i + 1) < s) o = o.slice(0, r) + "." + o.slice(r);
      if (t && (r = t - s) > 0) {
        if (i + 1 === s) o += ".";
        o += St(r);
      }
    }
    return o;
  }
  function Yn(e, n) {
    var t = e[0];
    for (n *= Y; t >= 10; t /= 10) n++;
    return n;
  }
  function Zn(e, n, t) {
    if (n > Yu) {
      if (((ee = !0), t)) e.precision = t;
      throw Error(qo);
    }
    return j(new e(Wn), n, 1, !0);
  }
  function et(e, n, t) {
    if (n > Hr) throw Error(qo);
    return j(new e(Gn), n, t, !0);
  }
  function jo(e) {
    var n = e.length - 1,
      t = n * Y + 1;
    if (((n = e[n]), n)) {
      for (; n % 10 == 0; n /= 10) t--;
      for (n = e[0]; n >= 10; n /= 10) t++;
    }
    return t;
  }
  function St(e) {
    var n = "";
    for (; e--;) n += "0";
    return n;
  }
  function Wo(e, n, t, r) {
    var i,
      o = new e(1),
      s = Math.ceil(r / Y + 4);
    ee = !1;
    for (;;) {
      if (t % 2) {
        if (((o = o.times(n)), Oo(o.d, s))) i = !0;
      }
      if (((t = Re(t / 2)), t === 0)) {
        if (((t = o.d.length - 1), i && o.d[t] === 0)) ++o.d[t];
        break;
      }
      ((n = n.times(n)), Oo(n.d, s));
    }
    return ((ee = !0), o);
  }
  function zo(e) {
    return e.d[e.d.length - 1] & 1;
  }
  function Go(e, n, t) {
    var r,
      i,
      o = new e(n[0]),
      s = 0;
    for (; ++s < n.length;) {
      if (((i = new e(n[s])), !i.s)) {
        o = i;
        break;
      }
      if (((r = o.cmp(i)), r === t || (r === 0 && o.s === t))) o = i;
    }
    return o;
  }
  function jr(e, n) {
    var t,
      r,
      i,
      o,
      s,
      a,
      u,
      l = 0,
      c = 0,
      f = 0,
      p = e.constructor,
      { rounding: h, precision: g } = p;
    if (!e.d || !e.d[0] || e.e > 17)
      return new p(e.d ? (!e.d[0] ? 1 : e.s < 0 ? 0 : 1 / 0) : e.s ? (e.s < 0 ? 0 : e) : NaN);
    if (n == null) ((ee = !1), (u = g));
    else u = n;
    a = new p(0.03125);
    while (e.e > -2) ((e = e.times(a)), (f += 5));
    ((r = ((Math.log(ye(2, f)) / Math.LN10) * 2 + 5) | 0),
      (u += r),
      (t = o = s = new p(1)),
      (p.precision = u));
    for (;;) {
      if (
        ((o = j(o.times(e), u, 1)),
        (t = t.times(++c)),
        (a = s.plus(ce(o, t, u, 1))),
        ve(a.d).slice(0, u) === ve(s.d).slice(0, u))
      ) {
        i = f;
        while (i--) s = j(s.times(s), u, 1);
        if (n == null)
          if (l < 3 && In(s.d, u - r, h, l))
            ((p.precision = u += 10), (t = o = a = new p(1)), (c = 0), l++);
          else return j(s, (p.precision = g), h, (ee = !0));
        else return ((p.precision = g), s);
      }
      s = a;
    }
  }
  function Ct(e, n) {
    var t,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c,
      f,
      p,
      h = 1,
      g = 10,
      k = e,
      C = k.d,
      b = k.constructor,
      { rounding: F, precision: M } = b;
    if (k.s < 0 || !C || !C[0] || (!k.e && C[0] == 1 && C.length == 1))
      return new b(C && !C[0] ? -1 / 0 : k.s != 1 ? NaN : C ? 0 : k);
    if (n == null) ((ee = !1), (c = M));
    else c = n;
    if (
      ((b.precision = c += g),
      (t = ve(C)),
      (r = t.charAt(0)),
      Math.abs((o = k.e)) < 1500000000000000)
    ) {
      while ((r < 7 && r != 1) || (r == 1 && t.charAt(1) > 3))
        ((k = k.times(e)), (t = ve(k.d)), (r = t.charAt(0)), h++);
      if (((o = k.e), r > 1)) ((k = new b("0." + t)), o++);
      else k = new b(r + "." + t.slice(1));
    } else
      return (
        (l = Zn(b, c + 2, M).times(o + "")),
        (k = Ct(new b(r + "." + t.slice(1)), c - g).plus(l)),
        (b.precision = M),
        n == null ? j(k, M, F, (ee = !0)) : k
      );
    ((f = k), (u = s = k = ce(k.minus(1), k.plus(1), c, 1)), (p = j(k.times(k), c, 1)), (i = 3));
    for (;;) {
      if (
        ((s = j(s.times(p), c, 1)),
        (l = u.plus(ce(s, new b(i), c, 1))),
        ve(l.d).slice(0, c) === ve(u.d).slice(0, c))
      ) {
        if (((u = u.times(2)), o !== 0)) u = u.plus(Zn(b, c + 2, M).times(o + ""));
        if (((u = ce(u, new b(h), c, 1)), n == null))
          if (In(u.d, c - g, F, a))
            ((b.precision = c += g),
              (l = s = k = ce(f.minus(1), f.plus(1), c, 1)),
              (p = j(k.times(k), c, 1)),
              (i = a = 1));
          else return j(u, (b.precision = M), F, (ee = !0));
        else return ((b.precision = M), u);
      }
      ((u = l), (i += 2));
    }
  }
  function Zo(e) {
    return String((e.s * e.s) / 0);
  }
  function jn(e, n) {
    var t, r, i;
    if ((t = n.indexOf(".")) > -1) n = n.replace(".", "");
    if ((r = n.search(/e/i)) > 0) {
      if (t < 0) t = r;
      ((t += +n.slice(r + 1)), (n = n.substring(0, r)));
    } else if (t < 0) t = n.length;
    for (r = 0; n.charCodeAt(r) === 48; r++);
    for (i = n.length; n.charCodeAt(i - 1) === 48; --i);
    if (((n = n.slice(r, i)), n)) {
      if (((i -= r), (e.e = t = t - r - 1), (e.d = []), (r = (t + 1) % Y), t < 0)) r += Y;
      if (r < i) {
        if (r) e.d.push(+n.slice(0, r));
        for (i -= Y; r < i;) e.d.push(+n.slice(r, (r += Y)));
        ((n = n.slice(r)), (r = Y - n.length));
      } else r -= i;
      for (; r--;) n += "0";
      if ((e.d.push(+n), ee)) {
        if (e.e > e.constructor.maxE) ((e.d = null), (e.e = NaN));
        else if (e.e < e.constructor.minE) ((e.e = 0), (e.d = [0]));
      }
    } else ((e.e = 0), (e.d = [0]));
    return e;
  }
  function Xu(e, n) {
    var t, r, i, o, s, a, u, l, c;
    if (n.indexOf("_") > -1) {
      if (((n = n.replace(/(\d)_(?=\d)/g, "$1")), Ho.test(n))) return jn(e, n);
    } else if (n === "Infinity" || n === "NaN") {
      if (!+n) e.s = NaN;
      return ((e.e = NaN), (e.d = null), e);
    }
    if (Gu.test(n)) ((t = 16), (n = n.toLowerCase()));
    else if (Wu.test(n)) t = 2;
    else if (Zu.test(n)) t = 8;
    else throw Error(Et + n);
    if (((o = n.search(/p/i)), o > 0)) ((u = +n.slice(o + 1)), (n = n.substring(2, o)));
    else n = n.slice(2);
    if (((o = n.indexOf(".")), (s = o >= 0), (r = e.constructor), s))
      ((n = n.replace(".", "")), (a = n.length), (o = a - o), (i = Wo(r, new r(t), o, o * 2)));
    ((l = Hn(n, t, Ze)), (c = l.length - 1));
    for (o = c; l[o] === 0; --o) l.pop();
    if (o < 0) return new r(e.s * 0);
    if (((e.e = Yn(l, c)), (e.d = l), (ee = !1), s)) e = ce(e, i, a * 4);
    if (u) e = e.times(Math.abs(u) < 54 ? ye(2, u) : ue.pow(2, u));
    return ((ee = !0), e);
  }
  function Ju(e, n) {
    var t,
      r = n.d.length;
    if (r < 3) return n.isZero() ? n : on(e, 2, n, n);
    ((t = 1.4 * Math.sqrt(r)),
      (t = t > 16 ? 16 : t | 0),
      (n = n.times(1 / Kn(5, t))),
      (n = on(e, 2, n, n)));
    var i,
      o = new e(5),
      s = new e(16),
      a = new e(20);
    for (; t--;) ((i = n.times(n)), (n = n.times(o.plus(i.times(s.times(i).minus(a))))));
    return n;
  }
  function on(e, n, t, r, i) {
    var o,
      s,
      a,
      u,
      l = 1,
      c = e.precision,
      f = Math.ceil(c / Y);
    ((ee = !1), (u = t.times(t)), (a = new e(r)));
    for (;;) {
      if (
        ((s = ce(a.times(u), new e(n++ * n++), c, 1)),
        (a = i ? r.plus(s) : r.minus(s)),
        (r = ce(s.times(u), new e(n++ * n++), c, 1)),
        (s = a.plus(r)),
        s.d[f] !== void 0)
      ) {
        for (o = f; s.d[o] === a.d[o] && o--;);
        if (o == -1) break;
      }
      ((o = a), (a = r), (r = s), (s = o), l++);
    }
    return ((ee = !0), (s.d.length = f + 1), s);
  }
  function Kn(e, n) {
    var t = e;
    while (--n) t *= e;
    return t;
  }
  function Qo(e, n) {
    var t,
      r = n.s < 0,
      i = et(e, e.precision, 1),
      o = i.times(0.5);
    if (((n = n.abs()), n.lte(o))) return ((pt = r ? 4 : 1), n);
    if (((t = n.divToInt(i)), t.isZero())) pt = r ? 3 : 2;
    else {
      if (((n = n.minus(t.times(i))), n.lte(o))) return ((pt = zo(t) ? (r ? 2 : 3) : r ? 4 : 1), n);
      pt = zo(t) ? (r ? 1 : 4) : r ? 3 : 2;
    }
    return n.minus(i).abs();
  }
  function Wr(e, n, t, r) {
    var i,
      o,
      s,
      a,
      u,
      l,
      c,
      f,
      p,
      h = e.constructor,
      g = t !== void 0;
    if (g)
      if ((_e(t, 1, It), r === void 0)) r = h.rounding;
      else _e(r, 0, 8);
    else ((t = h.precision), (r = h.rounding));
    if (!e.isFinite()) c = Zo(e);
    else {
      if (((c = tt(e)), (s = c.indexOf(".")), g)) {
        if (((i = 2), n == 16)) t = t * 4 - 3;
        else if (n == 8) t = t * 3 - 2;
      } else i = n;
      if (s >= 0)
        ((c = c.replace(".", "")),
          (p = new h(1)),
          (p.e = c.length - s),
          (p.d = Hn(tt(p), 10, i)),
          (p.e = p.d.length));
      ((f = Hn(c, 10, i)), (o = u = f.length));
      for (; f[--u] == 0;) f.pop();
      if (!f[0]) c = g ? "0p+0" : "0";
      else {
        if (s < 0) o--;
        else
          ((e = new h(e)),
            (e.d = f),
            (e.e = o),
            (e = ce(e, p, t, r, 0, i)),
            (f = e.d),
            (o = e.e),
            (l = _o));
        if (
          ((s = f[t]),
          (a = i / 2),
          (l = l || f[t + 1] !== void 0),
          (l =
            r < 4
              ? (s !== void 0 || l) && (r === 0 || r === (e.s < 0 ? 3 : 2))
              : s > a ||
                (s === a &&
                  (r === 4 || l || (r === 6 && f[t - 1] & 1) || r === (e.s < 0 ? 8 : 7)))),
          (f.length = t),
          l)
        ) {
          for (; ++f[--t] > i - 1;) if (((f[t] = 0), !t)) (++o, f.unshift(1));
        }
        for (u = f.length; !f[u - 1]; --u);
        for (s = 0, c = ""; s < u; s++) c += Ur.charAt(f[s]);
        if (g) {
          if (u > 1)
            if (n == 16 || n == 8) {
              s = n == 16 ? 4 : 3;
              for (--u; u % s; u++) c += "0";
              f = Hn(c, i, n);
              for (u = f.length; !f[u - 1]; --u);
              for (s = 1, c = "1."; s < u; s++) c += Ur.charAt(f[s]);
            } else c = c.charAt(0) + "." + c.slice(1);
          c = c + (o < 0 ? "p" : "p+") + o;
        } else if (o < 0) {
          for (; ++o;) c = "0" + c;
          c = "0." + c;
        } else if (++o > u) for (o -= u; o--;) c += "0";
        else if (o < u) c = c.slice(0, o) + "." + c.slice(o);
      }
      c = (n == 16 ? "0x" : n == 2 ? "0b" : n == 8 ? "0o" : "") + c;
    }
    return e.s < 0 ? "-" + c : c;
  }
  function Oo(e, n) {
    if (e.length > n) return ((e.length = n), !0);
  }
  function el(e) {
    return new this(e).abs();
  }
  function tl(e) {
    return new this(e).acos();
  }
  function nl(e) {
    return new this(e).acosh();
  }
  function rl(e, n) {
    return new this(e).plus(n);
  }
  function il(e) {
    return new this(e).asin();
  }
  function ol(e) {
    return new this(e).asinh();
  }
  function sl(e) {
    return new this(e).atan();
  }
  function al(e) {
    return new this(e).atanh();
  }
  function ul(e, n) {
    ((e = new this(e)), (n = new this(n)));
    var t,
      r = this.precision,
      i = this.rounding,
      o = r + 4;
    if (!e.s || !n.s) t = new this(NaN);
    else if (!e.d && !n.d) ((t = et(this, o, 1).times(n.s > 0 ? 0.25 : 0.75)), (t.s = e.s));
    else if (!n.d || e.isZero()) ((t = n.s < 0 ? et(this, r, i) : new this(0)), (t.s = e.s));
    else if (!e.d || n.isZero()) ((t = et(this, o, 1).times(0.5)), (t.s = e.s));
    else if (n.s < 0)
      ((this.precision = o),
        (this.rounding = 1),
        (t = this.atan(ce(e, n, o, 1))),
        (n = et(this, o, 1)),
        (this.precision = r),
        (this.rounding = i),
        (t = e.s < 0 ? t.minus(n) : t.plus(n)));
    else t = this.atan(ce(e, n, o, 1));
    return t;
  }
  function ll(e) {
    return new this(e).cbrt();
  }
  function cl(e) {
    return j((e = new this(e)), e.e + 1, 2);
  }
  function fl(e, n, t) {
    return new this(e).clamp(n, t);
  }
  function dl(e) {
    if (!e || typeof e !== "object") throw Error(Qn + "Object expected");
    var n,
      t,
      r,
      i = e.defaults === !0,
      o = [
        "precision",
        1,
        It,
        "rounding",
        0,
        8,
        "toExpNeg",
        -rn,
        0,
        "toExpPos",
        0,
        rn,
        "maxE",
        0,
        rn,
        "minE",
        -rn,
        0,
        "modulo",
        0,
        9,
      ];
    for (n = 0; n < o.length; n += 3) {
      if (((t = o[n]), i)) this[t] = Vr[t];
      if ((r = e[t]) !== void 0)
        if (Re(r) === r && r >= o[n + 1] && r <= o[n + 2]) this[t] = r;
        else throw Error(Et + t + ": " + r);
    }
    if (((t = "crypto"), i)) this[t] = Vr[t];
    if ((r = e[t]) !== void 0)
      if (r === !0 || r === !1 || r === 0 || r === 1)
        if (r)
          if (typeof crypto < "u" && crypto && (crypto.getRandomValues || crypto.randomBytes))
            this[t] = !0;
          else throw Error(Uo);
        else this[t] = !1;
      else throw Error(Et + t + ": " + r);
    return this;
  }
  function pl(e) {
    return new this(e).cos();
  }
  function hl(e) {
    return new this(e).cosh();
  }
  function Yo(e) {
    var n, t, r;
    function i(o) {
      var s,
        a,
        u,
        l = this;
      if (!(l instanceof i)) return new i(o);
      if (((l.constructor = i), $o(o))) {
        if (((l.s = o.s), ee))
          if (!o.d || o.e > i.maxE) ((l.e = NaN), (l.d = null));
          else if (o.e < i.minE) ((l.e = 0), (l.d = [0]));
          else ((l.e = o.e), (l.d = o.d.slice()));
        else ((l.e = o.e), (l.d = o.d ? o.d.slice() : o.d));
        return;
      }
      if (((u = typeof o), u === "number")) {
        if (o === 0) {
          ((l.s = 1 / o < 0 ? -1 : 1), (l.e = 0), (l.d = [0]));
          return;
        }
        if (o < 0) ((o = -o), (l.s = -1));
        else l.s = 1;
        if (o === ~~o && o < 1e7) {
          for (s = 0, a = o; a >= 10; a /= 10) s++;
          if (ee)
            if (s > i.maxE) ((l.e = NaN), (l.d = null));
            else if (s < i.minE) ((l.e = 0), (l.d = [0]));
            else ((l.e = s), (l.d = [o]));
          else ((l.e = s), (l.d = [o]));
          return;
        }
        if (o * 0 !== 0) {
          if (!o) l.s = NaN;
          ((l.e = NaN), (l.d = null));
          return;
        }
        return jn(l, o.toString());
      }
      if (u === "string") {
        if ((a = o.charCodeAt(0)) === 45) ((o = o.slice(1)), (l.s = -1));
        else {
          if (a === 43) o = o.slice(1);
          l.s = 1;
        }
        return Ho.test(o) ? jn(l, o) : Xu(l, o);
      }
      if (u === "bigint") {
        if (o < 0) ((o = -o), (l.s = -1));
        else l.s = 1;
        return jn(l, o.toString());
      }
      throw Error(Et + o);
    }
    if (
      ((i.prototype = L),
      (i.ROUND_UP = 0),
      (i.ROUND_DOWN = 1),
      (i.ROUND_CEIL = 2),
      (i.ROUND_FLOOR = 3),
      (i.ROUND_HALF_UP = 4),
      (i.ROUND_HALF_DOWN = 5),
      (i.ROUND_HALF_EVEN = 6),
      (i.ROUND_HALF_CEIL = 7),
      (i.ROUND_HALF_FLOOR = 8),
      (i.EUCLID = 9),
      (i.config = i.set = dl),
      (i.clone = Yo),
      (i.isDecimal = $o),
      (i.abs = el),
      (i.acos = tl),
      (i.acosh = nl),
      (i.add = rl),
      (i.asin = il),
      (i.asinh = ol),
      (i.atan = sl),
      (i.atanh = al),
      (i.atan2 = ul),
      (i.cbrt = ll),
      (i.ceil = cl),
      (i.clamp = fl),
      (i.cos = pl),
      (i.cosh = hl),
      (i.div = ml),
      (i.exp = gl),
      (i.floor = kl),
      (i.hypot = xl),
      (i.ln = wl),
      (i.log = bl),
      (i.log10 = Sl),
      (i.log2 = yl),
      (i.max = Cl),
      (i.min = El),
      (i.mod = Il),
      (i.mul = Tl),
      (i.pow = vl),
      (i.random = Al),
      (i.round = Ml),
      (i.sign = Fl),
      (i.sin = Rl),
      (i.sinh = Pl),
      (i.sqrt = Ll),
      (i.sub = Dl),
      (i.sum = Bl),
      (i.tan = Nl),
      (i.tanh = zl),
      (i.trunc = Ol),
      e === void 0)
    )
      e = {};
    if (e) {
      if (e.defaults !== !0) {
        r = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
        for (n = 0; n < r.length;) if (!e.hasOwnProperty((t = r[n++]))) e[t] = this[t];
      }
    }
    return (i.config(e), i);
  }
  function ml(e, n) {
    return new this(e).div(n);
  }
  function gl(e) {
    return new this(e).exp();
  }
  function kl(e) {
    return j((e = new this(e)), e.e + 1, 3);
  }
  function xl() {
    var e,
      n,
      t = new this(0);
    ee = !1;
    for (e = 0; e < arguments.length;)
      if (((n = new this(arguments[e++])), !n.d)) {
        if (n.s) return ((ee = !0), new this(1 / 0));
        t = n;
      } else if (t.d) t = t.plus(n.times(n));
    return ((ee = !0), t.sqrt());
  }
  function $o(e) {
    return e instanceof ue || (e && e.toStringTag === Vo) || !1;
  }
  function wl(e) {
    return new this(e).ln();
  }
  function bl(e, n) {
    return new this(e).log(n);
  }
  function yl(e) {
    return new this(e).log(2);
  }
  function Sl(e) {
    return new this(e).log(10);
  }
  function Cl() {
    return Go(this, arguments, -1);
  }
  function El() {
    return Go(this, arguments, 1);
  }
  function Il(e, n) {
    return new this(e).mod(n);
  }
  function Tl(e, n) {
    return new this(e).mul(n);
  }
  function vl(e, n) {
    return new this(e).pow(n);
  }
  function Al(e) {
    var n,
      t,
      r,
      i,
      o = 0,
      s = new this(1),
      a = [];
    if (e === void 0) e = this.precision;
    else _e(e, 1, It);
    if (((r = Math.ceil(e / Y)), !this.crypto)) for (; o < r;) a[o++] = (Math.random() * 1e7) | 0;
    else if (crypto.getRandomValues) {
      n = crypto.getRandomValues(new Uint32Array(r));
      for (; o < r;)
        if (((i = n[o]), i >= 4290000000)) n[o] = crypto.getRandomValues(new Uint32Array(1))[0];
        else a[o++] = i % 1e7;
    } else if (crypto.randomBytes) {
      n = crypto.randomBytes((r *= 4));
      for (; o < r;)
        if (
          ((i = n[o] + (n[o + 1] << 8) + (n[o + 2] << 16) + ((n[o + 3] & 127) << 24)),
          i >= 2140000000)
        )
          crypto.randomBytes(4).copy(n, o);
        else (a.push(i % 1e7), (o += 4));
      o = r / 4;
    } else throw Error(Uo);
    if (((r = a[--o]), (e %= Y), r && e)) ((i = ye(10, Y - e)), (a[o] = ((r / i) | 0) * i));
    for (; a[o] === 0; o--) a.pop();
    if (o < 0) ((t = 0), (a = [0]));
    else {
      t = -1;
      for (; a[0] === 0; t -= Y) a.shift();
      for (r = 1, i = a[0]; i >= 10; i /= 10) r++;
      if (r < Y) t -= Y - r;
    }
    return ((s.e = t), (s.d = a), s);
  }
  function Ml(e) {
    return j((e = new this(e)), e.e + 1, this.rounding);
  }
  function Fl(e) {
    return ((e = new this(e)), e.d ? (e.d[0] ? e.s : 0 * e.s) : e.s || NaN);
  }
  function Rl(e) {
    return new this(e).sin();
  }
  function Pl(e) {
    return new this(e).sinh();
  }
  function Ll(e) {
    return new this(e).sqrt();
  }
  function Dl(e, n) {
    return new this(e).sub(n);
  }
  function Bl() {
    var e = 0,
      n = arguments,
      t = new this(n[e]);
    ee = !1;
    for (; t.s && ++e < n.length;) t = t.plus(n[e]);
    return ((ee = !0), j(t, this.precision, this.rounding));
  }
  function Nl(e) {
    return new this(e).tan();
  }
  function zl(e) {
    return new this(e).tanh();
  }
  function Ol(e) {
    return j((e = new this(e)), e.e + 1, 1);
  }
  L[Symbol.for("nodejs.util.inspect.custom")] = L.toString;
  L[Symbol.toStringTag] = "Decimal";
  var ue = (L.constructor = Yo(Vr));
  Wn = new ue(Wn);
  Gn = new ue(Gn);
  function Gr(e, n) {
    let t = String(e);
    if (typeof n !== "string") throw TypeError("Expected character");
    let r = 0,
      i = t.indexOf(n);
    while (i !== -1) (r++, (i = t.indexOf(n, i + n.length)));
    return r;
  }
  class Ko extends Error {
    name = "Assertion";
    code = "ERR_ASSERTION";
    constructor(e, n, t, r, i) {
      super(e);
      if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
      ((this.actual = n), (this.expected = t), (this.generated = i), (this.operator = r));
    }
  }
  function x(e, n) {
    $l(Boolean(e), !1, !0, "ok", "Expected value to be truthy", n);
  }
  function $l(e, n, t, r, i, o) {
    if (!e) throw o instanceof Error ? o : new Ko(o || i, n, t, r, !o);
  }
  var d = {
    carriageReturn: -5,
    lineFeed: -4,
    carriageReturnLineFeed: -3,
    horizontalTab: -2,
    virtualSpace: -1,
    eof: null,
    nul: 0,
    soh: 1,
    stx: 2,
    etx: 3,
    eot: 4,
    enq: 5,
    ack: 6,
    bel: 7,
    bs: 8,
    ht: 9,
    lf: 10,
    vt: 11,
    ff: 12,
    cr: 13,
    so: 14,
    si: 15,
    dle: 16,
    dc1: 17,
    dc2: 18,
    dc3: 19,
    dc4: 20,
    nak: 21,
    syn: 22,
    etb: 23,
    can: 24,
    em: 25,
    sub: 26,
    esc: 27,
    fs: 28,
    gs: 29,
    rs: 30,
    us: 31,
    space: 32,
    exclamationMark: 33,
    quotationMark: 34,
    numberSign: 35,
    dollarSign: 36,
    percentSign: 37,
    ampersand: 38,
    apostrophe: 39,
    leftParenthesis: 40,
    rightParenthesis: 41,
    asterisk: 42,
    plusSign: 43,
    comma: 44,
    dash: 45,
    dot: 46,
    slash: 47,
    digit0: 48,
    digit1: 49,
    digit2: 50,
    digit3: 51,
    digit4: 52,
    digit5: 53,
    digit6: 54,
    digit7: 55,
    digit8: 56,
    digit9: 57,
    colon: 58,
    semicolon: 59,
    lessThan: 60,
    equalsTo: 61,
    greaterThan: 62,
    questionMark: 63,
    atSign: 64,
    uppercaseA: 65,
    uppercaseB: 66,
    uppercaseC: 67,
    uppercaseD: 68,
    uppercaseE: 69,
    uppercaseF: 70,
    uppercaseG: 71,
    uppercaseH: 72,
    uppercaseI: 73,
    uppercaseJ: 74,
    uppercaseK: 75,
    uppercaseL: 76,
    uppercaseM: 77,
    uppercaseN: 78,
    uppercaseO: 79,
    uppercaseP: 80,
    uppercaseQ: 81,
    uppercaseR: 82,
    uppercaseS: 83,
    uppercaseT: 84,
    uppercaseU: 85,
    uppercaseV: 86,
    uppercaseW: 87,
    uppercaseX: 88,
    uppercaseY: 89,
    uppercaseZ: 90,
    leftSquareBracket: 91,
    backslash: 92,
    rightSquareBracket: 93,
    caret: 94,
    underscore: 95,
    graveAccent: 96,
    lowercaseA: 97,
    lowercaseB: 98,
    lowercaseC: 99,
    lowercaseD: 100,
    lowercaseE: 101,
    lowercaseF: 102,
    lowercaseG: 103,
    lowercaseH: 104,
    lowercaseI: 105,
    lowercaseJ: 106,
    lowercaseK: 107,
    lowercaseL: 108,
    lowercaseM: 109,
    lowercaseN: 110,
    lowercaseO: 111,
    lowercaseP: 112,
    lowercaseQ: 113,
    lowercaseR: 114,
    lowercaseS: 115,
    lowercaseT: 116,
    lowercaseU: 117,
    lowercaseV: 118,
    lowercaseW: 119,
    lowercaseX: 120,
    lowercaseY: 121,
    lowercaseZ: 122,
    leftCurlyBrace: 123,
    verticalBar: 124,
    rightCurlyBrace: 125,
    tilde: 126,
    del: 127,
    byteOrderMarker: 65279,
    replacementCharacter: 65533,
  };
  var P = {
    attentionSideAfter: 2,
    attentionSideBefore: 1,
    atxHeadingOpeningFenceSizeMax: 6,
    autolinkDomainSizeMax: 63,
    autolinkSchemeSizeMax: 32,
    cdataOpeningString: "CDATA[",
    characterGroupPunctuation: 2,
    characterGroupWhitespace: 1,
    characterReferenceDecimalSizeMax: 7,
    characterReferenceHexadecimalSizeMax: 6,
    characterReferenceNamedSizeMax: 31,
    codeFencedSequenceSizeMin: 3,
    contentTypeContent: "content",
    contentTypeDocument: "document",
    contentTypeFlow: "flow",
    contentTypeString: "string",
    contentTypeText: "text",
    hardBreakPrefixSizeMin: 2,
    htmlBasic: 6,
    htmlCdata: 5,
    htmlComment: 2,
    htmlComplete: 7,
    htmlDeclaration: 4,
    htmlInstruction: 3,
    htmlRawSizeMax: 8,
    htmlRaw: 1,
    linkResourceDestinationBalanceMax: 32,
    linkReferenceSizeMax: 999,
    listItemValueSizeMax: 10,
    numericBaseDecimal: 10,
    numericBaseHexadecimal: 16,
    tabSize: 4,
    thematicBreakMarkerCountMin: 3,
    v8MaxSafeChunkSize: 1e4,
  };
  var m = {
    data: "data",
    whitespace: "whitespace",
    lineEnding: "lineEnding",
    lineEndingBlank: "lineEndingBlank",
    linePrefix: "linePrefix",
    lineSuffix: "lineSuffix",
    atxHeading: "atxHeading",
    atxHeadingSequence: "atxHeadingSequence",
    atxHeadingText: "atxHeadingText",
    autolink: "autolink",
    autolinkEmail: "autolinkEmail",
    autolinkMarker: "autolinkMarker",
    autolinkProtocol: "autolinkProtocol",
    characterEscape: "characterEscape",
    characterEscapeValue: "characterEscapeValue",
    characterReference: "characterReference",
    characterReferenceMarker: "characterReferenceMarker",
    characterReferenceMarkerNumeric: "characterReferenceMarkerNumeric",
    characterReferenceMarkerHexadecimal: "characterReferenceMarkerHexadecimal",
    characterReferenceValue: "characterReferenceValue",
    codeFenced: "codeFenced",
    codeFencedFence: "codeFencedFence",
    codeFencedFenceSequence: "codeFencedFenceSequence",
    codeFencedFenceInfo: "codeFencedFenceInfo",
    codeFencedFenceMeta: "codeFencedFenceMeta",
    codeFlowValue: "codeFlowValue",
    codeIndented: "codeIndented",
    codeText: "codeText",
    codeTextData: "codeTextData",
    codeTextPadding: "codeTextPadding",
    codeTextSequence: "codeTextSequence",
    content: "content",
    definition: "definition",
    definitionDestination: "definitionDestination",
    definitionDestinationLiteral: "definitionDestinationLiteral",
    definitionDestinationLiteralMarker: "definitionDestinationLiteralMarker",
    definitionDestinationRaw: "definitionDestinationRaw",
    definitionDestinationString: "definitionDestinationString",
    definitionLabel: "definitionLabel",
    definitionLabelMarker: "definitionLabelMarker",
    definitionLabelString: "definitionLabelString",
    definitionMarker: "definitionMarker",
    definitionTitle: "definitionTitle",
    definitionTitleMarker: "definitionTitleMarker",
    definitionTitleString: "definitionTitleString",
    emphasis: "emphasis",
    emphasisSequence: "emphasisSequence",
    emphasisText: "emphasisText",
    escapeMarker: "escapeMarker",
    hardBreakEscape: "hardBreakEscape",
    hardBreakTrailing: "hardBreakTrailing",
    htmlFlow: "htmlFlow",
    htmlFlowData: "htmlFlowData",
    htmlText: "htmlText",
    htmlTextData: "htmlTextData",
    image: "image",
    label: "label",
    labelText: "labelText",
    labelLink: "labelLink",
    labelImage: "labelImage",
    labelMarker: "labelMarker",
    labelImageMarker: "labelImageMarker",
    labelEnd: "labelEnd",
    link: "link",
    paragraph: "paragraph",
    reference: "reference",
    referenceMarker: "referenceMarker",
    referenceString: "referenceString",
    resource: "resource",
    resourceDestination: "resourceDestination",
    resourceDestinationLiteral: "resourceDestinationLiteral",
    resourceDestinationLiteralMarker: "resourceDestinationLiteralMarker",
    resourceDestinationRaw: "resourceDestinationRaw",
    resourceDestinationString: "resourceDestinationString",
    resourceMarker: "resourceMarker",
    resourceTitle: "resourceTitle",
    resourceTitleMarker: "resourceTitleMarker",
    resourceTitleString: "resourceTitleString",
    setextHeading: "setextHeading",
    setextHeadingText: "setextHeadingText",
    setextHeadingLine: "setextHeadingLine",
    setextHeadingLineSequence: "setextHeadingLineSequence",
    strong: "strong",
    strongSequence: "strongSequence",
    strongText: "strongText",
    thematicBreak: "thematicBreak",
    thematicBreakSequence: "thematicBreakSequence",
    blockQuote: "blockQuote",
    blockQuotePrefix: "blockQuotePrefix",
    blockQuoteMarker: "blockQuoteMarker",
    blockQuotePrefixWhitespace: "blockQuotePrefixWhitespace",
    listOrdered: "listOrdered",
    listUnordered: "listUnordered",
    listItemIndent: "listItemIndent",
    listItemMarker: "listItemMarker",
    listItemPrefix: "listItemPrefix",
    listItemPrefixWhitespace: "listItemPrefixWhitespace",
    listItemValue: "listItemValue",
    chunkDocument: "chunkDocument",
    chunkContent: "chunkContent",
    chunkFlow: "chunkFlow",
    chunkText: "chunkText",
    chunkString: "chunkString",
  };
  var Ve = {
    ht: "\t",
    lf: `
`,
    cr: "\r",
    space: " ",
    exclamationMark: "!",
    quotationMark: '"',
    numberSign: "#",
    dollarSign: "$",
    percentSign: "%",
    ampersand: "&",
    apostrophe: "'",
    leftParenthesis: "(",
    rightParenthesis: ")",
    asterisk: "*",
    plusSign: "+",
    comma: ",",
    dash: "-",
    dot: ".",
    slash: "/",
    digit0: "0",
    digit1: "1",
    digit2: "2",
    digit3: "3",
    digit4: "4",
    digit5: "5",
    digit6: "6",
    digit7: "7",
    digit8: "8",
    digit9: "9",
    colon: ":",
    semicolon: ";",
    lessThan: "<",
    equalsTo: "=",
    greaterThan: ">",
    questionMark: "?",
    atSign: "@",
    uppercaseA: "A",
    uppercaseB: "B",
    uppercaseC: "C",
    uppercaseD: "D",
    uppercaseE: "E",
    uppercaseF: "F",
    uppercaseG: "G",
    uppercaseH: "H",
    uppercaseI: "I",
    uppercaseJ: "J",
    uppercaseK: "K",
    uppercaseL: "L",
    uppercaseM: "M",
    uppercaseN: "N",
    uppercaseO: "O",
    uppercaseP: "P",
    uppercaseQ: "Q",
    uppercaseR: "R",
    uppercaseS: "S",
    uppercaseT: "T",
    uppercaseU: "U",
    uppercaseV: "V",
    uppercaseW: "W",
    uppercaseX: "X",
    uppercaseY: "Y",
    uppercaseZ: "Z",
    leftSquareBracket: "[",
    backslash: "\\",
    rightSquareBracket: "]",
    caret: "^",
    underscore: "_",
    graveAccent: "`",
    lowercaseA: "a",
    lowercaseB: "b",
    lowercaseC: "c",
    lowercaseD: "d",
    lowercaseE: "e",
    lowercaseF: "f",
    lowercaseG: "g",
    lowercaseH: "h",
    lowercaseI: "i",
    lowercaseJ: "j",
    lowercaseK: "k",
    lowercaseL: "l",
    lowercaseM: "m",
    lowercaseN: "n",
    lowercaseO: "o",
    lowercaseP: "p",
    lowercaseQ: "q",
    lowercaseR: "r",
    lowercaseS: "s",
    lowercaseT: "t",
    lowercaseU: "u",
    lowercaseV: "v",
    lowercaseW: "w",
    lowercaseX: "x",
    lowercaseY: "y",
    lowercaseZ: "z",
    leftCurlyBrace: "{",
    verticalBar: "|",
    rightCurlyBrace: "}",
    tilde: "~",
    replacementCharacter: "�",
  };
  var Se = Tt(/[A-Za-z]/),
    Ce = Tt(/[\dA-Za-z]/),
    Xo = Tt(/[#-'*+\--9=?A-Z^-~]/);
  function _t(e) {
    return e !== null && (e < d.space || e === d.del);
  }
  var Tn = Tt(/\d/),
    Jo = Tt(/[\dA-Fa-f]/),
    es = Tt(/[!-/:-@[-`{-~]/);
  function B(e) {
    return e !== null && e < d.horizontalTab;
  }
  function ie(e) {
    return e !== null && (e < d.nul || e === d.space);
  }
  function G(e) {
    return e === d.horizontalTab || e === d.virtualSpace || e === d.space;
  }
  var qt = Tt(/\p{P}|\p{S}/u),
    nt = Tt(/\s/);
  function Tt(e) {
    return n;
    function n(t) {
      return t !== null && t > -1 && e.test(String.fromCharCode(t));
    }
  }
  function Zr(e) {
    if (typeof e !== "string") throw TypeError("Expected a string");
    return e.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
  }
  var vt = function (e) {
    if (e === null || e === void 0) return Vl;
    if (typeof e === "function") return Xn(e);
    if (typeof e === "object") return Array.isArray(e) ? _l(e) : ql(e);
    if (typeof e === "string") return Ul(e);
    throw Error("Expected function, string, or object as test");
  };
  function _l(e) {
    let n = [],
      t = -1;
    while (++t < e.length) n[t] = vt(e[t]);
    return Xn(r);
    function r(...i) {
      let o = -1;
      while (++o < n.length) if (n[o].apply(this, i)) return !0;
      return !1;
    }
  }
  function ql(e) {
    let n = e;
    return Xn(t);
    function t(r) {
      let i = r,
        o;
      for (o in e) if (i[o] !== n[o]) return !1;
      return !0;
    }
  }
  function Ul(e) {
    return Xn(n);
    function n(t) {
      return t && t.type === e;
    }
  }
  function Xn(e) {
    return n;
    function n(t, r, i) {
      return Boolean(Hl(t) && e.call(this, t, typeof r === "number" ? r : void 0, i || void 0));
    }
  }
  function Vl() {
    return !0;
  }
  function Hl(e) {
    return e !== null && typeof e === "object" && "type" in e;
  }
  function ts(e) {
    return e;
  }
  var ns = [],
    Jn = !0,
    Ut = !1,
    er = "skip";
  function vn(e, n, t, r) {
    let i;
    if (typeof n === "function" && typeof t !== "function") ((r = t), (t = n));
    else i = n;
    let o = vt(i),
      s = r ? -1 : 1;
    a(e, void 0, [])();
    function a(u, l, c) {
      let f = u && typeof u === "object" ? u : {};
      if (typeof f.type === "string") {
        let h =
          typeof f.tagName === "string" ? f.tagName : typeof f.name === "string" ? f.name : void 0;
        Object.defineProperty(p, "name", {
          value: "node (" + ts(u.type + (h ? "<" + h + ">" : "")) + ")",
        });
      }
      return p;
      function p() {
        let h = ns,
          g,
          k,
          C;
        if (!n || o(u, l, c[c.length - 1] || void 0)) {
          if (((h = jl(t(u, c))), h[0] === Ut)) return h;
        }
        if ("children" in u && u.children) {
          let b = u;
          if (b.children && h[0] !== er) {
            ((k = (r ? b.children.length : -1) + s), (C = c.concat(b)));
            while (k > -1 && k < b.children.length) {
              let F = b.children[k];
              if (((g = a(F, k, C)()), g[0] === Ut)) return g;
              k = typeof g[1] === "number" ? g[1] : k + s;
            }
          }
        }
        return h;
      }
    }
  }
  function jl(e) {
    if (Array.isArray(e)) return e;
    if (typeof e === "number") return [Jn, e];
    return e === null || e === void 0 ? ns : [e];
  }
  function Qr(e, n, t) {
    let i = vt((t || {}).ignore || []),
      o = Wl(n),
      s = -1;
    while (++s < o.length) vn(e, "text", a);
    function a(l, c) {
      let f = -1,
        p;
      while (++f < c.length) {
        let h = c[f],
          g = p ? p.children : void 0;
        if (i(h, g ? g.indexOf(h) : void 0, p)) return;
        p = h;
      }
      if (p) return u(l, c);
    }
    function u(l, c) {
      let f = c[c.length - 1],
        p = o[s][0],
        h = o[s][1],
        g = 0,
        C = f.children.indexOf(l),
        b = !1,
        F = [];
      p.lastIndex = 0;
      let M = p.exec(l.value);
      while (M) {
        let q = M.index,
          z = { index: M.index, input: M.input, stack: [...c, l] },
          E = h(...M, z);
        if (typeof E === "string") E = E.length > 0 ? { type: "text", value: E } : void 0;
        if (E === !1) p.lastIndex = q + 1;
        else {
          if (g !== q) F.push({ type: "text", value: l.value.slice(g, q) });
          if (Array.isArray(E)) F.push(...E);
          else if (E) F.push(E);
          ((g = q + M[0].length), (b = !0));
        }
        if (!p.global) break;
        M = p.exec(l.value);
      }
      if (b) {
        if (g < l.value.length) F.push({ type: "text", value: l.value.slice(g) });
        f.children.splice(C, 1, ...F);
      } else F = [l];
      return C + F.length;
    }
  }
  function Wl(e) {
    let n = [];
    if (!Array.isArray(e)) throw TypeError("Expected find and replace tuple or list of tuples");
    let t = !e[0] || Array.isArray(e[0]) ? e : [e],
      r = -1;
    while (++r < t.length) {
      let i = t[r];
      n.push([Gl(i[0]), Zl(i[1])]);
    }
    return n;
  }
  function Gl(e) {
    return typeof e === "string" ? new RegExp(Zr(e), "g") : e;
  }
  function Zl(e) {
    return typeof e === "function"
      ? e
      : function () {
          return e;
        };
  }
  var Yr = "phrasing",
    Kr = ["autolink", "link", "image", "label"];
  function Jr() {
    return {
      transforms: [ec],
      enter: {
        literalAutolink: Ql,
        literalAutolinkEmail: Xr,
        literalAutolinkHttp: Xr,
        literalAutolinkWww: Xr,
      },
      exit: {
        literalAutolink: Jl,
        literalAutolinkEmail: Xl,
        literalAutolinkHttp: Yl,
        literalAutolinkWww: Kl,
      },
    };
  }
  function ei() {
    return {
      unsafe: [
        {
          character: "@",
          before: "[+\\-.\\w]",
          after: "[\\-.\\w]",
          inConstruct: Yr,
          notInConstruct: Kr,
        },
        { character: ".", before: "[Ww]", after: "[\\-.\\w]", inConstruct: Yr, notInConstruct: Kr },
        { character: ":", before: "[ps]", after: "\\/", inConstruct: Yr, notInConstruct: Kr },
      ],
    };
  }
  function Ql(e) {
    this.enter({ type: "link", title: null, url: "", children: [] }, e);
  }
  function Xr(e) {
    this.config.enter.autolinkProtocol.call(this, e);
  }
  function Yl(e) {
    this.config.exit.autolinkProtocol.call(this, e);
  }
  function Kl(e) {
    this.config.exit.data.call(this, e);
    let n = this.stack[this.stack.length - 1];
    (x(n.type === "link"), (n.url = "http://" + this.sliceSerialize(e)));
  }
  function Xl(e) {
    this.config.exit.autolinkEmail.call(this, e);
  }
  function Jl(e) {
    this.exit(e);
  }
  function ec(e) {
    Qr(
      e,
      [
        [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, tc],
        [/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu, nc],
      ],
      { ignore: ["link", "linkReference"] },
    );
  }
  function tc(e, n, t, r, i) {
    let o = "";
    if (!rs(i)) return !1;
    if (/^w/i.test(n)) ((t = n + t), (n = ""), (o = "http://"));
    if (!rc(t)) return !1;
    let s = ic(t + r);
    if (!s[0]) return !1;
    let a = {
      type: "link",
      title: null,
      url: o + n + s[0],
      children: [{ type: "text", value: n + s[0] }],
    };
    if (s[1]) return [a, { type: "text", value: s[1] }];
    return a;
  }
  function nc(e, n, t, r) {
    if (!rs(r, !0) || /[-\d_]$/.test(t)) return !1;
    return {
      type: "link",
      title: null,
      url: "mailto:" + n + "@" + t,
      children: [{ type: "text", value: n + "@" + t }],
    };
  }
  function rc(e) {
    let n = e.split(".");
    if (
      n.length < 2 ||
      (n[n.length - 1] && (/_/.test(n[n.length - 1]) || !/[a-zA-Z\d]/.test(n[n.length - 1]))) ||
      (n[n.length - 2] && (/_/.test(n[n.length - 2]) || !/[a-zA-Z\d]/.test(n[n.length - 2])))
    )
      return !1;
    return !0;
  }
  function ic(e) {
    let n = /[!"&'),.:;<>?\]}]+$/.exec(e);
    if (!n) return [e, void 0];
    e = e.slice(0, n.index);
    let t = n[0],
      r = t.indexOf(")"),
      i = Gr(e, "("),
      o = Gr(e, ")");
    while (r !== -1 && i > o)
      ((e += t.slice(0, r + 1)), (t = t.slice(r + 1)), (r = t.indexOf(")")), o++);
    return [e, t];
  }
  function rs(e, n) {
    let t = e.input.charCodeAt(e.index - 1);
    return (e.index === 0 || nt(t) || qt(t)) && (!n || t !== 47);
  }
  function Pe(e) {
    return e
      .replace(/[\t\n\r ]+/g, Ve.space)
      .replace(/^ | $/g, "")
      .toLowerCase()
      .toUpperCase();
  }
  is.peek = pc;
  function oc() {
    this.buffer();
  }
  function sc(e) {
    this.enter({ type: "footnoteReference", identifier: "", label: "" }, e);
  }
  function ac() {
    this.buffer();
  }
  function uc(e) {
    this.enter({ type: "footnoteDefinition", identifier: "", label: "", children: [] }, e);
  }
  function lc(e) {
    let n = this.resume(),
      t = this.stack[this.stack.length - 1];
    (x(t.type === "footnoteReference"),
      (t.identifier = Pe(this.sliceSerialize(e)).toLowerCase()),
      (t.label = n));
  }
  function cc(e) {
    this.exit(e);
  }
  function fc(e) {
    let n = this.resume(),
      t = this.stack[this.stack.length - 1];
    (x(t.type === "footnoteDefinition"),
      (t.identifier = Pe(this.sliceSerialize(e)).toLowerCase()),
      (t.label = n));
  }
  function dc(e) {
    this.exit(e);
  }
  function pc() {
    return "[";
  }
  function is(e, n, t, r) {
    let i = t.createTracker(r),
      o = i.move("[^"),
      s = t.enter("footnoteReference"),
      a = t.enter("reference");
    return (
      (o += i.move(t.safe(t.associationId(e), { after: "]", before: o }))),
      a(),
      s(),
      (o += i.move("]")),
      o
    );
  }
  function ti() {
    return {
      enter: {
        gfmFootnoteCallString: oc,
        gfmFootnoteCall: sc,
        gfmFootnoteDefinitionLabelString: ac,
        gfmFootnoteDefinition: uc,
      },
      exit: {
        gfmFootnoteCallString: lc,
        gfmFootnoteCall: cc,
        gfmFootnoteDefinitionLabelString: fc,
        gfmFootnoteDefinition: dc,
      },
    };
  }
  function ni(e) {
    let n = !1;
    if (e && e.firstLineBlank) n = !0;
    return {
      handlers: { footnoteDefinition: t, footnoteReference: is },
      unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }],
    };
    function t(r, i, o, s) {
      let a = o.createTracker(s),
        u = a.move("[^"),
        l = o.enter("footnoteDefinition"),
        c = o.enter("label");
      if (
        ((u += a.move(o.safe(o.associationId(r), { before: u, after: "]" }))),
        c(),
        (u += a.move("]:")),
        r.children && r.children.length > 0)
      )
        (a.shift(4),
          (u += a.move(
            (n
              ? `
`
              : " ") + o.indentLines(o.containerFlow(r, a.current()), n ? os : hc),
          )));
      return (l(), u);
    }
  }
  function hc(e, n, t) {
    return n === 0 ? e : os(e, n, t);
  }
  function os(e, n, t) {
    return (t ? "" : "    ") + e;
  }
  var mc = [
    "autolink",
    "destinationLiteral",
    "destinationRaw",
    "reference",
    "titleQuote",
    "titleApostrophe",
  ];
  ss.peek = xc;
  function ri() {
    return {
      canContainEols: ["delete"],
      enter: { strikethrough: gc },
      exit: { strikethrough: kc },
    };
  }
  function ii() {
    return {
      unsafe: [{ character: "~", inConstruct: "phrasing", notInConstruct: mc }],
      handlers: { delete: ss },
    };
  }
  function gc(e) {
    this.enter({ type: "delete", children: [] }, e);
  }
  function kc(e) {
    this.exit(e);
  }
  function ss(e, n, t, r) {
    let i = t.createTracker(r),
      o = t.enter("strikethrough"),
      s = i.move("~~");
    return (
      (s += t.containerPhrasing(e, { ...i.current(), before: s, after: "~" })),
      (s += i.move("~~")),
      o(),
      s
    );
  }
  function xc() {
    return "~";
  }
  function wc(e) {
    return e.length;
  }
  function us(e, n) {
    let t = n || {},
      r = (t.align || []).concat(),
      i = t.stringLength || wc,
      o = [],
      s = [],
      a = [],
      u = [],
      l = 0,
      c = -1;
    while (++c < e.length) {
      let k = [],
        C = [],
        b = -1;
      if (e[c].length > l) l = e[c].length;
      while (++b < e[c].length) {
        let F = bc(e[c][b]);
        if (t.alignDelimiters !== !1) {
          let M = i(F);
          if (((C[b] = M), u[b] === void 0 || M > u[b])) u[b] = M;
        }
        k.push(F);
      }
      ((s[c] = k), (a[c] = C));
    }
    let f = -1;
    if (typeof r === "object" && "length" in r) while (++f < l) o[f] = as(r[f]);
    else {
      let k = as(r);
      while (++f < l) o[f] = k;
    }
    f = -1;
    let p = [],
      h = [];
    while (++f < l) {
      let k = o[f],
        C = "",
        b = "";
      if (k === 99) ((C = ":"), (b = ":"));
      else if (k === 108) C = ":";
      else if (k === 114) b = ":";
      let F = t.alignDelimiters === !1 ? 1 : Math.max(1, u[f] - C.length - b.length),
        M = C + "-".repeat(F) + b;
      if (t.alignDelimiters !== !1) {
        if (((F = C.length + F + b.length), F > u[f])) u[f] = F;
        h[f] = F;
      }
      p[f] = M;
    }
    (s.splice(1, 0, p), a.splice(1, 0, h), (c = -1));
    let g = [];
    while (++c < s.length) {
      let k = s[c],
        C = a[c];
      f = -1;
      let b = [];
      while (++f < l) {
        let F = k[f] || "",
          M = "",
          q = "";
        if (t.alignDelimiters !== !1) {
          let z = u[f] - (C[f] || 0),
            E = o[f];
          if (E === 114) M = " ".repeat(z);
          else if (E === 99)
            if (z % 2) ((M = " ".repeat(z / 2 + 0.5)), (q = " ".repeat(z / 2 - 0.5)));
            else ((M = " ".repeat(z / 2)), (q = M));
          else q = " ".repeat(z);
        }
        if (t.delimiterStart !== !1 && !f) b.push("|");
        if (
          t.padding !== !1 &&
          !(t.alignDelimiters === !1 && F === "") &&
          (t.delimiterStart !== !1 || f)
        )
          b.push(" ");
        if (t.alignDelimiters !== !1) b.push(M);
        if ((b.push(F), t.alignDelimiters !== !1)) b.push(q);
        if (t.padding !== !1) b.push(" ");
        if (t.delimiterEnd !== !1 || f !== l - 1) b.push("|");
      }
      g.push(t.delimiterEnd === !1 ? b.join("").replace(/ +$/, "") : b.join(""));
    }
    return g.join(`
`);
  }
  function bc(e) {
    return e === null || e === void 0 ? "" : String(e);
  }
  function as(e) {
    let n = typeof e === "string" ? e.codePointAt(0) : 0;
    return n === 67 || n === 99
      ? 99
      : n === 76 || n === 108
        ? 108
        : n === 82 || n === 114
          ? 114
          : 0;
  }
  function ls(e, n, t, r) {
    let i = t.enter("blockquote"),
      o = t.createTracker(r);
    (o.move("> "), o.shift(2));
    let s = t.indentLines(t.containerFlow(e, o.current()), yc);
    return (i(), s);
  }
  function yc(e, n, t) {
    return ">" + (t ? "" : " ") + e;
  }
  function fs(e, n) {
    return cs(e, n.inConstruct, !0) && !cs(e, n.notInConstruct, !1);
  }
  function cs(e, n, t) {
    if (typeof n === "string") n = [n];
    if (!n || n.length === 0) return t;
    let r = -1;
    while (++r < n.length) if (e.includes(n[r])) return !0;
    return !1;
  }
  function oi(e, n, t, r) {
    let i = -1;
    while (++i < t.unsafe.length)
      if (
        t.unsafe[i].character ===
          `
` &&
        fs(t.stack, t.unsafe[i])
      )
        return /[ \t]/.test(r.before) ? "" : " ";
    return "\\\n";
  }
  function ds(e, n) {
    let t = String(e),
      r = t.indexOf(n),
      i = r,
      o = 0,
      s = 0;
    if (typeof n !== "string") throw TypeError("Expected substring");
    while (r !== -1) {
      if (r === i) {
        if (++o > s) s = o;
      } else o = 1;
      ((i = r + n.length), (r = t.indexOf(n, i)));
    }
    return s;
  }
  function ps(e, n) {
    return Boolean(
      n.options.fences === !1 &&
      e.value &&
      !e.lang &&
      /[^ \r\n]/.test(e.value) &&
      !/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(e.value),
    );
  }
  function hs(e) {
    let n = e.options.fence || "`";
    if (n !== "`" && n !== "~")
      throw Error(
        "Cannot serialize code with `" + n + "` for `options.fence`, expected `` ` `` or `~`",
      );
    return n;
  }
  function ms(e, n, t, r) {
    let i = hs(t),
      o = e.value || "",
      s = i === "`" ? "GraveAccent" : "Tilde";
    if (ps(e, t)) {
      let f = t.enter("codeIndented"),
        p = t.indentLines(o, Sc);
      return (f(), p);
    }
    let a = t.createTracker(r),
      u = i.repeat(Math.max(ds(o, i) + 1, 3)),
      l = t.enter("codeFenced"),
      c = a.move(u);
    if (e.lang) {
      let f = t.enter(`codeFencedLang${s}`);
      ((c += a.move(t.safe(e.lang, { before: c, after: " ", encode: ["`"], ...a.current() }))),
        f());
    }
    if (e.lang && e.meta) {
      let f = t.enter(`codeFencedMeta${s}`);
      ((c += a.move(" ")),
        (c += a.move(
          t.safe(e.meta, {
            before: c,
            after: `
`,
            encode: ["`"],
            ...a.current(),
          }),
        )),
        f());
    }
    if (
      ((c += a.move(`
`)),
      o)
    )
      c += a.move(
        o +
          `
`,
      );
    return ((c += a.move(u)), l(), c);
  }
  function Sc(e, n, t) {
    return (t ? "" : "    ") + e;
  }
  function sn(e) {
    let n = e.options.quote || '"';
    if (n !== '"' && n !== "'")
      throw Error(
        "Cannot serialize title with `" + n + "` for `options.quote`, expected `\"`, or `'`",
      );
    return n;
  }
  function gs(e, n, t, r) {
    let i = sn(t),
      o = i === '"' ? "Quote" : "Apostrophe",
      s = t.enter("definition"),
      a = t.enter("label"),
      u = t.createTracker(r),
      l = u.move("[");
    if (
      ((l += u.move(t.safe(t.associationId(e), { before: l, after: "]", ...u.current() }))),
      (l += u.move("]: ")),
      a(),
      !e.url || /[\0- \u007F]/.test(e.url))
    )
      ((a = t.enter("destinationLiteral")),
        (l += u.move("<")),
        (l += u.move(t.safe(e.url, { before: l, after: ">", ...u.current() }))),
        (l += u.move(">")));
    else
      ((a = t.enter("destinationRaw")),
        (l += u.move(
          t.safe(e.url, {
            before: l,
            after: e.title
              ? " "
              : `
`,
            ...u.current(),
          }),
        )));
    if ((a(), e.title))
      ((a = t.enter(`title${o}`)),
        (l += u.move(" " + i)),
        (l += u.move(t.safe(e.title, { before: l, after: i, ...u.current() }))),
        (l += u.move(i)),
        a());
    return (s(), l);
  }
  function ks(e) {
    let n = e.options.emphasis || "*";
    if (n !== "*" && n !== "_")
      throw Error(
        "Cannot serialize emphasis with `" + n + "` for `options.emphasis`, expected `*`, or `_`",
      );
    return n;
  }
  function At(e) {
    return "&#x" + e.toString(16).toUpperCase() + ";";
  }
  function ht(e) {
    if (e === d.eof || ie(e) || nt(e)) return P.characterGroupWhitespace;
    if (qt(e)) return P.characterGroupPunctuation;
  }
  function an(e, n, t) {
    let r = ht(e),
      i = ht(n);
    if (r === void 0)
      return i === void 0
        ? t === "_"
          ? { inside: !0, outside: !0 }
          : { inside: !1, outside: !1 }
        : i === 1
          ? { inside: !0, outside: !0 }
          : { inside: !1, outside: !0 };
    if (r === 1)
      return i === void 0
        ? { inside: !1, outside: !1 }
        : i === 1
          ? { inside: !0, outside: !0 }
          : { inside: !1, outside: !1 };
    return i === void 0
      ? { inside: !1, outside: !1 }
      : i === 1
        ? { inside: !0, outside: !1 }
        : { inside: !1, outside: !1 };
  }
  si.peek = Cc;
  function si(e, n, t, r) {
    let i = ks(t),
      o = t.enter("emphasis"),
      s = t.createTracker(r),
      a = s.move(i),
      u = s.move(t.containerPhrasing(e, { after: i, before: a, ...s.current() })),
      l = u.charCodeAt(0),
      c = an(r.before.charCodeAt(r.before.length - 1), l, i);
    if (c.inside) u = At(l) + u.slice(1);
    let f = u.charCodeAt(u.length - 1),
      p = an(r.after.charCodeAt(0), f, i);
    if (p.inside) u = u.slice(0, -1) + At(f);
    let h = s.move(i);
    return (
      o(), (t.attentionEncodeSurroundingInfo = { after: p.outside, before: c.outside }), a + u + h
    );
  }
  function Cc(e, n, t) {
    return t.options.emphasis || "*";
  }
  function ai(e, n, t, r) {
    let i, o, s;
    if (typeof n === "function" && typeof t !== "function") ((o = void 0), (s = n), (i = t));
    else ((o = n), (s = t), (i = r));
    vn(e, o, a, i);
    function a(u, l) {
      let c = l[l.length - 1],
        f = c ? c.children.indexOf(u) : void 0;
      return s(u, f, c);
    }
  }
  var Ec = {};
  function Vt(e, n) {
    let t = n || Ec,
      r = typeof t.includeImageAlt === "boolean" ? t.includeImageAlt : !0,
      i = typeof t.includeHtml === "boolean" ? t.includeHtml : !0;
    return ws(e, r, i);
  }
  function ws(e, n, t) {
    if (Ic(e)) {
      if ("value" in e) return e.type === "html" && !t ? "" : e.value;
      if (n && "alt" in e && e.alt) return e.alt;
      if ("children" in e) return xs(e.children, n, t);
    }
    if (Array.isArray(e)) return xs(e, n, t);
    return "";
  }
  function xs(e, n, t) {
    let r = [],
      i = -1;
    while (++i < e.length) r[i] = ws(e[i], n, t);
    return r.join("");
  }
  function Ic(e) {
    return Boolean(e && typeof e === "object");
  }
  function bs(e, n) {
    let t = !1;
    return (
      ai(e, function (r) {
        if (("value" in r && /\r?\n|\r/.test(r.value)) || r.type === "break") return ((t = !0), Ut);
      }),
      Boolean((!e.depth || e.depth < 3) && Vt(e) && (n.options.setext || t))
    );
  }
  function ys(e, n, t, r) {
    let i = Math.max(Math.min(6, e.depth || 1), 1),
      o = t.createTracker(r);
    if (bs(e, t)) {
      let c = t.enter("headingSetext"),
        f = t.enter("phrasing"),
        p = t.containerPhrasing(e, {
          ...o.current(),
          before: `
`,
          after: `
`,
        });
      return (
        f(),
        c(),
        p +
          `
` +
          (i === 1 ? "=" : "-").repeat(
            p.length -
              (Math.max(
                p.lastIndexOf("\r"),
                p.lastIndexOf(`
`),
              ) +
                1),
          )
      );
    }
    let s = "#".repeat(i),
      a = t.enter("headingAtx"),
      u = t.enter("phrasing");
    o.move(s + " ");
    let l = t.containerPhrasing(e, {
      before: "# ",
      after: `
`,
      ...o.current(),
    });
    if (/^[\t ]/.test(l)) l = At(l.charCodeAt(0)) + l.slice(1);
    if (((l = l ? s + " " + l : s), t.options.closeAtx)) l += " " + s;
    return (u(), a(), l);
  }
  ui.peek = Tc;
  function ui(e) {
    return e.value || "";
  }
  function Tc() {
    return "<";
  }
  li.peek = vc;
  function li(e, n, t, r) {
    let i = sn(t),
      o = i === '"' ? "Quote" : "Apostrophe",
      s = t.enter("image"),
      a = t.enter("label"),
      u = t.createTracker(r),
      l = u.move("![");
    if (
      ((l += u.move(t.safe(e.alt, { before: l, after: "]", ...u.current() }))),
      (l += u.move("](")),
      a(),
      (!e.url && e.title) || /[\0- \u007F]/.test(e.url))
    )
      ((a = t.enter("destinationLiteral")),
        (l += u.move("<")),
        (l += u.move(t.safe(e.url, { before: l, after: ">", ...u.current() }))),
        (l += u.move(">")));
    else
      ((a = t.enter("destinationRaw")),
        (l += u.move(t.safe(e.url, { before: l, after: e.title ? " " : ")", ...u.current() }))));
    if ((a(), e.title))
      ((a = t.enter(`title${o}`)),
        (l += u.move(" " + i)),
        (l += u.move(t.safe(e.title, { before: l, after: i, ...u.current() }))),
        (l += u.move(i)),
        a());
    return ((l += u.move(")")), s(), l);
  }
  function vc() {
    return "!";
  }
  ci.peek = Ac;
  function ci(e, n, t, r) {
    let i = e.referenceType,
      o = t.enter("imageReference"),
      s = t.enter("label"),
      a = t.createTracker(r),
      u = a.move("!["),
      l = t.safe(e.alt, { before: u, after: "]", ...a.current() });
    ((u += a.move(l + "][")), s());
    let c = t.stack;
    ((t.stack = []), (s = t.enter("reference")));
    let f = t.safe(t.associationId(e), { before: u, after: "]", ...a.current() });
    if ((s(), (t.stack = c), o(), i === "full" || !l || l !== f)) u += a.move(f + "]");
    else if (i === "shortcut") u = u.slice(0, -1);
    else u += a.move("]");
    return u;
  }
  function Ac() {
    return "!";
  }
  fi.peek = Mc;
  function fi(e, n, t) {
    let r = e.value || "",
      i = "`",
      o = -1;
    while (new RegExp("(^|[^`])" + i + "([^`]|$)").test(r)) i += "`";
    if (/[^ \r\n]/.test(r) && ((/^[ \r\n]/.test(r) && /[ \r\n]$/.test(r)) || /^`|`$/.test(r)))
      r = " " + r + " ";
    while (++o < t.unsafe.length) {
      let s = t.unsafe[o],
        a = t.compilePattern(s),
        u;
      if (!s.atBreak) continue;
      while ((u = a.exec(r))) {
        let l = u.index;
        if (r.charCodeAt(l) === 10 && r.charCodeAt(l - 1) === 13) l--;
        r = r.slice(0, l) + " " + r.slice(u.index + 1);
      }
    }
    return i + r + i;
  }
  function Mc() {
    return "`";
  }
  function di(e, n) {
    let t = Vt(e);
    return Boolean(
      !n.options.resourceLink &&
      e.url &&
      !e.title &&
      e.children &&
      e.children.length === 1 &&
      e.children[0].type === "text" &&
      (t === e.url || "mailto:" + t === e.url) &&
      /^[a-z][a-z+.-]+:/i.test(e.url) &&
      !/[\0- <>\u007F]/.test(e.url),
    );
  }
  pi.peek = Fc;
  function pi(e, n, t, r) {
    let i = sn(t),
      o = i === '"' ? "Quote" : "Apostrophe",
      s = t.createTracker(r),
      a,
      u;
    if (di(e, t)) {
      let c = t.stack;
      ((t.stack = []), (a = t.enter("autolink")));
      let f = s.move("<");
      return (
        (f += s.move(t.containerPhrasing(e, { before: f, after: ">", ...s.current() }))),
        (f += s.move(">")),
        a(),
        (t.stack = c),
        f
      );
    }
    ((a = t.enter("link")), (u = t.enter("label")));
    let l = s.move("[");
    if (
      ((l += s.move(t.containerPhrasing(e, { before: l, after: "](", ...s.current() }))),
      (l += s.move("](")),
      u(),
      (!e.url && e.title) || /[\0- \u007F]/.test(e.url))
    )
      ((u = t.enter("destinationLiteral")),
        (l += s.move("<")),
        (l += s.move(t.safe(e.url, { before: l, after: ">", ...s.current() }))),
        (l += s.move(">")));
    else
      ((u = t.enter("destinationRaw")),
        (l += s.move(t.safe(e.url, { before: l, after: e.title ? " " : ")", ...s.current() }))));
    if ((u(), e.title))
      ((u = t.enter(`title${o}`)),
        (l += s.move(" " + i)),
        (l += s.move(t.safe(e.title, { before: l, after: i, ...s.current() }))),
        (l += s.move(i)),
        u());
    return ((l += s.move(")")), a(), l);
  }
  function Fc(e, n, t) {
    return di(e, t) ? "<" : "[";
  }
  hi.peek = Rc;
  function hi(e, n, t, r) {
    let i = e.referenceType,
      o = t.enter("linkReference"),
      s = t.enter("label"),
      a = t.createTracker(r),
      u = a.move("["),
      l = t.containerPhrasing(e, { before: u, after: "]", ...a.current() });
    ((u += a.move(l + "][")), s());
    let c = t.stack;
    ((t.stack = []), (s = t.enter("reference")));
    let f = t.safe(t.associationId(e), { before: u, after: "]", ...a.current() });
    if ((s(), (t.stack = c), o(), i === "full" || !l || l !== f)) u += a.move(f + "]");
    else if (i === "shortcut") u = u.slice(0, -1);
    else u += a.move("]");
    return u;
  }
  function Rc() {
    return "[";
  }
  function un(e) {
    let n = e.options.bullet || "*";
    if (n !== "*" && n !== "+" && n !== "-")
      throw Error(
        "Cannot serialize items with `" + n + "` for `options.bullet`, expected `*`, `+`, or `-`",
      );
    return n;
  }
  function Ss(e) {
    let n = un(e),
      t = e.options.bulletOther;
    if (!t) return n === "*" ? "-" : "*";
    if (t !== "*" && t !== "+" && t !== "-")
      throw Error(
        "Cannot serialize items with `" +
          t +
          "` for `options.bulletOther`, expected `*`, `+`, or `-`",
      );
    if (t === n)
      throw Error(
        "Expected `bullet` (`" + n + "`) and `bulletOther` (`" + t + "`) to be different",
      );
    return t;
  }
  function Cs(e) {
    let n = e.options.bulletOrdered || ".";
    if (n !== "." && n !== ")")
      throw Error(
        "Cannot serialize items with `" + n + "` for `options.bulletOrdered`, expected `.` or `)`",
      );
    return n;
  }
  function tr(e) {
    let n = e.options.rule || "*";
    if (n !== "*" && n !== "-" && n !== "_")
      throw Error(
        "Cannot serialize rules with `" + n + "` for `options.rule`, expected `*`, `-`, or `_`",
      );
    return n;
  }
  function Es(e, n, t, r) {
    let i = t.enter("list"),
      o = t.bulletCurrent,
      s = e.ordered ? Cs(t) : un(t),
      a = e.ordered ? (s === "." ? ")" : ".") : Ss(t),
      u = n && t.bulletLastUsed ? s === t.bulletLastUsed : !1;
    if (!e.ordered) {
      let c = e.children ? e.children[0] : void 0;
      if (
        (s === "*" || s === "-") &&
        c &&
        (!c.children || !c.children[0]) &&
        t.stack[t.stack.length - 1] === "list" &&
        t.stack[t.stack.length - 2] === "listItem" &&
        t.stack[t.stack.length - 3] === "list" &&
        t.stack[t.stack.length - 4] === "listItem" &&
        t.indexStack[t.indexStack.length - 1] === 0 &&
        t.indexStack[t.indexStack.length - 2] === 0 &&
        t.indexStack[t.indexStack.length - 3] === 0
      )
        u = !0;
      if (tr(t) === s && c) {
        let f = -1;
        while (++f < e.children.length) {
          let p = e.children[f];
          if (
            p &&
            p.type === "listItem" &&
            p.children &&
            p.children[0] &&
            p.children[0].type === "thematicBreak"
          ) {
            u = !0;
            break;
          }
        }
      }
    }
    if (u) s = a;
    t.bulletCurrent = s;
    let l = t.containerFlow(e, r);
    return ((t.bulletLastUsed = s), (t.bulletCurrent = o), i(), l);
  }
  function Is(e) {
    let n = e.options.listItemIndent || "one";
    if (n !== "tab" && n !== "one" && n !== "mixed")
      throw Error(
        "Cannot serialize items with `" +
          n +
          "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`",
      );
    return n;
  }
  function Ts(e, n, t, r) {
    let i = Is(t),
      o = t.bulletCurrent || un(t);
    if (n && n.type === "list" && n.ordered)
      o =
        (typeof n.start === "number" && n.start > -1 ? n.start : 1) +
        (t.options.incrementListMarker === !1 ? 0 : n.children.indexOf(e)) +
        o;
    let s = o.length + 1;
    if (i === "tab" || (i === "mixed" && ((n && n.type === "list" && n.spread) || e.spread)))
      s = Math.ceil(s / 4) * 4;
    let a = t.createTracker(r);
    (a.move(o + " ".repeat(s - o.length)), a.shift(s));
    let u = t.enter("listItem"),
      l = t.indentLines(t.containerFlow(e, a.current()), c);
    return (u(), l);
    function c(f, p, h) {
      if (p) return (h ? "" : " ".repeat(s)) + f;
      return (h ? o : o + " ".repeat(s - o.length)) + f;
    }
  }
  function vs(e, n, t, r) {
    let i = t.enter("paragraph"),
      o = t.enter("phrasing"),
      s = t.containerPhrasing(e, r);
    return (o(), i(), s);
  }
  var mi = vt([
    "break",
    "delete",
    "emphasis",
    "footnote",
    "footnoteReference",
    "image",
    "imageReference",
    "inlineCode",
    "inlineMath",
    "link",
    "linkReference",
    "mdxJsxTextElement",
    "mdxTextExpression",
    "strong",
    "text",
    "textDirective",
  ]);
  function As(e, n, t, r) {
    return (
      e.children.some(function (s) {
        return mi(s);
      })
        ? t.containerPhrasing
        : t.containerFlow
    ).call(t, e, r);
  }
  function Ms(e) {
    let n = e.options.strong || "*";
    if (n !== "*" && n !== "_")
      throw Error(
        "Cannot serialize strong with `" + n + "` for `options.strong`, expected `*`, or `_`",
      );
    return n;
  }
  gi.peek = Pc;
  function gi(e, n, t, r) {
    let i = Ms(t),
      o = t.enter("strong"),
      s = t.createTracker(r),
      a = s.move(i + i),
      u = s.move(t.containerPhrasing(e, { after: i, before: a, ...s.current() })),
      l = u.charCodeAt(0),
      c = an(r.before.charCodeAt(r.before.length - 1), l, i);
    if (c.inside) u = At(l) + u.slice(1);
    let f = u.charCodeAt(u.length - 1),
      p = an(r.after.charCodeAt(0), f, i);
    if (p.inside) u = u.slice(0, -1) + At(f);
    let h = s.move(i + i);
    return (
      o(), (t.attentionEncodeSurroundingInfo = { after: p.outside, before: c.outside }), a + u + h
    );
  }
  function Pc(e, n, t) {
    return t.options.strong || "*";
  }
  function Fs(e, n, t, r) {
    return t.safe(e.value, r);
  }
  function Rs(e) {
    let n = e.options.ruleRepetition || 3;
    if (n < 3)
      throw Error(
        "Cannot serialize rules with repetition `" +
          n +
          "` for `options.ruleRepetition`, expected `3` or more",
      );
    return n;
  }
  function Ps(e, n, t) {
    let r = (tr(t) + (t.options.ruleSpaces ? " " : "")).repeat(Rs(t));
    return t.options.ruleSpaces ? r.slice(0, -1) : r;
  }
  var An = {
    blockquote: ls,
    break: oi,
    code: ms,
    definition: gs,
    emphasis: si,
    hardBreak: oi,
    heading: ys,
    html: ui,
    image: li,
    imageReference: ci,
    inlineCode: fi,
    link: pi,
    linkReference: hi,
    list: Es,
    listItem: Ts,
    paragraph: vs,
    root: As,
    strong: gi,
    text: Fs,
    thematicBreak: Ps,
  };
  function xi() {
    return {
      enter: { table: Dc, tableData: Ls, tableHeader: Ls, tableRow: Nc },
      exit: { codeText: zc, table: Bc, tableData: ki, tableHeader: ki, tableRow: ki },
    };
  }
  function Dc(e) {
    let n = e._align;
    (x(n, "expected `_align` on table"),
      this.enter(
        {
          type: "table",
          align: n.map(function (t) {
            return t === "none" ? null : t;
          }),
          children: [],
        },
        e,
      ),
      (this.data.inTable = !0));
  }
  function Bc(e) {
    (this.exit(e), (this.data.inTable = void 0));
  }
  function Nc(e) {
    this.enter({ type: "tableRow", children: [] }, e);
  }
  function ki(e) {
    this.exit(e);
  }
  function Ls(e) {
    this.enter({ type: "tableCell", children: [] }, e);
  }
  function zc(e) {
    let n = this.resume();
    if (this.data.inTable) n = n.replace(/\\([\\|])/g, Oc);
    let t = this.stack[this.stack.length - 1];
    (x(t.type === "inlineCode"), (t.value = n), this.exit(e));
  }
  function Oc(e, n) {
    return n === "|" ? n : e;
  }
  function wi(e) {
    let n = e || {},
      { tableCellPadding: t, tablePipeAlign: r, stringLength: i } = n,
      o = t ? " " : "|";
    return {
      unsafe: [
        { character: "\r", inConstruct: "tableCell" },
        {
          character: `
`,
          inConstruct: "tableCell",
        },
        { atBreak: !0, character: "|", after: "[\t :-]" },
        { character: "|", inConstruct: "tableCell" },
        { atBreak: !0, character: ":", after: "-" },
        { atBreak: !0, character: "-", after: "[:|-]" },
      ],
      handlers: { inlineCode: p, table: s, tableCell: u, tableRow: a },
    };
    function s(h, g, k, C) {
      return l(c(h, k, C), h.align);
    }
    function a(h, g, k, C) {
      let b = f(h, k, C),
        F = l([b]);
      return F.slice(
        0,
        F.indexOf(`
`),
      );
    }
    function u(h, g, k, C) {
      let b = k.enter("tableCell"),
        F = k.enter("phrasing"),
        M = k.containerPhrasing(h, { ...C, before: o, after: o });
      return (F(), b(), M);
    }
    function l(h, g) {
      return us(h, { align: g, alignDelimiters: r, padding: t, stringLength: i });
    }
    function c(h, g, k) {
      let C = h.children,
        b = -1,
        F = [],
        M = g.enter("table");
      while (++b < C.length) F[b] = f(C[b], g, k);
      return (M(), F);
    }
    function f(h, g, k) {
      let C = h.children,
        b = -1,
        F = [],
        M = g.enter("tableRow");
      while (++b < C.length) F[b] = u(C[b], h, g, k);
      return (M(), F);
    }
    function p(h, g, k) {
      let C = An.inlineCode(h, g, k);
      if (k.stack.includes("tableCell")) C = C.replace(/\|/g, "\\$&");
      return C;
    }
  }
  function bi() {
    return {
      exit: { taskListCheckValueChecked: Ds, taskListCheckValueUnchecked: Ds, paragraph: $c },
    };
  }
  function yi() {
    return {
      unsafe: [{ atBreak: !0, character: "-", after: "[:|-]" }],
      handlers: { listItem: _c },
    };
  }
  function Ds(e) {
    let n = this.stack[this.stack.length - 2];
    (x(n.type === "listItem"), (n.checked = e.type === "taskListCheckValueChecked"));
  }
  function $c(e) {
    let n = this.stack[this.stack.length - 2];
    if (n && n.type === "listItem" && typeof n.checked === "boolean") {
      let t = this.stack[this.stack.length - 1];
      x(t.type === "paragraph");
      let r = t.children[0];
      if (r && r.type === "text") {
        let i = n.children,
          o = -1,
          s;
        while (++o < i.length) {
          let a = i[o];
          if (a.type === "paragraph") {
            s = a;
            break;
          }
        }
        if (s === t) {
          if (((r.value = r.value.slice(1)), r.value.length === 0)) t.children.shift();
          else if (t.position && r.position && typeof r.position.start.offset === "number")
            (r.position.start.column++,
              r.position.start.offset++,
              (t.position.start = Object.assign({}, r.position.start)));
        }
      }
    }
    this.exit(e);
  }
  function _c(e, n, t, r) {
    let i = e.children[0],
      o = typeof e.checked === "boolean" && i && i.type === "paragraph",
      s = "[" + (e.checked ? "x" : " ") + "] ",
      a = t.createTracker(r);
    if (o) a.move(s);
    let u = An.listItem(e, n, t, { ...r, ...a.current() });
    if (o) u = u.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, l);
    return u;
    function l(c) {
      return c + s;
    }
  }
  function Si() {
    return [Jr(), ti(), ri(), xi(), bi()];
  }
  function Ci(e) {
    return { extensions: [ei(), ni(e), ii(), wi(e), yi()] };
  }
  function we(e, n, t, r) {
    let i = e.length,
      o = 0,
      s;
    if (n < 0) n = -n > i ? 0 : i + n;
    else n = n > i ? i : n;
    if (((t = t > 0 ? t : 0), r.length < P.v8MaxSafeChunkSize))
      ((s = Array.from(r)), s.unshift(n, t), e.splice(...s));
    else {
      if (t) e.splice(n, t);
      while (o < r.length)
        ((s = r.slice(o, o + P.v8MaxSafeChunkSize)),
          s.unshift(n, 0),
          e.splice(...s),
          (o += P.v8MaxSafeChunkSize),
          (n += P.v8MaxSafeChunkSize));
    }
  }
  function Ne(e, n) {
    if (e.length > 0) return (we(e, e.length, 0, n), e);
    return n;
  }
  var Bs = {}.hasOwnProperty;
  function nr(e) {
    let n = {},
      t = -1;
    while (++t < e.length) qc(n, e[t]);
    return n;
  }
  function qc(e, n) {
    let t;
    for (t in n) {
      let i = (Bs.call(e, t) ? e[t] : void 0) || (e[t] = {}),
        o = n[t],
        s;
      if (o)
        for (s in o) {
          if (!Bs.call(i, s)) i[s] = [];
          let a = o[s];
          Uc(i[s], Array.isArray(a) ? a : a ? [a] : []);
        }
    }
  }
  function Uc(e, n) {
    let t = -1,
      r = [];
    while (++t < n.length) (n[t].add === "after" ? e : r).push(n[t]);
    we(e, 0, 0, r);
  }
  var Vc = { tokenize: Zc, partial: !0 },
    Ns = { tokenize: Qc, partial: !0 },
    zs = { tokenize: Yc, partial: !0 },
    Os = { tokenize: Kc, partial: !0 },
    Hc = { tokenize: Xc, partial: !0 },
    $s = { name: "wwwAutolink", tokenize: Wc, previous: qs },
    _s = { name: "protocolAutolink", tokenize: Gc, previous: Us },
    mt = { name: "emailAutolink", tokenize: jc, previous: Vs },
    rt = {};
  function Ii() {
    return { text: rt };
  }
  var Ht = d.digit0;
  while (Ht < d.leftCurlyBrace)
    if (((rt[Ht] = mt), Ht++, Ht === d.colon)) Ht = d.uppercaseA;
    else if (Ht === d.leftSquareBracket) Ht = d.lowercaseA;
  rt[d.plusSign] = mt;
  rt[d.dash] = mt;
  rt[d.dot] = mt;
  rt[d.underscore] = mt;
  rt[d.uppercaseH] = [mt, _s];
  rt[d.lowercaseH] = [mt, _s];
  rt[d.uppercaseW] = [mt, $s];
  rt[d.lowercaseW] = [mt, $s];
  function jc(e, n, t) {
    let r = this,
      i,
      o;
    return s;
    function s(f) {
      if (!Ei(f) || !Vs.call(r, r.previous) || Ti(r.events)) return t(f);
      return (e.enter("literalAutolink"), e.enter("literalAutolinkEmail"), a(f));
    }
    function a(f) {
      if (Ei(f)) return (e.consume(f), a);
      if (f === d.atSign) return (e.consume(f), u);
      return t(f);
    }
    function u(f) {
      if (f === d.dot) return e.check(Hc, c, l)(f);
      if (f === d.dash || f === d.underscore || Ce(f)) return ((o = !0), e.consume(f), u);
      return c(f);
    }
    function l(f) {
      return (e.consume(f), (i = !0), u);
    }
    function c(f) {
      if (o && i && Se(r.previous))
        return (e.exit("literalAutolinkEmail"), e.exit("literalAutolink"), n(f));
      return t(f);
    }
  }
  function Wc(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      if ((s !== d.uppercaseW && s !== d.lowercaseW) || !qs.call(r, r.previous) || Ti(r.events))
        return t(s);
      return (
        e.enter("literalAutolink"),
        e.enter("literalAutolinkWww"),
        e.check(Vc, e.attempt(Ns, e.attempt(zs, o), t), t)(s)
      );
    }
    function o(s) {
      return (e.exit("literalAutolinkWww"), e.exit("literalAutolink"), n(s));
    }
  }
  function Gc(e, n, t) {
    let r = this,
      i = "",
      o = !1;
    return s;
    function s(f) {
      if ((f === d.uppercaseH || f === d.lowercaseH) && Us.call(r, r.previous) && !Ti(r.events))
        return (
          e.enter("literalAutolink"),
          e.enter("literalAutolinkHttp"),
          (i += String.fromCodePoint(f)),
          e.consume(f),
          a
        );
      return t(f);
    }
    function a(f) {
      if (Se(f) && i.length < 5) return ((i += String.fromCodePoint(f)), e.consume(f), a);
      if (f === d.colon) {
        let p = i.toLowerCase();
        if (p === "http" || p === "https") return (e.consume(f), u);
      }
      return t(f);
    }
    function u(f) {
      if (f === d.slash) {
        if ((e.consume(f), o)) return l;
        return ((o = !0), u);
      }
      return t(f);
    }
    function l(f) {
      return f === d.eof || _t(f) || ie(f) || nt(f) || qt(f)
        ? t(f)
        : e.attempt(Ns, e.attempt(zs, c), t)(f);
    }
    function c(f) {
      return (e.exit("literalAutolinkHttp"), e.exit("literalAutolink"), n(f));
    }
  }
  function Zc(e, n, t) {
    let r = 0;
    return i;
    function i(s) {
      if ((s === d.uppercaseW || s === d.lowercaseW) && r < 3) return (r++, e.consume(s), i);
      if (s === d.dot && r === 3) return (e.consume(s), o);
      return t(s);
    }
    function o(s) {
      return s === d.eof ? t(s) : n(s);
    }
  }
  function Qc(e, n, t) {
    let r, i, o;
    return s;
    function s(l) {
      if (l === d.dot || l === d.underscore) return e.check(Os, u, a)(l);
      if (l === d.eof || ie(l) || nt(l) || (l !== d.dash && qt(l))) return u(l);
      return ((o = !0), e.consume(l), s);
    }
    function a(l) {
      if (l === d.underscore) r = !0;
      else ((i = r), (r = void 0));
      return (e.consume(l), s);
    }
    function u(l) {
      if (i || r || !o) return t(l);
      return n(l);
    }
  }
  function Yc(e, n) {
    let t = 0,
      r = 0;
    return i;
    function i(s) {
      if (s === d.leftParenthesis) return (t++, e.consume(s), i);
      if (s === d.rightParenthesis && r < t) return o(s);
      if (
        s === d.exclamationMark ||
        s === d.quotationMark ||
        s === d.ampersand ||
        s === d.apostrophe ||
        s === d.rightParenthesis ||
        s === d.asterisk ||
        s === d.comma ||
        s === d.dot ||
        s === d.colon ||
        s === d.semicolon ||
        s === d.lessThan ||
        s === d.questionMark ||
        s === d.rightSquareBracket ||
        s === d.underscore ||
        s === d.tilde
      )
        return e.check(Os, n, o)(s);
      if (s === d.eof || ie(s) || nt(s)) return n(s);
      return (e.consume(s), i);
    }
    function o(s) {
      if (s === d.rightParenthesis) r++;
      return (e.consume(s), i);
    }
  }
  function Kc(e, n, t) {
    return r;
    function r(a) {
      if (
        a === d.exclamationMark ||
        a === d.quotationMark ||
        a === d.apostrophe ||
        a === d.rightParenthesis ||
        a === d.asterisk ||
        a === d.comma ||
        a === d.dot ||
        a === d.colon ||
        a === d.semicolon ||
        a === d.questionMark ||
        a === d.underscore ||
        a === d.tilde
      )
        return (e.consume(a), r);
      if (a === d.ampersand) return (e.consume(a), o);
      if (a === d.rightSquareBracket) return (e.consume(a), i);
      if (a === d.lessThan || a === d.eof || ie(a) || nt(a)) return n(a);
      return t(a);
    }
    function i(a) {
      if (a === d.eof || a === d.leftParenthesis || a === d.leftSquareBracket || ie(a) || nt(a))
        return n(a);
      return r(a);
    }
    function o(a) {
      return Se(a) ? s(a) : t(a);
    }
    function s(a) {
      if (a === d.semicolon) return (e.consume(a), r);
      if (Se(a)) return (e.consume(a), s);
      return t(a);
    }
  }
  function Xc(e, n, t) {
    return r;
    function r(o) {
      return (e.consume(o), i);
    }
    function i(o) {
      return Ce(o) ? t(o) : n(o);
    }
  }
  function qs(e) {
    return (
      e === d.eof ||
      e === d.leftParenthesis ||
      e === d.asterisk ||
      e === d.underscore ||
      e === d.leftSquareBracket ||
      e === d.rightSquareBracket ||
      e === d.tilde ||
      ie(e)
    );
  }
  function Us(e) {
    return !Se(e);
  }
  function Vs(e) {
    return !(e === d.slash || Ei(e));
  }
  function Ei(e) {
    return e === d.plusSign || e === d.dash || e === d.dot || e === d.underscore || Ce(e);
  }
  function Ti(e) {
    let n = e.length,
      t = !1;
    while (n--) {
      let r = e[n][1];
      if ((r.type === "labelLink" || r.type === "labelImage") && !r._balanced) {
        t = !0;
        break;
      }
      if (r._gfmAutolinkLiteralWalkedInto) {
        t = !1;
        break;
      }
    }
    if (e.length > 0 && !t) e[e.length - 1][1]._gfmAutolinkLiteralWalkedInto = !0;
    return t;
  }
  function Mt(e, n, t) {
    let r = [],
      i = -1;
    while (++i < e.length) {
      let o = e[i].resolveAll;
      if (o && !r.includes(o)) ((n = o(n, t)), r.push(o));
    }
    return n;
  }
  var Mn = { name: "attention", resolveAll: Jc, tokenize: ef };
  function Jc(e, n) {
    let t = -1,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c;
    while (++t < e.length)
      if (e[t][0] === "enter" && e[t][1].type === "attentionSequence" && e[t][1]._close) {
        r = t;
        while (r--)
          if (
            e[r][0] === "exit" &&
            e[r][1].type === "attentionSequence" &&
            e[r][1]._open &&
            n.sliceSerialize(e[r][1]).charCodeAt(0) === n.sliceSerialize(e[t][1]).charCodeAt(0)
          ) {
            if (
              (e[r][1]._close || e[t][1]._open) &&
              (e[t][1].end.offset - e[t][1].start.offset) % 3 &&
              !(
                (e[r][1].end.offset -
                  e[r][1].start.offset +
                  e[t][1].end.offset -
                  e[t][1].start.offset) %
                3
              )
            )
              continue;
            u =
              e[r][1].end.offset - e[r][1].start.offset > 1 &&
              e[t][1].end.offset - e[t][1].start.offset > 1
                ? 2
                : 1;
            let f = { ...e[r][1].end },
              p = { ...e[t][1].start };
            if (
              (Hs(f, -u),
              Hs(p, u),
              (s = {
                type: u > 1 ? m.strongSequence : m.emphasisSequence,
                start: f,
                end: { ...e[r][1].end },
              }),
              (a = {
                type: u > 1 ? m.strongSequence : m.emphasisSequence,
                start: { ...e[t][1].start },
                end: p,
              }),
              (o = {
                type: u > 1 ? m.strongText : m.emphasisText,
                start: { ...e[r][1].end },
                end: { ...e[t][1].start },
              }),
              (i = {
                type: u > 1 ? m.strong : m.emphasis,
                start: { ...s.start },
                end: { ...a.end },
              }),
              (e[r][1].end = { ...s.start }),
              (e[t][1].start = { ...a.end }),
              (l = []),
              e[r][1].end.offset - e[r][1].start.offset)
            )
              l = Ne(l, [
                ["enter", e[r][1], n],
                ["exit", e[r][1], n],
              ]);
            if (
              ((l = Ne(l, [
                ["enter", i, n],
                ["enter", s, n],
                ["exit", s, n],
                ["enter", o, n],
              ])),
              x(n.parser.constructs.insideSpan.null, "expected `insideSpan` to be populated"),
              (l = Ne(l, Mt(n.parser.constructs.insideSpan.null, e.slice(r + 1, t), n))),
              (l = Ne(l, [
                ["exit", o, n],
                ["enter", a, n],
                ["exit", a, n],
                ["exit", i, n],
              ])),
              e[t][1].end.offset - e[t][1].start.offset)
            )
              ((c = 2),
                (l = Ne(l, [
                  ["enter", e[t][1], n],
                  ["exit", e[t][1], n],
                ])));
            else c = 0;
            (we(e, r - 1, t - r + 3, l), (t = r + l.length - c - 2));
            break;
          }
      }
    t = -1;
    while (++t < e.length) if (e[t][1].type === "attentionSequence") e[t][1].type = "data";
    return e;
  }
  function ef(e, n) {
    let t = this.parser.constructs.attentionMarkers.null,
      r = this.previous,
      i = ht(r),
      o;
    return s;
    function s(u) {
      return (
        x(u === d.asterisk || u === d.underscore, "expected asterisk or underscore"),
        (o = u),
        e.enter("attentionSequence"),
        a(u)
      );
    }
    function a(u) {
      if (u === o) return (e.consume(u), a);
      let l = e.exit("attentionSequence"),
        c = ht(u);
      x(t, "expected `attentionMarkers` to be populated");
      let f = !c || (c === P.characterGroupPunctuation && i) || t.includes(u),
        p = !i || (i === P.characterGroupPunctuation && c) || t.includes(r);
      return (
        (l._open = Boolean(o === d.asterisk ? f : f && (i || !p))),
        (l._close = Boolean(o === d.asterisk ? p : p && (c || !f))),
        n(u)
      );
    }
  }
  function Hs(e, n) {
    ((e.column += n), (e.offset += n), (e._bufferIndex += n));
  }
  var vi = { name: "autolink", tokenize: tf };
  function tf(e, n, t) {
    let r = 0;
    return i;
    function i(h) {
      return (
        x(h === d.lessThan, "expected `<`"),
        e.enter(m.autolink),
        e.enter(m.autolinkMarker),
        e.consume(h),
        e.exit(m.autolinkMarker),
        e.enter(m.autolinkProtocol),
        o
      );
    }
    function o(h) {
      if (Se(h)) return (e.consume(h), s);
      if (h === d.atSign) return t(h);
      return l(h);
    }
    function s(h) {
      if (h === d.plusSign || h === d.dash || h === d.dot || Ce(h)) return ((r = 1), a(h));
      return l(h);
    }
    function a(h) {
      if (h === d.colon) return (e.consume(h), (r = 0), u);
      if (
        (h === d.plusSign || h === d.dash || h === d.dot || Ce(h)) &&
        r++ < P.autolinkSchemeSizeMax
      )
        return (e.consume(h), a);
      return ((r = 0), l(h));
    }
    function u(h) {
      if (h === d.greaterThan)
        return (
          e.exit(m.autolinkProtocol),
          e.enter(m.autolinkMarker),
          e.consume(h),
          e.exit(m.autolinkMarker),
          e.exit(m.autolink),
          n
        );
      if (h === d.eof || h === d.space || h === d.lessThan || _t(h)) return t(h);
      return (e.consume(h), u);
    }
    function l(h) {
      if (h === d.atSign) return (e.consume(h), c);
      if (Xo(h)) return (e.consume(h), l);
      return t(h);
    }
    function c(h) {
      return Ce(h) ? f(h) : t(h);
    }
    function f(h) {
      if (h === d.dot) return (e.consume(h), (r = 0), c);
      if (h === d.greaterThan)
        return (
          (e.exit(m.autolinkProtocol).type = m.autolinkEmail),
          e.enter(m.autolinkMarker),
          e.consume(h),
          e.exit(m.autolinkMarker),
          e.exit(m.autolink),
          n
        );
      return p(h);
    }
    function p(h) {
      if ((h === d.dash || Ce(h)) && r++ < P.autolinkDomainSizeMax) {
        let g = h === d.dash ? p : f;
        return (e.consume(h), g);
      }
      return t(h);
    }
  }
  function Z(e, n, t, r) {
    let i = r ? r - 1 : Number.POSITIVE_INFINITY,
      o = 0;
    return s;
    function s(u) {
      if (G(u)) return (e.enter(t), a(u));
      return n(u);
    }
    function a(u) {
      if (G(u) && o++ < i) return (e.consume(u), a);
      return (e.exit(t), n(u));
    }
  }
  var it = { partial: !0, tokenize: nf };
  function nf(e, n, t) {
    return r;
    function r(o) {
      return G(o) ? Z(e, i, m.linePrefix)(o) : i(o);
    }
    function i(o) {
      return o === d.eof || B(o) ? n(o) : t(o);
    }
  }
  var rr = { continuation: { tokenize: of }, exit: sf, name: "blockQuote", tokenize: rf };
  function rf(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      if (s === d.greaterThan) {
        let a = r.containerState;
        if ((x(a, "expected `containerState` to be defined in container"), !a.open))
          (e.enter(m.blockQuote, { _container: !0 }), (a.open = !0));
        return (
          e.enter(m.blockQuotePrefix),
          e.enter(m.blockQuoteMarker),
          e.consume(s),
          e.exit(m.blockQuoteMarker),
          o
        );
      }
      return t(s);
    }
    function o(s) {
      if (G(s))
        return (
          e.enter(m.blockQuotePrefixWhitespace),
          e.consume(s),
          e.exit(m.blockQuotePrefixWhitespace),
          e.exit(m.blockQuotePrefix),
          n
        );
      return (e.exit(m.blockQuotePrefix), n(s));
    }
  }
  function of(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      if (G(s))
        return (
          x(r.parser.constructs.disable.null, "expected `disable.null` to be populated"),
          Z(
            e,
            o,
            m.linePrefix,
            r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize,
          )(s)
        );
      return o(s);
    }
    function o(s) {
      return e.attempt(rr, n, t)(s);
    }
  }
  function sf(e) {
    e.exit(m.blockQuote);
  }
  var ir = { name: "characterEscape", tokenize: af };
  function af(e, n, t) {
    return r;
    function r(o) {
      return (
        x(o === d.backslash, "expected `\\`"),
        e.enter(m.characterEscape),
        e.enter(m.escapeMarker),
        e.consume(o),
        e.exit(m.escapeMarker),
        i
      );
    }
    function i(o) {
      if (es(o))
        return (
          e.enter(m.characterEscapeValue),
          e.consume(o),
          e.exit(m.characterEscapeValue),
          e.exit(m.characterEscape),
          n
        );
      return t(o);
    }
  }
  var js = document.createElement("i");
  function ln(e) {
    let n = "&" + e + ";";
    js.innerHTML = n;
    let t = js.textContent;
    if (t.charCodeAt(t.length - 1) === 59 && e !== "semi") return !1;
    return t === n ? !1 : t;
  }
  var or = { name: "characterReference", tokenize: uf };
  function uf(e, n, t) {
    let r = this,
      i = 0,
      o,
      s;
    return a;
    function a(f) {
      return (
        x(f === d.ampersand, "expected `&`"),
        e.enter(m.characterReference),
        e.enter(m.characterReferenceMarker),
        e.consume(f),
        e.exit(m.characterReferenceMarker),
        u
      );
    }
    function u(f) {
      if (f === d.numberSign)
        return (
          e.enter(m.characterReferenceMarkerNumeric),
          e.consume(f),
          e.exit(m.characterReferenceMarkerNumeric),
          l
        );
      return (
        e.enter(m.characterReferenceValue), (o = P.characterReferenceNamedSizeMax), (s = Ce), c(f)
      );
    }
    function l(f) {
      if (f === d.uppercaseX || f === d.lowercaseX)
        return (
          e.enter(m.characterReferenceMarkerHexadecimal),
          e.consume(f),
          e.exit(m.characterReferenceMarkerHexadecimal),
          e.enter(m.characterReferenceValue),
          (o = P.characterReferenceHexadecimalSizeMax),
          (s = Jo),
          c
        );
      return (
        e.enter(m.characterReferenceValue), (o = P.characterReferenceDecimalSizeMax), (s = Tn), c(f)
      );
    }
    function c(f) {
      if (f === d.semicolon && i) {
        let p = e.exit(m.characterReferenceValue);
        if (s === Ce && !ln(r.sliceSerialize(p))) return t(f);
        return (
          e.enter(m.characterReferenceMarker),
          e.consume(f),
          e.exit(m.characterReferenceMarker),
          e.exit(m.characterReference),
          n
        );
      }
      if (s(f) && i++ < o) return (e.consume(f), c);
      return t(f);
    }
  }
  var Ws = { partial: !0, tokenize: cf },
    sr = { concrete: !0, name: "codeFenced", tokenize: lf };
  function lf(e, n, t) {
    let r = this,
      i = { partial: !0, tokenize: z },
      o = 0,
      s = 0,
      a;
    return u;
    function u(E) {
      return l(E);
    }
    function l(E) {
      x(E === d.graveAccent || E === d.tilde, "expected `` ` `` or `~`");
      let _ = r.events[r.events.length - 1];
      return (
        (o = _ && _[1].type === m.linePrefix ? _[2].sliceSerialize(_[1], !0).length : 0),
        (a = E),
        e.enter(m.codeFenced),
        e.enter(m.codeFencedFence),
        e.enter(m.codeFencedFenceSequence),
        c(E)
      );
    }
    function c(E) {
      if (E === a) return (s++, e.consume(E), c);
      if (s < P.codeFencedSequenceSizeMin) return t(E);
      return (e.exit(m.codeFencedFenceSequence), G(E) ? Z(e, f, m.whitespace)(E) : f(E));
    }
    function f(E) {
      if (E === d.eof || B(E))
        return (e.exit(m.codeFencedFence), r.interrupt ? n(E) : e.check(Ws, k, q)(E));
      return (
        e.enter(m.codeFencedFenceInfo),
        e.enter(m.chunkString, { contentType: P.contentTypeString }),
        p(E)
      );
    }
    function p(E) {
      if (E === d.eof || B(E)) return (e.exit(m.chunkString), e.exit(m.codeFencedFenceInfo), f(E));
      if (G(E))
        return (e.exit(m.chunkString), e.exit(m.codeFencedFenceInfo), Z(e, h, m.whitespace)(E));
      if (E === d.graveAccent && E === a) return t(E);
      return (e.consume(E), p);
    }
    function h(E) {
      if (E === d.eof || B(E)) return f(E);
      return (
        e.enter(m.codeFencedFenceMeta),
        e.enter(m.chunkString, { contentType: P.contentTypeString }),
        g(E)
      );
    }
    function g(E) {
      if (E === d.eof || B(E)) return (e.exit(m.chunkString), e.exit(m.codeFencedFenceMeta), f(E));
      if (E === d.graveAccent && E === a) return t(E);
      return (e.consume(E), g);
    }
    function k(E) {
      return (x(B(E), "expected eol"), e.attempt(i, q, C)(E));
    }
    function C(E) {
      return (
        x(B(E), "expected eol"), e.enter(m.lineEnding), e.consume(E), e.exit(m.lineEnding), b
      );
    }
    function b(E) {
      return o > 0 && G(E) ? Z(e, F, m.linePrefix, o + 1)(E) : F(E);
    }
    function F(E) {
      if (E === d.eof || B(E)) return e.check(Ws, k, q)(E);
      return (e.enter(m.codeFlowValue), M(E));
    }
    function M(E) {
      if (E === d.eof || B(E)) return (e.exit(m.codeFlowValue), F(E));
      return (e.consume(E), M);
    }
    function q(E) {
      return (e.exit(m.codeFenced), n(E));
    }
    function z(E, _, te) {
      let X = 0;
      return T;
      function T(H) {
        return (
          x(B(H), "expected eol"), E.enter(m.lineEnding), E.consume(H), E.exit(m.lineEnding), K
        );
      }
      function K(H) {
        return (
          x(r.parser.constructs.disable.null, "expected `disable.null` to be populated"),
          E.enter(m.codeFencedFence),
          G(H)
            ? Z(
                E,
                ne,
                m.linePrefix,
                r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize,
              )(H)
            : ne(H)
        );
      }
      function ne(H) {
        if (H === a) return (E.enter(m.codeFencedFenceSequence), U(H));
        return te(H);
      }
      function U(H) {
        if (H === a) return (X++, E.consume(H), U);
        if (X >= s)
          return (E.exit(m.codeFencedFenceSequence), G(H) ? Z(E, W, m.whitespace)(H) : W(H));
        return te(H);
      }
      function W(H) {
        if (H === d.eof || B(H)) return (E.exit(m.codeFencedFence), _(H));
        return te(H);
      }
    }
  }
  function cf(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      if (s === d.eof) return t(s);
      return (
        x(B(s), "expected eol"), e.enter(m.lineEnding), e.consume(s), e.exit(m.lineEnding), o
      );
    }
    function o(s) {
      return r.parser.lazy[r.now().line] ? t(s) : n(s);
    }
  }
  var Fn = { name: "codeIndented", tokenize: df },
    ff = { partial: !0, tokenize: pf };
  function df(e, n, t) {
    let r = this;
    return i;
    function i(l) {
      return (x(G(l)), e.enter(m.codeIndented), Z(e, o, m.linePrefix, P.tabSize + 1)(l));
    }
    function o(l) {
      let c = r.events[r.events.length - 1];
      return c && c[1].type === m.linePrefix && c[2].sliceSerialize(c[1], !0).length >= P.tabSize
        ? s(l)
        : t(l);
    }
    function s(l) {
      if (l === d.eof) return u(l);
      if (B(l)) return e.attempt(ff, s, u)(l);
      return (e.enter(m.codeFlowValue), a(l));
    }
    function a(l) {
      if (l === d.eof || B(l)) return (e.exit(m.codeFlowValue), s(l));
      return (e.consume(l), a);
    }
    function u(l) {
      return (e.exit(m.codeIndented), n(l));
    }
  }
  function pf(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      if (r.parser.lazy[r.now().line]) return t(s);
      if (B(s)) return (e.enter(m.lineEnding), e.consume(s), e.exit(m.lineEnding), i);
      return Z(e, o, m.linePrefix, P.tabSize + 1)(s);
    }
    function o(s) {
      let a = r.events[r.events.length - 1];
      return a && a[1].type === m.linePrefix && a[2].sliceSerialize(a[1], !0).length >= P.tabSize
        ? n(s)
        : B(s)
          ? i(s)
          : t(s);
    }
  }
  var Ai = { name: "codeText", previous: Gs, resolve: hf, tokenize: mf };
  function hf(e) {
    let n = e.length - 4,
      t = 3,
      r,
      i;
    if (
      (e[t][1].type === m.lineEnding || e[t][1].type === "space") &&
      (e[n][1].type === m.lineEnding || e[n][1].type === "space")
    ) {
      r = t;
      while (++r < n)
        if (e[r][1].type === m.codeTextData) {
          ((e[t][1].type = m.codeTextPadding),
            (e[n][1].type = m.codeTextPadding),
            (t += 2),
            (n -= 2));
          break;
        }
    }
    ((r = t - 1), n++);
    while (++r <= n)
      if (i === void 0) {
        if (r !== n && e[r][1].type !== m.lineEnding) i = r;
      } else if (r === n || e[r][1].type === m.lineEnding) {
        if (((e[i][1].type = m.codeTextData), r !== i + 2))
          ((e[i][1].end = e[r - 1][1].end),
            e.splice(i + 2, r - i - 2),
            (n -= r - i - 2),
            (r = i + 2));
        i = void 0;
      }
    return e;
  }
  function Gs(e) {
    return e !== d.graveAccent || this.events[this.events.length - 1][1].type === m.characterEscape;
  }
  function mf(e, n, t) {
    let r = this,
      i = 0,
      o,
      s;
    return a;
    function a(p) {
      return (
        x(p === d.graveAccent, "expected `` ` ``"),
        x(Gs.call(r, r.previous), "expected correct previous"),
        e.enter(m.codeText),
        e.enter(m.codeTextSequence),
        u(p)
      );
    }
    function u(p) {
      if (p === d.graveAccent) return (e.consume(p), i++, u);
      return (e.exit(m.codeTextSequence), l(p));
    }
    function l(p) {
      if (p === d.eof) return t(p);
      if (p === d.space) return (e.enter("space"), e.consume(p), e.exit("space"), l);
      if (p === d.graveAccent) return ((s = e.enter(m.codeTextSequence)), (o = 0), f(p));
      if (B(p)) return (e.enter(m.lineEnding), e.consume(p), e.exit(m.lineEnding), l);
      return (e.enter(m.codeTextData), c(p));
    }
    function c(p) {
      if (p === d.eof || p === d.space || p === d.graveAccent || B(p))
        return (e.exit(m.codeTextData), l(p));
      return (e.consume(p), c);
    }
    function f(p) {
      if (p === d.graveAccent) return (e.consume(p), o++, f);
      if (o === i) return (e.exit(m.codeTextSequence), e.exit(m.codeText), n(p));
      return ((s.type = m.codeTextData), c(p));
    }
  }
  class Mi {
    constructor(e) {
      ((this.left = e ? [...e] : []), (this.right = []));
    }
    get(e) {
      if (e < 0 || e >= this.left.length + this.right.length)
        throw RangeError(
          "Cannot access index `" +
            e +
            "` in a splice buffer of size `" +
            (this.left.length + this.right.length) +
            "`",
        );
      if (e < this.left.length) return this.left[e];
      return this.right[this.right.length - e + this.left.length - 1];
    }
    get length() {
      return this.left.length + this.right.length;
    }
    shift() {
      return (this.setCursor(0), this.right.pop());
    }
    slice(e, n) {
      let t = n === null || n === void 0 ? Number.POSITIVE_INFINITY : n;
      if (t < this.left.length) return this.left.slice(e, t);
      if (e > this.left.length)
        return this.right
          .slice(this.right.length - t + this.left.length, this.right.length - e + this.left.length)
          .reverse();
      return this.left
        .slice(e)
        .concat(this.right.slice(this.right.length - t + this.left.length).reverse());
    }
    splice(e, n, t) {
      let r = n || 0;
      this.setCursor(Math.trunc(e));
      let i = this.right.splice(this.right.length - r, Number.POSITIVE_INFINITY);
      if (t) Rn(this.left, t);
      return i.reverse();
    }
    pop() {
      return (this.setCursor(Number.POSITIVE_INFINITY), this.left.pop());
    }
    push(e) {
      (this.setCursor(Number.POSITIVE_INFINITY), this.left.push(e));
    }
    pushMany(e) {
      (this.setCursor(Number.POSITIVE_INFINITY), Rn(this.left, e));
    }
    unshift(e) {
      (this.setCursor(0), this.right.push(e));
    }
    unshiftMany(e) {
      (this.setCursor(0), Rn(this.right, e.reverse()));
    }
    setCursor(e) {
      if (
        e === this.left.length ||
        (e > this.left.length && this.right.length === 0) ||
        (e < 0 && this.left.length === 0)
      )
        return;
      if (e < this.left.length) {
        let n = this.left.splice(e, Number.POSITIVE_INFINITY);
        Rn(this.right, n.reverse());
      } else {
        let n = this.right.splice(
          this.left.length + this.right.length - e,
          Number.POSITIVE_INFINITY,
        );
        Rn(this.left, n.reverse());
      }
    }
  }
  function Rn(e, n) {
    let t = 0;
    if (n.length < P.v8MaxSafeChunkSize) e.push(...n);
    else
      while (t < n.length)
        (e.push(...n.slice(t, t + P.v8MaxSafeChunkSize)), (t += P.v8MaxSafeChunkSize));
  }
  function ar(e) {
    let n = {},
      t = -1,
      r,
      i,
      o,
      s,
      a,
      u,
      l,
      c = new Mi(e);
    while (++t < c.length) {
      while (t in n) t = n[t];
      if (
        ((r = c.get(t)),
        t && r[1].type === m.chunkFlow && c.get(t - 1)[1].type === m.listItemPrefix)
      ) {
        if (
          (x(r[1]._tokenizer, "expected `_tokenizer` on subtokens"),
          (u = r[1]._tokenizer.events),
          (o = 0),
          o < u.length && u[o][1].type === m.lineEndingBlank)
        )
          o += 2;
        if (o < u.length && u[o][1].type === m.content)
          while (++o < u.length) {
            if (u[o][1].type === m.content) break;
            if (u[o][1].type === m.chunkText) ((u[o][1]._isInFirstContentOfListItem = !0), o++);
          }
      }
      if (r[0] === "enter") {
        if (r[1].contentType) (Object.assign(n, gf(c, t)), (t = n[t]), (l = !0));
      } else if (r[1]._container) {
        ((o = t), (i = void 0));
        while (o--)
          if (((s = c.get(o)), s[1].type === m.lineEnding || s[1].type === m.lineEndingBlank)) {
            if (s[0] === "enter") {
              if (i) c.get(i)[1].type = m.lineEndingBlank;
              ((s[1].type = m.lineEnding), (i = o));
            }
          } else if (s[1].type === m.linePrefix || s[1].type === m.listItemIndent);
          else break;
        if (i)
          ((r[1].end = { ...c.get(i)[1].start }),
            (a = c.slice(i, t)),
            a.unshift(r),
            c.splice(i, t - i + 1, a));
      }
    }
    return (we(e, 0, Number.POSITIVE_INFINITY, c.slice(0)), !l);
  }
  function gf(e, n) {
    let t = e.get(n)[1],
      r = e.get(n)[2],
      i = n - 1,
      o = [];
    x(t.contentType, "expected `contentType` on subtokens");
    let s = t._tokenizer;
    if (!s) {
      if (((s = r.parser[t.contentType](t.start)), t._contentTypeTextTrailing))
        s._contentTypeTextTrailing = !0;
    }
    let a = s.events,
      u = [],
      l = {},
      c,
      f,
      p = -1,
      h = t,
      g = 0,
      k = 0,
      C = [k];
    while (h) {
      while (e.get(++i)[1] !== h);
      if (
        (x(!f || h.previous === f, "expected previous to match"),
        x(!f || f.next === h, "expected next to match"),
        o.push(i),
        !h._tokenizer)
      ) {
        if (((c = r.sliceStream(h)), !h.next)) c.push(d.eof);
        if (f) s.defineSkip(h.start);
        if (h._isInFirstContentOfListItem) s._gfmTasklistFirstContentOfListItem = !0;
        if ((s.write(c), h._isInFirstContentOfListItem))
          s._gfmTasklistFirstContentOfListItem = void 0;
      }
      ((f = h), (h = h.next));
    }
    h = t;
    while (++p < a.length)
      if (
        a[p][0] === "exit" &&
        a[p - 1][0] === "enter" &&
        a[p][1].type === a[p - 1][1].type &&
        a[p][1].start.line !== a[p][1].end.line
      )
        (x(h, "expected a current token"),
          (k = p + 1),
          C.push(k),
          (h._tokenizer = void 0),
          (h.previous = void 0),
          (h = h.next));
    if (((s.events = []), h))
      ((h._tokenizer = void 0), (h.previous = void 0), x(!h.next, "expected no next token"));
    else C.pop();
    p = C.length;
    while (p--) {
      let b = a.slice(C[p], C[p + 1]),
        F = o.pop();
      (x(F !== void 0, "expected a start position when splicing"),
        u.push([F, F + b.length - 1]),
        e.splice(F, 2, b));
    }
    (u.reverse(), (p = -1));
    while (++p < u.length) ((l[g + u[p][0]] = g + u[p][1]), (g += u[p][1] - u[p][0] - 1));
    return l;
  }
  var Fi = { resolve: xf, tokenize: wf },
    kf = { partial: !0, tokenize: bf };
  function xf(e) {
    return (ar(e), e);
  }
  function wf(e, n) {
    let t;
    return r;
    function r(a) {
      return (
        x(a !== d.eof && !B(a), "expected no eof or eol"),
        e.enter(m.content),
        (t = e.enter(m.chunkContent, { contentType: P.contentTypeContent })),
        i(a)
      );
    }
    function i(a) {
      if (a === d.eof) return o(a);
      if (B(a)) return e.check(kf, s, o)(a);
      return (e.consume(a), i);
    }
    function o(a) {
      return (e.exit(m.chunkContent), e.exit(m.content), n(a));
    }
    function s(a) {
      return (
        x(B(a), "expected eol"),
        e.consume(a),
        e.exit(m.chunkContent),
        x(t, "expected previous token"),
        (t.next = e.enter(m.chunkContent, { contentType: P.contentTypeContent, previous: t })),
        (t = t.next),
        i
      );
    }
  }
  function bf(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      return (
        x(B(s), "expected a line ending"),
        e.exit(m.chunkContent),
        e.enter(m.lineEnding),
        e.consume(s),
        e.exit(m.lineEnding),
        Z(e, o, m.linePrefix)
      );
    }
    function o(s) {
      if (s === d.eof || B(s)) return t(s);
      x(r.parser.constructs.disable.null, "expected `disable.null` to be populated");
      let a = r.events[r.events.length - 1];
      if (
        !r.parser.constructs.disable.null.includes("codeIndented") &&
        a &&
        a[1].type === m.linePrefix &&
        a[2].sliceSerialize(a[1], !0).length >= P.tabSize
      )
        return n(s);
      return e.interrupt(r.parser.constructs.flow, t, n)(s);
    }
  }
  function ur(e, n, t, r, i, o, s, a, u) {
    let l = u || Number.POSITIVE_INFINITY,
      c = 0;
    return f;
    function f(b) {
      if (b === d.lessThan) return (e.enter(r), e.enter(i), e.enter(o), e.consume(b), e.exit(o), p);
      if (b === d.eof || b === d.space || b === d.rightParenthesis || _t(b)) return t(b);
      return (
        e.enter(r),
        e.enter(s),
        e.enter(a),
        e.enter(m.chunkString, { contentType: P.contentTypeString }),
        k(b)
      );
    }
    function p(b) {
      if (b === d.greaterThan)
        return (e.enter(o), e.consume(b), e.exit(o), e.exit(i), e.exit(r), n);
      return (e.enter(a), e.enter(m.chunkString, { contentType: P.contentTypeString }), h(b));
    }
    function h(b) {
      if (b === d.greaterThan) return (e.exit(m.chunkString), e.exit(a), p(b));
      if (b === d.eof || b === d.lessThan || B(b)) return t(b);
      return (e.consume(b), b === d.backslash ? g : h);
    }
    function g(b) {
      if (b === d.lessThan || b === d.greaterThan || b === d.backslash) return (e.consume(b), h);
      return h(b);
    }
    function k(b) {
      if (!c && (b === d.eof || b === d.rightParenthesis || ie(b)))
        return (e.exit(m.chunkString), e.exit(a), e.exit(s), e.exit(r), n(b));
      if (c < l && b === d.leftParenthesis) return (e.consume(b), c++, k);
      if (b === d.rightParenthesis) return (e.consume(b), c--, k);
      if (b === d.eof || b === d.space || b === d.leftParenthesis || _t(b)) return t(b);
      return (e.consume(b), b === d.backslash ? C : k);
    }
    function C(b) {
      if (b === d.leftParenthesis || b === d.rightParenthesis || b === d.backslash)
        return (e.consume(b), k);
      return k(b);
    }
  }
  function lr(e, n, t, r, i, o) {
    let s = this,
      a = 0,
      u;
    return l;
    function l(h) {
      return (
        x(h === d.leftSquareBracket, "expected `[`"),
        e.enter(r),
        e.enter(i),
        e.consume(h),
        e.exit(i),
        e.enter(o),
        c
      );
    }
    function c(h) {
      if (
        a > P.linkReferenceSizeMax ||
        h === d.eof ||
        h === d.leftSquareBracket ||
        (h === d.rightSquareBracket && !u) ||
        (h === d.caret && !a && "_hiddenFootnoteSupport" in s.parser.constructs)
      )
        return t(h);
      if (h === d.rightSquareBracket)
        return (e.exit(o), e.enter(i), e.consume(h), e.exit(i), e.exit(r), n);
      if (B(h)) return (e.enter(m.lineEnding), e.consume(h), e.exit(m.lineEnding), c);
      return (e.enter(m.chunkString, { contentType: P.contentTypeString }), f(h));
    }
    function f(h) {
      if (
        h === d.eof ||
        h === d.leftSquareBracket ||
        h === d.rightSquareBracket ||
        B(h) ||
        a++ > P.linkReferenceSizeMax
      )
        return (e.exit(m.chunkString), c(h));
      if ((e.consume(h), !u)) u = !G(h);
      return h === d.backslash ? p : f;
    }
    function p(h) {
      if (h === d.leftSquareBracket || h === d.backslash || h === d.rightSquareBracket)
        return (e.consume(h), a++, f);
      return f(h);
    }
  }
  function cr(e, n, t, r, i, o) {
    let s;
    return a;
    function a(p) {
      if (p === d.quotationMark || p === d.apostrophe || p === d.leftParenthesis)
        return (
          e.enter(r),
          e.enter(i),
          e.consume(p),
          e.exit(i),
          (s = p === d.leftParenthesis ? d.rightParenthesis : p),
          u
        );
      return t(p);
    }
    function u(p) {
      if (p === s) return (e.enter(i), e.consume(p), e.exit(i), e.exit(r), n);
      return (e.enter(o), l(p));
    }
    function l(p) {
      if (p === s) return (e.exit(o), u(s));
      if (p === d.eof) return t(p);
      if (B(p))
        return (e.enter(m.lineEnding), e.consume(p), e.exit(m.lineEnding), Z(e, l, m.linePrefix));
      return (e.enter(m.chunkString, { contentType: P.contentTypeString }), c(p));
    }
    function c(p) {
      if (p === s || p === d.eof || B(p)) return (e.exit(m.chunkString), l(p));
      return (e.consume(p), p === d.backslash ? f : c);
    }
    function f(p) {
      if (p === s || p === d.backslash) return (e.consume(p), c);
      return c(p);
    }
  }
  function jt(e, n) {
    let t;
    return r;
    function r(i) {
      if (B(i)) return (e.enter(m.lineEnding), e.consume(i), e.exit(m.lineEnding), (t = !0), r);
      if (G(i)) return Z(e, r, t ? m.linePrefix : m.lineSuffix)(i);
      return n(i);
    }
  }
  var Ri = { name: "definition", tokenize: Sf },
    yf = { partial: !0, tokenize: Cf };
  function Sf(e, n, t) {
    let r = this,
      i;
    return o;
    function o(h) {
      return (e.enter(m.definition), s(h));
    }
    function s(h) {
      return (
        x(h === d.leftSquareBracket, "expected `[`"),
        lr.call(r, e, a, t, m.definitionLabel, m.definitionLabelMarker, m.definitionLabelString)(h)
      );
    }
    function a(h) {
      if (
        ((i = Pe(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1))), h === d.colon)
      )
        return (e.enter(m.definitionMarker), e.consume(h), e.exit(m.definitionMarker), u);
      return t(h);
    }
    function u(h) {
      return ie(h) ? jt(e, l)(h) : l(h);
    }
    function l(h) {
      return ur(
        e,
        c,
        t,
        m.definitionDestination,
        m.definitionDestinationLiteral,
        m.definitionDestinationLiteralMarker,
        m.definitionDestinationRaw,
        m.definitionDestinationString,
      )(h);
    }
    function c(h) {
      return e.attempt(yf, f, f)(h);
    }
    function f(h) {
      return G(h) ? Z(e, p, m.whitespace)(h) : p(h);
    }
    function p(h) {
      if (h === d.eof || B(h)) return (e.exit(m.definition), r.parser.defined.push(i), n(h));
      return t(h);
    }
  }
  function Cf(e, n, t) {
    return r;
    function r(a) {
      return ie(a) ? jt(e, i)(a) : t(a);
    }
    function i(a) {
      return cr(e, o, t, m.definitionTitle, m.definitionTitleMarker, m.definitionTitleString)(a);
    }
    function o(a) {
      return G(a) ? Z(e, s, m.whitespace)(a) : s(a);
    }
    function s(a) {
      return a === d.eof || B(a) ? n(a) : t(a);
    }
  }
  var Pi = { name: "hardBreakEscape", tokenize: Ef };
  function Ef(e, n, t) {
    return r;
    function r(o) {
      return (x(o === d.backslash, "expected `\\`"), e.enter(m.hardBreakEscape), e.consume(o), i);
    }
    function i(o) {
      if (B(o)) return (e.exit(m.hardBreakEscape), n(o));
      return t(o);
    }
  }
  var Li = { name: "headingAtx", resolve: If, tokenize: Tf };
  function If(e, n) {
    let t = e.length - 2,
      r = 3,
      i,
      o;
    if (e[r][1].type === m.whitespace) r += 2;
    if (t - 2 > r && e[t][1].type === m.whitespace) t -= 2;
    if (
      e[t][1].type === m.atxHeadingSequence &&
      (r === t - 1 || (t - 4 > r && e[t - 2][1].type === m.whitespace))
    )
      t -= r + 1 === t ? 2 : 4;
    if (t > r)
      ((i = { type: m.atxHeadingText, start: e[r][1].start, end: e[t][1].end }),
        (o = {
          type: m.chunkText,
          start: e[r][1].start,
          end: e[t][1].end,
          contentType: P.contentTypeText,
        }),
        we(e, r, t - r + 1, [
          ["enter", i, n],
          ["enter", o, n],
          ["exit", o, n],
          ["exit", i, n],
        ]));
    return e;
  }
  function Tf(e, n, t) {
    let r = 0;
    return i;
    function i(c) {
      return (e.enter(m.atxHeading), o(c));
    }
    function o(c) {
      return (x(c === d.numberSign, "expected `#`"), e.enter(m.atxHeadingSequence), s(c));
    }
    function s(c) {
      if (c === d.numberSign && r++ < P.atxHeadingOpeningFenceSizeMax) return (e.consume(c), s);
      if (c === d.eof || ie(c)) return (e.exit(m.atxHeadingSequence), a(c));
      return t(c);
    }
    function a(c) {
      if (c === d.numberSign) return (e.enter(m.atxHeadingSequence), u(c));
      if (c === d.eof || B(c)) return (e.exit(m.atxHeading), n(c));
      if (G(c)) return Z(e, a, m.whitespace)(c);
      return (e.enter(m.atxHeadingText), l(c));
    }
    function u(c) {
      if (c === d.numberSign) return (e.consume(c), u);
      return (e.exit(m.atxHeadingSequence), a(c));
    }
    function l(c) {
      if (c === d.eof || c === d.numberSign || ie(c)) return (e.exit(m.atxHeadingText), a(c));
      return (e.consume(c), l);
    }
  }
  var Zs = [
      "address",
      "article",
      "aside",
      "base",
      "basefont",
      "blockquote",
      "body",
      "caption",
      "center",
      "col",
      "colgroup",
      "dd",
      "details",
      "dialog",
      "dir",
      "div",
      "dl",
      "dt",
      "fieldset",
      "figcaption",
      "figure",
      "footer",
      "form",
      "frame",
      "frameset",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "head",
      "header",
      "hr",
      "html",
      "iframe",
      "legend",
      "li",
      "link",
      "main",
      "menu",
      "menuitem",
      "nav",
      "noframes",
      "ol",
      "optgroup",
      "option",
      "p",
      "param",
      "search",
      "section",
      "summary",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "title",
      "tr",
      "track",
      "ul",
    ],
    Di = ["pre", "script", "style", "textarea"];
  var Bi = { concrete: !0, name: "htmlFlow", resolveTo: Mf, tokenize: Ff },
    vf = { partial: !0, tokenize: Pf },
    Af = { partial: !0, tokenize: Rf };
  function Mf(e) {
    let n = e.length;
    while (n--) if (e[n][0] === "enter" && e[n][1].type === m.htmlFlow) break;
    if (n > 1 && e[n - 2][1].type === m.linePrefix)
      ((e[n][1].start = e[n - 2][1].start),
        (e[n + 1][1].start = e[n - 2][1].start),
        e.splice(n - 2, 2));
    return e;
  }
  function Ff(e, n, t) {
    let r = this,
      i,
      o,
      s,
      a,
      u;
    return l;
    function l(y) {
      return c(y);
    }
    function c(y) {
      return (
        x(y === d.lessThan, "expected `<`"),
        e.enter(m.htmlFlow),
        e.enter(m.htmlFlowData),
        e.consume(y),
        f
      );
    }
    function f(y) {
      if (y === d.exclamationMark) return (e.consume(y), p);
      if (y === d.slash) return (e.consume(y), (o = !0), k);
      if (y === d.questionMark) return (e.consume(y), (i = P.htmlInstruction), r.interrupt ? n : w);
      if (Se(y)) return (x(y !== null), e.consume(y), (s = String.fromCharCode(y)), C);
      return t(y);
    }
    function p(y) {
      if (y === d.dash) return (e.consume(y), (i = P.htmlComment), h);
      if (y === d.leftSquareBracket) return (e.consume(y), (i = P.htmlCdata), (a = 0), g);
      if (Se(y)) return (e.consume(y), (i = P.htmlDeclaration), r.interrupt ? n : w);
      return t(y);
    }
    function h(y) {
      if (y === d.dash) return (e.consume(y), r.interrupt ? n : w);
      return t(y);
    }
    function g(y) {
      let Be = P.cdataOpeningString;
      if (y === Be.charCodeAt(a++)) {
        if ((e.consume(y), a === Be.length)) return r.interrupt ? n : ne;
        return g;
      }
      return t(y);
    }
    function k(y) {
      if (Se(y)) return (x(y !== null), e.consume(y), (s = String.fromCharCode(y)), C);
      return t(y);
    }
    function C(y) {
      if (y === d.eof || y === d.slash || y === d.greaterThan || ie(y)) {
        let Be = y === d.slash,
          Ke = s.toLowerCase();
        if (!Be && !o && Di.includes(Ke)) return ((i = P.htmlRaw), r.interrupt ? n(y) : ne(y));
        if (Zs.includes(s.toLowerCase())) {
          if (((i = P.htmlBasic), Be)) return (e.consume(y), b);
          return r.interrupt ? n(y) : ne(y);
        }
        return (
          (i = P.htmlComplete), r.interrupt && !r.parser.lazy[r.now().line] ? t(y) : o ? F(y) : M(y)
        );
      }
      if (y === d.dash || Ce(y)) return (e.consume(y), (s += String.fromCharCode(y)), C);
      return t(y);
    }
    function b(y) {
      if (y === d.greaterThan) return (e.consume(y), r.interrupt ? n : ne);
      return t(y);
    }
    function F(y) {
      if (G(y)) return (e.consume(y), F);
      return T(y);
    }
    function M(y) {
      if (y === d.slash) return (e.consume(y), T);
      if (y === d.colon || y === d.underscore || Se(y)) return (e.consume(y), q);
      if (G(y)) return (e.consume(y), M);
      return T(y);
    }
    function q(y) {
      if (y === d.dash || y === d.dot || y === d.colon || y === d.underscore || Ce(y))
        return (e.consume(y), q);
      return z(y);
    }
    function z(y) {
      if (y === d.equalsTo) return (e.consume(y), E);
      if (G(y)) return (e.consume(y), z);
      return M(y);
    }
    function E(y) {
      if (
        y === d.eof ||
        y === d.lessThan ||
        y === d.equalsTo ||
        y === d.greaterThan ||
        y === d.graveAccent
      )
        return t(y);
      if (y === d.quotationMark || y === d.apostrophe) return (e.consume(y), (u = y), _);
      if (G(y)) return (e.consume(y), E);
      return te(y);
    }
    function _(y) {
      if (y === u) return (e.consume(y), (u = null), X);
      if (y === d.eof || B(y)) return t(y);
      return (e.consume(y), _);
    }
    function te(y) {
      if (
        y === d.eof ||
        y === d.quotationMark ||
        y === d.apostrophe ||
        y === d.slash ||
        y === d.lessThan ||
        y === d.equalsTo ||
        y === d.greaterThan ||
        y === d.graveAccent ||
        ie(y)
      )
        return z(y);
      return (e.consume(y), te);
    }
    function X(y) {
      if (y === d.slash || y === d.greaterThan || G(y)) return M(y);
      return t(y);
    }
    function T(y) {
      if (y === d.greaterThan) return (e.consume(y), K);
      return t(y);
    }
    function K(y) {
      if (y === d.eof || B(y)) return ne(y);
      if (G(y)) return (e.consume(y), K);
      return t(y);
    }
    function ne(y) {
      if (y === d.dash && i === P.htmlComment) return (e.consume(y), Q);
      if (y === d.lessThan && i === P.htmlRaw) return (e.consume(y), ge);
      if (y === d.greaterThan && i === P.htmlDeclaration) return (e.consume(y), Oe);
      if (y === d.questionMark && i === P.htmlInstruction) return (e.consume(y), w);
      if (y === d.rightSquareBracket && i === P.htmlCdata) return (e.consume(y), me);
      if (B(y) && (i === P.htmlBasic || i === P.htmlComplete))
        return (e.exit(m.htmlFlowData), e.check(vf, Ge, U)(y));
      if (y === d.eof || B(y)) return (e.exit(m.htmlFlowData), U(y));
      return (e.consume(y), ne);
    }
    function U(y) {
      return e.check(Af, W, Ge)(y);
    }
    function W(y) {
      return (x(B(y)), e.enter(m.lineEnding), e.consume(y), e.exit(m.lineEnding), H);
    }
    function H(y) {
      if (y === d.eof || B(y)) return U(y);
      return (e.enter(m.htmlFlowData), ne(y));
    }
    function Q(y) {
      if (y === d.dash) return (e.consume(y), w);
      return ne(y);
    }
    function ge(y) {
      if (y === d.slash) return (e.consume(y), (s = ""), De);
      return ne(y);
    }
    function De(y) {
      if (y === d.greaterThan) {
        let Be = s.toLowerCase();
        if (Di.includes(Be)) return (e.consume(y), Oe);
        return ne(y);
      }
      if (Se(y) && s.length < P.htmlRawSizeMax)
        return (x(y !== null), e.consume(y), (s += String.fromCharCode(y)), De);
      return ne(y);
    }
    function me(y) {
      if (y === d.rightSquareBracket) return (e.consume(y), w);
      return ne(y);
    }
    function w(y) {
      if (y === d.greaterThan) return (e.consume(y), Oe);
      if (y === d.dash && i === P.htmlComment) return (e.consume(y), w);
      return ne(y);
    }
    function Oe(y) {
      if (y === d.eof || B(y)) return (e.exit(m.htmlFlowData), Ge(y));
      return (e.consume(y), Oe);
    }
    function Ge(y) {
      return (e.exit(m.htmlFlow), n(y));
    }
  }
  function Rf(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      if (B(s)) return (e.enter(m.lineEnding), e.consume(s), e.exit(m.lineEnding), o);
      return t(s);
    }
    function o(s) {
      return r.parser.lazy[r.now().line] ? t(s) : n(s);
    }
  }
  function Pf(e, n, t) {
    return r;
    function r(i) {
      return (
        x(B(i), "expected a line ending"),
        e.enter(m.lineEnding),
        e.consume(i),
        e.exit(m.lineEnding),
        e.attempt(it, n, t)
      );
    }
  }
  var Ni = { name: "htmlText", tokenize: Lf };
  function Lf(e, n, t) {
    let r = this,
      i,
      o,
      s;
    return a;
    function a(w) {
      return (
        x(w === d.lessThan, "expected `<`"),
        e.enter(m.htmlText),
        e.enter(m.htmlTextData),
        e.consume(w),
        u
      );
    }
    function u(w) {
      if (w === d.exclamationMark) return (e.consume(w), l);
      if (w === d.slash) return (e.consume(w), z);
      if (w === d.questionMark) return (e.consume(w), M);
      if (Se(w)) return (e.consume(w), te);
      return t(w);
    }
    function l(w) {
      if (w === d.dash) return (e.consume(w), c);
      if (w === d.leftSquareBracket) return (e.consume(w), (o = 0), g);
      if (Se(w)) return (e.consume(w), F);
      return t(w);
    }
    function c(w) {
      if (w === d.dash) return (e.consume(w), h);
      return t(w);
    }
    function f(w) {
      if (w === d.eof) return t(w);
      if (w === d.dash) return (e.consume(w), p);
      if (B(w)) return ((s = f), ge(w));
      return (e.consume(w), f);
    }
    function p(w) {
      if (w === d.dash) return (e.consume(w), h);
      return f(w);
    }
    function h(w) {
      return w === d.greaterThan ? Q(w) : w === d.dash ? p(w) : f(w);
    }
    function g(w) {
      let Oe = P.cdataOpeningString;
      if (w === Oe.charCodeAt(o++)) return (e.consume(w), o === Oe.length ? k : g);
      return t(w);
    }
    function k(w) {
      if (w === d.eof) return t(w);
      if (w === d.rightSquareBracket) return (e.consume(w), C);
      if (B(w)) return ((s = k), ge(w));
      return (e.consume(w), k);
    }
    function C(w) {
      if (w === d.rightSquareBracket) return (e.consume(w), b);
      return k(w);
    }
    function b(w) {
      if (w === d.greaterThan) return Q(w);
      if (w === d.rightSquareBracket) return (e.consume(w), b);
      return k(w);
    }
    function F(w) {
      if (w === d.eof || w === d.greaterThan) return Q(w);
      if (B(w)) return ((s = F), ge(w));
      return (e.consume(w), F);
    }
    function M(w) {
      if (w === d.eof) return t(w);
      if (w === d.questionMark) return (e.consume(w), q);
      if (B(w)) return ((s = M), ge(w));
      return (e.consume(w), M);
    }
    function q(w) {
      return w === d.greaterThan ? Q(w) : M(w);
    }
    function z(w) {
      if (Se(w)) return (e.consume(w), E);
      return t(w);
    }
    function E(w) {
      if (w === d.dash || Ce(w)) return (e.consume(w), E);
      return _(w);
    }
    function _(w) {
      if (B(w)) return ((s = _), ge(w));
      if (G(w)) return (e.consume(w), _);
      return Q(w);
    }
    function te(w) {
      if (w === d.dash || Ce(w)) return (e.consume(w), te);
      if (w === d.slash || w === d.greaterThan || ie(w)) return X(w);
      return t(w);
    }
    function X(w) {
      if (w === d.slash) return (e.consume(w), Q);
      if (w === d.colon || w === d.underscore || Se(w)) return (e.consume(w), T);
      if (B(w)) return ((s = X), ge(w));
      if (G(w)) return (e.consume(w), X);
      return Q(w);
    }
    function T(w) {
      if (w === d.dash || w === d.dot || w === d.colon || w === d.underscore || Ce(w))
        return (e.consume(w), T);
      return K(w);
    }
    function K(w) {
      if (w === d.equalsTo) return (e.consume(w), ne);
      if (B(w)) return ((s = K), ge(w));
      if (G(w)) return (e.consume(w), K);
      return X(w);
    }
    function ne(w) {
      if (
        w === d.eof ||
        w === d.lessThan ||
        w === d.equalsTo ||
        w === d.greaterThan ||
        w === d.graveAccent
      )
        return t(w);
      if (w === d.quotationMark || w === d.apostrophe) return (e.consume(w), (i = w), U);
      if (B(w)) return ((s = ne), ge(w));
      if (G(w)) return (e.consume(w), ne);
      return (e.consume(w), W);
    }
    function U(w) {
      if (w === i) return (e.consume(w), (i = void 0), H);
      if (w === d.eof) return t(w);
      if (B(w)) return ((s = U), ge(w));
      return (e.consume(w), U);
    }
    function W(w) {
      if (
        w === d.eof ||
        w === d.quotationMark ||
        w === d.apostrophe ||
        w === d.lessThan ||
        w === d.equalsTo ||
        w === d.graveAccent
      )
        return t(w);
      if (w === d.slash || w === d.greaterThan || ie(w)) return X(w);
      return (e.consume(w), W);
    }
    function H(w) {
      if (w === d.slash || w === d.greaterThan || ie(w)) return X(w);
      return t(w);
    }
    function Q(w) {
      if (w === d.greaterThan) return (e.consume(w), e.exit(m.htmlTextData), e.exit(m.htmlText), n);
      return t(w);
    }
    function ge(w) {
      return (
        x(s, "expected return state"),
        x(B(w), "expected eol"),
        e.exit(m.htmlTextData),
        e.enter(m.lineEnding),
        e.consume(w),
        e.exit(m.lineEnding),
        De
      );
    }
    function De(w) {
      return (
        x(r.parser.constructs.disable.null, "expected `disable.null` to be populated"),
        G(w)
          ? Z(
              e,
              me,
              m.linePrefix,
              r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize,
            )(w)
          : me(w)
      );
    }
    function me(w) {
      return (e.enter(m.htmlTextData), s(w));
    }
  }
  var Wt = { name: "labelEnd", resolveAll: zf, resolveTo: Of, tokenize: $f },
    Df = { tokenize: _f },
    Bf = { tokenize: qf },
    Nf = { tokenize: Uf };
  function zf(e) {
    let n = -1,
      t = [];
    while (++n < e.length) {
      let r = e[n][1];
      if (
        (t.push(e[n]), r.type === m.labelImage || r.type === m.labelLink || r.type === m.labelEnd)
      ) {
        let i = r.type === m.labelImage ? 4 : 2;
        ((r.type = m.data), (n += i));
      }
    }
    if (e.length !== t.length) we(e, 0, e.length, t);
    return e;
  }
  function Of(e, n) {
    let t = e.length,
      r = 0,
      i,
      o,
      s,
      a;
    while (t--)
      if (((i = e[t][1]), o)) {
        if (i.type === m.link || (i.type === m.labelLink && i._inactive)) break;
        if (e[t][0] === "enter" && i.type === m.labelLink) i._inactive = !0;
      } else if (s) {
        if (
          e[t][0] === "enter" &&
          (i.type === m.labelImage || i.type === m.labelLink) &&
          !i._balanced
        ) {
          if (((o = t), i.type !== m.labelLink)) {
            r = 2;
            break;
          }
        }
      } else if (i.type === m.labelEnd) s = t;
    (x(o !== void 0, "`open` is supposed to be found"),
      x(s !== void 0, "`close` is supposed to be found"));
    let u = {
        type: e[o][1].type === m.labelLink ? m.link : m.image,
        start: { ...e[o][1].start },
        end: { ...e[e.length - 1][1].end },
      },
      l = { type: m.label, start: { ...e[o][1].start }, end: { ...e[s][1].end } },
      c = { type: m.labelText, start: { ...e[o + r + 2][1].end }, end: { ...e[s - 2][1].start } };
    return (
      (a = [
        ["enter", u, n],
        ["enter", l, n],
      ]),
      (a = Ne(a, e.slice(o + 1, o + r + 3))),
      (a = Ne(a, [["enter", c, n]])),
      x(n.parser.constructs.insideSpan.null, "expected `insideSpan.null` to be populated"),
      (a = Ne(a, Mt(n.parser.constructs.insideSpan.null, e.slice(o + r + 4, s - 3), n))),
      (a = Ne(a, [["exit", c, n], e[s - 2], e[s - 1], ["exit", l, n]])),
      (a = Ne(a, e.slice(s + 1))),
      (a = Ne(a, [["exit", u, n]])),
      we(e, o, e.length, a),
      e
    );
  }
  function $f(e, n, t) {
    let r = this,
      i = r.events.length,
      o,
      s;
    while (i--)
      if (
        (r.events[i][1].type === m.labelImage || r.events[i][1].type === m.labelLink) &&
        !r.events[i][1]._balanced
      ) {
        o = r.events[i][1];
        break;
      }
    return a;
    function a(p) {
      if ((x(p === d.rightSquareBracket, "expected `]`"), !o)) return t(p);
      if (o._inactive) return f(p);
      return (
        (s = r.parser.defined.includes(Pe(r.sliceSerialize({ start: o.end, end: r.now() })))),
        e.enter(m.labelEnd),
        e.enter(m.labelMarker),
        e.consume(p),
        e.exit(m.labelMarker),
        e.exit(m.labelEnd),
        u
      );
    }
    function u(p) {
      if (p === d.leftParenthesis) return e.attempt(Df, c, s ? c : f)(p);
      if (p === d.leftSquareBracket) return e.attempt(Bf, c, s ? l : f)(p);
      return s ? c(p) : f(p);
    }
    function l(p) {
      return e.attempt(Nf, c, f)(p);
    }
    function c(p) {
      return n(p);
    }
    function f(p) {
      return ((o._balanced = !0), t(p));
    }
  }
  function _f(e, n, t) {
    return r;
    function r(f) {
      return (
        x(f === d.leftParenthesis, "expected left paren"),
        e.enter(m.resource),
        e.enter(m.resourceMarker),
        e.consume(f),
        e.exit(m.resourceMarker),
        i
      );
    }
    function i(f) {
      return ie(f) ? jt(e, o)(f) : o(f);
    }
    function o(f) {
      if (f === d.rightParenthesis) return c(f);
      return ur(
        e,
        s,
        a,
        m.resourceDestination,
        m.resourceDestinationLiteral,
        m.resourceDestinationLiteralMarker,
        m.resourceDestinationRaw,
        m.resourceDestinationString,
        P.linkResourceDestinationBalanceMax,
      )(f);
    }
    function s(f) {
      return ie(f) ? jt(e, u)(f) : c(f);
    }
    function a(f) {
      return t(f);
    }
    function u(f) {
      if (f === d.quotationMark || f === d.apostrophe || f === d.leftParenthesis)
        return cr(e, l, t, m.resourceTitle, m.resourceTitleMarker, m.resourceTitleString)(f);
      return c(f);
    }
    function l(f) {
      return ie(f) ? jt(e, c)(f) : c(f);
    }
    function c(f) {
      if (f === d.rightParenthesis)
        return (
          e.enter(m.resourceMarker), e.consume(f), e.exit(m.resourceMarker), e.exit(m.resource), n
        );
      return t(f);
    }
  }
  function qf(e, n, t) {
    let r = this;
    return i;
    function i(a) {
      return (
        x(a === d.leftSquareBracket, "expected left bracket"),
        lr.call(r, e, o, s, m.reference, m.referenceMarker, m.referenceString)(a)
      );
    }
    function o(a) {
      return r.parser.defined.includes(
        Pe(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1)),
      )
        ? n(a)
        : t(a);
    }
    function s(a) {
      return t(a);
    }
  }
  function Uf(e, n, t) {
    return r;
    function r(o) {
      return (
        x(o === d.leftSquareBracket, "expected left bracket"),
        e.enter(m.reference),
        e.enter(m.referenceMarker),
        e.consume(o),
        e.exit(m.referenceMarker),
        i
      );
    }
    function i(o) {
      if (o === d.rightSquareBracket)
        return (
          e.enter(m.referenceMarker),
          e.consume(o),
          e.exit(m.referenceMarker),
          e.exit(m.reference),
          n
        );
      return t(o);
    }
  }
  var zi = { name: "labelStartImage", resolveAll: Wt.resolveAll, tokenize: Vf };
  function Vf(e, n, t) {
    let r = this;
    return i;
    function i(a) {
      return (
        x(a === d.exclamationMark, "expected `!`"),
        e.enter(m.labelImage),
        e.enter(m.labelImageMarker),
        e.consume(a),
        e.exit(m.labelImageMarker),
        o
      );
    }
    function o(a) {
      if (a === d.leftSquareBracket)
        return (
          e.enter(m.labelMarker), e.consume(a), e.exit(m.labelMarker), e.exit(m.labelImage), s
        );
      return t(a);
    }
    function s(a) {
      return a === d.caret && "_hiddenFootnoteSupport" in r.parser.constructs ? t(a) : n(a);
    }
  }
  var Oi = { name: "labelStartLink", resolveAll: Wt.resolveAll, tokenize: Hf };
  function Hf(e, n, t) {
    let r = this;
    return i;
    function i(s) {
      return (
        x(s === d.leftSquareBracket, "expected `[`"),
        e.enter(m.labelLink),
        e.enter(m.labelMarker),
        e.consume(s),
        e.exit(m.labelMarker),
        e.exit(m.labelLink),
        o
      );
    }
    function o(s) {
      return s === d.caret && "_hiddenFootnoteSupport" in r.parser.constructs ? t(s) : n(s);
    }
  }
  var Pn = { name: "lineEnding", tokenize: jf };
  function jf(e, n) {
    return t;
    function t(r) {
      return (
        x(B(r), "expected eol"),
        e.enter(m.lineEnding),
        e.consume(r),
        e.exit(m.lineEnding),
        Z(e, n, m.linePrefix)
      );
    }
  }
  var Gt = { name: "thematicBreak", tokenize: Wf };
  function Wf(e, n, t) {
    let r = 0,
      i;
    return o;
    function o(l) {
      return (e.enter(m.thematicBreak), s(l));
    }
    function s(l) {
      return (
        x(l === d.asterisk || l === d.dash || l === d.underscore, "expected `*`, `-`, or `_`"),
        (i = l),
        a(l)
      );
    }
    function a(l) {
      if (l === i) return (e.enter(m.thematicBreakSequence), u(l));
      if (r >= P.thematicBreakMarkerCountMin && (l === d.eof || B(l)))
        return (e.exit(m.thematicBreak), n(l));
      return t(l);
    }
    function u(l) {
      if (l === i) return (e.consume(l), r++, u);
      return (e.exit(m.thematicBreakSequence), G(l) ? Z(e, a, m.whitespace)(l) : a(l));
    }
  }
  var Le = { continuation: { tokenize: Yf }, exit: Xf, name: "list", tokenize: Qf },
    Gf = { partial: !0, tokenize: Jf },
    Zf = { partial: !0, tokenize: Kf };
  function Qf(e, n, t) {
    let r = this,
      i = r.events[r.events.length - 1],
      o = i && i[1].type === m.linePrefix ? i[2].sliceSerialize(i[1], !0).length : 0,
      s = 0;
    return a;
    function a(h) {
      x(r.containerState, "expected state");
      let g =
        r.containerState.type ||
        (h === d.asterisk || h === d.plusSign || h === d.dash ? m.listUnordered : m.listOrdered);
      if (
        g === m.listUnordered ? !r.containerState.marker || h === r.containerState.marker : Tn(h)
      ) {
        if (!r.containerState.type) ((r.containerState.type = g), e.enter(g, { _container: !0 }));
        if (g === m.listUnordered)
          return (
            e.enter(m.listItemPrefix),
            h === d.asterisk || h === d.dash ? e.check(Gt, t, l)(h) : l(h)
          );
        if (!r.interrupt || h === d.digit1)
          return (e.enter(m.listItemPrefix), e.enter(m.listItemValue), u(h));
      }
      return t(h);
    }
    function u(h) {
      if ((x(r.containerState, "expected state"), Tn(h) && ++s < P.listItemValueSizeMax))
        return (e.consume(h), u);
      if (
        (!r.interrupt || s < 2) &&
        (r.containerState.marker
          ? h === r.containerState.marker
          : h === d.rightParenthesis || h === d.dot)
      )
        return (e.exit(m.listItemValue), l(h));
      return t(h);
    }
    function l(h) {
      return (
        x(r.containerState, "expected state"),
        x(h !== d.eof, "eof (`null`) is not a marker"),
        e.enter(m.listItemMarker),
        e.consume(h),
        e.exit(m.listItemMarker),
        (r.containerState.marker = r.containerState.marker || h),
        e.check(it, r.interrupt ? t : c, e.attempt(Gf, p, f))
      );
    }
    function c(h) {
      return (
        x(r.containerState, "expected state"), (r.containerState.initialBlankLine = !0), o++, p(h)
      );
    }
    function f(h) {
      if (G(h))
        return (
          e.enter(m.listItemPrefixWhitespace), e.consume(h), e.exit(m.listItemPrefixWhitespace), p
        );
      return t(h);
    }
    function p(h) {
      return (
        x(r.containerState, "expected state"),
        (r.containerState.size = o + r.sliceSerialize(e.exit(m.listItemPrefix), !0).length),
        n(h)
      );
    }
  }
  function Yf(e, n, t) {
    let r = this;
    return (
      x(r.containerState, "expected state"),
      (r.containerState._closeFlow = void 0),
      e.check(it, i, o)
    );
    function i(a) {
      return (
        x(r.containerState, "expected state"),
        x(typeof r.containerState.size === "number", "expected size"),
        (r.containerState.furtherBlankLines =
          r.containerState.furtherBlankLines || r.containerState.initialBlankLine),
        Z(e, n, m.listItemIndent, r.containerState.size + 1)(a)
      );
    }
    function o(a) {
      if ((x(r.containerState, "expected state"), r.containerState.furtherBlankLines || !G(a)))
        return (
          (r.containerState.furtherBlankLines = void 0),
          (r.containerState.initialBlankLine = void 0),
          s(a)
        );
      return (
        (r.containerState.furtherBlankLines = void 0),
        (r.containerState.initialBlankLine = void 0),
        e.attempt(Zf, n, s)(a)
      );
    }
    function s(a) {
      return (
        x(r.containerState, "expected state"),
        (r.containerState._closeFlow = !0),
        (r.interrupt = void 0),
        x(r.parser.constructs.disable.null, "expected `disable.null` to be populated"),
        Z(
          e,
          e.attempt(Le, n, t),
          m.linePrefix,
          r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize,
        )(a)
      );
    }
  }
  function Kf(e, n, t) {
    let r = this;
    return (
      x(r.containerState, "expected state"),
      x(typeof r.containerState.size === "number", "expected size"),
      Z(e, i, m.listItemIndent, r.containerState.size + 1)
    );
    function i(o) {
      x(r.containerState, "expected state");
      let s = r.events[r.events.length - 1];
      return s &&
        s[1].type === m.listItemIndent &&
        s[2].sliceSerialize(s[1], !0).length === r.containerState.size
        ? n(o)
        : t(o);
    }
  }
  function Xf(e) {
    (x(this.containerState, "expected state"),
      x(typeof this.containerState.type === "string", "expected type"),
      e.exit(this.containerState.type));
  }
  function Jf(e, n, t) {
    let r = this;
    return (
      x(r.parser.constructs.disable.null, "expected `disable.null` to be populated"),
      Z(
        e,
        i,
        m.listItemPrefixWhitespace,
        r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize + 1,
      )
    );
    function i(o) {
      let s = r.events[r.events.length - 1];
      return !G(o) && s && s[1].type === m.listItemPrefixWhitespace ? n(o) : t(o);
    }
  }
  var fr = { name: "setextUnderline", resolveTo: ed, tokenize: td };
  function ed(e, n) {
    let t = e.length,
      r,
      i,
      o;
    while (t--)
      if (e[t][0] === "enter") {
        if (e[t][1].type === m.content) {
          r = t;
          break;
        }
        if (e[t][1].type === m.paragraph) i = t;
      } else {
        if (e[t][1].type === m.content) e.splice(t, 1);
        if (!o && e[t][1].type === m.definition) o = t;
      }
    (x(i !== void 0, "expected a `text` index to be found"),
      x(r !== void 0, "expected a `text` index to be found"),
      x(e[r][2] === n, "enter context should be same"),
      x(e[e.length - 1][2] === n, "enter context should be same"));
    let s = {
      type: m.setextHeading,
      start: { ...e[r][1].start },
      end: { ...e[e.length - 1][1].end },
    };
    if (((e[i][1].type = m.setextHeadingText), o))
      (e.splice(i, 0, ["enter", s, n]),
        e.splice(o + 1, 0, ["exit", e[r][1], n]),
        (e[r][1].end = { ...e[o][1].end }));
    else e[r][1] = s;
    return (e.push(["exit", s, n]), e);
  }
  function td(e, n, t) {
    let r = this,
      i;
    return o;
    function o(l) {
      let c = r.events.length,
        f;
      x(l === d.dash || l === d.equalsTo, "expected `=` or `-`");
      while (c--)
        if (
          r.events[c][1].type !== m.lineEnding &&
          r.events[c][1].type !== m.linePrefix &&
          r.events[c][1].type !== m.content
        ) {
          f = r.events[c][1].type === m.paragraph;
          break;
        }
      if (!r.parser.lazy[r.now().line] && (r.interrupt || f))
        return (e.enter(m.setextHeadingLine), (i = l), s(l));
      return t(l);
    }
    function s(l) {
      return (e.enter(m.setextHeadingLineSequence), a(l));
    }
    function a(l) {
      if (l === i) return (e.consume(l), a);
      return (e.exit(m.setextHeadingLineSequence), G(l) ? Z(e, u, m.lineSuffix)(l) : u(l));
    }
    function u(l) {
      if (l === d.eof || B(l)) return (e.exit(m.setextHeadingLine), n(l));
      return t(l);
    }
  }
  var nd = { tokenize: ld, partial: !0 };
  function $i() {
    return {
      document: {
        [d.leftSquareBracket]: {
          name: "gfmFootnoteDefinition",
          tokenize: sd,
          continuation: { tokenize: ad },
          exit: ud,
        },
      },
      text: {
        [d.leftSquareBracket]: { name: "gfmFootnoteCall", tokenize: od },
        [d.rightSquareBracket]: {
          name: "gfmPotentialFootnoteCall",
          add: "after",
          tokenize: rd,
          resolveTo: id,
        },
      },
    };
  }
  function rd(e, n, t) {
    let r = this,
      i = r.events.length,
      o = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []),
      s;
    while (i--) {
      let u = r.events[i][1];
      if (u.type === m.labelImage) {
        s = u;
        break;
      }
      if (
        u.type === "gfmFootnoteCall" ||
        u.type === m.labelLink ||
        u.type === m.label ||
        u.type === m.image ||
        u.type === m.link
      )
        break;
    }
    return a;
    function a(u) {
      if ((x(u === d.rightSquareBracket, "expected `]`"), !s || !s._balanced)) return t(u);
      let l = Pe(r.sliceSerialize({ start: s.end, end: r.now() }));
      if (l.codePointAt(0) !== d.caret || !o.includes(l.slice(1))) return t(u);
      return (
        e.enter("gfmFootnoteCallLabelMarker"),
        e.consume(u),
        e.exit("gfmFootnoteCallLabelMarker"),
        n(u)
      );
    }
  }
  function id(e, n) {
    let t = e.length,
      r;
    while (t--)
      if (e[t][1].type === m.labelImage && e[t][0] === "enter") {
        r = e[t][1];
        break;
      }
    (x(r, "expected `labelStart` to resolve"),
      (e[t + 1][1].type = m.data),
      (e[t + 3][1].type = "gfmFootnoteCallLabelMarker"));
    let i = {
        type: "gfmFootnoteCall",
        start: Object.assign({}, e[t + 3][1].start),
        end: Object.assign({}, e[e.length - 1][1].end),
      },
      o = {
        type: "gfmFootnoteCallMarker",
        start: Object.assign({}, e[t + 3][1].end),
        end: Object.assign({}, e[t + 3][1].end),
      };
    (o.end.column++, o.end.offset++, o.end._bufferIndex++);
    let s = {
        type: "gfmFootnoteCallString",
        start: Object.assign({}, o.end),
        end: Object.assign({}, e[e.length - 1][1].start),
      },
      a = {
        type: m.chunkString,
        contentType: "string",
        start: Object.assign({}, s.start),
        end: Object.assign({}, s.end),
      },
      u = [
        e[t + 1],
        e[t + 2],
        ["enter", i, n],
        e[t + 3],
        e[t + 4],
        ["enter", o, n],
        ["exit", o, n],
        ["enter", s, n],
        ["enter", a, n],
        ["exit", a, n],
        ["exit", s, n],
        e[e.length - 2],
        e[e.length - 1],
        ["exit", i, n],
      ];
    return (e.splice(t, e.length - t + 1, ...u), e);
  }
  function od(e, n, t) {
    let r = this,
      i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []),
      o = 0,
      s;
    return a;
    function a(f) {
      return (
        x(f === d.leftSquareBracket, "expected `[`"),
        e.enter("gfmFootnoteCall"),
        e.enter("gfmFootnoteCallLabelMarker"),
        e.consume(f),
        e.exit("gfmFootnoteCallLabelMarker"),
        u
      );
    }
    function u(f) {
      if (f !== d.caret) return t(f);
      return (
        e.enter("gfmFootnoteCallMarker"),
        e.consume(f),
        e.exit("gfmFootnoteCallMarker"),
        e.enter("gfmFootnoteCallString"),
        (e.enter("chunkString").contentType = "string"),
        l
      );
    }
    function l(f) {
      if (
        o > P.linkReferenceSizeMax ||
        (f === d.rightSquareBracket && !s) ||
        f === d.eof ||
        f === d.leftSquareBracket ||
        ie(f)
      )
        return t(f);
      if (f === d.rightSquareBracket) {
        e.exit("chunkString");
        let p = e.exit("gfmFootnoteCallString");
        if (!i.includes(Pe(r.sliceSerialize(p)))) return t(f);
        return (
          e.enter("gfmFootnoteCallLabelMarker"),
          e.consume(f),
          e.exit("gfmFootnoteCallLabelMarker"),
          e.exit("gfmFootnoteCall"),
          n
        );
      }
      if (!ie(f)) s = !0;
      return (o++, e.consume(f), f === d.backslash ? c : l);
    }
    function c(f) {
      if (f === d.leftSquareBracket || f === d.backslash || f === d.rightSquareBracket)
        return (e.consume(f), o++, l);
      return l(f);
    }
  }
  function sd(e, n, t) {
    let r = this,
      i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []),
      o,
      s = 0,
      a;
    return u;
    function u(g) {
      return (
        x(g === d.leftSquareBracket, "expected `[`"),
        (e.enter("gfmFootnoteDefinition")._container = !0),
        e.enter("gfmFootnoteDefinitionLabel"),
        e.enter("gfmFootnoteDefinitionLabelMarker"),
        e.consume(g),
        e.exit("gfmFootnoteDefinitionLabelMarker"),
        l
      );
    }
    function l(g) {
      if (g === d.caret)
        return (
          e.enter("gfmFootnoteDefinitionMarker"),
          e.consume(g),
          e.exit("gfmFootnoteDefinitionMarker"),
          e.enter("gfmFootnoteDefinitionLabelString"),
          (e.enter("chunkString").contentType = "string"),
          c
        );
      return t(g);
    }
    function c(g) {
      if (
        s > P.linkReferenceSizeMax ||
        (g === d.rightSquareBracket && !a) ||
        g === d.eof ||
        g === d.leftSquareBracket ||
        ie(g)
      )
        return t(g);
      if (g === d.rightSquareBracket) {
        e.exit("chunkString");
        let k = e.exit("gfmFootnoteDefinitionLabelString");
        return (
          (o = Pe(r.sliceSerialize(k))),
          e.enter("gfmFootnoteDefinitionLabelMarker"),
          e.consume(g),
          e.exit("gfmFootnoteDefinitionLabelMarker"),
          e.exit("gfmFootnoteDefinitionLabel"),
          p
        );
      }
      if (!ie(g)) a = !0;
      return (s++, e.consume(g), g === d.backslash ? f : c);
    }
    function f(g) {
      if (g === d.leftSquareBracket || g === d.backslash || g === d.rightSquareBracket)
        return (e.consume(g), s++, c);
      return c(g);
    }
    function p(g) {
      if (g === d.colon) {
        if ((e.enter("definitionMarker"), e.consume(g), e.exit("definitionMarker"), !i.includes(o)))
          i.push(o);
        return Z(e, h, "gfmFootnoteDefinitionWhitespace");
      }
      return t(g);
    }
    function h(g) {
      return n(g);
    }
  }
  function ad(e, n, t) {
    return e.check(it, n, e.attempt(nd, n, t));
  }
  function ud(e) {
    e.exit("gfmFootnoteDefinition");
  }
  function ld(e, n, t) {
    let r = this;
    return Z(e, i, "gfmFootnoteDefinitionIndent", P.tabSize + 1);
    function i(o) {
      let s = r.events[r.events.length - 1];
      return s &&
        s[1].type === "gfmFootnoteDefinitionIndent" &&
        s[2].sliceSerialize(s[1], !0).length === P.tabSize
        ? n(o)
        : t(o);
    }
  }
  function _i(e) {
    let t = (e || {}).singleTilde,
      r = { name: "strikethrough", tokenize: o, resolveAll: i };
    if (t === null || t === void 0) t = !0;
    return {
      text: { [d.tilde]: r },
      insideSpan: { null: [r] },
      attentionMarkers: { null: [d.tilde] },
    };
    function i(s, a) {
      let u = -1;
      while (++u < s.length)
        if (
          s[u][0] === "enter" &&
          s[u][1].type === "strikethroughSequenceTemporary" &&
          s[u][1]._close
        ) {
          let l = u;
          while (l--)
            if (
              s[l][0] === "exit" &&
              s[l][1].type === "strikethroughSequenceTemporary" &&
              s[l][1]._open &&
              s[u][1].end.offset - s[u][1].start.offset ===
                s[l][1].end.offset - s[l][1].start.offset
            ) {
              ((s[u][1].type = "strikethroughSequence"), (s[l][1].type = "strikethroughSequence"));
              let c = {
                  type: "strikethrough",
                  start: Object.assign({}, s[l][1].start),
                  end: Object.assign({}, s[u][1].end),
                },
                f = {
                  type: "strikethroughText",
                  start: Object.assign({}, s[l][1].end),
                  end: Object.assign({}, s[u][1].start),
                },
                p = [
                  ["enter", c, a],
                  ["enter", s[l][1], a],
                  ["exit", s[l][1], a],
                  ["enter", f, a],
                ],
                h = a.parser.constructs.insideSpan.null;
              if (h) we(p, p.length, 0, Mt(h, s.slice(l + 1, u), a));
              (we(p, p.length, 0, [
                ["exit", f, a],
                ["enter", s[u][1], a],
                ["exit", s[u][1], a],
                ["exit", c, a],
              ]),
                we(s, l - 1, u - l + 3, p),
                (u = l + p.length - 2));
              break;
            }
        }
      u = -1;
      while (++u < s.length)
        if (s[u][1].type === "strikethroughSequenceTemporary") s[u][1].type = m.data;
      return s;
    }
    function o(s, a, u) {
      let l = this.previous,
        c = this.events,
        f = 0;
      return p;
      function p(g) {
        if (
          (x(g === d.tilde, "expected `~`"),
          l === d.tilde && c[c.length - 1][1].type !== m.characterEscape)
        )
          return u(g);
        return (s.enter("strikethroughSequenceTemporary"), h(g));
      }
      function h(g) {
        let k = ht(l);
        if (g === d.tilde) {
          if (f > 1) return u(g);
          return (s.consume(g), f++, h);
        }
        if (f < 2 && !t) return u(g);
        let C = s.exit("strikethroughSequenceTemporary"),
          b = ht(g);
        return (
          (C._open = !b || (b === P.attentionSideAfter && Boolean(k))),
          (C._close = !k || (k === P.attentionSideAfter && Boolean(b))),
          a(g)
        );
      }
    }
  }
  class qi {
    constructor() {
      this.map = [];
    }
    add(e, n, t) {
      cd(this, e, n, t);
    }
    consume(e) {
      if (
        (this.map.sort(function (i, o) {
          return i[0] - o[0];
        }),
        this.map.length === 0)
      )
        return;
      let n = this.map.length,
        t = [];
      while (n > 0)
        ((n -= 1),
          t.push(e.slice(this.map[n][0] + this.map[n][1]), this.map[n][2]),
          (e.length = this.map[n][0]));
      (t.push(e.slice()), (e.length = 0));
      let r = t.pop();
      while (r) {
        for (let i of r) e.push(i);
        r = t.pop();
      }
      this.map.length = 0;
    }
  }
  function cd(e, n, t, r) {
    let i = 0;
    if (t === 0 && r.length === 0) return;
    while (i < e.map.length) {
      if (e.map[i][0] === n) {
        ((e.map[i][1] += t), e.map[i][2].push(...r));
        return;
      }
      i += 1;
    }
    e.map.push([n, t, r]);
  }
  function Qs(e, n) {
    x(e[n][1].type === "table", "expected table");
    let t = !1,
      r = [];
    while (n < e.length) {
      let i = e[n];
      if (t) {
        if (i[0] === "enter") {
          if (i[1].type === "tableContent")
            r.push(e[n + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
        } else if (i[1].type === "tableContent") {
          if (e[n - 1][1].type === "tableDelimiterMarker") {
            let o = r.length - 1;
            r[o] = r[o] === "left" ? "center" : "right";
          }
        } else if (i[1].type === "tableDelimiterRow") break;
      } else if (i[0] === "enter" && i[1].type === "tableDelimiterRow") t = !0;
      n += 1;
    }
    return r;
  }
  function Ui() {
    return { flow: { null: { name: "table", tokenize: fd, resolveAll: dd } } };
  }
  function fd(e, n, t) {
    let r = this,
      i = 0,
      o = 0,
      s;
    return a;
    function a(T) {
      let K = r.events.length - 1;
      while (K > -1) {
        let W = r.events[K][1].type;
        if (W === m.lineEnding || W === m.linePrefix) K--;
        else break;
      }
      let ne = K > -1 ? r.events[K][1].type : null,
        U = ne === "tableHead" || ne === "tableRow" ? E : u;
      if (U === E && r.parser.lazy[r.now().line]) return t(T);
      return U(T);
    }
    function u(T) {
      return (e.enter("tableHead"), e.enter("tableRow"), l(T));
    }
    function l(T) {
      if (T === d.verticalBar) return c(T);
      return ((s = !0), (o += 1), c(T));
    }
    function c(T) {
      if (T === d.eof) return t(T);
      if (B(T)) {
        if (o > 1)
          return (
            (o = 0),
            (r.interrupt = !0),
            e.exit("tableRow"),
            e.enter(m.lineEnding),
            e.consume(T),
            e.exit(m.lineEnding),
            h
          );
        return t(T);
      }
      if (G(T)) return Z(e, c, m.whitespace)(T);
      if (((o += 1), s)) ((s = !1), (i += 1));
      if (T === d.verticalBar)
        return (e.enter("tableCellDivider"), e.consume(T), e.exit("tableCellDivider"), (s = !0), c);
      return (e.enter(m.data), f(T));
    }
    function f(T) {
      if (T === d.eof || T === d.verticalBar || ie(T)) return (e.exit(m.data), c(T));
      return (e.consume(T), T === d.backslash ? p : f);
    }
    function p(T) {
      if (T === d.backslash || T === d.verticalBar) return (e.consume(T), f);
      return f(T);
    }
    function h(T) {
      if (((r.interrupt = !1), r.parser.lazy[r.now().line])) return t(T);
      if ((e.enter("tableDelimiterRow"), (s = !1), G(T)))
        return (
          x(r.parser.constructs.disable.null, "expected `disabled.null`"),
          Z(
            e,
            g,
            m.linePrefix,
            r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize,
          )(T)
        );
      return g(T);
    }
    function g(T) {
      if (T === d.dash || T === d.colon) return C(T);
      if (T === d.verticalBar)
        return ((s = !0), e.enter("tableCellDivider"), e.consume(T), e.exit("tableCellDivider"), k);
      return z(T);
    }
    function k(T) {
      if (G(T)) return Z(e, C, m.whitespace)(T);
      return C(T);
    }
    function C(T) {
      if (T === d.colon)
        return (
          (o += 1),
          (s = !0),
          e.enter("tableDelimiterMarker"),
          e.consume(T),
          e.exit("tableDelimiterMarker"),
          b
        );
      if (T === d.dash) return ((o += 1), b(T));
      if (T === d.eof || B(T)) return q(T);
      return z(T);
    }
    function b(T) {
      if (T === d.dash) return (e.enter("tableDelimiterFiller"), F(T));
      return z(T);
    }
    function F(T) {
      if (T === d.dash) return (e.consume(T), F);
      if (T === d.colon)
        return (
          (s = !0),
          e.exit("tableDelimiterFiller"),
          e.enter("tableDelimiterMarker"),
          e.consume(T),
          e.exit("tableDelimiterMarker"),
          M
        );
      return (e.exit("tableDelimiterFiller"), M(T));
    }
    function M(T) {
      if (G(T)) return Z(e, q, m.whitespace)(T);
      return q(T);
    }
    function q(T) {
      if (T === d.verticalBar) return g(T);
      if (T === d.eof || B(T)) {
        if (!s || i !== o) return z(T);
        return (e.exit("tableDelimiterRow"), e.exit("tableHead"), n(T));
      }
      return z(T);
    }
    function z(T) {
      return t(T);
    }
    function E(T) {
      return (e.enter("tableRow"), _(T));
    }
    function _(T) {
      if (T === d.verticalBar)
        return (e.enter("tableCellDivider"), e.consume(T), e.exit("tableCellDivider"), _);
      if (T === d.eof || B(T)) return (e.exit("tableRow"), n(T));
      if (G(T)) return Z(e, _, m.whitespace)(T);
      return (e.enter(m.data), te(T));
    }
    function te(T) {
      if (T === d.eof || T === d.verticalBar || ie(T)) return (e.exit(m.data), _(T));
      return (e.consume(T), T === d.backslash ? X : te);
    }
    function X(T) {
      if (T === d.backslash || T === d.verticalBar) return (e.consume(T), te);
      return te(T);
    }
  }
  function dd(e, n) {
    let t = -1,
      r = !0,
      i = 0,
      o = [0, 0, 0, 0],
      s = [0, 0, 0, 0],
      a = !1,
      u = 0,
      l,
      c,
      f,
      p = new qi();
    while (++t < e.length) {
      let h = e[t],
        g = h[1];
      if (h[0] === "enter") {
        if (g.type === "tableHead") {
          if (((a = !1), u !== 0))
            (x(l, "there should be a table opening"), Ys(p, n, u, l, c), (c = void 0), (u = 0));
          ((l = {
            type: "table",
            start: Object.assign({}, g.start),
            end: Object.assign({}, g.end),
          }),
            p.add(t, 0, [["enter", l, n]]));
        } else if (g.type === "tableRow" || g.type === "tableDelimiterRow") {
          if (((r = !0), (f = void 0), (o = [0, 0, 0, 0]), (s = [0, t + 1, 0, 0]), a))
            ((a = !1),
              (c = {
                type: "tableBody",
                start: Object.assign({}, g.start),
                end: Object.assign({}, g.end),
              }),
              p.add(t, 0, [["enter", c, n]]));
          i = g.type === "tableDelimiterRow" ? 2 : c ? 3 : 1;
        } else if (
          i &&
          (g.type === m.data ||
            g.type === "tableDelimiterMarker" ||
            g.type === "tableDelimiterFiller")
        ) {
          if (((r = !1), s[2] === 0)) {
            if (o[1] !== 0) ((s[0] = s[1]), (f = dr(p, n, o, i, void 0, f)), (o = [0, 0, 0, 0]));
            s[2] = t;
          }
        } else if (g.type === "tableCellDivider")
          if (r) r = !1;
          else {
            if (o[1] !== 0) ((s[0] = s[1]), (f = dr(p, n, o, i, void 0, f)));
            ((o = s), (s = [o[1], t, 0, 0]));
          }
      } else if (g.type === "tableHead") ((a = !0), (u = t));
      else if (g.type === "tableRow" || g.type === "tableDelimiterRow") {
        if (((u = t), o[1] !== 0)) ((s[0] = s[1]), (f = dr(p, n, o, i, t, f)));
        else if (s[1] !== 0) f = dr(p, n, s, i, t, f);
        i = 0;
      } else if (
        i &&
        (g.type === m.data ||
          g.type === "tableDelimiterMarker" ||
          g.type === "tableDelimiterFiller")
      )
        s[3] = t;
    }
    if (u !== 0) (x(l, "expected table opening"), Ys(p, n, u, l, c));
    (p.consume(n.events), (t = -1));
    while (++t < n.events.length) {
      let h = n.events[t];
      if (h[0] === "enter" && h[1].type === "table") h[1]._align = Qs(n.events, t);
    }
    return e;
  }
  function dr(e, n, t, r, i, o) {
    let s = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData",
      a = "tableContent";
    if (t[0] !== 0)
      (x(o, "expected previous cell enter"),
        (o.end = Object.assign({}, cn(n.events, t[0]))),
        e.add(t[0], 0, [["exit", o, n]]));
    let u = cn(n.events, t[1]);
    if (
      ((o = { type: s, start: Object.assign({}, u), end: Object.assign({}, u) }),
      e.add(t[1], 0, [["enter", o, n]]),
      t[2] !== 0)
    ) {
      let l = cn(n.events, t[2]),
        c = cn(n.events, t[3]),
        f = { type: "tableContent", start: Object.assign({}, l), end: Object.assign({}, c) };
      if ((e.add(t[2], 0, [["enter", f, n]]), x(t[3] !== 0), r !== 2)) {
        let p = n.events[t[2]],
          h = n.events[t[3]];
        if (
          ((p[1].end = Object.assign({}, h[1].end)),
          (p[1].type = m.chunkText),
          (p[1].contentType = P.contentTypeText),
          t[3] > t[2] + 1)
        ) {
          let g = t[2] + 1,
            k = t[3] - t[2] - 1;
          e.add(g, k, []);
        }
      }
      e.add(t[3] + 1, 0, [["exit", f, n]]);
    }
    if (i !== void 0)
      ((o.end = Object.assign({}, cn(n.events, i))), e.add(i, 0, [["exit", o, n]]), (o = void 0));
    return o;
  }
  function Ys(e, n, t, r, i) {
    let o = [],
      s = cn(n.events, t);
    if (i) ((i.end = Object.assign({}, s)), o.push(["exit", i, n]));
    ((r.end = Object.assign({}, s)), o.push(["exit", r, n]), e.add(t + 1, 0, o));
  }
  function cn(e, n) {
    let t = e[n],
      r = t[0] === "enter" ? "start" : "end";
    return t[1][r];
  }
  var pd = { name: "tasklistCheck", tokenize: hd };
  function Vi() {
    return { text: { [d.leftSquareBracket]: pd } };
  }
  function hd(e, n, t) {
    let r = this;
    return i;
    function i(u) {
      if (
        (x(u === d.leftSquareBracket, "expected `[`"),
        r.previous !== d.eof || !r._gfmTasklistFirstContentOfListItem)
      )
        return t(u);
      return (
        e.enter("taskListCheck"),
        e.enter("taskListCheckMarker"),
        e.consume(u),
        e.exit("taskListCheckMarker"),
        o
      );
    }
    function o(u) {
      if (ie(u))
        return (
          e.enter("taskListCheckValueUnchecked"),
          e.consume(u),
          e.exit("taskListCheckValueUnchecked"),
          s
        );
      if (u === d.uppercaseX || u === d.lowercaseX)
        return (
          e.enter("taskListCheckValueChecked"), e.consume(u), e.exit("taskListCheckValueChecked"), s
        );
      return t(u);
    }
    function s(u) {
      if (u === d.rightSquareBracket)
        return (
          e.enter("taskListCheckMarker"),
          e.consume(u),
          e.exit("taskListCheckMarker"),
          e.exit("taskListCheck"),
          a
        );
      return t(u);
    }
    function a(u) {
      if (B(u)) return n(u);
      if (G(u)) return e.check({ tokenize: md }, n, t)(u);
      return t(u);
    }
  }
  function md(e, n, t) {
    return Z(e, r, m.whitespace);
    function r(i) {
      return i === d.eof ? t(i) : n(i);
    }
  }
  function Ks(e) {
    return nr([Ii(), $i(), _i(e), Ui(), Vi()]);
  }
  var gd = {};
  function pr(e) {
    let n = this,
      t = e || gd,
      r = n.data(),
      i = r.micromarkExtensions || (r.micromarkExtensions = []),
      o = r.fromMarkdownExtensions || (r.fromMarkdownExtensions = []),
      s = r.toMarkdownExtensions || (r.toMarkdownExtensions = []);
    (i.push(Ks(t)), o.push(Si()), s.push(Ci(t)));
  }
  function hr(e, n) {
    let t = Number.parseInt(e, n);
    if (
      t < d.ht ||
      t === d.vt ||
      (t > d.cr && t < d.space) ||
      (t > d.tilde && t < 160) ||
      (t > 55295 && t < 57344) ||
      (t > 64975 && t < 65008) ||
      (t & 65535) === 65535 ||
      (t & 65535) === 65534 ||
      t > 1114111
    )
      return Ve.replacementCharacter;
    return String.fromCodePoint(t);
  }
  var Xs = { tokenize: kd };
  function kd(e) {
    let n = e.attempt(this.parser.constructs.contentInitial, r, i),
      t;
    return n;
    function r(a) {
      if ((x(a === d.eof || B(a), "expected eol or eof"), a === d.eof)) {
        e.consume(a);
        return;
      }
      return (e.enter(m.lineEnding), e.consume(a), e.exit(m.lineEnding), Z(e, n, m.linePrefix));
    }
    function i(a) {
      return (
        x(a !== d.eof && !B(a), "expected anything other than a line ending or EOF"),
        e.enter(m.paragraph),
        o(a)
      );
    }
    function o(a) {
      let u = e.enter(m.chunkText, { contentType: P.contentTypeText, previous: t });
      if (t) t.next = u;
      return ((t = u), s(a));
    }
    function s(a) {
      if (a === d.eof) {
        (e.exit(m.chunkText), e.exit(m.paragraph), e.consume(a));
        return;
      }
      if (B(a)) return (e.consume(a), e.exit(m.chunkText), o);
      return (e.consume(a), s);
    }
  }
  var ea = { tokenize: xd },
    Js = { tokenize: wd };
  function xd(e) {
    let n = this,
      t = [],
      r = 0,
      i,
      o,
      s;
    return a;
    function a(M) {
      if (r < t.length) {
        let q = t[r];
        return (
          (n.containerState = q[1]),
          x(q[0].continuation, "expected `continuation` to be defined on container construct"),
          e.attempt(q[0].continuation, u, l)(M)
        );
      }
      return l(M);
    }
    function u(M) {
      if (
        (x(n.containerState, "expected `containerState` to be defined after continuation"),
        r++,
        n.containerState._closeFlow)
      ) {
        if (((n.containerState._closeFlow = void 0), i)) F();
        let q = n.events.length,
          z = q,
          E;
        while (z--)
          if (n.events[z][0] === "exit" && n.events[z][1].type === m.chunkFlow) {
            E = n.events[z][1].end;
            break;
          }
        (x(E, "could not find previous flow chunk"), b(r));
        let _ = q;
        while (_ < n.events.length) ((n.events[_][1].end = { ...E }), _++);
        return (we(n.events, z + 1, 0, n.events.slice(q)), (n.events.length = _), l(M));
      }
      return a(M);
    }
    function l(M) {
      if (r === t.length) {
        if (!i) return p(M);
        if (i.currentConstruct && i.currentConstruct.concrete) return g(M);
        n.interrupt = Boolean(i.currentConstruct && !i._gfmTableDynamicInterruptHack);
      }
      return ((n.containerState = {}), e.check(Js, c, f)(M));
    }
    function c(M) {
      if (i) F();
      return (b(r), p(M));
    }
    function f(M) {
      return ((n.parser.lazy[n.now().line] = r !== t.length), (s = n.now().offset), g(M));
    }
    function p(M) {
      return ((n.containerState = {}), e.attempt(Js, h, g)(M));
    }
    function h(M) {
      return (
        x(n.currentConstruct, "expected `currentConstruct` to be defined on tokenizer"),
        x(n.containerState, "expected `containerState` to be defined on tokenizer"),
        r++,
        t.push([n.currentConstruct, n.containerState]),
        p(M)
      );
    }
    function g(M) {
      if (M === d.eof) {
        if (i) F();
        (b(0), e.consume(M));
        return;
      }
      return (
        (i = i || n.parser.flow(n.now())),
        e.enter(m.chunkFlow, { _tokenizer: i, contentType: P.contentTypeFlow, previous: o }),
        k(M)
      );
    }
    function k(M) {
      if (M === d.eof) {
        (C(e.exit(m.chunkFlow), !0), b(0), e.consume(M));
        return;
      }
      if (B(M)) return (e.consume(M), C(e.exit(m.chunkFlow)), (r = 0), (n.interrupt = void 0), a);
      return (e.consume(M), k);
    }
    function C(M, q) {
      x(i, "expected `childFlow` to be defined when continuing");
      let z = n.sliceStream(M);
      if (q) z.push(null);
      if (((M.previous = o), o)) o.next = M;
      if (((o = M), i.defineSkip(M.start), i.write(z), n.parser.lazy[M.start.line])) {
        let E = i.events.length;
        while (E--)
          if (
            i.events[E][1].start.offset < s &&
            (!i.events[E][1].end || i.events[E][1].end.offset > s)
          )
            return;
        let _ = n.events.length,
          te = _,
          X,
          T;
        while (te--)
          if (n.events[te][0] === "exit" && n.events[te][1].type === m.chunkFlow) {
            if (X) {
              T = n.events[te][1].end;
              break;
            }
            X = !0;
          }
        (x(T, "could not find previous flow chunk"), b(r), (E = _));
        while (E < n.events.length) ((n.events[E][1].end = { ...T }), E++);
        (we(n.events, te + 1, 0, n.events.slice(_)), (n.events.length = E));
      }
    }
    function b(M) {
      let q = t.length;
      while (q-- > M) {
        let z = t[q];
        ((n.containerState = z[1]),
          x(z[0].exit, "expected `exit` to be defined on container construct"),
          z[0].exit.call(n, e));
      }
      t.length = M;
    }
    function F() {
      (x(n.containerState, "expected `containerState` to be defined when closing flow"),
        x(i, "expected `childFlow` to be defined when closing it"),
        i.write([d.eof]),
        (o = void 0),
        (i = void 0),
        (n.containerState._closeFlow = void 0));
    }
  }
  function wd(e, n, t) {
    return (
      x(this.parser.constructs.disable.null, "expected `disable.null` to be populated"),
      Z(
        e,
        e.attempt(this.parser.constructs.document, n, t),
        m.linePrefix,
        this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : P.tabSize,
      )
    );
  }
  var ta = { tokenize: bd };
  function bd(e) {
    let n = this,
      t = e.attempt(
        it,
        r,
        e.attempt(
          this.parser.constructs.flowInitial,
          i,
          Z(e, e.attempt(this.parser.constructs.flow, i, e.attempt(Fi, i)), m.linePrefix),
        ),
      );
    return t;
    function r(o) {
      if ((x(o === d.eof || B(o), "expected eol or eof"), o === d.eof)) {
        e.consume(o);
        return;
      }
      return (
        e.enter(m.lineEndingBlank),
        e.consume(o),
        e.exit(m.lineEndingBlank),
        (n.currentConstruct = void 0),
        t
      );
    }
    function i(o) {
      if ((x(o === d.eof || B(o), "expected eol or eof"), o === d.eof)) {
        e.consume(o);
        return;
      }
      return (
        e.enter(m.lineEnding), e.consume(o), e.exit(m.lineEnding), (n.currentConstruct = void 0), t
      );
    }
  }
  var na = { resolveAll: sa() },
    ra = oa("string"),
    ia = oa("text");
  function oa(e) {
    return { resolveAll: sa(e === "text" ? yd : void 0), tokenize: n };
    function n(t) {
      let r = this,
        i = this.parser.constructs[e],
        o = t.attempt(i, s, a);
      return s;
      function s(c) {
        return l(c) ? o(c) : a(c);
      }
      function a(c) {
        if (c === d.eof) {
          t.consume(c);
          return;
        }
        return (t.enter(m.data), t.consume(c), u);
      }
      function u(c) {
        if (l(c)) return (t.exit(m.data), o(c));
        return (t.consume(c), u);
      }
      function l(c) {
        if (c === d.eof) return !0;
        let f = i[c],
          p = -1;
        if (f) {
          x(Array.isArray(f), "expected `disable.null` to be populated");
          while (++p < f.length) {
            let h = f[p];
            if (!h.previous || h.previous.call(r, r.previous)) return !0;
          }
        }
        return !1;
      }
    }
  }
  function sa(e) {
    return n;
    function n(t, r) {
      let i = -1,
        o;
      while (++i <= t.length)
        if (o === void 0) {
          if (t[i] && t[i][1].type === m.data) ((o = i), i++);
        } else if (!t[i] || t[i][1].type !== m.data) {
          if (i !== o + 2)
            ((t[o][1].end = t[i - 1][1].end), t.splice(o + 2, i - o - 2), (i = o + 2));
          o = void 0;
        }
      return e ? e(t, r) : t;
    }
  }
  function yd(e, n) {
    let t = 0;
    while (++t <= e.length)
      if ((t === e.length || e[t][1].type === m.lineEnding) && e[t - 1][1].type === m.data) {
        let r = e[t - 1][1],
          i = n.sliceStream(r),
          o = i.length,
          s = -1,
          a = 0,
          u;
        while (o--) {
          let l = i[o];
          if (typeof l === "string") {
            s = l.length;
            while (l.charCodeAt(s - 1) === d.space) (a++, s--);
            if (s) break;
            s = -1;
          } else if (l === d.horizontalTab) ((u = !0), a++);
          else if (l === d.virtualSpace);
          else {
            o++;
            break;
          }
        }
        if (n._contentTypeTextTrailing && t === e.length) a = 0;
        if (a) {
          let l = {
            type:
              t === e.length || u || a < P.hardBreakPrefixSizeMin
                ? m.lineSuffix
                : m.hardBreakTrailing,
            start: {
              _bufferIndex: o ? s : r.start._bufferIndex + s,
              _index: r.start._index + o,
              line: r.end.line,
              column: r.end.column - a,
              offset: r.end.offset - a,
            },
            end: { ...r.end },
          };
          if (((r.end = { ...l.start }), r.start.offset === r.end.offset)) Object.assign(r, l);
          else (e.splice(t, 0, ["enter", l, n], ["exit", l, n]), (t += 2));
        }
        t++;
      }
    return e;
  }
  var Hi = {};
  ju(Hi, {
    attentionMarkers: () => Md,
    contentInitial: () => Cd,
    disable: () => Fd,
    document: () => Sd,
    flow: () => Id,
    flowInitial: () => Ed,
    insideSpan: () => Ad,
    string: () => Td,
    text: () => vd,
  });
  var Sd = {
      [d.asterisk]: Le,
      [d.plusSign]: Le,
      [d.dash]: Le,
      [d.digit0]: Le,
      [d.digit1]: Le,
      [d.digit2]: Le,
      [d.digit3]: Le,
      [d.digit4]: Le,
      [d.digit5]: Le,
      [d.digit6]: Le,
      [d.digit7]: Le,
      [d.digit8]: Le,
      [d.digit9]: Le,
      [d.greaterThan]: rr,
    },
    Cd = { [d.leftSquareBracket]: Ri },
    Ed = { [d.horizontalTab]: Fn, [d.virtualSpace]: Fn, [d.space]: Fn },
    Id = {
      [d.numberSign]: Li,
      [d.asterisk]: Gt,
      [d.dash]: [fr, Gt],
      [d.lessThan]: Bi,
      [d.equalsTo]: fr,
      [d.underscore]: Gt,
      [d.graveAccent]: sr,
      [d.tilde]: sr,
    },
    Td = { [d.ampersand]: or, [d.backslash]: ir },
    vd = {
      [d.carriageReturn]: Pn,
      [d.lineFeed]: Pn,
      [d.carriageReturnLineFeed]: Pn,
      [d.exclamationMark]: zi,
      [d.ampersand]: or,
      [d.asterisk]: Mn,
      [d.lessThan]: [vi, Ni],
      [d.leftSquareBracket]: Oi,
      [d.backslash]: [Pi, ir],
      [d.rightSquareBracket]: Wt,
      [d.underscore]: Mn,
      [d.graveAccent]: Ai,
    },
    Ad = { null: [Mn, na] },
    Md = { null: [d.asterisk, d.underscore] },
    Fd = { null: [] };
  var da = No(fa(), 1);
  var Qt = da.default("micromark");
  function pa(e, n, t) {
    let r = {
        _bufferIndex: -1,
        _index: 0,
        line: (t && t.line) || 1,
        column: (t && t.column) || 1,
        offset: (t && t.offset) || 0,
      },
      i = {},
      o = [],
      s = [],
      a = [],
      u = !0,
      l = {
        attempt: X(_),
        check: X(te),
        consume: q,
        enter: z,
        exit: E,
        interrupt: X(te, { interrupt: !0 }),
      },
      c = {
        code: d.eof,
        containerState: {},
        defineSkip: b,
        events: [],
        now: C,
        parser: e,
        previous: d.eof,
        sliceSerialize: g,
        sliceStream: k,
        write: h,
      },
      f = n.tokenize.call(c, l),
      p;
    if (n.resolveAll) o.push(n);
    return c;
    function h(U) {
      if (((s = Ne(s, U)), F(), s[s.length - 1] !== d.eof)) return [];
      return (T(n, 0), (c.events = Mt(o, c.events, c)), c.events);
    }
    function g(U, W) {
      return Hd(k(U), W);
    }
    function k(U) {
      return Vd(s, U);
    }
    function C() {
      let { _bufferIndex: U, _index: W, line: H, column: Q, offset: ge } = r;
      return { _bufferIndex: U, _index: W, line: H, column: Q, offset: ge };
    }
    function b(U) {
      ((i[U.line] = U.column), ne(), Qt("position: define skip: `%j`", r));
    }
    function F() {
      let U;
      while (r._index < s.length) {
        let W = s[r._index];
        if (typeof W === "string") {
          if (((U = r._index), r._bufferIndex < 0)) r._bufferIndex = 0;
          while (r._index === U && r._bufferIndex < W.length) M(W.charCodeAt(r._bufferIndex));
        } else M(W);
      }
    }
    function M(U) {
      (x(u === !0, "expected character to be consumed"),
        (u = void 0),
        Qt("main: passing `%s` to %s", U, f && f.name),
        (p = U),
        x(typeof f === "function", "expected state"),
        (f = f(U)));
    }
    function q(U) {
      if (
        (x(U === p, "expected given code to equal expected code"),
        Qt("consume: `%s`", U),
        x(
          u === void 0,
          "expected code to not have been consumed: this might be because `return x(code)` instead of `return x` was used",
        ),
        x(
          U === null
            ? c.events.length === 0 || c.events[c.events.length - 1][0] === "exit"
            : c.events[c.events.length - 1][0] === "enter",
          "expected last token to be open",
        ),
        B(U))
      )
        (r.line++,
          (r.column = 1),
          (r.offset += U === d.carriageReturnLineFeed ? 2 : 1),
          ne(),
          Qt("position: after eol: `%j`", r));
      else if (U !== d.virtualSpace) (r.column++, r.offset++);
      if (r._bufferIndex < 0) r._index++;
      else if ((r._bufferIndex++, r._bufferIndex === s[r._index].length))
        ((r._bufferIndex = -1), r._index++);
      ((c.previous = U), (u = !0));
    }
    function z(U, W) {
      let H = W || {};
      return (
        (H.type = U),
        (H.start = C()),
        x(typeof U === "string", "expected string type"),
        x(U.length > 0, "expected non-empty string"),
        Qt("enter: `%s`", U),
        c.events.push(["enter", H, c]),
        a.push(H),
        H
      );
    }
    function E(U) {
      (x(typeof U === "string", "expected string type"),
        x(U.length > 0, "expected non-empty string"));
      let W = a.pop();
      return (
        x(W, "cannot close w/o open tokens"),
        (W.end = C()),
        x(U === W.type, "expected exit token to match current token"),
        x(
          !(W.start._index === W.end._index && W.start._bufferIndex === W.end._bufferIndex),
          "expected non-empty token (`" + U + "`)",
        ),
        Qt("exit: `%s`", W.type),
        c.events.push(["exit", W, c]),
        W
      );
    }
    function _(U, W) {
      T(U, W.from);
    }
    function te(U, W) {
      W.restore();
    }
    function X(U, W) {
      return H;
      function H(Q, ge, De) {
        let me, w, Oe, Ge;
        return Array.isArray(Q) ? Be(Q) : "tokenize" in Q ? Be([Q]) : y(Q);
        function y(ke) {
          return Ot;
          function Ot(je) {
            let Xe = je !== null && ke[je],
              bt = je !== null && ke.null,
              $t = [
                ...(Array.isArray(Xe) ? Xe : Xe ? [Xe] : []),
                ...(Array.isArray(bt) ? bt : bt ? [bt] : []),
              ];
            return Be($t)(je);
          }
        }
        function Be(ke) {
          if (((me = ke), (w = 0), ke.length === 0))
            return (x(De, "expected `bogusState` to be given"), De);
          return Ke(ke[w]);
        }
        function Ke(ke) {
          return Ot;
          function Ot(je) {
            if (((Ge = K()), (Oe = ke), !ke.partial)) c.currentConstruct = ke;
            if (
              (x(c.parser.constructs.disable.null, "expected `disable.null` to be populated"),
              ke.name && c.parser.constructs.disable.null.includes(ke.name))
            )
              return nn(je);
            return ke.tokenize.call(W ? Object.assign(Object.create(c), W) : c, l, Sn, nn)(je);
          }
        }
        function Sn(ke) {
          return (x(ke === p, "expected code"), (u = !0), U(Oe, Ge), ge);
        }
        function nn(ke) {
          if ((x(ke === p, "expected code"), (u = !0), Ge.restore(), ++w < me.length))
            return Ke(me[w]);
          return De;
        }
      }
    }
    function T(U, W) {
      if (U.resolveAll && !o.includes(U)) o.push(U);
      if (U.resolve) we(c.events, W, c.events.length - W, U.resolve(c.events.slice(W), c));
      if (U.resolveTo) c.events = U.resolveTo(c.events, c);
      x(
        U.partial || c.events.length === 0 || c.events[c.events.length - 1][0] === "exit",
        "expected last token to end",
      );
    }
    function K() {
      let U = C(),
        { previous: W, currentConstruct: H } = c,
        Q = c.events.length,
        ge = Array.from(a);
      return { from: Q, restore: De };
      function De() {
        ((r = U),
          (c.previous = W),
          (c.currentConstruct = H),
          (c.events.length = Q),
          (a = ge),
          ne(),
          Qt("position: restore: `%j`", r));
      }
    }
    function ne() {
      if (r.line in i && r.column < 2) ((r.column = i[r.line]), (r.offset += i[r.line] - 1));
    }
  }
  function Vd(e, n) {
    let t = n.start._index,
      r = n.start._bufferIndex,
      i = n.end._index,
      o = n.end._bufferIndex,
      s;
    if (t === i)
      (x(o > -1, "expected non-negative end buffer index"),
        x(r > -1, "expected non-negative start buffer index"),
        (s = [e[t].slice(r, o)]));
    else {
      if (((s = e.slice(t, i)), r > -1)) {
        let a = s[0];
        if (typeof a === "string") s[0] = a.slice(r);
        else (x(r === 0, "expected `startBufferIndex` to be `0`"), s.shift());
      }
      if (o > 0) s.push(e[i].slice(0, o));
    }
    return s;
  }
  function Hd(e, n) {
    let t = -1,
      r = [],
      i;
    while (++t < e.length) {
      let o = e[t],
        s;
      if (typeof o === "string") s = o;
      else
        switch (o) {
          case d.carriageReturn: {
            s = Ve.cr;
            break;
          }
          case d.lineFeed: {
            s = Ve.lf;
            break;
          }
          case d.carriageReturnLineFeed: {
            s = Ve.cr + Ve.lf;
            break;
          }
          case d.horizontalTab: {
            s = n ? Ve.space : Ve.ht;
            break;
          }
          case d.virtualSpace: {
            if (!n && i) continue;
            s = Ve.space;
            break;
          }
          default:
            (x(typeof o === "number", "expected number"), (s = String.fromCharCode(o)));
        }
      ((i = o === d.horizontalTab), r.push(s));
    }
    return r.join("");
  }
  function ji(e) {
    let r = {
      constructs: nr([Hi, ...((e || {}).extensions || [])]),
      content: i(Xs),
      defined: [],
      document: i(ea),
      flow: i(ta),
      lazy: {},
      string: i(ra),
      text: i(ia),
    };
    return r;
    function i(o) {
      return s;
      function s(a) {
        return pa(r, o, a);
      }
    }
  }
  function Wi(e) {
    while (!ar(e));
    return e;
  }
  var ha = /[\0\t\n\r]/g;
  function Gi() {
    let e = 1,
      n = "",
      t = !0,
      r;
    return i;
    function i(o, s, a) {
      let u = [],
        l,
        c,
        f,
        p,
        h;
      if (
        ((o = n + (typeof o === "string" ? o.toString() : new TextDecoder(s || void 0).decode(o))),
        (f = 0),
        (n = ""),
        t)
      ) {
        if (o.charCodeAt(0) === d.byteOrderMarker) f++;
        t = void 0;
      }
      while (f < o.length) {
        if (
          ((ha.lastIndex = f),
          (l = ha.exec(o)),
          (p = l && l.index !== void 0 ? l.index : o.length),
          (h = o.charCodeAt(p)),
          !l)
        ) {
          n = o.slice(f);
          break;
        }
        if (h === d.lf && f === p && r) (u.push(d.carriageReturnLineFeed), (r = void 0));
        else {
          if (r) (u.push(d.carriageReturn), (r = void 0));
          if (f < p) (u.push(o.slice(f, p)), (e += p - f));
          switch (h) {
            case d.nul: {
              (u.push(d.replacementCharacter), e++);
              break;
            }
            case d.ht: {
              ((c = Math.ceil(e / P.tabSize) * P.tabSize), u.push(d.horizontalTab));
              while (e++ < c) u.push(d.virtualSpace);
              break;
            }
            case d.lf: {
              (u.push(d.lineFeed), (e = 1));
              break;
            }
            default:
              ((r = !0), (e = 1));
          }
        }
        f = p + 1;
      }
      if (a) {
        if (r) u.push(d.carriageReturn);
        if (n) u.push(n);
        u.push(d.eof);
      }
      return u;
    }
  }
  var jd = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
  function ma(e) {
    return e.replace(jd, Wd);
  }
  function Wd(e, n, t) {
    if (n) return n;
    if (t.charCodeAt(0) === d.numberSign) {
      let i = t.charCodeAt(1),
        o = i === d.lowercaseX || i === d.uppercaseX;
      return hr(t.slice(o ? 2 : 1), o ? P.numericBaseHexadecimal : P.numericBaseDecimal);
    }
    return ln(t) || e;
  }
  function Ft(e) {
    if (!e || typeof e !== "object") return "";
    if ("position" in e || "type" in e) return ga(e.position);
    if ("start" in e || "end" in e) return ga(e);
    if ("line" in e || "column" in e) return Zi(e);
    return "";
  }
  function Zi(e) {
    return ka(e && e.line) + ":" + ka(e && e.column);
  }
  function ga(e) {
    return Zi(e && e.start) + "-" + Zi(e && e.end);
  }
  function ka(e) {
    return e && typeof e === "number" ? e : 1;
  }
  var wa = {}.hasOwnProperty;
  function Qi(e, n, t) {
    if (n && typeof n === "object") ((t = n), (n = void 0));
    return Gd(t)(
      Wi(
        ji(t)
          .document()
          .write(Gi()(e, n, !0)),
      ),
    );
  }
  function Gd(e) {
    let n = {
      transforms: [],
      canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
      enter: {
        autolink: o(D),
        autolinkProtocol: X,
        autolinkEmail: X,
        atxHeading: o(En),
        blockQuote: o(je),
        characterEscape: X,
        characterReference: X,
        codeFenced: o(Xe),
        codeFencedFenceInfo: s,
        codeFencedFenceMeta: s,
        codeIndented: o(Xe, s),
        codeText: o(bt, s),
        codeTextData: X,
        data: X,
        codeFlowValue: X,
        definition: o($t),
        definitionDestinationString: s,
        definitionLabelString: s,
        definitionTitleString: s,
        emphasis: o(Cn),
        hardBreakEscape: o(S),
        hardBreakTrailing: o(S),
        htmlFlow: o(R, s),
        htmlFlowData: X,
        htmlText: o(R, s),
        htmlTextData: X,
        image: o(I),
        label: s,
        link: o(D),
        listItem: o(O),
        listItemValue: p,
        listOrdered: o(V, f),
        listUnordered: o(V),
        paragraph: o(se),
        reference: y,
        referenceString: s,
        resourceDestinationString: s,
        resourceTitleString: s,
        setextHeading: o(En),
        strong: o(ae),
        thematicBreak: o(Te),
      },
      exit: {
        atxHeading: u(),
        atxHeadingSequence: z,
        autolink: u(),
        autolinkEmail: Ot,
        autolinkProtocol: ke,
        blockQuote: u(),
        characterEscapeValue: T,
        characterReferenceMarkerHexadecimal: Ke,
        characterReferenceMarkerNumeric: Ke,
        characterReferenceValue: Sn,
        characterReference: nn,
        codeFenced: u(C),
        codeFencedFence: k,
        codeFencedFenceInfo: h,
        codeFencedFenceMeta: g,
        codeFlowValue: T,
        codeIndented: u(b),
        codeText: u(H),
        codeTextData: T,
        data: T,
        definition: u(),
        definitionDestinationString: q,
        definitionLabelString: F,
        definitionTitleString: M,
        emphasis: u(),
        hardBreakEscape: u(ne),
        hardBreakTrailing: u(ne),
        htmlFlow: u(U),
        htmlFlowData: T,
        htmlText: u(W),
        htmlTextData: T,
        image: u(ge),
        label: me,
        labelText: De,
        lineEnding: K,
        link: u(Q),
        listItem: u(),
        listOrdered: u(),
        listUnordered: u(),
        paragraph: u(),
        referenceString: Be,
        resourceDestinationString: w,
        resourceTitleString: Oe,
        resource: Ge,
        setextHeading: u(te),
        setextHeadingLineSequence: _,
        setextHeadingText: E,
        strong: u(),
        thematicBreak: u(),
      },
    };
    ba(n, (e || {}).mdastExtensions || []);
    let t = {};
    return r;
    function r(v) {
      let A = { type: "root", children: [] },
        N = {
          stack: [A],
          tokenStack: [],
          config: n,
          enter: a,
          exit: l,
          buffer: s,
          resume: c,
          data: t,
        },
        J = [],
        re = -1;
      while (++re < v.length)
        if (v[re][1].type === m.listOrdered || v[re][1].type === m.listUnordered)
          if (v[re][0] === "enter") J.push(re);
          else {
            let xe = J.pop();
            (x(typeof xe === "number", "expected list to be open"), (re = i(v, xe, re)));
          }
      re = -1;
      while (++re < v.length) {
        let xe = n[v[re][0]];
        if (wa.call(xe, v[re][1].type))
          xe[v[re][1].type].call(
            Object.assign({ sliceSerialize: v[re][2].sliceSerialize }, N),
            v[re][1],
          );
      }
      if (N.tokenStack.length > 0) {
        let xe = N.tokenStack[N.tokenStack.length - 1];
        (xe[1] || xa).call(N, void 0, xe[0]);
      }
      ((A.position = {
        start: Rt(v.length > 0 ? v[0][1].start : { line: 1, column: 1, offset: 0 }),
        end: Rt(v.length > 0 ? v[v.length - 2][1].end : { line: 1, column: 1, offset: 0 }),
      }),
        (re = -1));
      while (++re < n.transforms.length) A = n.transforms[re](A) || A;
      return A;
    }
    function i(v, A, N) {
      let J = A - 1,
        re = -1,
        xe = !1,
        Me,
        le,
        $e,
        yt;
      while (++J <= N) {
        let Fe = v[J];
        switch (Fe[1].type) {
          case m.listUnordered:
          case m.listOrdered:
          case m.blockQuote: {
            if (Fe[0] === "enter") re++;
            else re--;
            yt = void 0;
            break;
          }
          case m.lineEndingBlank: {
            if (Fe[0] === "enter") {
              if (Me && !yt && !re && !$e) $e = J;
              yt = void 0;
            }
            break;
          }
          case m.linePrefix:
          case m.listItemValue:
          case m.listItemMarker:
          case m.listItemPrefix:
          case m.listItemPrefixWhitespace:
            break;
          default:
            yt = void 0;
        }
        if (
          (!re && Fe[0] === "enter" && Fe[1].type === m.listItemPrefix) ||
          (re === -1 &&
            Fe[0] === "exit" &&
            (Fe[1].type === m.listUnordered || Fe[1].type === m.listOrdered))
        ) {
          if (Me) {
            let Je = J;
            le = void 0;
            while (Je--) {
              let dt = v[Je];
              if (dt[1].type === m.lineEnding || dt[1].type === m.lineEndingBlank) {
                if (dt[0] === "exit") continue;
                if (le) ((v[le][1].type = m.lineEndingBlank), (xe = !0));
                ((dt[1].type = m.lineEnding), (le = Je));
              } else if (
                dt[1].type === m.linePrefix ||
                dt[1].type === m.blockQuotePrefix ||
                dt[1].type === m.blockQuotePrefixWhitespace ||
                dt[1].type === m.blockQuoteMarker ||
                dt[1].type === m.listItemIndent
              );
              else break;
            }
            if ($e && (!le || $e < le)) Me._spread = !0;
            ((Me.end = Object.assign({}, le ? v[le][1].start : Fe[1].end)),
              v.splice(le || J, 0, ["exit", Me, Fe[2]]),
              J++,
              N++);
          }
          if (Fe[1].type === m.listItemPrefix) {
            let Je = {
              type: "listItem",
              _spread: !1,
              start: Object.assign({}, Fe[1].start),
              end: void 0,
            };
            ((Me = Je), v.splice(J, 0, ["enter", Je, Fe[2]]), J++, N++, ($e = void 0), (yt = !0));
          }
        }
      }
      return ((v[A][1]._spread = xe), N);
    }
    function o(v, A) {
      return N;
      function N(J) {
        if ((a.call(this, v(J), J), A)) A.call(this, J);
      }
    }
    function s() {
      this.stack.push({ type: "fragment", children: [] });
    }
    function a(v, A, N) {
      let J = this.stack[this.stack.length - 1];
      (x(J, "expected `parent`"),
        x("children" in J, "expected `parent`"),
        J.children.push(v),
        this.stack.push(v),
        this.tokenStack.push([A, N || void 0]),
        (v.position = { start: Rt(A.start), end: void 0 }));
    }
    function u(v) {
      return A;
      function A(N) {
        if (v) v.call(this, N);
        l.call(this, N);
      }
    }
    function l(v, A) {
      let N = this.stack.pop();
      x(N, "expected `node`");
      let J = this.tokenStack.pop();
      if (!J)
        throw Error(
          "Cannot close `" +
            v.type +
            "` (" +
            Ft({ start: v.start, end: v.end }) +
            "): it’s not open",
        );
      else if (J[0].type !== v.type)
        if (A) A.call(this, v, J[0]);
        else (J[1] || xa).call(this, v, J[0]);
      (x(N.type !== "fragment", "unexpected fragment `exit`ed"),
        x(N.position, "expected `position` to be defined"),
        (N.position.end = Rt(v.end)));
    }
    function c() {
      return Vt(this.stack.pop());
    }
    function f() {
      this.data.expectingFirstListItemValue = !0;
    }
    function p(v) {
      if (this.data.expectingFirstListItemValue) {
        let A = this.stack[this.stack.length - 2];
        (x(A, "expected nodes on stack"),
          x(A.type === "list", "expected list on stack"),
          (A.start = Number.parseInt(this.sliceSerialize(v), P.numericBaseDecimal)),
          (this.data.expectingFirstListItemValue = void 0));
      }
    }
    function h() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "code", "expected code on stack"),
        (A.lang = v));
    }
    function g() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "code", "expected code on stack"),
        (A.meta = v));
    }
    function k() {
      if (this.data.flowCodeInside) return;
      (this.buffer(), (this.data.flowCodeInside = !0));
    }
    function C() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "code", "expected code on stack"),
        (A.value = v.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "")),
        (this.data.flowCodeInside = void 0));
    }
    function b() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "code", "expected code on stack"),
        (A.value = v.replace(/(\r?\n|\r)$/g, "")));
    }
    function F(v) {
      let A = this.resume(),
        N = this.stack[this.stack.length - 1];
      (x(N, "expected node on stack"),
        x(N.type === "definition", "expected definition on stack"),
        (N.label = A),
        (N.identifier = Pe(this.sliceSerialize(v)).toLowerCase()));
    }
    function M() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "definition", "expected definition on stack"),
        (A.title = v));
    }
    function q() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "definition", "expected definition on stack"),
        (A.url = v));
    }
    function z(v) {
      let A = this.stack[this.stack.length - 1];
      if (
        (x(A, "expected node on stack"),
        x(A.type === "heading", "expected heading on stack"),
        !A.depth)
      ) {
        let N = this.sliceSerialize(v).length;
        (x(
          N === 1 || N === 2 || N === 3 || N === 4 || N === 5 || N === 6,
          "expected `depth` between `1` and `6`",
        ),
          (A.depth = N));
      }
    }
    function E() {
      this.data.setextHeadingSlurpLineEnding = !0;
    }
    function _(v) {
      let A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "heading", "expected heading on stack"),
        (A.depth = this.sliceSerialize(v).codePointAt(0) === d.equalsTo ? 1 : 2));
    }
    function te() {
      this.data.setextHeadingSlurpLineEnding = void 0;
    }
    function X(v) {
      let A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"), x("children" in A, "expected parent on stack"));
      let N = A.children,
        J = N[N.length - 1];
      if (!J || J.type !== "text")
        ((J = fe()), (J.position = { start: Rt(v.start), end: void 0 }), N.push(J));
      this.stack.push(J);
    }
    function T(v) {
      let A = this.stack.pop();
      (x(A, "expected a `node` to be on the stack"),
        x("value" in A, "expected a `literal` to be on the stack"),
        x(A.position, "expected `node` to have an open position"),
        (A.value += this.sliceSerialize(v)),
        (A.position.end = Rt(v.end)));
    }
    function K(v) {
      let A = this.stack[this.stack.length - 1];
      if ((x(A, "expected `node`"), this.data.atHardBreak)) {
        x("children" in A, "expected `parent`");
        let N = A.children[A.children.length - 1];
        (x(N.position, "expected tail to have a starting position"),
          (N.position.end = Rt(v.end)),
          (this.data.atHardBreak = void 0));
        return;
      }
      if (!this.data.setextHeadingSlurpLineEnding && n.canContainEols.includes(A.type))
        (X.call(this, v), T.call(this, v));
    }
    function ne() {
      this.data.atHardBreak = !0;
    }
    function U() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "html", "expected html on stack"),
        (A.value = v));
    }
    function W() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "html", "expected html on stack"),
        (A.value = v));
    }
    function H() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "inlineCode", "expected inline code on stack"),
        (A.value = v));
    }
    function Q() {
      let v = this.stack[this.stack.length - 1];
      if (
        (x(v, "expected node on stack"),
        x(v.type === "link", "expected link on stack"),
        this.data.inReference)
      ) {
        let A = this.data.referenceType || "shortcut";
        ((v.type += "Reference"), (v.referenceType = A), delete v.url, delete v.title);
      } else (delete v.identifier, delete v.label);
      this.data.referenceType = void 0;
    }
    function ge() {
      let v = this.stack[this.stack.length - 1];
      if (
        (x(v, "expected node on stack"),
        x(v.type === "image", "expected image on stack"),
        this.data.inReference)
      ) {
        let A = this.data.referenceType || "shortcut";
        ((v.type += "Reference"), (v.referenceType = A), delete v.url, delete v.title);
      } else (delete v.identifier, delete v.label);
      this.data.referenceType = void 0;
    }
    function De(v) {
      let A = this.sliceSerialize(v),
        N = this.stack[this.stack.length - 2];
      (x(N, "expected ancestor on stack"),
        x(N.type === "image" || N.type === "link", "expected image or link on stack"),
        (N.label = ma(A)),
        (N.identifier = Pe(A).toLowerCase()));
    }
    function me() {
      let v = this.stack[this.stack.length - 1];
      (x(v, "expected node on stack"), x(v.type === "fragment", "expected fragment on stack"));
      let A = this.resume(),
        N = this.stack[this.stack.length - 1];
      if (
        (x(N, "expected node on stack"),
        x(N.type === "image" || N.type === "link", "expected image or link on stack"),
        (this.data.inReference = !0),
        N.type === "link")
      ) {
        let J = v.children;
        N.children = J;
      } else N.alt = A;
    }
    function w() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "image" || A.type === "link", "expected image or link on stack"),
        (A.url = v));
    }
    function Oe() {
      let v = this.resume(),
        A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "image" || A.type === "link", "expected image or link on stack"),
        (A.title = v));
    }
    function Ge() {
      this.data.inReference = void 0;
    }
    function y() {
      this.data.referenceType = "collapsed";
    }
    function Be(v) {
      let A = this.resume(),
        N = this.stack[this.stack.length - 1];
      (x(N, "expected node on stack"),
        x(
          N.type === "image" || N.type === "link",
          "expected image reference or link reference on stack",
        ),
        (N.label = A),
        (N.identifier = Pe(this.sliceSerialize(v)).toLowerCase()),
        (this.data.referenceType = "full"));
    }
    function Ke(v) {
      (x(
        v.type === "characterReferenceMarkerNumeric" ||
          v.type === "characterReferenceMarkerHexadecimal",
      ),
        (this.data.characterReferenceType = v.type));
    }
    function Sn(v) {
      let A = this.sliceSerialize(v),
        N = this.data.characterReferenceType,
        J;
      if (N)
        ((J = hr(
          A,
          N === m.characterReferenceMarkerNumeric ? P.numericBaseDecimal : P.numericBaseHexadecimal,
        )),
          (this.data.characterReferenceType = void 0));
      else {
        let xe = ln(A);
        (x(xe !== !1, "expected reference to decode"), (J = xe));
      }
      let re = this.stack[this.stack.length - 1];
      (x(re, "expected `node`"), x("value" in re, "expected `node.value`"), (re.value += J));
    }
    function nn(v) {
      let A = this.stack.pop();
      (x(A, "expected `node`"),
        x(A.position, "expected `node.position`"),
        (A.position.end = Rt(v.end)));
    }
    function ke(v) {
      T.call(this, v);
      let A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "link", "expected link on stack"),
        (A.url = this.sliceSerialize(v)));
    }
    function Ot(v) {
      T.call(this, v);
      let A = this.stack[this.stack.length - 1];
      (x(A, "expected node on stack"),
        x(A.type === "link", "expected link on stack"),
        (A.url = "mailto:" + this.sliceSerialize(v)));
    }
    function je() {
      return { type: "blockquote", children: [] };
    }
    function Xe() {
      return { type: "code", lang: null, meta: null, value: "" };
    }
    function bt() {
      return { type: "inlineCode", value: "" };
    }
    function $t() {
      return { type: "definition", identifier: "", label: null, title: null, url: "" };
    }
    function Cn() {
      return { type: "emphasis", children: [] };
    }
    function En() {
      return { type: "heading", depth: 0, children: [] };
    }
    function S() {
      return { type: "break" };
    }
    function R() {
      return { type: "html", value: "" };
    }
    function I() {
      return { type: "image", title: null, url: "", alt: null };
    }
    function D() {
      return { type: "link", title: null, url: "", children: [] };
    }
    function V(v) {
      return {
        type: "list",
        ordered: v.type === "listOrdered",
        start: null,
        spread: v._spread,
        children: [],
      };
    }
    function O(v) {
      return { type: "listItem", spread: v._spread, checked: null, children: [] };
    }
    function se() {
      return { type: "paragraph", children: [] };
    }
    function ae() {
      return { type: "strong", children: [] };
    }
    function fe() {
      return { type: "text", value: "" };
    }
    function Te() {
      return { type: "thematicBreak" };
    }
  }
  function Rt(e) {
    return { line: e.line, column: e.column, offset: e.offset };
  }
  function ba(e, n) {
    let t = -1;
    while (++t < n.length) {
      let r = n[t];
      if (Array.isArray(r)) ba(e, r);
      else Zd(e, r);
    }
  }
  function Zd(e, n) {
    let t;
    for (t in n)
      if (wa.call(n, t))
        switch (t) {
          case "canContainEols": {
            let r = n[t];
            if (r) e[t].push(...r);
            break;
          }
          case "transforms": {
            let r = n[t];
            if (r) e[t].push(...r);
            break;
          }
          case "enter":
          case "exit": {
            let r = n[t];
            if (r) Object.assign(e[t], r);
            break;
          }
        }
  }
  function xa(e, n) {
    if (e)
      throw Error(
        "Cannot close `" +
          e.type +
          "` (" +
          Ft({ start: e.start, end: e.end }) +
          "): a different token (`" +
          n.type +
          "`, " +
          Ft({ start: n.start, end: n.end }) +
          ") is open",
      );
    else
      throw Error(
        "Cannot close document, a token (`" +
          n.type +
          "`, " +
          Ft({ start: n.start, end: n.end }) +
          ") is still open",
      );
  }
  function kr(e) {
    let n = this;
    n.parser = t;
    function t(r) {
      return Qi(r, {
        ...n.data("settings"),
        ...e,
        extensions: n.data("micromarkExtensions") || [],
        mdastExtensions: n.data("fromMarkdownExtensions") || [],
      });
    }
  }
  function Yi(e) {
    if (e) throw e;
  }
  var yr = No(Ma(), 1);
  function Ln(e) {
    if (typeof e !== "object" || e === null) return !1;
    let n = Object.getPrototypeOf(e);
    return (
      (n === null || n === Object.prototype || Object.getPrototypeOf(n) === null) &&
      !(Symbol.toStringTag in e) &&
      !(Symbol.iterator in e)
    );
  }
  function Ki() {
    let e = [],
      n = { run: t, use: r };
    return n;
    function t(...i) {
      let o = -1,
        s = i.pop();
      if (typeof s !== "function") throw TypeError("Expected function as last argument, not " + s);
      a(null, ...i);
      function a(u, ...l) {
        let c = e[++o],
          f = -1;
        if (u) {
          s(u);
          return;
        }
        while (++f < i.length) if (l[f] === null || l[f] === void 0) l[f] = i[f];
        if (((i = l), c)) Fa(c, a)(...l);
        else s(null, ...l);
      }
    }
    function r(i) {
      if (typeof i !== "function")
        throw TypeError("Expected `middelware` to be a function, not " + i);
      return (e.push(i), n);
    }
  }
  function Fa(e, n) {
    let t;
    return r;
    function r(...s) {
      let a = e.length > s.length,
        u;
      if (a) s.push(i);
      try {
        u = e.apply(this, s);
      } catch (l) {
        let c = l;
        if (a && t) throw c;
        return i(c);
      }
      if (!a)
        if (u && u.then && typeof u.then === "function") u.then(o, i);
        else if (u instanceof Error) i(u);
        else o(u);
    }
    function i(s, ...a) {
      if (!t) ((t = !0), n(s, ...a));
    }
    function o(s) {
      i(null, s);
    }
  }
  class Ae extends Error {
    constructor(e, n, t) {
      super();
      if (typeof n === "string") ((t = n), (n = void 0));
      let r = "",
        i = {},
        o = !1;
      if (n)
        if ("line" in n && "column" in n) i = { place: n };
        else if ("start" in n && "end" in n) i = { place: n };
        else if ("type" in n) i = { ancestors: [n], place: n.position };
        else i = { ...n };
      if (typeof e === "string") r = e;
      else if (!i.cause && e) ((o = !0), (r = e.message), (i.cause = e));
      if (!i.ruleId && !i.source && typeof t === "string") {
        let a = t.indexOf(":");
        if (a === -1) i.ruleId = t;
        else ((i.source = t.slice(0, a)), (i.ruleId = t.slice(a + 1)));
      }
      if (!i.place && i.ancestors && i.ancestors) {
        let a = i.ancestors[i.ancestors.length - 1];
        if (a) i.place = a.position;
      }
      let s = i.place && "start" in i.place ? i.place.start : i.place;
      ((this.ancestors = i.ancestors || void 0),
        (this.cause = i.cause || void 0),
        (this.column = s ? s.column : void 0),
        (this.fatal = void 0),
        (this.file = ""),
        (this.message = r),
        (this.line = s ? s.line : void 0),
        (this.name = Ft(i.place) || "1:1"),
        (this.place = i.place || void 0),
        (this.reason = this.message),
        (this.ruleId = i.ruleId || void 0),
        (this.source = i.source || void 0),
        (this.stack = o && i.cause && typeof i.cause.stack === "string" ? i.cause.stack : ""),
        (this.actual = void 0),
        (this.expected = void 0),
        (this.note = void 0),
        (this.url = void 0));
    }
  }
  Ae.prototype.file = "";
  Ae.prototype.name = "";
  Ae.prototype.reason = "";
  Ae.prototype.message = "";
  Ae.prototype.stack = "";
  Ae.prototype.column = void 0;
  Ae.prototype.line = void 0;
  Ae.prototype.ancestors = void 0;
  Ae.prototype.cause = void 0;
  Ae.prototype.fatal = void 0;
  Ae.prototype.place = void 0;
  Ae.prototype.ruleId = void 0;
  Ae.prototype.source = void 0;
  var Qe = { basename: Qd, dirname: Yd, extname: Kd, join: Xd, sep: "/" };
  function Qd(e, n) {
    if (n !== void 0 && typeof n !== "string") throw TypeError('"ext" argument must be a string');
    Dn(e);
    let t = 0,
      r = -1,
      i = e.length,
      o;
    if (n === void 0 || n.length === 0 || n.length > e.length) {
      while (i--)
        if (e.codePointAt(i) === 47) {
          if (o) {
            t = i + 1;
            break;
          }
        } else if (r < 0) ((o = !0), (r = i + 1));
      return r < 0 ? "" : e.slice(t, r);
    }
    if (n === e) return "";
    let s = -1,
      a = n.length - 1;
    while (i--)
      if (e.codePointAt(i) === 47) {
        if (o) {
          t = i + 1;
          break;
        }
      } else {
        if (s < 0) ((o = !0), (s = i + 1));
        if (a > -1)
          if (e.codePointAt(i) === n.codePointAt(a--)) {
            if (a < 0) r = i;
          } else ((a = -1), (r = s));
      }
    if (t === r) r = s;
    else if (r < 0) r = e.length;
    return e.slice(t, r);
  }
  function Yd(e) {
    if ((Dn(e), e.length === 0)) return ".";
    let n = -1,
      t = e.length,
      r;
    while (--t)
      if (e.codePointAt(t) === 47) {
        if (r) {
          n = t;
          break;
        }
      } else if (!r) r = !0;
    return n < 0
      ? e.codePointAt(0) === 47
        ? "/"
        : "."
      : n === 1 && e.codePointAt(0) === 47
        ? "//"
        : e.slice(0, n);
  }
  function Kd(e) {
    Dn(e);
    let n = e.length,
      t = -1,
      r = 0,
      i = -1,
      o = 0,
      s;
    while (n--) {
      let a = e.codePointAt(n);
      if (a === 47) {
        if (s) {
          r = n + 1;
          break;
        }
        continue;
      }
      if (t < 0) ((s = !0), (t = n + 1));
      if (a === 46) {
        if (i < 0) i = n;
        else if (o !== 1) o = 1;
      } else if (i > -1) o = -1;
    }
    if (i < 0 || t < 0 || o === 0 || (o === 1 && i === t - 1 && i === r + 1)) return "";
    return e.slice(i, t);
  }
  function Xd(...e) {
    let n = -1,
      t;
    while (++n < e.length) if ((Dn(e[n]), e[n])) t = t === void 0 ? e[n] : t + "/" + e[n];
    return t === void 0 ? "." : Jd(t);
  }
  function Jd(e) {
    Dn(e);
    let n = e.codePointAt(0) === 47,
      t = ep(e, !n);
    if (t.length === 0 && !n) t = ".";
    if (t.length > 0 && e.codePointAt(e.length - 1) === 47) t += "/";
    return n ? "/" + t : t;
  }
  function ep(e, n) {
    let t = "",
      r = 0,
      i = -1,
      o = 0,
      s = -1,
      a,
      u;
    while (++s <= e.length) {
      if (s < e.length) a = e.codePointAt(s);
      else if (a === 47) break;
      else a = 47;
      if (a === 47) {
        if (i === s - 1 || o === 1);
        else if (i !== s - 1 && o === 2) {
          if (
            t.length < 2 ||
            r !== 2 ||
            t.codePointAt(t.length - 1) !== 46 ||
            t.codePointAt(t.length - 2) !== 46
          ) {
            if (t.length > 2) {
              if (((u = t.lastIndexOf("/")), u !== t.length - 1)) {
                if (u < 0) ((t = ""), (r = 0));
                else ((t = t.slice(0, u)), (r = t.length - 1 - t.lastIndexOf("/")));
                ((i = s), (o = 0));
                continue;
              }
            } else if (t.length > 0) {
              ((t = ""), (r = 0), (i = s), (o = 0));
              continue;
            }
          }
          if (n) ((t = t.length > 0 ? t + "/.." : ".."), (r = 2));
        } else {
          if (t.length > 0) t += "/" + e.slice(i + 1, s);
          else t = e.slice(i + 1, s);
          r = s - i - 1;
        }
        ((i = s), (o = 0));
      } else if (a === 46 && o > -1) o++;
      else o = -1;
    }
    return t;
  }
  function Dn(e) {
    if (typeof e !== "string")
      throw TypeError("Path must be a string. Received " + JSON.stringify(e));
  }
  var Ra = { cwd: tp };
  function tp() {
    return "/";
  }
  function hn(e) {
    return Boolean(
      e !== null &&
      typeof e === "object" &&
      "href" in e &&
      e.href &&
      "protocol" in e &&
      e.protocol &&
      e.auth === void 0,
    );
  }
  function Pa(e) {
    if (typeof e === "string") e = new URL(e);
    else if (!hn(e)) {
      let n = TypeError(
        'The "path" argument must be of type string or an instance of URL. Received `' + e + "`",
      );
      throw ((n.code = "ERR_INVALID_ARG_TYPE"), n);
    }
    if (e.protocol !== "file:") {
      let n = TypeError("The URL must be of scheme file");
      throw ((n.code = "ERR_INVALID_URL_SCHEME"), n);
    }
    return np(e);
  }
  function np(e) {
    if (e.hostname !== "") {
      let r = TypeError('File URL host must be "localhost" or empty on darwin');
      throw ((r.code = "ERR_INVALID_FILE_URL_HOST"), r);
    }
    let n = e.pathname,
      t = -1;
    while (++t < n.length)
      if (n.codePointAt(t) === 37 && n.codePointAt(t + 1) === 50) {
        let r = n.codePointAt(t + 2);
        if (r === 70 || r === 102) {
          let i = TypeError("File URL path must not include encoded / characters");
          throw ((i.code = "ERR_INVALID_FILE_URL_PATH"), i);
        }
      }
    return decodeURIComponent(n);
  }
  var Xi = ["history", "path", "basename", "stem", "extname", "dirname"];
  class wr {
    constructor(e) {
      let n;
      if (!e) n = {};
      else if (hn(e)) n = { path: e };
      else if (typeof e === "string" || rp(e)) n = { value: e };
      else n = e;
      ((this.cwd = "cwd" in n ? "" : Ra.cwd()),
        (this.data = {}),
        (this.history = []),
        (this.messages = []),
        this.value,
        this.map,
        this.result,
        this.stored);
      let t = -1;
      while (++t < Xi.length) {
        let i = Xi[t];
        if (i in n && n[i] !== void 0 && n[i] !== null)
          this[i] = i === "history" ? [...n[i]] : n[i];
      }
      let r;
      for (r in n) if (!Xi.includes(r)) this[r] = n[r];
    }
    get basename() {
      return typeof this.path === "string" ? Qe.basename(this.path) : void 0;
    }
    set basename(e) {
      (eo(e, "basename"), Ji(e, "basename"), (this.path = Qe.join(this.dirname || "", e)));
    }
    get dirname() {
      return typeof this.path === "string" ? Qe.dirname(this.path) : void 0;
    }
    set dirname(e) {
      (La(this.basename, "dirname"), (this.path = Qe.join(e || "", this.basename)));
    }
    get extname() {
      return typeof this.path === "string" ? Qe.extname(this.path) : void 0;
    }
    set extname(e) {
      if ((Ji(e, "extname"), La(this.dirname, "extname"), e)) {
        if (e.codePointAt(0) !== 46) throw Error("`extname` must start with `.`");
        if (e.includes(".", 1)) throw Error("`extname` cannot contain multiple dots");
      }
      this.path = Qe.join(this.dirname, this.stem + (e || ""));
    }
    get path() {
      return this.history[this.history.length - 1];
    }
    set path(e) {
      if (hn(e)) e = Pa(e);
      if ((eo(e, "path"), this.path !== e)) this.history.push(e);
    }
    get stem() {
      return typeof this.path === "string" ? Qe.basename(this.path, this.extname) : void 0;
    }
    set stem(e) {
      (eo(e, "stem"),
        Ji(e, "stem"),
        (this.path = Qe.join(this.dirname || "", e + (this.extname || ""))));
    }
    fail(e, n, t) {
      let r = this.message(e, n, t);
      throw ((r.fatal = !0), r);
    }
    info(e, n, t) {
      let r = this.message(e, n, t);
      return ((r.fatal = void 0), r);
    }
    message(e, n, t) {
      let r = new Ae(e, n, t);
      if (this.path) ((r.name = this.path + ":" + r.name), (r.file = this.path));
      return ((r.fatal = !1), this.messages.push(r), r);
    }
    toString(e) {
      if (this.value === void 0) return "";
      if (typeof this.value === "string") return this.value;
      return new TextDecoder(e || void 0).decode(this.value);
    }
  }
  function Ji(e, n) {
    if (e && e.includes(Qe.sep))
      throw Error("`" + n + "` cannot be a path: did not expect `" + Qe.sep + "`");
  }
  function eo(e, n) {
    if (!e) throw Error("`" + n + "` cannot be empty");
  }
  function La(e, n) {
    if (!e) throw Error("Setting `" + n + "` requires `path` to be set too");
  }
  function rp(e) {
    return Boolean(e && typeof e === "object" && "byteLength" in e && "byteOffset" in e);
  }
  var Da = function (e) {
    let r = this.constructor.prototype,
      i = r[e],
      o = function () {
        return i.apply(o, arguments);
      };
    return (Object.setPrototypeOf(o, r), o);
  };
  var ip = {}.hasOwnProperty;
  class io extends Da {
    constructor() {
      super("copy");
      ((this.Compiler = void 0),
        (this.Parser = void 0),
        (this.attachers = []),
        (this.compiler = void 0),
        (this.freezeIndex = -1),
        (this.frozen = void 0),
        (this.namespace = {}),
        (this.parser = void 0),
        (this.transformers = Ki()));
    }
    copy() {
      let e = new io(),
        n = -1;
      while (++n < this.attachers.length) {
        let t = this.attachers[n];
        e.use(...t);
      }
      return (e.data(yr.default(!0, {}, this.namespace)), e);
    }
    data(e, n) {
      if (typeof e === "string") {
        if (arguments.length === 2) return (ro("data", this.frozen), (this.namespace[e] = n), this);
        return (ip.call(this.namespace, e) && this.namespace[e]) || void 0;
      }
      if (e) return (ro("data", this.frozen), (this.namespace = e), this);
      return this.namespace;
    }
    freeze() {
      if (this.frozen) return this;
      let e = this;
      while (++this.freezeIndex < this.attachers.length) {
        let [n, ...t] = this.attachers[this.freezeIndex];
        if (t[0] === !1) continue;
        if (t[0] === !0) t[0] = void 0;
        let r = n.call(e, ...t);
        if (typeof r === "function") this.transformers.use(r);
      }
      return ((this.frozen = !0), (this.freezeIndex = Number.POSITIVE_INFINITY), this);
    }
    parse(e) {
      this.freeze();
      let n = br(e),
        t = this.parser || this.Parser;
      return (to("parse", t), t(String(n), n));
    }
    process(e, n) {
      let t = this;
      return (
        this.freeze(),
        to("process", this.parser || this.Parser),
        no("process", this.compiler || this.Compiler),
        n ? r(void 0, n) : new Promise(r)
      );
      function r(i, o) {
        let s = br(e),
          a = t.parse(s);
        t.run(a, s, function (l, c, f) {
          if (l || !c || !f) return u(l);
          let p = c,
            h = t.stringify(p, f);
          if (sp(h)) f.value = h;
          else f.result = h;
          u(l, f);
        });
        function u(l, c) {
          if (l || !c) o(l);
          else if (i) i(c);
          else (x(n, "`done` is defined if `resolve` is not"), n(void 0, c));
        }
      }
    }
    processSync(e) {
      let n = !1,
        t;
      return (
        this.freeze(),
        to("processSync", this.parser || this.Parser),
        no("processSync", this.compiler || this.Compiler),
        this.process(e, r),
        Na("processSync", "process", n),
        x(t, "we either bailed on an error or have a tree"),
        t
      );
      function r(i, o) {
        ((n = !0), Yi(i), (t = o));
      }
    }
    run(e, n, t) {
      (Ba(e), this.freeze());
      let r = this.transformers;
      if (!t && typeof n === "function") ((t = n), (n = void 0));
      return t ? i(void 0, t) : new Promise(i);
      function i(o, s) {
        x(typeof n !== "function", "`file` can’t be a `done` anymore, we checked");
        let a = br(n);
        r.run(e, a, u);
        function u(l, c, f) {
          let p = c || e;
          if (l) s(l);
          else if (o) o(p);
          else (x(t, "`done` is defined if `resolve` is not"), t(void 0, p, f));
        }
      }
    }
    runSync(e, n) {
      let t = !1,
        r;
      return (
        this.run(e, n, i),
        Na("runSync", "run", t),
        x(r, "we either bailed on an error or have a tree"),
        r
      );
      function i(o, s) {
        (Yi(o), (r = s), (t = !0));
      }
    }
    stringify(e, n) {
      this.freeze();
      let t = br(n),
        r = this.compiler || this.Compiler;
      return (no("stringify", r), Ba(e), r(e, t));
    }
    use(e, ...n) {
      let t = this.attachers,
        r = this.namespace;
      if ((ro("use", this.frozen), e === null || e === void 0));
      else if (typeof e === "function") a(e, n);
      else if (typeof e === "object")
        if (Array.isArray(e)) s(e);
        else o(e);
      else throw TypeError("Expected usable value, not `" + e + "`");
      return this;
      function i(u) {
        if (typeof u === "function") a(u, []);
        else if (typeof u === "object")
          if (Array.isArray(u)) {
            let [l, ...c] = u;
            a(l, c);
          } else o(u);
        else throw TypeError("Expected usable value, not `" + u + "`");
      }
      function o(u) {
        if (!("plugins" in u) && !("settings" in u))
          throw Error(
            "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither",
          );
        if ((s(u.plugins), u.settings)) r.settings = yr.default(!0, r.settings, u.settings);
      }
      function s(u) {
        let l = -1;
        if (u === null || u === void 0);
        else if (Array.isArray(u))
          while (++l < u.length) {
            let c = u[l];
            i(c);
          }
        else throw TypeError("Expected a list of plugins, not `" + u + "`");
      }
      function a(u, l) {
        let c = -1,
          f = -1;
        while (++c < t.length)
          if (t[c][0] === u) {
            f = c;
            break;
          }
        if (f === -1) t.push([u, ...l]);
        else if (l.length > 0) {
          let [p, ...h] = l,
            g = t[f][1];
          if (Ln(g) && Ln(p)) p = yr.default(!0, g, p);
          t[f] = [u, p, ...h];
        }
      }
    }
  }
  var oo = new io().freeze();
  function to(e, n) {
    if (typeof n !== "function") throw TypeError("Cannot `" + e + "` without `parser`");
  }
  function no(e, n) {
    if (typeof n !== "function") throw TypeError("Cannot `" + e + "` without `compiler`");
  }
  function ro(e, n) {
    if (n)
      throw Error(
        "Cannot call `" +
          e +
          "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.",
      );
  }
  function Ba(e) {
    if (!Ln(e) || typeof e.type !== "string") throw TypeError("Expected node, got `" + e + "`");
  }
  function Na(e, n, t) {
    if (!t) throw Error("`" + e + "` finished async. Use `" + n + "` instead");
  }
  function br(e) {
    return op(e) ? e : new wr(e);
  }
  function op(e) {
    return Boolean(e && typeof e === "object" && "message" in e && "messages" in e);
  }
  function sp(e) {
    return typeof e === "string" || ap(e);
  }
  function ap(e) {
    return Boolean(e && typeof e === "object" && "byteLength" in e && "byteOffset" in e);
  }
  function za(e, n) {
    let t = [],
      r = 0,
      i = e.split(`
`);
    for (let o of i) {
      let s = up(o),
        a = o.slice(0, s),
        u = a.length - a.trimStart().length,
        l = a.trim();
      if (l.length > 0) {
        let c = n + r + u;
        t.push({ raw: l, start: c, end: c + l.length });
      }
      r += o.length + 1;
    }
    return t;
  }
  function up(e) {
    let n = !1;
    for (let t = 0; t < e.length; t++) {
      let r = e[t];
      if (r === '"') n = !n;
      else if (r === "#" && !n) return t;
    }
    return e.length;
  }
  var lp = /^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*-->$/,
    cp = /^<!--\s*vmark\s*=/,
    Bn = "<!--vmark:no-formulas-->",
    fp = /^<!--\s*vmark\s*:\s*no-formulas\s*-->$/,
    _a = /(-?\d+(?:\.\d+)?)\s*$/,
    de = (e, n) => {
      let t = e.position?.[n].offset;
      if (t === void 0) throw Error(`mdast node ${e.type} is missing a byte offset`);
      return t;
    };
  function We(e) {
    let n = oo().use(kr).use(pr).parse(e),
      t = n.children ?? [],
      r = [],
      i = [],
      o = [],
      s = [],
      a = new Map(),
      u = new Set(),
      l = new Map(),
      c = null;
    for (let h = 0; h < t.length; h++) {
      let g = t[h];
      if (g.type === "table") {
        let k = pp(g, e);
        (i.push(k), l.set(k.span.start, k));
      }
      if (g.type === "html" && c === null && fp.test((g.value ?? "").trim()))
        c = { start: de(g, "start"), end: de(g, "end") };
    }
    for (let h = 0; h < t.length; h++) {
      let g = t[h];
      if (g.type === "code" && g.lang === "vmark") {
        let k = { start: de(g, "start"), end: de(g, "end") },
          C =
            e.indexOf(
              `
`,
              k.start,
            ) + 1,
          b = { sheetId: dp(g.meta ?? null), bindings: za(g.value ?? "", C), span: k };
        r.push(b);
        let F = t[h - 1];
        if (F && F.type === "table") a.set(b, l.get(de(F, "start")) ?? null);
        else {
          a.set(b, null);
          for (let M = h - 1; M >= 0; M--) {
            let q = t[M];
            if (q.type === "code" && q.lang === "vmark") break;
            if (q.type === "heading") break;
            if (q.type === "table") {
              u.add(b);
              break;
            }
          }
        }
      }
    }
    mp(n, e, o, s);
    let f = [];
    ao(n, e, f);
    let p = new Set(o.filter((h) => h.value).map((h) => `${h.value.start}:${h.value.end}`));
    for (let h of f) h.anchored = p.has(`${h.value.start}:${h.value.end}`);
    return {
      source: e,
      blocks: r,
      tables: i,
      anchors: o,
      malformedAnchors: s,
      figures: f,
      noFormulas: c,
      tableBeforeBlock: a,
      detachedTableBlocks: u,
    };
  }
  function dp(e) {
    if (!e) return null;
    let n = /^#(\S+)/.exec(e.trim());
    return n ? n[1] : null;
  }
  function pp(e, n) {
    let t = (e.children ?? []).map((o) => (o.children ?? []).map((s) => hp(s, n))),
      [r = [], ...i] = t;
    return {
      headers: r,
      rows: i.map((o) => ({ cells: o })),
      span: { start: de(e, "start"), end: de(e, "end") },
    };
  }
  function hp(e, n) {
    let t = e.children?.[0];
    if (t) {
      let l = Sr(t);
      if (l) return { ...l, text: n.slice(l.start, l.end) };
    }
    let r = de(e, "start"),
      i = de(e, "end"),
      o = n.slice(r, i),
      s = o.replace(/^\|?\s*/, ""),
      a = o.length - s.length,
      u = s.replace(/\s*\|?\s*$/, "");
    return { start: r + a, end: r + a + u.length, text: u };
  }
  function Sr(e) {
    if (e.type === "strong" || e.type === "emphasis") {
      let n = e.children?.[0];
      if (n && n.type === "text") return { start: de(n, "start"), end: de(n, "end"), kind: e.type };
      return null;
    }
    if (e.type === "inlineCode")
      return { start: de(e, "start") + 1, end: de(e, "end") - 1, kind: "inlineCode" };
    if (e.type === "text") return { start: de(e, "start"), end: de(e, "end"), kind: "text" };
    return null;
  }
  function mp(e, n, t, r) {
    qa(e, (i) => {
      let o = i.children;
      if (!o) return;
      for (let s = 0; s < o.length; s++) {
        let a = o[s];
        if (a.type !== "html") continue;
        let u = (a.value ?? "").trim(),
          l = lp.exec(u);
        if (!l) {
          if (cp.test(u)) r.push({ start: de(a, "start"), end: de(a, "end") });
          continue;
        }
        let c = { start: de(a, "start"), end: de(a, "end") },
          f = o[s - 1];
        t.push({
          sheetId: l[1],
          name: l[2],
          commentSpan: c,
          value: f ? gp(f) : null,
          ...(f?.type === "image" && f.url !== void 0 ? { imageUrl: f.url } : {}),
        });
      }
    });
  }
  function gp(e) {
    if (e.type === "image") return { start: de(e, "start"), end: de(e, "end"), kind: "image" };
    if (e.type === "strong" || e.type === "emphasis" || e.type === "inlineCode") return Sr(e);
    if (e.type === "text") {
      let n = e.value ?? "",
        t = _a.exec(n);
      if (!t) return null;
      let r = de(e, "start") + t.index;
      return { start: r, end: r + t[1].length, kind: "text" };
    }
    return null;
  }
  function qa(e, n) {
    n(e);
    for (let t of e.children ?? []) qa(t, n);
  }
  var Oa = /^-?\s*[^\d\s.\-%]*\s*\d+(?:\.\d+)?\s*(?:%|[^\d\s.\-%]*)$/,
    so = /\d+(?:\.\d+)?%?/g,
    $a = /[\w./\-:%]/;
  function ao(e, n, t) {
    if (e.type === "table" || e.type === "code" || e.type === "html") return;
    let r = e.children;
    if (!r) return;
    for (let i of r)
      switch (i.type) {
        case "strong":
        case "emphasis": {
          let o = i.children?.[0];
          if (i.children?.length === 1 && o?.type === "text" && Oa.test((o.value ?? "").trim())) {
            let s = Sr(o);
            if (s) {
              t.push({
                text: n.slice(s.start, s.end),
                value: { ...s, kind: i.type },
                anchorAt: de(i, "end"),
                anchored: !1,
              });
              continue;
            }
          }
          ao(i, n, t);
          continue;
        }
        case "inlineCode": {
          let o = (i.value ?? "").trim();
          if (Oa.test(o)) {
            let s = Sr(i);
            t.push({
              text: n.slice(s.start, s.end),
              value: s,
              anchorAt: de(i, "end"),
              anchored: !1,
            });
          }
          continue;
        }
        case "text": {
          kp(i, n, t);
          continue;
        }
        default:
          ao(i, n, t);
      }
  }
  function kp(e, n, t) {
    let r = e.value ?? "",
      i = de(e, "start"),
      o = _a.exec(r),
      s = o ? o.index : -1;
    so.lastIndex = 0;
    for (let a = so.exec(r); a; a = so.exec(r)) {
      let u = a.index,
        l = u + a[0].length,
        c = r[u - 1] ?? " ",
        f = r[l] ?? " ";
      if ($a.test(c) || $a.test(f)) continue;
      let p = u === s && !a[0].endsWith("%");
      t.push({
        text: a[0],
        value: { start: i + u, end: i + l, kind: "text" },
        anchorAt: p ? de(e, "end") : null,
        anchored: !1,
      });
    }
  }
  var uo = new Set([
    "DATE",
    "UNIT",
    "UNDEF",
    "DUP",
    "VECTOR",
    "CYCLE",
    "TYPE",
    "SHEET",
    "ANCHOR",
    "ASSERT",
    "ARTIFACT",
    "COVERAGE",
  ]);
  function Ua(e) {
    return e.code === "STALE" || uo.has(e.code);
  }
  var lo = "";
  function xp(e, n) {
    let t = e.length,
      r = n.length;
    if (t === 0) return r;
    if (r === 0) return t;
    let i = Array.from({ length: r + 1 }, (s, a) => a),
      o = Array.from({ length: r + 1 });
    for (let s = 1; s <= t; s++) {
      o[0] = s;
      for (let a = 1; a <= r; a++) {
        let u = e[s - 1] === n[a - 1] ? 0 : 1;
        o[a] = Math.min(i[a] + 1, o[a - 1] + 1, i[a - 1] + u);
      }
      [i, o] = [o, i];
    }
    return i[r];
  }
  function wp(e, n) {
    let t = 0;
    while (t < e.length && t < n.length && e[t] === n[t]) t++;
    return t;
  }
  function ot(e, n, t = 1 / 0) {
    let r = null,
      i = 1 / 0,
      o = -1;
    for (let s of n) {
      if (s === e) continue;
      let a = xp(e, s);
      if (a > t) continue;
      let u = wp(e, s);
      if (a < i || (a === i && u > o) || (a === i && u === o && r !== null && s < r))
        ((r = s), (i = a), (o = u));
    }
    return r;
  }
  ue.set({ precision: 40, rounding: ue.ROUND_HALF_UP });
  var be = (e) => ({ t: "num", d: e instanceof ue ? e : new ue(e) }),
    gt = (e) => ({ t: "date", iso: e }),
    Cr = (e) => ({ t: "str", s: e }),
    mn = (e) => ({ t: "bool", b: e });
  class he extends Error {
    code = "TYPE";
    constructor(e) {
      super(e);
      this.name = "EvalError";
    }
  }
  class co extends he {
    code = "DATE";
    constructor(e) {
      super(e);
      this.name = "DateError";
    }
  }
  function Pt(e, n) {
    let t = e.toDecimalPlaces(n, ue.ROUND_HALF_UP);
    return t.isZero() ? new ue(0) : t;
  }
  function fo(e, n) {
    if (e.t !== n.t) return !1;
    if (e.t === "num" && n.t === "num") return e.d.equals(n.d);
    if (e.t === "date" && n.t === "date") return e.iso === n.iso;
    if (e.t === "str" && n.t === "str") return e.s === n.s;
    if (e.t === "bool" && n.t === "bool") return e.b === n.b;
    return !1;
  }
  var bp = /^(\d{4})-(\d{2})-(\d{2})$/,
    yp = /^(\d{1,4})([./-])(\d{1,4})\2(\d{1,4})$/;
  function Sp(e) {
    return (e % 4 === 0 && e % 100 !== 0) || e % 400 === 0;
  }
  function Va(e, n) {
    return [31, Sp(e) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][n - 1];
  }
  function po(e, n, t) {
    return e >= 1 && e <= 9999 && n >= 1 && n <= 12 && t >= 1 && t <= Va(e, n);
  }
  var Er = (e, n, t) =>
    `${String(e).padStart(4, "0")}-${String(n).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
  function Ha(e) {
    let n = bp.exec(e);
    if (n) {
      let [, r, i, o] = n;
      if (po(+r, +i, +o)) return { ok: !0, iso: e };
      return { ok: !1, reason: "not a valid calendar date" };
    }
    let t = yp.exec(e);
    if (t) {
      let r = [t[1], t[3], t[4]].map(Number),
        i,
        o;
      if (t[1].length === 4) ((i = r[0]), (o = [r[1], r[2]]));
      else if (t[4].length === 4) ((i = r[2]), (o = [r[0], r[1]]));
      else return { ok: !1, reason: "not a date VisiMark can read" };
      let [s, a] = o,
        u = [];
      if (po(i, a, s)) u.push(Er(i, a, s));
      if (po(i, s, a) && s !== a) u.push(Er(i, s, a));
      if (u.length === 0) return { ok: !1, reason: "not a valid calendar date" };
      if (u.length === 1) return { ok: !1, reason: "non-ISO date order", decidable: u[0] };
      let [l, c] = u;
      return {
        ok: !1,
        reason: "ambiguous date order",
        ambiguous: { a: l, b: c, daysApart: Math.abs(mo(l, c).toNumber()) },
      };
    }
    return { ok: !1, reason: "not a date VisiMark can read" };
  }
  function ho(e) {
    let [n, t, r] = e.split("-").map(Number);
    return Math.round(Date.UTC(n, t - 1, r) / 86400000);
  }
  function mo(e, n) {
    return new ue(ho(e) - ho(n));
  }
  function Ir(e, n) {
    let t = (ho(e) + n) * 86400000,
      r = new Date(t);
    return Er(r.getUTCFullYear(), r.getUTCMonth() + 1, r.getUTCDate());
  }
  function ja(e, n) {
    let [t, r] = e.split("-").map(Number),
      i = t * 12 + (r - 1) + n,
      o = Math.floor(i / 12),
      s = i - o * 12 + 1;
    if (o < 1 || o > 9999)
      throw new co(
        `EOMONTH result ${String(o).padStart(4, "0")}-${String(s).padStart(2, "0")} is outside the supported date range`,
      );
    return Er(o, s, Va(o, s));
  }
  var Nn = new Map([
      ["SUM", { kind: "reduce", arity: 1 }],
      ["MIN", { kind: "reduce", arity: 1 }],
      ["MAX", { kind: "reduce", arity: 1 }],
      ["COUNT", { kind: "reduce", arity: 1 }],
      ["AVG", { kind: "reduce", arity: 1 }],
      ["ROUND", { kind: "map", arity: 2 }],
      ["ABS", { kind: "map", arity: 1 }],
      ["MOD", { kind: "map", arity: 2 }],
      ["SQRT", { kind: "map", arity: 1 }],
      ["IF", { kind: "map", arity: 3 }],
      ["EOMONTH", { kind: "map", arity: 2 }],
    ]),
    Yt = (e) => Nn.get(e)?.kind === "reduce";
  function Tr(e, n) {
    let t = Nn.get(e);
    if (!t) return { kind: "unknown" };
    if (n.length !== t.arity) return { kind: "arity", expected: t.arity, got: n.length };
    if (t.kind === "reduce" && n[0].type !== "ref") return { kind: "shape" };
    return null;
  }
  function gn(e, n) {
    switch (n.kind) {
      case "unknown":
        return `unknown function \`${e}\``;
      case "arity":
        return `${e}() takes ${n.expected} argument${n.expected === 1 ? "" : "s"}, got ${n.got}`;
      case "shape":
        return `${e}() takes a column reference, not an expression`;
    }
  }
  function Lt(e, n) {
    switch (e.type) {
      case "num":
        return be(new ue(e.value));
      case "date":
        return gt(e.value);
      case "str":
        return Cr(e.value);
      case "ref":
        return n.scalar(e);
      case "unary":
        return Ep(e.op, Lt(e.operand, n));
      case "binary":
        return Ip(e.op, Lt(e.left, n), Lt(e.right, n));
      case "call":
        return vp(e, n);
    }
  }
  function Ie(e, n) {
    if (e.t !== "num") throw new he(`${n} expects a number`);
    return e.d;
  }
  function Cp(e, n) {
    if (e.t !== "date") throw new he(`${n} expects a date`);
    return e.iso;
  }
  function Ep(e, n) {
    if (e === "-") return be(Ie(n, "unary minus").negated());
    if (n.t !== "bool") throw new he("`not` expects a boolean");
    return mn(!n.b);
  }
  function Ip(e, n, t) {
    switch (e) {
      case "+":
        if (n.t === "num" && t.t === "num") return be(n.d.plus(t.d));
        if (n.t === "date" && t.t === "num") return gt(Ir(n.iso, go(t.d)));
        if (n.t === "num" && t.t === "date") return gt(Ir(t.iso, go(n.d)));
        throw new he("`+` needs two numbers or a date and a number");
      case "-":
        if (n.t === "num" && t.t === "num") return be(n.d.minus(t.d));
        if (n.t === "date" && t.t === "date") return be(mo(n.iso, t.iso));
        if (n.t === "date" && t.t === "num") return gt(Ir(n.iso, -go(t.d)));
        throw new he("`-` needs two numbers, two dates, or a date and a number");
      case "*":
        return be(Ie(n, "`*`").times(Ie(t, "`*`")));
      case "/":
        return be(Ie(n, "`/`").div(Ie(t, "`/`")));
      case "^":
        return be(Ie(n, "`^`").pow(Ie(t, "`^`")));
      case "and":
      case "or": {
        if (n.t !== "bool" || t.t !== "bool") throw new he(`\`${e}\` expects booleans`);
        return mn(e === "and" ? n.b && t.b : n.b || t.b);
      }
      case "==":
        return mn(fo(n, t));
      case "!=":
        return mn(!fo(n, t));
      case "<":
      case "<=":
      case ">":
      case ">=":
        return mn(Tp(e, n, t));
      default:
        throw new he(`unknown operator \`${e}\``);
    }
  }
  function go(e) {
    if (!e.isInteger()) throw new he("date arithmetic needs a whole number of days");
    return e.toNumber();
  }
  function Tp(e, n, t) {
    let r;
    if (n.t === "num" && t.t === "num") r = n.d.comparedTo(t.d);
    else if (n.t === "date" && t.t === "date") r = n.iso < t.iso ? -1 : n.iso > t.iso ? 1 : 0;
    else if (n.t === "str" && t.t === "str") r = n.s < t.s ? -1 : n.s > t.s ? 1 : 0;
    else throw new he(`\`${e}\` cannot compare those operands`);
    if (e === "<") return r < 0;
    if (e === "<=") return r <= 0;
    if (e === ">") return r > 0;
    return r >= 0;
  }
  function vp(e, n) {
    let { name: t, args: r } = e,
      i = Tr(t, r);
    if (i) throw new he(gn(t, i));
    if (Yt(t)) {
      let s = r[0];
      if (!s || s.type !== "ref") throw new he(gn(t, { kind: "shape" }));
      return Ap(t, n.vector(s));
    }
    let o = r.map((s) => Lt(s, n));
    switch (t) {
      case "ROUND":
        return be(Pt(Ie(o[0], "ROUND"), Number(Ie(o[1], "ROUND"))));
      case "ABS":
        return be(Ie(o[0], "ABS").abs());
      case "MOD":
        return be(Ie(o[0], "MOD").mod(Ie(o[1], "MOD")));
      case "SQRT": {
        let s = Ie(o[0], "SQRT");
        if (s.isNegative() && !s.isZero()) throw new he("SQRT of a negative number");
        return be(s.sqrt());
      }
      case "IF": {
        let s = o[0];
        if (s.t !== "bool") throw new he("IF() needs a boolean condition");
        return s.b ? o[1] : o[2];
      }
      case "EOMONTH": {
        let s = Cp(o[0], "EOMONTH"),
          a = Ie(o[1], "EOMONTH");
        if (!a.isInteger()) throw new he("EOMONTH expects a whole number of months");
        return gt(ja(s, a.toNumber()));
      }
      default:
        throw new he(`unknown function \`${t}\``);
    }
  }
  function Ap(e, n) {
    if (e === "COUNT") return be(n.length);
    if (e === "SUM") return be(n.reduce((r, i) => r.plus(Ie(i, "SUM")), new ue(0)));
    if (n.length === 0) throw new he(`${e}() of an empty column`);
    if (e === "AVG") {
      let r = n.reduce((i, o) => i.plus(Ie(o, "AVG")), new ue(0));
      return be(r.div(n.length));
    }
    let t = n[0];
    if (t.t === "num") {
      let r = Ie(t, e);
      for (let i of n.slice(1)) {
        let o = Ie(i, e);
        if ((e === "MIN" && o.lt(r)) || (e === "MAX" && o.gt(r))) r = o;
      }
      return be(r);
    }
    if (t.t === "date") {
      let r = t.iso;
      for (let i of n.slice(1)) {
        if (i.t !== "date") throw new he(`${e}() over mixed types`);
        if ((e === "MIN" && i.iso < r) || (e === "MAX" && i.iso > r)) r = i.iso;
      }
      return gt(r);
    }
    throw new he(`${e}() needs numbers or dates`);
  }
  function Mp(e) {
    return { id: e.id, sheetId: e.sheetId, name: "", expr: e.expr, kind: "scalar", span: e.span };
  }
  function ko(e) {
    let t = [...e.series, e.labels].map((i) => {
        let o = i.indexOf(".");
        return {
          type: "ref",
          ...(o === -1 ? { name: i } : { qualifier: i.slice(0, o), name: i.slice(o + 1) }),
          start: e.span.start,
          end: e.span.end,
        };
      }),
      r = t[0];
    for (let i = 1; i < t.length; i++)
      r = { type: "binary", op: "+", left: r, right: t[i], start: e.span.start, end: e.span.end };
    return { id: e.id, sheetId: e.sheetId, name: e.name, expr: r, kind: "column", span: e.span };
  }
  function Kt(e) {
    return e.qualifier ? `${e.qualifier}.${e.name}` : e.name;
  }
  function kt(e, n, t) {
    if (t.qualifier) {
      let s = e.sheets.get(t.qualifier);
      if (!s)
        return {
          kind: "unknown",
          badName: `${t.qualifier}.${t.name}`,
          suggestion: ot(t.qualifier, e.sheets.keys()),
        };
      let a = s.columns.get(t.name);
      if (a) return { kind: "column", binding: a, sheetId: s.id };
      if (s.inputColumns.has(t.name))
        return { kind: "input-column", sheetId: s.id, column: t.name };
      let u = s.scalars.get(t.name);
      if (u) return { kind: "scalar", binding: u, sheetId: s.id };
      return {
        kind: "unknown",
        badName: `${t.qualifier}.${t.name}`,
        suggestion: ot(t.name, [...s.columns.keys(), ...s.inputColumns, ...s.scalars.keys()]),
      };
    }
    let r = e.sheets.get(n);
    if (r) {
      let s = r.columns.get(t.name);
      if (s) return { kind: "column", binding: s, sheetId: r.id };
      if (r.inputColumns.has(t.name))
        return { kind: "input-column", sheetId: r.id, column: t.name };
      let a = r.scalars.get(t.name);
      if (a) return { kind: "scalar", binding: a, sheetId: r.id };
    }
    let i = e.docScope.get(t.name);
    if (i) return { kind: "doc-scalar", binding: i, sheetId: "" };
    let o = new Set(e.docScope.keys());
    if (r) {
      for (let s of r.columns.keys()) o.add(s);
      for (let s of r.inputColumns) o.add(s);
      for (let s of r.scalars.keys()) o.add(s);
    }
    return { kind: "unknown", badName: t.name, suggestion: ot(t.name, o) };
  }
  function xo(e, n) {
    let t = { refs: [], deps: new Set(), vectorRefs: [], undefRefs: [], callErrors: [] },
      r = (i, o) => {
        switch (i.type) {
          case "ref": {
            let s = kt(e, n.sheetId, i);
            if ((t.refs.push({ ref: i, res: s }), s.kind === "unknown")) {
              t.undefRefs.push(i);
              return;
            }
            if (s.kind === "column") {
              let a = s.sheetId !== n.sheetId,
                u = n.kind === "column" && !a;
              if (o) t.deps.add(s.binding.id);
              else if (u) t.deps.add(s.binding.id);
              else t.vectorRefs.push(i);
            } else if (s.kind === "input-column") {
              let a = s.sheetId !== n.sheetId,
                u = n.kind === "column" && !a;
              if (!o && !u) t.vectorRefs.push(i);
            } else t.deps.add(s.binding.id);
            return;
          }
          case "call": {
            let s = Tr(i.name, i.args);
            if (s) t.callErrors.push({ call: i, problem: s });
            let a = Yt(i.name);
            for (let u of i.args) r(u, o || a);
            return;
          }
          case "unary":
            r(i.operand, o);
            return;
          case "binary":
            (r(i.left, o), r(i.right, o));
            return;
        }
      };
    if (!n.parseError) r(n.expr, !1);
    return t;
  }
  function zn(e) {
    let n = new Map(),
      t = new Set(),
      r = new Set();
    for (let k of e.docScope.values()) n.set(k.id, k);
    for (let k of e.sheets.values()) {
      for (let C of k.columns.values()) n.set(C.id, C);
      for (let C of k.scalars.values()) n.set(C.id, C);
      for (let C of k.assertions) (n.set(C.id, Mp(C)), t.add(C.id));
      for (let C of k.charts) (n.set(C.id, ko(C)), r.add(C.id));
    }
    let i = [...n.keys()],
      o = new Map(i.map((k, C) => [k, C])),
      s = new Map(),
      a = new Map();
    for (let [k, C] of n) {
      let b = xo(e, C);
      (s.set(k, b), a.set(k, new Set([...b.deps].filter((F) => n.has(F)))));
    }
    let u = new Map(),
      l = new Map();
    for (let k of n.keys()) (u.set(k, 0), l.set(k, []));
    for (let [k, C] of a) for (let b of C) (u.set(k, u.get(k) + 1), l.get(b).push(k));
    let c = i.filter((k) => u.get(k) === 0);
    c.sort((k, C) => o.get(k) - o.get(C));
    let f = [],
      p = new Set();
    while (c.length) {
      let k = c.shift();
      (f.push(n.get(k)), p.add(k));
      for (let C of l.get(k))
        if ((u.set(C, u.get(C) - 1), u.get(C) === 0)) {
          let b = o.get(C),
            F = 0;
          while (F < c.length && o.get(c[F]) < b) F++;
          c.splice(F, 0, C);
        }
    }
    let h = i.filter((k) => !p.has(k)),
      g = Fp(h, a, n, o);
    return { order: f, cycles: g, depMap: s, assertionIds: t, chartIds: r };
  }
  function Fp(e, n, t, r) {
    let i = new Set(e),
      o = Rp(e, n, i),
      s = [];
    for (let a of o) {
      if (a.length === 1 && !n.get(a[0]).has(a[0])) continue;
      let u = new Set(a),
        l = new Map();
      for (let h of a) l.set(h, []);
      for (let h of a) for (let g of n.get(h)) if (u.has(g)) l.get(g).push(h);
      for (let h of l.values()) h.sort((g, k) => r.get(g) - r.get(k));
      let c = [...a].sort((h, g) => r.get(h) - r.get(g))[0],
        f = [c],
        p = c;
      for (;;) {
        let h = l.get(p),
          k = h.find((C) => !f.includes(C)) ?? (h.includes(c) ? c : void 0);
        if (k === void 0) break;
        if ((f.push(k), k === c)) break;
        p = k;
      }
      s.push(f.map((h) => t.get(h)));
    }
    return s;
  }
  function Rp(e, n, t) {
    let r = 0,
      i = new Map(),
      o = new Map(),
      s = new Set(),
      a = [],
      u = [],
      l = (c) => {
        (i.set(c, r), o.set(c, r), r++, a.push(c), s.add(c));
        for (let f of n.get(c) ?? []) {
          if (!t.has(f)) continue;
          if (!i.has(f)) (l(f), o.set(c, Math.min(o.get(c), o.get(f))));
          else if (s.has(f)) o.set(c, Math.min(o.get(c), i.get(f)));
        }
        if (o.get(c) === i.get(c)) {
          let f = [];
          for (;;) {
            let p = a.pop();
            if ((s.delete(p), f.push(p), p === c)) break;
          }
          u.push(f);
        }
      };
    for (let c of e) if (!i.has(c)) l(c);
    return u;
  }
  var Wa = "[^\\d\\s.\\-%]",
    Pp = new RegExp(
      `^(?<sign1>-?)\\s*(?<pre>${Wa}*)\\s*(?<sign2>-?)\\s*(?<num>\\d+(?:\\.\\d+)?)\\s*(?<post>${Wa}*)$`,
    );
  function st(e) {
    let n = e.trim();
    if (n === "") return { kind: "not-a-number" };
    let t = Pp.exec(n);
    if (!t?.groups) return { kind: "not-a-number" };
    let { sign1: r, pre: i, sign2: o, num: s, post: a } = t.groups;
    if (r && o) return { kind: "not-a-number" };
    if (i && a) return { kind: "both-sides", pre: i, post: a };
    let u = r || o ? "-" : "",
      l = i ? { text: i, side: "prefix" } : a ? { text: a, side: "suffix" } : null;
    return { kind: "number", num: u + s, unit: l };
  }
  function Lp(e) {
    return e ? `${e.side}:${e.text}` : "(none)";
  }
  function Ga(e) {
    return e ? e.text : "(none)";
  }
  function Ye(e, n) {
    if (!n) return e;
    if (n.side === "suffix") return `${e} ${n.text}`;
    return e.startsWith("-") ? `-${n.text}${e.slice(1)}` : `${n.text}${e}`;
  }
  function Za(e) {
    let n = [];
    if (
      (e.forEach((o, s) => {
        let a = st(o ?? "");
        if (a.kind !== "number") return;
        n.push({ key: Lp(a.unit), unit: a.unit, row: s });
      }),
      n.length === 0)
    )
      return { unit: null, conflict: !1, forms: [], firstDeviantRow: null };
    let t = n[0],
      r = n.find((o) => o.key !== t.key);
    if (!r) return { unit: t.unit, conflict: !1, forms: [Ga(t.unit)], firstDeviantRow: null };
    let i = [];
    for (let o of n) {
      let s = Ga(o.unit);
      if (!i.includes(s)) i.push(s);
    }
    return { unit: null, conflict: !0, forms: i, firstDeviantRow: r.row };
  }
  function at(e) {
    let n = e.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(n)) return new ue(n);
    let t = /^(\d+(?:\.\d+)?)%$/.exec(n);
    if (t) return new ue(t[1]).div(100);
    let r = st(n);
    return r.kind === "number" ? new ue(r.num) : null;
  }
  var vr = () => ({}),
    Dp = /<visimark\s+sheet="([^"]*)"\s+chart="([^"]*)"\s*\/>/;
  function Ya(e, n) {
    return `<metadata><visimark sheet="${e}" chart="${n}"/></metadata>`;
  }
  function Bp(e) {
    let n = Dp.exec(e);
    return n ? { sheet: n[1], chart: n[2] } : null;
  }
  function Qa(e) {
    return e.replace(
      /\r\n/g,
      `
`,
    );
  }
  function Ka(e, n, t, r) {
    if (!vr.existsSync(e)) return { state: "missing" };
    let i;
    try {
      i = vr.readFileSync(e, "utf8");
    } catch {
      return { state: "missing" };
    }
    let o = Bp(i);
    if (!o) return { state: "unowned" };
    if (o.sheet !== t || o.chart !== r) return { state: "foreign", sheet: o.sheet, chart: o.chart };
    return Qa(i) === Qa(n) ? { state: "current" } : { state: "stale" };
  }
  var Dt = 640,
    Bt = "#808080",
    Xt = 1,
    Np = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    zp = 0.6;
  function Ar(e) {
    return Math.round((Dt * e.h) / e.w);
  }
  function Mr(e, n) {
    return e.length * zp * n;
  }
  function pe(e) {
    return (Object.is(e, -0) ? 0 : e).toFixed(2);
  }
  function Op(e) {
    return e
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  var Xa = 51,
    $p = 204;
  function Fr(e) {
    if (e <= 0) return [];
    if (e === 1) return ["#808080"];
    let n = ($p - Xa) / (e - 1);
    return Array.from({ length: e }, (t, r) => {
      let o = Math.round(Xa + r * n)
        .toString(16)
        .padStart(2, "0");
      return `#${o}${o}${o}`;
    });
  }
  function Nt(e, n, t, r = {}) {
    let i = r.size ?? 12,
      o = r.anchor ?? "middle",
      s =
        r.length !== void 0 ? ` textLength="${pe(r.length)}" lengthAdjust="spacingAndGlyphs"` : "";
    return `<text x="${pe(e)}" y="${pe(n)}" font-family="${Np}" font-size="${i}" text-anchor="${o}" fill="${Bt}"${s}>${Op(t)}</text>`;
  }
  function Rr(e, n) {
    return Ye(e.toFixed(n.precision), n.unit);
  }
  function Ja(e, n, t, r) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Dt} ${t}" role="img">` +
      Ya(e, n) +
      r.join("") +
      `</svg>
`
    );
  }
  function eu(e, n, t = 5) {
    let r = Math.min(0, e),
      i = Math.max(0, n);
    if (r === i) return [0];
    let o = (i - r) / t,
      s = Math.pow(10, Math.floor(Math.log10(o))),
      a = o / s,
      u = s * (a <= 1 ? 1 : a <= 2 ? 2 : a <= 5 ? 5 : 10),
      l = Math.floor(r / u) * u,
      c = Math.ceil(i / u) * u,
      f = [];
    for (let p = l; p <= c + u / 2; p += u) f.push(Math.abs(p) < u / 1e6 ? 0 : p);
    return f;
  }
  var Jt = 70,
    tu = 16,
    wo = 18,
    _p = 26;
  function nu(e) {
    let { series: n, labels: t } = e;
    if (n.length === 0) return { err: "a bar chart needs a series" };
    let r = n[0].values.length,
      i = Ar(e.aspect),
      o = n.length > 1 ? 20 : 0,
      s = wo + o,
      a = i - _p,
      u = a - s,
      l = Dt - Jt - tu,
      c = n.flatMap((z) => z.values.map((E) => E.toNumber())),
      f = eu(Math.min(...c), Math.max(...c)),
      p = f[0],
      g = f[f.length - 1] - p || 1,
      k = (z) => a - ((z - p) / g) * u,
      C = Fr(n.length),
      b = [];
    for (let z of f) {
      let E = k(z);
      b.push(
        `<line x1="${pe(Jt)}" y1="${pe(E)}" x2="${pe(Dt - tu)}" y2="${pe(E)}" stroke="${Bt}" stroke-width="${z === 0 ? Xt : 0.5}"/>`,
      );
      let _ = qp(z);
      b.push(Nt(Jt - 6, E + 4, _, { anchor: "end", size: 11, length: Mr(_, 11) }));
    }
    let F = l / Math.max(r, 1),
      M = F * 0.7,
      q = M / n.length;
    for (let z = 0; z < r; z++) {
      let E = Jt + F * z + (F - M) / 2;
      n.forEach((te, X) => {
        let T = te.values[z]?.toNumber() ?? 0,
          K = Math.min(k(T), k(0)),
          ne = Math.abs(k(T) - k(0));
        b.push(
          `<rect x="${pe(E + q * X)}" y="${pe(K)}" width="${pe(q)}" height="${pe(ne)}" fill="${C[X]}" stroke="${Bt}" stroke-width="${Xt}"/>`,
        );
      });
      let _ = t[z] ?? "";
      b.push(Nt(Jt + F * z + F / 2, a + 16, _, { size: 11, length: Math.min(Mr(_, 11), F - 4) }));
    }
    if (n.length > 1) {
      let z = Jt;
      n.forEach((E, _) => {
        (b.push(
          `<rect x="${pe(z)}" y="${pe(wo - 8)}" width="10" height="10" fill="${C[_]}" stroke="${Bt}" stroke-width="${Xt}"/>`,
        ),
          b.push(Nt(z + 14, wo + 1, E.name, { anchor: "start", size: 11 })),
          (z += 14 + Mr(E.name, 11) + 16));
      });
    }
    if (n.length === 1) {
      let z = n[0];
      for (let E = 0; E < r; E++) {
        let _ = z.values[E],
          te = k(_.toNumber());
        b.push(Nt(Jt + F * E + F / 2, te - 5, Rr(_, z), { size: 10 }));
      }
    }
    return { body: b, height: i };
  }
  function qp(e) {
    let n = e.toFixed(2);
    return n.endsWith(".00") ? n.slice(0, -3) : n;
  }
  function ru(e) {
    if (e.series.length !== 1) return { err: "a pie takes one series" };
    let n = e.series[0],
      t = n.values.findIndex((f) => f.isNegative());
    if (t !== -1)
      return {
        err:
          "pie of `" +
          n.name +
          "` contains a negative value (" +
          n.values[t].toFixed(n.precision) +
          ", row " +
          (t + 1) +
          ")",
      };
    let r = n.values.reduce((f, p) => f.plus(p), n.values[0].mul(0));
    if (r.isZero()) return { err: "pie of `" + n.name + "` sums to zero" };
    let i = Ar(e.aspect),
      o = Dt / 2,
      s = i / 2,
      a = Math.min(Dt, i) * 0.34,
      u = Fr(n.values.length),
      l = [],
      c = -90;
    return (
      n.values.forEach((f, p) => {
        let h = f.div(r),
          g = h.toNumber() * 360,
          k = u[p];
        if (n.values.length === 1)
          l.push(
            `<circle cx="${pe(o)}" cy="${pe(s)}" r="${pe(a)}" fill="${k}" stroke="${Bt}" stroke-width="${Xt}"/>`,
          );
        else {
          let z = (c * Math.PI) / 180,
            E = ((c + g) * Math.PI) / 180,
            _ = o + a * Math.cos(z),
            te = s + a * Math.sin(z),
            X = o + a * Math.cos(E),
            T = s + a * Math.sin(E),
            K = g > 180 ? 1 : 0;
          l.push(
            `<path d="M ${pe(o)} ${pe(s)} L ${pe(_)} ${pe(te)} A ${pe(a)} ${pe(a)} 0 ${K} 1 ${pe(X)} ${pe(T)} Z" fill="${k}" stroke="${Bt}" stroke-width="${Xt}"/>`,
          );
        }
        let C = ((c + g / 2) * Math.PI) / 180,
          b = o + a * 1.28 * Math.cos(C),
          F = s + a * 1.28 * Math.sin(C),
          M = h.mul(100).toFixed(1),
          q = e.labels[p] ?? "";
        (l.push(Nt(b, F, `${q} ${M}%`, { size: 12 })),
          l.push(Nt(b, F + 14, Rr(f, n), { size: 11 })),
          (c += g));
      }),
      { body: l, height: i }
    );
  }
  var Pr = new Map();
  function iu(e, n) {
    Pr.set(e, n);
  }
  function ou(e) {
    return Pr.has(e);
  }
  function su(e) {
    return ot(e, Pr.keys(), 3);
  }
  function au(e, n, t) {
    let r = Pr.get(e);
    if (!r) return { err: "unknown chart type `" + e + "`" };
    let i = r(n);
    if ("err" in i) return i;
    return { svg: Ja(t.sheetId, t.chart, i.height, i.body) };
  }
  iu("pie", ru);
  iu("bar", nu);
  var xn = () => ({});
  function ut(e) {
    if (typeof e !== "string")
      throw TypeError("Path must be a string. Received " + JSON.stringify(e));
  }
  function uu(e, n) {
    var t = "",
      r = 0,
      i = -1,
      o = 0,
      s;
    for (var a = 0; a <= e.length; ++a) {
      if (a < e.length) s = e.charCodeAt(a);
      else if (s === 47) break;
      else s = 47;
      if (s === 47) {
        if (i === a - 1 || o === 1);
        else if (i !== a - 1 && o === 2) {
          if (
            t.length < 2 ||
            r !== 2 ||
            t.charCodeAt(t.length - 1) !== 46 ||
            t.charCodeAt(t.length - 2) !== 46
          ) {
            if (t.length > 2) {
              var u = t.lastIndexOf("/");
              if (u !== t.length - 1) {
                if (u === -1) ((t = ""), (r = 0));
                else ((t = t.slice(0, u)), (r = t.length - 1 - t.lastIndexOf("/")));
                ((i = a), (o = 0));
                continue;
              }
            } else if (t.length === 2 || t.length === 1) {
              ((t = ""), (r = 0), (i = a), (o = 0));
              continue;
            }
          }
          if (n) {
            if (t.length > 0) t += "/..";
            else t = "..";
            r = 2;
          }
        } else {
          if (t.length > 0) t += "/" + e.slice(i + 1, a);
          else t = e.slice(i + 1, a);
          r = a - i - 1;
        }
        ((i = a), (o = 0));
      } else if (s === 46 && o !== -1) ++o;
      else o = -1;
    }
    return t;
  }
  function Up(e, n) {
    var t = n.dir || n.root,
      r = n.base || (n.name || "") + (n.ext || "");
    if (!t) return r;
    if (t === n.root) return t + r;
    return t + e + r;
  }
  function kn() {
    var e = "",
      n = !1,
      t;
    for (var r = arguments.length - 1; r >= -1 && !n; r--) {
      var i;
      if (r >= 0) i = arguments[r];
      else {
        if (t === void 0) t = process.cwd();
        i = t;
      }
      if ((ut(i), i.length === 0)) continue;
      ((e = i + "/" + e), (n = i.charCodeAt(0) === 47));
    }
    if (((e = uu(e, !n)), n))
      if (e.length > 0) return "/" + e;
      else return "/";
    else if (e.length > 0) return e;
    else return ".";
  }
  function lu(e) {
    if ((ut(e), e.length === 0)) return ".";
    var n = e.charCodeAt(0) === 47,
      t = e.charCodeAt(e.length - 1) === 47;
    if (((e = uu(e, !n)), e.length === 0 && !n)) e = ".";
    if (e.length > 0 && t) e += "/";
    if (n) return "/" + e;
    return e;
  }
  function bo(e) {
    return (ut(e), e.length > 0 && e.charCodeAt(0) === 47);
  }
  function Vp() {
    if (arguments.length === 0) return ".";
    var e;
    for (var n = 0; n < arguments.length; ++n) {
      var t = arguments[n];
      if ((ut(t), t.length > 0))
        if (e === void 0) e = t;
        else e += "/" + t;
    }
    if (e === void 0) return ".";
    return lu(e);
  }
  function Hp(e, n) {
    if ((ut(e), ut(n), e === n)) return "";
    if (((e = kn(e)), (n = kn(n)), e === n)) return "";
    var t = 1;
    for (; t < e.length; ++t) if (e.charCodeAt(t) !== 47) break;
    var r = e.length,
      i = r - t,
      o = 1;
    for (; o < n.length; ++o) if (n.charCodeAt(o) !== 47) break;
    var s = n.length,
      a = s - o,
      u = i < a ? i : a,
      l = -1,
      c = 0;
    for (; c <= u; ++c) {
      if (c === u) {
        if (a > u) {
          if (n.charCodeAt(o + c) === 47) return n.slice(o + c + 1);
          else if (c === 0) return n.slice(o + c);
        } else if (i > u) {
          if (e.charCodeAt(t + c) === 47) l = c;
          else if (c === 0) l = 0;
        }
        break;
      }
      var f = e.charCodeAt(t + c),
        p = n.charCodeAt(o + c);
      if (f !== p) break;
      else if (f === 47) l = c;
    }
    var h = "";
    for (c = t + l + 1; c <= r; ++c)
      if (c === r || e.charCodeAt(c) === 47)
        if (h.length === 0) h += "..";
        else h += "/..";
    if (h.length > 0) return h + n.slice(o + l);
    else {
      if (((o += l), n.charCodeAt(o) === 47)) ++o;
      return n.slice(o);
    }
  }
  function jp(e) {
    return e;
  }
  function Lr(e) {
    if ((ut(e), e.length === 0)) return ".";
    var n = e.charCodeAt(0),
      t = n === 47,
      r = -1,
      i = !0;
    for (var o = e.length - 1; o >= 1; --o)
      if (((n = e.charCodeAt(o)), n === 47)) {
        if (!i) {
          r = o;
          break;
        }
      } else i = !1;
    if (r === -1) return t ? "/" : ".";
    if (t && r === 1) return "//";
    return e.slice(0, r);
  }
  function Wp(e, n) {
    if (n !== void 0 && typeof n !== "string") throw TypeError('"ext" argument must be a string');
    ut(e);
    var t = 0,
      r = -1,
      i = !0,
      o;
    if (n !== void 0 && n.length > 0 && n.length <= e.length) {
      if (n.length === e.length && n === e) return "";
      var s = n.length - 1,
        a = -1;
      for (o = e.length - 1; o >= 0; --o) {
        var u = e.charCodeAt(o);
        if (u === 47) {
          if (!i) {
            t = o + 1;
            break;
          }
        } else {
          if (a === -1) ((i = !1), (a = o + 1));
          if (s >= 0)
            if (u === n.charCodeAt(s)) {
              if (--s === -1) r = o;
            } else ((s = -1), (r = a));
        }
      }
      if (t === r) r = a;
      else if (r === -1) r = e.length;
      return e.slice(t, r);
    } else {
      for (o = e.length - 1; o >= 0; --o)
        if (e.charCodeAt(o) === 47) {
          if (!i) {
            t = o + 1;
            break;
          }
        } else if (r === -1) ((i = !1), (r = o + 1));
      if (r === -1) return "";
      return e.slice(t, r);
    }
  }
  function Gp(e) {
    ut(e);
    var n = -1,
      t = 0,
      r = -1,
      i = !0,
      o = 0;
    for (var s = e.length - 1; s >= 0; --s) {
      var a = e.charCodeAt(s);
      if (a === 47) {
        if (!i) {
          t = s + 1;
          break;
        }
        continue;
      }
      if (r === -1) ((i = !1), (r = s + 1));
      if (a === 46) {
        if (n === -1) n = s;
        else if (o !== 1) o = 1;
      } else if (n !== -1) o = -1;
    }
    if (n === -1 || r === -1 || o === 0 || (o === 1 && n === r - 1 && n === t + 1)) return "";
    return e.slice(n, r);
  }
  function Zp(e) {
    if (e === null || typeof e !== "object")
      throw TypeError(
        'The "pathObject" argument must be of type Object. Received type ' + typeof e,
      );
    return Up("/", e);
  }
  function Qp(e) {
    ut(e);
    var n = { root: "", dir: "", base: "", ext: "", name: "" };
    if (e.length === 0) return n;
    var t = e.charCodeAt(0),
      r = t === 47,
      i;
    if (r) ((n.root = "/"), (i = 1));
    else i = 0;
    var o = -1,
      s = 0,
      a = -1,
      u = !0,
      l = e.length - 1,
      c = 0;
    for (; l >= i; --l) {
      if (((t = e.charCodeAt(l)), t === 47)) {
        if (!u) {
          s = l + 1;
          break;
        }
        continue;
      }
      if (a === -1) ((u = !1), (a = l + 1));
      if (t === 46) {
        if (o === -1) o = l;
        else if (c !== 1) c = 1;
      } else if (o !== -1) c = -1;
    }
    if (o === -1 || a === -1 || c === 0 || (c === 1 && o === a - 1 && o === s + 1)) {
      if (a !== -1)
        if (s === 0 && r) n.base = n.name = e.slice(1, a);
        else n.base = n.name = e.slice(s, a);
    } else {
      if (s === 0 && r) ((n.name = e.slice(1, o)), (n.base = e.slice(1, a)));
      else ((n.name = e.slice(s, o)), (n.base = e.slice(s, a)));
      n.ext = e.slice(o, a);
    }
    if (s > 0) n.dir = e.slice(0, s - 1);
    else if (r) n.dir = "/";
    return n;
  }
  var Dr = "/",
    Yp = ":",
    vC = ((e) => ((e.posix = e), e))({
      resolve: kn,
      normalize: lu,
      isAbsolute: bo,
      join: Vp,
      relative: Hp,
      _makeLong: jp,
      dirname: Lr,
      basename: Wp,
      extname: Gp,
      format: Zp,
      parse: Qp,
      sep: Dr,
      delimiter: Yp,
      win32: null,
      posix: null,
    });
  var Kp = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i,
    Xp = /[\x00-\x1f\x7f]/;
  function cu(e, n) {
    if (n.length === 0) return { err: "artifact path is empty" };
    if (Xp.test(n)) return { err: "artifact path contains a control character" };
    if (/^[A-Za-z]:/.test(n)) return { err: "artifact path must be relative, not a drive letter" };
    if (/^[a-z][a-z0-9+.-]*:/i.test(n))
      return { err: "artifact path must be a relative path, not a URL" };
    if (bo(n) || n.startsWith("/") || n.startsWith("\\"))
      return { err: "artifact path must be relative" };
    if (!n.endsWith(".svg")) return { err: "artifact path must end in `.svg`" };
    for (let o of n.split(/[\\/]/))
      if (Kp.test(o)) return { err: "artifact path uses a reserved device name `" + o + "`" };
    let t = So(Lr(kn(e))),
      r = kn(t, n);
    if (!yo(t, r)) return { err: "artifact path escapes the document's directory" };
    if (xn.existsSync(r)) {
      let o = So(r);
      if (o !== r && !yo(t, o))
        return { err: "artifact path resolves through a symlink out of the document's directory" };
    }
    let i = Lr(r);
    if (xn.existsSync(i)) {
      let o = So(i);
      if (o !== i && !yo(t, o))
        return { err: "artifact path resolves through a symlink out of the document's directory" };
    }
    return { ok: r };
  }
  function yo(e, n) {
    return n === e || n.startsWith(e.endsWith(Dr) ? e : e + Dr);
  }
  function So(e) {
    try {
      return xn.realpathSync(e);
    } catch {
      return e;
    }
  }
  var fu = 2,
    du = "a boolean cannot be stored; wrap it in `IF()` to produce a number or a string";
  class He extends Error {}
  var pu = /^(\d+(?:\.\d+)?)%$/,
    Jp = /^\d{1,4}[./-]\d{1,4}[./-]\d{1,4}$/;
  function xt(e, n = {}) {
    let { order: t, cycles: r, assertionIds: i, chartIds: o } = zn(e),
      s = new Map();
    for (let S of e.sheets.values()) for (let R of S.assertions) s.set(R.id, R);
    let a = new Map(),
      u = new Set(),
      l = new Map(),
      c = (S) => {
        a.set(S, (a.get(S) ?? 0) + 1);
      },
      f = new Map(),
      p = new Map(),
      h = new Set(),
      g = new Map(),
      k = new Map(),
      C = new Map(),
      b = new Map(),
      F = new Set(),
      M = new Set(),
      q = new Set(),
      z = [],
      E = 0,
      _ = (S, R = {}) => {
        z.push({ f: S, det: E++, ...R });
      };
    for (let S of e.findings) _(S);
    nh(e, _);
    let te = rh(e);
    for (let S of e.sheets.values()) {
      let R = S.table;
      if (!R) continue;
      for (let [I, D] of S.columnIndex) {
        let V = `${S.id}.${I}`,
          O = R.rows.map((fe) => fe.cells[D]?.text),
          se = O.findIndex((fe) => st(fe ?? "").kind === "both-sides");
        if (se !== -1) {
          let fe = R.rows[se].cells[D];
          (F.add(V),
            C.set(V, null),
            _(
              {
                code: "UNIT",
                sheetId: S.id,
                name: I,
                rowLabel: On(R, se),
                raw: O[se],
                message: `\`${O[se]}\` is decorated on both sides; a unit sits before the number or after it, not both`,
                span: fe ? { start: fe.start, end: fe.end } : void 0,
              },
              { sheetId: S.id },
            ));
          continue;
        }
        let ae = Za(O);
        if ((C.set(V, ae.unit), ae.conflict)) {
          F.add(V);
          let fe = ae.firstDeviantRow,
            Te = R.rows[fe].cells[D];
          _(
            {
              code: "UNIT",
              sheetId: S.id,
              name: I,
              rowLabel: On(R, fe),
              raw: O[fe],
              message: `column mixes units: ${ae.forms.join(" and ")}`,
              span: Te ? { start: Te.start, end: Te.end } : void 0,
            },
            { sheetId: S.id },
          );
        }
      }
    }
    let X = new Set(),
      T = [];
    for (let S of t) {
      let R = e.sheets.get(S.sheetId);
      if (S.sheetId && !T.includes(S.sheetId)) T.push(S.sheetId);
      let I = xo(e, S);
      if (i.has(S.id)) {
        Sn(s.get(S.id), S, I);
        continue;
      }
      if (I.callErrors.length > 0) {
        for (let { call: D, problem: V } of I.callErrors)
          _(
            {
              code: "TYPE",
              sheetId: S.sheetId,
              name: S.name,
              message: gn(D.name, V),
              suggestion: V.kind === "unknown" ? (ot(D.name, Nn.keys(), fu) ?? void 0) : void 0,
              sourceOffset: D.start,
              span: { start: D.start, end: D.end },
            },
            { sheetId: S.sheetId },
          );
        h.add(S.id);
        continue;
      }
      if (I.undefRefs.length > 0) {
        for (let D of I.undefRefs) {
          let V = kt(e, S.sheetId, D);
          _(
            {
              code: "UNDEF",
              sheetId: S.sheetId,
              name: S.name,
              raw: Kt(D),
              suggestion: V.kind === "unknown" ? (V.suggestion ?? void 0) : void 0,
              sourceOffset: D.start,
              span: { start: D.start, end: D.end },
            },
            { sheetId: S.sheetId },
          );
        }
        h.add(S.id);
        continue;
      }
      if (I.vectorRefs.length > 0) {
        for (let D of I.vectorRefs)
          _(
            {
              code: "VECTOR",
              sheetId: S.sheetId,
              name: S.name,
              raw: Kt(D),
              sourceOffset: D.start,
              span: { start: D.start, end: D.end },
            },
            { sheetId: S.sheetId },
          );
        h.add(S.id);
        continue;
      }
      if ([...I.deps].some((D) => h.has(D))) {
        h.add(S.id);
        continue;
      }
      if (o.has(S.id)) {
        X.add(S.id);
        continue;
      }
      if (
        [...I.deps].some((D) => F.has(D)) ||
        I.refs.some(
          (D) => D.res.kind === "input-column" && F.has(`${D.res.sheetId}.${D.res.column}`),
        )
      )
        F.add(S.id);
      if (S.kind === "column" && R?.table) y(S, R, R.table);
      else Be(S);
    }
    for (let S of r) {
      _({ code: "CYCLE", sheetId: S[0]?.sheetId, cyclePath: S.map((R) => R.id), span: S[0]?.span });
      for (let R of S) h.add(R.id);
    }
    for (let S of i) {
      if (u.has(S)) continue;
      let R = s.get(S);
      (l.set(S, {
        sheetId: R.sheetId,
        source: R.source,
        holds: null,
        operands: {},
        substituted: R.source.replace(/^assert\s+/, ""),
      }),
        c(R.sheetId));
    }
    for (let [S, R] of a)
      if (R > 0)
        _(
          {
            code: "NOTE",
            sheetId: S,
            suppressedCount: R,
            message: `${R} assertion${R === 1 ? "" : "s"} not verified (upstream errors)`,
          },
          { sheetId: S },
        );
    let K = [],
      ne = new Map();
    for (let S of e.sheets.values()) {
      let R = 0;
      for (let I of S.charts) {
        let D = `${I.sheetId}.${I.name}`,
          V = (le, $e) =>
            _(
              {
                code: "ARTIFACT",
                sheetId: I.sheetId,
                name: I.name,
                message: le,
                ...($e ? { suggestion: $e } : {}),
                sourceOffset: I.span.start,
                span: I.span,
              },
              { sheetId: I.sheetId },
            );
        if (!X.has(I.id)) {
          (R++, K.push({ ...me(I), path: null, state: "skipped" }));
          continue;
        }
        if (!ou(I.engine)) {
          (V("unknown chart type `" + I.engine + "`", su(I.engine) ?? void 0),
            K.push({ ...me(I), path: null, state: "error" }));
          continue;
        }
        let O = ko(I),
          se = [],
          ae = null;
        for (let le of I.series) {
          let $e = w(O, le);
          if (typeof $e === "string") {
            ae = $e;
            break;
          }
          if ($e.length === 0) {
            ae = "`" + le + "` has no rows";
            break;
          }
          if ($e.some((Je) => Je.t !== "num")) {
            ae = "`" + le + "` needs numbers";
            break;
          }
          let yt = le.includes(".") ? le.slice(le.indexOf(".") + 1) : le,
            Fe = `${I.sheetId}.${yt}`;
          se.push({
            name: le,
            values: $e.map((Je) => Je.d),
            unit: C.get(Fe) ?? null,
            precision: g.get(Fe) ?? Ge(I.sheetId, yt),
          });
        }
        if (ae) {
          (V(ae), K.push({ ...me(I), path: null, state: "error" }));
          continue;
        }
        let fe = se.map((le) => (le.unit ? `${le.unit.side}:${le.unit.text}` : ""));
        if (new Set(fe).size > 1) {
          (_(
            {
              code: "UNIT",
              sheetId: I.sheetId,
              name: I.name,
              message: "a chart's series must agree about their unit",
              sourceOffset: I.span.start,
              span: I.span,
            },
            { sheetId: I.sheetId },
          ),
            K.push({ ...me(I), path: null, state: "error" }));
          continue;
        }
        let Te = Oe(I.sheetId, I.labels);
        if (typeof Te === "string") {
          (V(Te), K.push({ ...me(I), path: null, state: "error" }));
          continue;
        }
        let v = Te,
          A = e.anchors.find(
            (le) => le.sheetId === I.sheetId && le.name === I.name && le.imageUrl !== void 0,
          );
        if (!A?.imageUrl) {
          (V("no image reference for this chart — add `![...](path)<!--vmark=" + D + "-->`"),
            K.push({ ...me(I), path: null, state: "error" }));
          continue;
        }
        let N = A.imageUrl,
          J = ne.get(N);
        if (J && J !== D) {
          (V("two charts write to `" + N + "`"), K.push({ ...me(I), path: N, state: "error" }));
          continue;
        }
        ne.set(N, D);
        let re = au(
          I.engine,
          { series: se, labels: v, aspect: I.aspect ?? { w: 16, h: 10 } },
          { sheetId: I.sheetId, chart: I.name },
        );
        if ("err" in re) {
          (V(re.err), K.push({ ...me(I), path: N, state: "error" }));
          continue;
        }
        if (n.docPath === void 0) {
          K.push({ ...me(I), path: N, state: "skipped", svg: re.svg });
          continue;
        }
        let xe = cu(n.docPath, N);
        if ("err" in xe) {
          (V(xe.err), K.push({ ...me(I), path: N, state: "error" }));
          continue;
        }
        let Me = Ka(xe.ok, re.svg, I.sheetId, I.name);
        if (Me.state === "unowned") {
          (V("`" + N + "` exists and was not generated by visimark"),
            K.push({ ...me(I), path: N, state: "error", target: xe.ok }));
          continue;
        }
        if (Me.state === "foreign") {
          (V("`" + N + "` belongs to chart `" + Me.sheet + "." + Me.chart + "`"),
            K.push({ ...me(I), path: N, state: "error", target: xe.ok }));
          continue;
        }
        if (Me.state !== "current")
          _(
            {
              code: "STALE",
              sheetId: I.sheetId,
              name: I.name,
              artifact: N,
              message:
                Me.state === "missing"
                  ? "artifact missing at `" + N + "`"
                  : "artifact is out of date — run `visimark fmt`",
              sourceOffset: I.span.start,
              span: I.span,
            },
            { sheetId: I.sheetId },
          );
        K.push({
          ...me(I),
          path: N,
          state: Me.state === "current" ? "current" : Me.state,
          target: xe.ok,
          svg: re.svg,
        });
      }
      if (R > 0)
        _(
          {
            code: "NOTE",
            sheetId: S.id,
            message: `${R} chart${R === 1 ? "" : "s"} not built (upstream errors)`,
          },
          { sheetId: S.id },
        );
    }
    let U = new Set();
    for (let S of e.sheets.values()) for (let R of S.charts) U.add(`${R.sheetId}.${R.name}`);
    let W = 0;
    for (let S of e.anchors) {
      let R = `${S.sheetId}.${S.name}`;
      if (M.has(R)) W++;
      let I = (V) =>
        _({
          code: "ANCHOR",
          sheetId: S.sheetId,
          name: S.name,
          sourceOffset: S.commentSpan.start,
          span: S.commentSpan,
          ...(V ? { message: V } : {}),
        });
      if (S.value === null) {
        I();
        continue;
      }
      let D = U.has(R);
      if (S.value.kind === "image" && !D) {
        I("an image anchor must name a chart");
        continue;
      }
      if (S.value.kind !== "image" && D) I("a chart must be anchored to an image");
    }
    if (W > 0) _({ code: "STALE", anchorGroup: !0, suppressedCount: W });
    let H = ah(e),
      Q = new Set(e.anchors.map((S) => `${S.sheetId}.${S.name}`));
    for (let S of e.sheets.values())
      for (let R of S.scalars.values()) {
        if (H.has(R.id) || Q.has(R.id)) continue;
        if (h.has(R.id)) continue;
        if (z.some((I) => I.f.sheetId === R.sheetId && I.f.name === R.name)) continue;
        _({
          code: "WARN",
          sheetId: R.sheetId,
          name: R.name,
          suggestion: ot(R.name, [...H].map(uh)) ?? void 0,
          span: R.span,
        });
      }
    let ge = eh(z, T),
      De = [];
    for (let S of e.sheets.values())
      for (let R of S.assertions) {
        let I = l.get(R.id);
        if (I) De.push(I);
      }
    return {
      findings: ge,
      values: f,
      cells: p,
      columnPrecision: g,
      scalarPrecision: k,
      columnUnits: C,
      scalarUnits: b,
      unitConflicts: F,
      assertions: De,
      charts: K,
      exitCode: ge.some(Ua) ? 1 : 0,
    };
    function me(S) {
      return {
        sheetId: S.sheetId,
        name: S.name,
        engine: S.engine,
        series: S.series,
        labels: S.labels,
      };
    }
    function w(S, R) {
      let I = R.indexOf("."),
        D =
          I === -1
            ? { type: "ref", name: R, start: S.span.start, end: S.span.end }
            : {
                type: "ref",
                qualifier: R.slice(0, I),
                name: R.slice(I + 1),
                start: S.span.start,
                end: S.span.end,
              };
      try {
        return Cn(S, D, void 0);
      } catch {
        return "`" + R + "` contains a blank cell";
      }
    }
    function Oe(S, R) {
      let I = e.sheets.get(S),
        D = I?.columnIndex.get(R);
      if (!I?.table || D === void 0) return "`" + R + "` is not a column of this sheet";
      return I.table.rows.map((V) => (V.cells[D]?.text ?? "").trim());
    }
    function Ge(S, R) {
      let I = e.sheets.get(S),
        D = I?.columnIndex.get(R);
      if (I?.table && D !== void 0)
        for (let V of I.table.rows) {
          let O = (V.cells[D]?.text ?? "").trim();
          if (O) return $n(O, 2);
        }
      return 2;
    }
    function y(S, R, I) {
      let D = `${R.id}.${S.name}`,
        V = R.columnIndex.get(S.name),
        O = th(I, V, te);
      g.set(D, O);
      let se = C.get(D) ?? null,
        ae = F.has(D),
        fe = [],
        Te = 0;
      for (let v = 0; v < I.rows.length; v++)
        try {
          let A = Lt(S.expr, bt(S, R, v));
          if (A.t === "bool") {
            (_(
              { code: "TYPE", sheetId: R.id, name: S.name, message: du, span: S.span },
              { sheetId: R.id },
            ),
              h.add(S.id));
            return;
          }
          let N = wn(A, O);
          fe.push(N);
          let J = I.rows[v].cells[V],
            re = J?.text ?? "";
          if (!ae && re !== "" && !en(N, re, O))
            _(
              {
                code: "STALE",
                sheetId: R.id,
                name: S.name,
                rowLabel: On(I, v),
                stored: re,
                computed: Ye(lt(N, O), se),
                formula: hu(e, S),
                span: J ? { start: J.start, end: J.end } : void 0,
              },
              { sheetId: R.id, rowIndex: v, isColumnCell: !0 },
            );
        } catch (A) {
          if (A instanceof He) (fe.push(null), Te++);
          else if (A instanceof he) {
            fe.push(null);
            let N = I.rows[v]?.cells[V];
            _(
              {
                code: A.code,
                sheetId: R.id,
                name: S.name,
                rowLabel: On(I, v),
                message: A.message,
                span: N ? { start: N.start, end: N.end } : void 0,
              },
              { sheetId: R.id },
            );
          } else throw A;
        }
      if ((p.set(D, fe), Te > 0))
        _(
          {
            code: "NOTE",
            sheetId: R.id,
            name: S.name,
            suppressedCount: Te,
            message: `${Te} row${Te === 1 ? "" : "s"} not verified (upstream DATE errors)`,
          },
          { sheetId: R.id },
        );
    }
    function Be(S) {
      try {
        let R = Lt(S.expr, Ke(S));
        if (R.t === "bool") {
          (_(
            { code: "TYPE", sheetId: S.sheetId, name: S.name, message: du, span: S.span },
            { sheetId: S.sheetId },
          ),
            h.add(S.id));
          return;
        }
        let I = sh(e, S.id),
          D =
            I !== void 0
              ? (() => {
                  let se = st(I);
                  return se.kind === "number" ? se.unit : null;
                })()
              : null;
        b.set(S.id, D);
        let V = I !== void 0 ? $n(I, te) : void 0;
        if (V !== void 0) k.set(S.id, V);
        let O = V !== void 0 ? wn(R, V) : R;
        if ((f.set(S.id, O), I !== void 0 && V !== void 0 && !en(O, I, V))) {
          if ((M.add(S.id), !ih(e, S)))
            _(
              {
                code: "STALE",
                sheetId: S.sheetId,
                name: S.name,
                stored: I,
                computed: Ye(lt(O, V), D),
                formula: hu(e, S),
                span: oh(e, S.id) ?? S.span,
              },
              { sheetId: S.sheetId },
            );
        }
      } catch (R) {
        if (R instanceof He) h.add(S.id);
        else if (R instanceof he)
          (h.add(S.id),
            _(
              { code: R.code, sheetId: S.sheetId, name: S.name, message: R.message, span: S.span },
              { sheetId: S.sheetId },
            ));
        else throw R;
      }
    }
    function Ke(S) {
      return { scalar: (R) => $t(S, R, null), vector: (R) => Cn(S, R, null) };
    }
    function Sn(S, R, I) {
      u.add(S.id);
      let D = { sheetId: S.sheetId, source: S.source, span: S.span },
        V = (O) => {
          l.set(S.id, {
            sheetId: S.sheetId,
            source: S.source,
            holds: O,
            operands: O === null ? {} : nn(R),
            substituted: O === null ? ke(S) : je(R),
          });
        };
      if (I.callErrors.length > 0) {
        V(null);
        for (let { call: O, problem: se } of I.callErrors)
          _(
            {
              ...D,
              code: "TYPE",
              message: gn(O.name, se),
              suggestion: se.kind === "unknown" ? (ot(O.name, Nn.keys(), fu) ?? void 0) : void 0,
              span: { start: O.start, end: O.end },
            },
            { sheetId: S.sheetId },
          );
        return;
      }
      if (I.undefRefs.length > 0) {
        V(null);
        for (let O of I.undefRefs) {
          let se = kt(e, S.sheetId, O);
          _(
            {
              ...D,
              code: "UNDEF",
              raw: Kt(O),
              suggestion: se.kind === "unknown" ? (se.suggestion ?? void 0) : void 0,
              span: { start: O.start, end: O.end },
            },
            { sheetId: S.sheetId },
          );
        }
        return;
      }
      if (I.vectorRefs.length > 0) {
        V(null);
        for (let O of I.vectorRefs)
          _(
            { ...D, code: "VECTOR", raw: Kt(O), span: { start: O.start, end: O.end } },
            { sheetId: S.sheetId },
          );
        return;
      }
      if ([...I.deps].some((O) => h.has(O))) {
        (V(null), c(S.sheetId));
        return;
      }
      try {
        let O = Lt(R.expr, Ke(R));
        if (O.t !== "bool") {
          (V(null),
            _(
              { ...D, code: "TYPE", message: `assert needs a boolean; \`${ke(S)}\` is ${Ot(O)}` },
              { sheetId: S.sheetId },
            ));
          return;
        }
        if ((V(O.b), O.b === !1))
          _({ ...D, code: "ASSERT", message: je(R) }, { sheetId: S.sheetId });
      } catch (O) {
        if (O instanceof He) (V(null), c(S.sheetId));
        else if (O instanceof he)
          (V(null), _({ ...D, code: O.code, message: O.message }, { sheetId: S.sheetId }));
        else throw O;
      }
    }
    function nn(S) {
      let R = {},
        I = (D) => {
          if (D.type === "ref") R[Kt(D)] = Xe(S, D);
          else if (D.type === "unary") I(D.operand);
          else if (D.type === "binary") (I(D.left), I(D.right));
          else if (D.type === "call") D.args.forEach(I);
        };
      return (I(S.expr), R);
    }
    function ke(S) {
      return S.source.replace(/^assert\s+/, "");
    }
    function Ot(S) {
      return S.t === "num" ? "a number" : S.t === "date" ? "a date" : "a string";
    }
    function je(S) {
      let R = S.expr.start,
        I = e.source.slice(S.expr.start, S.expr.end),
        D = [],
        V = (O) => {
          switch (O.type) {
            case "ref": {
              D.push({ at: O.start - R, to: O.end - R, text: Xe(S, O) });
              break;
            }
            case "unary":
              V(O.operand);
              break;
            case "binary":
              (V(O.left), V(O.right));
              break;
            case "call":
              O.args.forEach(V);
              break;
          }
        };
      (V(S.expr), D.sort((O, se) => se.at - O.at));
      for (let O of D) I = I.slice(0, O.at) + O.text + I.slice(O.to);
      return I;
    }
    function Xe(S, R) {
      let I;
      try {
        I = $t(S, R, null);
      } catch {
        return Kt(R);
      }
      if (I.t === "date") return I.iso;
      if (I.t === "str") return I.s;
      if (I.t === "bool") return String(I.b);
      let D = kt(e, S.sheetId, R),
        V = D.kind === "scalar" || D.kind === "doc-scalar" ? D.binding.id : void 0,
        O = V !== void 0 ? (k.get(V) ?? te) : te;
      return lt(I, O);
    }
    function bt(S, R, I) {
      return {
        scalar: (D) => $t(S, D, { sheet: R, row: I }),
        vector: (D) => Cn(S, D, { sheet: R, row: I }),
      };
    }
    function $t(S, R, I) {
      let D = kt(e, S.sheetId, R);
      if (D.kind === "unknown") throw new He();
      if (D.kind === "doc-scalar" || D.kind === "scalar") {
        if (h.has(D.binding.id)) throw new He();
        let se = f.get(D.binding.id);
        if (!se) throw new He();
        return se;
      }
      if (D.kind === "column") {
        if (!I) throw new He();
        let ae = p.get(D.binding.id)?.[I.row];
        if (ae == null) throw new He();
        return ae;
      }
      if (!I) throw new He();
      let V = I.sheet.columnIndex.get(D.column),
        O = I.sheet.table?.rows[I.row]?.cells[V];
      return En(O?.text ?? "", I.sheet.id, D.column, I.row, O);
    }
    function Cn(S, R, I) {
      let D = kt(e, S.sheetId, R);
      if (D.kind === "column") {
        let V = p.get(D.binding.id);
        if (!V || V.some((O) => O === null)) throw new He();
        return V;
      }
      if (D.kind === "input-column") {
        let V = e.sheets.get(D.sheetId),
          O = V.columnIndex.get(D.column);
        return (V.table?.rows ?? []).map((se, ae) => {
          let fe = se.cells[O];
          return En(fe?.text ?? "", V.id, D.column, ae, fe);
        });
      }
      throw new He();
    }
    function En(S, R, I, D, V) {
      let O = S.trim(),
        se = at(O);
      if (se !== null) return be(se);
      let ae = Ha(O);
      if (ae.ok) return gt(ae.iso);
      if (Jp.test(O) || /^\d{4}-\d{2}-\d{2}$/.test(O)) {
        let fe = `${R}.${I}#${D}`;
        if (!q.has(fe)) {
          q.add(fe);
          let Te = e.sheets.get(R).table;
          _(
            {
              code: "DATE",
              sheetId: R,
              name: I,
              rowLabel: On(Te, D),
              raw: O,
              isoFix: ae.ok ? void 0 : ae.decidable,
              altA: ae.ok ? void 0 : ae.ambiguous?.a,
              altB: ae.ok ? void 0 : ae.ambiguous?.b,
              daysApart: ae.ok ? void 0 : ae.ambiguous?.daysApart,
              span: V ? { start: V.start, end: V.end } : void 0,
            },
            { sheetId: R },
          );
        }
        throw new He();
      }
      return Cr(O);
    }
  }
  function eh(e, n) {
    let t = e.filter((f) => f.f.code === "STALE" && f.isColumnCell),
      r = e.filter((f) => f.f.code === "STALE" && !f.isColumnCell && !f.f.anchorGroup),
      i = e.find((f) => f.f.anchorGroup),
      o = e.filter((f) => f.f.code !== "STALE"),
      s = (f) => {
        let p = f ? n.indexOf(f) : -1;
        return p === -1 ? Number.MAX_SAFE_INTEGER : p;
      },
      a = [],
      u = [...new Set([...t, ...r].map((f) => f.sheetId ?? ""))].sort((f, p) => s(f) - s(p));
    for (let f of u) {
      let p = t.filter((k) => (k.sheetId ?? "") === f),
        h = new Map();
      for (let k of p) {
        let C = h.get(k.rowIndex) ?? [];
        (C.push(k), h.set(k.rowIndex, C));
      }
      let g = [...h.entries()].sort(
        (k, C) => Math.min(...k[1].map((b) => b.det)) - Math.min(...C[1].map((b) => b.det)),
      );
      for (let [, k] of g) {
        k.sort((C, b) => C.det - b.det);
        for (let C of k) a.push(C.f);
      }
      r.filter((k) => (k.sheetId ?? "") === f)
        .sort((k, C) => k.det - C.det)
        .forEach((k) => a.push(k.f));
    }
    if (i) a.push(i.f);
    let l = {
        COVERAGE: 0,
        SHEET: 0,
        TYPE: 0,
        DATE: 1,
        UNIT: 1,
        NOTE: 1,
        UNDEF: 1,
        DUP: 1,
        VECTOR: 1,
        CYCLE: 2,
        ASSERT: 2,
        ANCHOR: 3,
        WARN: 4,
      },
      c = o
        .slice()
        .sort((f, p) => (l[f.f.code] ?? 9) - (l[p.f.code] ?? 9) || f.det - p.det)
        .map((f) => f.f);
    return [...a, ...c];
  }
  function th(e, n, t) {
    let r = -1;
    for (let i of e.rows) {
      let o = i.cells[n]?.text ?? "",
        s = st(o);
      if (s.kind !== "number") continue;
      r = Math.max(r, $n(s.num, t));
    }
    return r === -1 ? t : r;
  }
  function $n(e, n) {
    let t = st(e),
      r = (t.kind === "number" ? t.num : e).trim(),
      i = /\.(\d+)\s*$/.exec(r);
    if (i) return i[1].length;
    if (/^-?\d+$/.test(r)) return 0;
    return n;
  }
  function wn(e, n) {
    return e.t === "num" ? be(Pt(e.d, n)) : e;
  }
  function en(e, n, t) {
    let r = n.trim();
    if (e.t === "num") {
      let i = st(r);
      if (i.kind === "number") return Pt(new ue(i.num), t).equals(Pt(e.d, t));
      if (!pu.test(r)) return !1;
      let o = new ue(pu.exec(r)[1]).div(100);
      return Pt(o, t).equals(Pt(e.d, t));
    }
    if (e.t === "date") return r === e.iso;
    if (e.t === "bool") return r === String(e.b);
    return r === e.s;
  }
  function lt(e, n) {
    if (e.t === "num") return e.d.toFixed(n);
    if (e.t === "date") return e.iso;
    if (e.t === "bool") return String(e.b);
    return e.s;
  }
  function On(e, n) {
    return e.rows[n]?.cells[0]?.text ?? `row ${n + 1}`;
  }
  function Co(e) {
    let n = e.docScope.size;
    for (let t of e.sheets.values()) n += t.columns.size + t.scalars.size + t.assertions.length;
    return n;
  }
  function nh(e, n) {
    let t = Co(e),
      r = e.located.noFormulas !== null;
    if (r && t > 0) {
      n({
        code: "COVERAGE",
        message: `marked \`${Bn}\`, but the document has ${t} rule${t === 1 ? "" : "s"}`,
        suggestion: "delete the marker — those rules are checked either way",
        span: e.located.noFormulas ?? void 0,
      });
      return;
    }
    if (!r && t === 0 && e.located.tables.length > 0)
      n({
        code: "COVERAGE",
        message: "a table with no `vmark` rules — nothing in this document is checked",
        suggestion: `run \`visimark infer\` to derive them, or mark it \`${Bn}\``,
      });
  }
  function rh(e) {
    let n = e.docScope.get("precision");
    if (n && n.expr.type === "num") return Number(n.expr.value);
    return 2;
  }
  function hu(e, n) {
    let t = n.expr.type === "call" && Yt(n.expr.name);
    if (n.kind !== "column" && !t) return;
    return e.source.slice(n.expr.start, n.expr.end);
  }
  function ih(e, n) {
    let t = n.expr;
    if (t.type !== "call" || !Yt(t.name)) return !1;
    let r = t.args[0];
    if (!r || r.type !== "ref") return !1;
    let i = kt(e, n.sheetId, r);
    return (i.kind === "column" || i.kind === "input-column") && i.sheetId !== n.sheetId;
  }
  function oh(e, n) {
    for (let t of e.anchors)
      if (`${t.sheetId}.${t.name}` === n && t.value)
        return { start: t.value.start, end: t.value.end };
    return;
  }
  function sh(e, n) {
    for (let t of e.anchors)
      if (`${t.sheetId}.${t.name}` === n && t.value)
        return e.source.slice(t.value.start, t.value.end);
    return;
  }
  function ah(e) {
    let n = new Set(),
      t = (r, i) => {
        if (r.type === "ref") {
          let o = kt(e, i, r);
          if (o.kind === "scalar" || o.kind === "doc-scalar" || o.kind === "column")
            n.add(o.binding.id);
        } else if (r.type === "unary") t(r.operand, i);
        else if (r.type === "binary") (t(r.left, i), t(r.right, i));
        else if (r.type === "call") for (let o of r.args) t(o, i);
      };
    for (let r of e.docScope.values()) t(r.expr, r.sheetId);
    for (let r of e.sheets.values()) {
      for (let i of r.columns.values()) t(i.expr, i.sheetId);
      for (let i of r.scalars.values()) t(i.expr, i.sheetId);
      for (let i of r.assertions) t(i.expr, i.sheetId);
    }
    return n;
  }
  function uh(e) {
    let n = e.lastIndexOf(".");
    return n === -1 ? e : e.slice(n + 1);
  }
  var Eo = new Set(["==", "!=", "<", "<=", ">", ">="]);
  class oe extends Error {
    start;
    end;
    bindingName;
    constructor(e, n, t) {
      super(e);
      ((this.name = "LangError"), (this.start = n), (this.end = t));
    }
  }
  var lh = new Set(["and", "or", "not"]),
    ch = /^\d{4}-\d{2}-\d{2}/,
    fh = "VisiMark has no boolean literals; use `IF()` to produce a number or a string",
    bn = (e) => e >= "0" && e <= "9",
    dh = (e) => /[A-Za-z_]/.test(e),
    ph = (e) => /[A-Za-z0-9_]/.test(e),
    hh = ["==", "!=", "<=", ">=", "^", "*", "/", "+", "-", "<", ">", "="];
  function Io(e) {
    let n = [],
      t = 0,
      r = (i, o, s, a) => n.push({ kind: i, value: o, start: s, end: a });
    while (t < e.length) {
      let i = e[t];
      if (
        i === " " ||
        i === "\t" ||
        i ===
          `
` ||
        i === "\r"
      ) {
        t++;
        continue;
      }
      if (i === "#") throw new oe("unexpected `#` in expression", t, t + 1);
      if (i === "(") {
        (r("lparen", "(", t, t + 1), t++);
        continue;
      }
      if (i === ")") {
        (r("rparen", ")", t, t + 1), t++);
        continue;
      }
      if (i === ",") {
        (r("comma", ",", t, t + 1), t++);
        continue;
      }
      if (i === ":") {
        (r("colon", ":", t, t + 1), t++);
        continue;
      }
      if (i === '"') {
        let s = t;
        t++;
        let a = "";
        while (t < e.length && e[t] !== '"') ((a += e[t]), t++);
        if (t >= e.length) throw new oe("unterminated string literal", s, e.length);
        (t++, r("string", a, s, t));
        continue;
      }
      if (bn(i)) {
        let s = e.slice(t),
          a = ch.exec(s);
        if (a && !bn(s[10] ?? "")) {
          (r("date", a[0], t, t + 10), (t += 10));
          continue;
        }
        let u = t;
        while (t < e.length && bn(e[t])) t++;
        if (e[t] === "." && bn(e[t + 1] ?? "")) {
          t++;
          while (t < e.length && bn(e[t])) t++;
        }
        if (e[t] === "," && bn(e[t + 1] ?? ""))
          throw new oe(
            "thousands separators are not allowed; write the number without separators",
            u,
            t + 1,
          );
        let l = e.slice(u, t);
        if (e[t] === "%") (t++, r("percent", l, u, t));
        else r("number", l, u, t);
        continue;
      }
      if (i === ".") {
        (r("dot", ".", t, t + 1), t++);
        continue;
      }
      if (i === "Σ" || i === "∑") {
        (r("ident", "SUM", t, t + 1), t++);
        continue;
      }
      if (dh(i)) {
        let s = t;
        while (t < e.length && ph(e[t])) t++;
        let a = e.slice(s, t);
        if (a === "true" || a === "false") throw new oe(fh, s, t);
        if (lh.has(a)) r("op", a, s, t);
        else if (a === "chart") r("chart", a, s, t);
        else if (a === "assert") r("assert", a, s, t);
        else r("ident", a, s, t);
        continue;
      }
      let o = hh.find((s) => e.startsWith(s, t));
      if (o) {
        (r("op", o, t, t + o.length), (t += o.length));
        continue;
      }
      throw new oe(`unexpected character ${JSON.stringify(i)}`, t, t + 1);
    }
    return (r("eof", "", e.length, e.length), n);
  }
  var mh = {
      or: 1,
      and: 2,
      "==": 3,
      "!=": 3,
      "<": 3,
      "<=": 3,
      ">": 3,
      ">=": 3,
      "+": 4,
      "-": 4,
      "*": 5,
      "/": 5,
      "^": 6,
    },
    gh = new Set(["^"]),
    kh = 5,
    xh = 2;
  class To {
    toks;
    pos = 0;
    constructor(e) {
      this.toks = e;
    }
    peek() {
      return this.toks[this.pos];
    }
    next() {
      return this.toks[this.pos++];
    }
    expect(e, n) {
      let t = this.peek();
      if (t.kind !== e) throw new oe(`expected ${n}`, t.start, t.end);
      return this.next();
    }
    parseTopLevel() {
      let e = this.parseBp(0),
        n = this.peek();
      if (n.kind !== "eof")
        throw new oe(
          `unexpected ${n.kind === "op" ? `operator \`${n.value}\`` : n.kind}`,
          n.start,
          n.end,
        );
      return e;
    }
    parseBp(e) {
      let n = this.nud();
      for (;;) {
        let t = this.peek();
        if (t.kind !== "op") break;
        let r = mh[t.value];
        if (r === void 0 || r <= e) break;
        if (Eo.has(t.value) && n.type === "binary" && Eo.has(n.op))
          throw new oe("comparisons do not chain; use `and` to combine them", t.start, t.end);
        this.next();
        let i = gh.has(t.value) ? r - 1 : r,
          o = this.parseBp(i);
        n = { type: "binary", op: t.value, left: n, right: o, start: n.start, end: o.end };
      }
      return n;
    }
    nud() {
      let e = this.next();
      switch (e.kind) {
        case "number":
          return { type: "num", value: wh(e.value), start: e.start, end: e.end };
        case "percent":
          return {
            type: "num",
            value: new ue(e.value).div(100).toString(),
            start: e.start,
            end: e.end,
          };
        case "date":
          return { type: "date", value: e.value, start: e.start, end: e.end };
        case "string":
          return { type: "str", value: e.value, start: e.start, end: e.end };
        case "ident":
          return this.identTail(e);
        case "lparen": {
          let n = this.parseBp(0),
            t = this.expect("rparen", "`)`");
          return ((n.start = e.start), (n.end = t.end), n);
        }
        case "op":
          if (e.value === "-") {
            let n = this.parseBp(kh);
            return { type: "unary", op: "-", operand: n, start: e.start, end: n.end };
          }
          if (e.value === "not") {
            let n = this.parseBp(xh);
            return { type: "unary", op: "not", operand: n, start: e.start, end: n.end };
          }
          throw new oe(`unexpected operator \`${e.value}\``, e.start, e.end);
        default:
          throw new oe(`unexpected ${e.kind}`, e.start, e.end);
      }
    }
    identTail(e) {
      if (this.peek().kind === "dot") {
        this.next();
        let n = this.expect("ident", "a name after `.`");
        return { type: "ref", qualifier: e.value, name: n.value, start: e.start, end: n.end };
      }
      if (this.peek().kind === "lparen") {
        this.next();
        let n = [];
        if (this.peek().kind !== "rparen") {
          n.push(this.parseBp(0));
          while (this.peek().kind === "comma") (this.next(), n.push(this.parseBp(0)));
        }
        let t = this.expect("rparen", "`)`");
        return { type: "call", name: e.value, args: n, start: e.start, end: t.end };
      }
      return { type: "ref", name: e.value, start: e.start, end: e.end };
    }
  }
  function wh(e) {
    return e;
  }
  var mu = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;
  function vo(e) {
    try {
      return yh(e);
    } catch (n) {
      if (n instanceof oe && n.bindingName === void 0) {
        let t = mu.exec(e);
        if (t) n.bindingName = t[1];
      }
      throw n;
    }
  }
  function gu(e) {
    try {
      return bh(e);
    } catch (n) {
      if (n instanceof oe && n.bindingName === void 0) {
        let t = mu.exec(e);
        if (t) n.bindingName = t[1];
      }
      throw n;
    }
  }
  function bh(e) {
    let n = Io(e),
      t = n.find((r) => r.kind !== "eof");
    if (t?.kind === "chart") return Sh(n, t);
    if (n.some((r) => r.kind === "chart")) {
      let r = n.find((i) => i.kind === "chart");
      throw new oe("`chart` is a keyword", r.start, r.end);
    }
    if (t?.kind === "assert") {
      let r = n.slice(n.indexOf(t) + 1);
      if (r[0]?.kind === "op" && r[0].value === "=")
        throw new oe("`assert` is a keyword", t.start, t.end);
      if (r.length === 1 && r[0].kind === "eof")
        throw new oe("assert needs an expression", t.start, t.end);
      let i = new To(r).parseTopLevel();
      return { type: "assert", expr: i, start: t.start, end: i.end };
    }
    if (n.some((r) => r.kind === "assert")) {
      let r = n.find((i) => i.kind === "assert");
      throw new oe("`assert` is a keyword", r.start, r.end);
    }
    return vo(e);
  }
  function yh(e) {
    let n = Io(e),
      t = n.findIndex((u) => u.kind === "op" && u.value === "=");
    if (t === -1) throw new oe("binding has no `=`", 0, e.length);
    let i = n.slice(0, t).filter((u) => u.kind !== "eof");
    if (i.length !== 1 || i[0].kind !== "ident") {
      let u = i[0]?.start ?? 0,
        l = i[i.length - 1]?.end ?? e.length;
      throw new oe("the left of `=` must be a single name", u, l);
    }
    let o = i[0],
      s = n.slice(t + 1),
      a = new To(s).parseTopLevel();
    return { name: o.value, expr: a, nameStart: o.start, nameEnd: o.end };
  }
  var Br = "aspect needs two positive integers, as `16:9`";
  function Sh(e, n) {
    let t = e.indexOf(n) + 1,
      r = () => e[t] ?? e[e.length - 1],
      i = (h) => {
        let g = r();
        if (g.kind === "op")
          throw new oe("a chart takes a column, not an expression", g.start, g.end);
        if (g.kind !== "ident") throw new oe(`expected ${h}`, g.start, g.end);
        return (t++, g);
      },
      o = (h) => {
        let g = r();
        if (g.kind === "op")
          throw new oe("a chart takes a column, not an expression", g.start, g.end);
        if (g.kind !== "ident" || g.value !== h) throw new oe(`expected \`${h}\``, g.start, g.end);
        t++;
      };
    if (r().kind === "op" && r().value === "=")
      throw new oe("`chart` is a keyword", n.start, n.end);
    if (r().kind === "ident" && r().value === "as")
      throw new oe("a chart needs a name", n.start, r().end);
    let s = i("a chart name").value;
    o("as");
    let a = i("a chart type").value;
    o("of");
    let u = (h) => {
        let g = i(h).value;
        if (r().kind === "dot") return (t++, `${g}.${i(h).value}`);
        return g;
      },
      l = [];
    for (;;) {
      if ((l.push(u("a column name")), r().kind === "comma")) {
        t++;
        continue;
      }
      break;
    }
    o("labelled");
    let c = u("a label column"),
      f = null;
    if (r().kind === "ident" && r().value === "aspect") {
      let h = r();
      t++;
      let g = r();
      if (g.kind !== "number") throw new oe(Br, h.start, g.end);
      if ((t++, r().kind !== "colon")) throw new oe(Br, h.start, r().end);
      t++;
      let k = r();
      if (k.kind !== "number") throw new oe(Br, h.start, k.end);
      t++;
      let C = Number(g.value),
        b = Number(k.value);
      if (!Number.isInteger(C) || !Number.isInteger(b) || C < 1 || b < 1)
        throw new oe(Br, h.start, k.end);
      f = { w: C, h: b };
    }
    let p = r();
    if (p.kind !== "eof")
      throw new oe(
        `unexpected ${p.kind === "op" ? `operator \`${p.value}\`` : p.kind}`,
        p.start,
        p.end,
      );
    return {
      type: "chart",
      name: s,
      engine: a,
      series: l,
      labels: c,
      aspect: f,
      start: n.start,
      end: p.start,
    };
  }
  var Ch = /^[A-Za-z_][A-Za-z0-9_]*$/;
  function Eh(e) {
    let n = new Set(),
      t = [],
      r = (i) => {
        if (n.has(i)) return;
        (n.add(i), t.push(i));
      };
    if (/[0-9]/.test(e[0] ?? "")) r(e[0]);
    for (let i of e) {
      if (/[A-Za-z0-9_]/.test(i)) continue;
      r(i);
    }
    return t;
  }
  function ct(e) {
    let n = new Map(),
      t = new Map(),
      r = [],
      i = new Map();
    for (let o of e.blocks) {
      if (o.sheetId === null) {
        for (let c of o.bindings) {
          let f = ku(c, e.source, r, lo);
          if (!f) continue;
          if (f.kind === "assert") {
            r.push({
              code: "SHEET",
              message: "`assert` must be in a `#id` sheet block",
              sourceOffset: f.assertion.span.start,
              span: f.assertion.span,
            });
            continue;
          }
          if (f.kind === "chart") {
            r.push({
              code: "SHEET",
              message: "`chart` must be in a `#id` sheet block",
              sourceOffset: f.chart.span.start,
              span: f.chart.span,
            });
            continue;
          }
          let p = f.binding,
            h = t.get(p.name);
          if (h) {
            r.push({ code: "DUP", name: p.name, span: p.span, relatedSpan: h.span });
            continue;
          }
          t.set(p.name, p);
        }
        continue;
      }
      let s = o.sheetId;
      i.set(s, o);
      let a = e.tableBeforeBlock.get(o) ?? null,
        u = Ih(n, s, a);
      if (!Ch.test(s)) {
        let c = Eh(s),
          f = c.length === 1 ? "invalid character" : "invalid characters",
          p = c.map((h) => "`" + h + "`").join(", ");
        r.push({
          code: "SHEET",
          sheetId: s,
          message: `sheet id \`${s}\` is not a valid identifier — ${f} ${p}`,
          sourceOffset: o.span.start,
          span: o.span,
        });
      }
      if (e.detachedTableBlocks.has(o))
        r.push({
          code: "SHEET",
          sheetId: s,
          message: "this block declares column rules but no table immediately precedes it",
          sourceOffset: o.span.start,
          span: o.span,
        });
      let l = new Map();
      (a?.headers ?? []).forEach((c, f) => l.set(c.text, f));
      for (let c of o.bindings) {
        let f = ku(c, e.source, r, s);
        if (!f) continue;
        if (f.kind === "assert") {
          u.assertions.push(f.assertion);
          continue;
        }
        if (f.kind === "chart") {
          if (a === null) {
            r.push({
              code: "SHEET",
              sheetId: s,
              message: "a chart needs a table",
              sourceOffset: f.chart.span.start,
              span: f.chart.span,
            });
            continue;
          }
          let k =
            u.columns.get(f.chart.name) ??
            u.scalars.get(f.chart.name) ??
            u.charts.find((C) => C.name === f.chart.name);
          if (k) {
            r.push({
              code: "DUP",
              sheetId: s,
              name: f.chart.name,
              span: f.chart.span,
              relatedSpan: k.span,
            });
            continue;
          }
          u.charts.push(f.chart);
          continue;
        }
        let p = f.binding,
          h = u.columns.get(p.name) ?? u.scalars.get(p.name);
        if (h) {
          r.push({ code: "DUP", sheetId: s, name: p.name, span: p.span, relatedSpan: h.span });
          continue;
        }
        let g = a !== null && l.has(p.name);
        if (((p.kind = g ? "column" : "scalar"), g))
          (u.columns.set(p.name, p), u.columnIndex.set(p.name, l.get(p.name)));
        else u.scalars.set(p.name, p);
      }
      for (let [c, f] of l) if (!u.columns.has(c)) (u.inputColumns.add(c), u.columnIndex.set(c, f));
    }
    for (let o of e.malformedAnchors)
      r.push({
        code: "ANCHOR",
        message: "malformed anchor comment — expected `<!--vmark=sheet.name-->`",
        sourceOffset: o.start,
        span: o,
      });
    return {
      sheets: n,
      docScope: t,
      anchors: e.anchors,
      findings: r,
      source: e.source,
      located: e,
      blockOfSheet: i,
    };
  }
  function Ih(e, n, t) {
    let r = e.get(n);
    if (!r)
      ((r = {
        id: n,
        table: t,
        columns: new Map(),
        scalars: new Map(),
        columnIndex: new Map(),
        inputColumns: new Set(),
        assertions: [],
        charts: [],
      }),
        e.set(n, r));
    else if (r.table === null && t !== null) r.table = t;
    return r;
  }
  function ku(e, n, t, r) {
    try {
      let i = gu(e.raw);
      if ("type" in i && i.type === "chart")
        return {
          kind: "chart",
          chart: {
            id: `${r}::chart@${e.start}`,
            sheetId: r,
            name: i.name,
            engine: i.engine,
            series: i.series,
            labels: i.labels,
            aspect: i.aspect,
            span: { start: e.start, end: e.end },
            source: e.raw,
          },
        };
      if ("type" in i)
        return (
          yn(i.expr, e.start),
          {
            kind: "assert",
            assertion: {
              sheetId: r,
              expr: i.expr,
              span: { start: e.start, end: e.end },
              source: e.raw,
              id: `${r}::assert@${e.start}`,
            },
          }
        );
      return (
        yn(i.expr, e.start),
        {
          kind: "binding",
          binding: {
            id: r === lo ? i.name : `${r}.${i.name}`,
            sheetId: r,
            name: i.name,
            expr: i.expr,
            kind: "scalar",
            span: { start: e.start, end: e.end },
          },
        }
      );
    } catch (i) {
      if (i instanceof oe)
        return (
          t.push({
            code: "TYPE",
            sheetId: r || void 0,
            name: i.bindingName,
            message: i.message,
            raw: e.raw,
            sourceOffset: e.start + i.start,
            span: { start: e.start + i.start, end: e.start + i.end },
          }),
          null
        );
      throw i;
    }
  }
  function yn(e, n) {
    switch (((e.start += n), (e.end += n), e.type)) {
      case "unary":
        yn(e.operand, n);
        break;
      case "binary":
        (yn(e.left, n), yn(e.right, n));
        break;
      case "call":
        for (let t of e.args) yn(t, n);
        break;
    }
  }
  function Nr(e) {
    let n = We(e),
      t = ct(n),
      r = new Map();
    for (let [u, l] of n.tableBeforeBlock) if (l) r.set(l, u);
    let i = new Set(t.sheets.keys()),
      o = 1,
      s = () => {
        for (;;) {
          let u = `unnamed${o++}`;
          if (!i.has(u)) return (i.add(u), u);
        }
      },
      a = n.tables.map((u) => {
        let l = r.get(u) ?? null,
          c = l?.sheetId == null,
          f = l?.sheetId ?? s(),
          p = t.sheets.get(f),
          h = new Map();
        u.headers.forEach((b, F) => h.set(b.text, F));
        let g = [],
          k = new Map(),
          C = new Set();
        for (let [b, F] of h) {
          let M = u.rows.map((z) => z.cells[F]?.text ?? "").filter((z) => z.trim() !== "");
          if ((k.set(b, M.length), M.length === 0)) continue;
          let q = M.map((z) => at(z));
          if (q.some((z) => z === null)) continue;
          if ((g.push(b), q.every((z) => z.equals(q[0])))) C.add(b);
        }
        return {
          id: f,
          minted: c,
          table: u,
          block: l,
          index: h,
          numeric: g,
          managed: new Set(p?.columns.keys() ?? []),
          filled: k,
          constant: C,
        };
      });
    return { source: e, doc: n, base: t, sheets: a };
  }
  function Ao(e, n) {
    let t = new Map();
    for (let [r, i] of e.base.sheets) t.set(r, Th(i));
    for (let r of e.sheets)
      if (!t.has(r.id))
        t.set(r.id, {
          id: r.id,
          table: r.table,
          columns: new Map(),
          scalars: new Map(),
          columnIndex: new Map(r.index),
          inputColumns: new Set(r.index.keys()),
          assertions: [],
          charts: [],
        });
    for (let r of n) {
      let i = t.get(r.sheetId);
      if (!i) continue;
      if (r.kind === "column") (i.columns.set(r.name, r), i.inputColumns.delete(r.name));
      else i.scalars.set(r.name, r);
    }
    return {
      sheets: t,
      docScope: e.base.docScope,
      anchors: e.base.anchors,
      findings: [],
      source: e.source,
      located: e.doc,
      blockOfSheet: e.base.blockOfSheet,
    };
  }
  function Th(e) {
    return {
      id: e.id,
      table: e.table,
      columns: new Map(e.columns),
      scalars: new Map(e.scalars),
      columnIndex: new Map(e.columnIndex),
      inputColumns: new Set(e.inputColumns),
      assertions: [...e.assertions],
      charts: [...e.charts],
    };
  }
  function xu(e, n) {
    let t = vo(n);
    return {
      id: `${e.id}.${t.name}`,
      sheetId: e.id,
      name: t.name,
      expr: t.expr,
      kind: e.index.has(t.name) ? "column" : "scalar",
      span: { start: 0, end: n.length },
    };
  }
  function Mo(e, n, t, r) {
    let i = { usable: !1, rows: 0, fits: 0, misses: [] },
      o = Fo(n, t);
    if (!o || o.kind !== "column") return i;
    let s = Ao(e, [...bu(r), o]),
      a = xt(s),
      u = `${n.id}.${o.name}`;
    for (let g of a.findings) {
      if (g.code === "STALE") continue;
      if (g.sheetId === n.id && g.name === o.name) return i;
      if (g.code === "CYCLE" && g.cyclePath?.includes(o.id)) return i;
    }
    let l = a.cells.get(u);
    if (!l) return i;
    let c = a.columnPrecision.get(u) ?? 2,
      f = a.columnUnits.get(u) ?? null,
      p = n.index.get(o.name),
      h = { usable: !0, rows: 0, fits: 0, misses: [] };
    return (
      n.table.rows.forEach((g, k) => {
        let C = g.cells[p],
          b = C?.text ?? "";
        if (b.trim() === "") return;
        h.rows++;
        let F = l[k];
        if (F == null) {
          h.usable = !1;
          return;
        }
        if (en(F, b, c)) {
          h.fits++;
          return;
        }
        h.misses.push({
          rowIndex: k,
          rowLabel: g.cells[0]?.text ?? `row ${k + 1}`,
          stored: b,
          computed: Ye(lt(F, c), f),
          span: C ? { start: C.start, end: C.end } : { start: 0, end: 0 },
        });
      }),
      h.usable ? h : i
    );
  }
  function wu(e, n, t, r, i) {
    let o = { usable: !1, text: () => "", writes: () => !1 },
      s = Fo(n, t);
    if (!s || s.kind !== "scalar") return o;
    let a = Ao(e, [...bu(r), s]),
      u = xt(a);
    for (let f of u.findings) {
      if (f.code === "STALE" || f.code === "WARN") continue;
      if (f.sheetId === n.id && f.name === s.name) return o;
    }
    let l = u.values.get(s.id);
    if (!l) return o;
    let c = i ? (u.columnUnits.get(`${n.id}.${i}`) ?? null) : null;
    return { usable: !0, text: (f) => lt(l, f), writes: (f) => vh(l, c, f) };
  }
  function vh(e, n, t) {
    let r = t.trim(),
      i = st(r);
    if (i.kind !== "number") return !1;
    let o = /^-?\d+(?:\.(\d+))?$/.exec(i.num);
    if (!o) return !1;
    let s = o[1]?.length ?? 0;
    return Ye(lt(wn(e, s), s), n) === r;
  }
  function bu(e) {
    let n = [];
    for (let t of e) {
      let r = Fo(t.sheet, t.rule);
      if (r) n.push(r);
    }
    return n;
  }
  function Fo(e, n) {
    try {
      return xu(e, n);
    } catch {
      return null;
    }
  }
  var Ah = 6,
    Mh = ["*", "+"],
    Fh = ["-", "/"];
  function yu(e, n, t) {
    let r = [];
    for (let i of Cu(n)) {
      let o = n.numeric.filter((s) => s !== i);
      for (let s of Mh)
        for (let a = 0; a < o.length; a++)
          for (let u = a + 1; u < o.length; u++) zr(r, e, n, t, 1, i, o[a], s, o[u]);
      for (let s of Fh)
        for (let a of o)
          for (let u of o) {
            if (a === u) continue;
            zr(r, e, n, t, 1, i, a, s, u);
          }
      for (let s of o) {
        let a = Ph(n, i, s);
        if (!a) continue;
        zr(r, e, n, t, 2, i, s, "*", a);
      }
    }
    return r;
  }
  function Su(e, n, t, r) {
    let i = [];
    for (let o of Cu(n))
      for (let s of n.numeric) {
        if (s === o) continue;
        for (let a of t) {
          let u = a.sheetId === n.id ? a.name : `${a.sheetId}.${a.name}`;
          zr(i, e, n, r, 4, o, s, "*", u, `${a.sheetId}.${a.name}`);
        }
      }
    return i;
  }
  function Cu(e) {
    return e.numeric.filter((n) => !e.managed.has(n));
  }
  function zr(e, n, t, r, i, o, s, a, u, l) {
    let c = `${o} = ${s} ${a} ${u}`,
      f = Mo(n, t, c, r);
    if (!f.usable || f.fits === 0) return;
    let p = [s, u].filter((k) => t.index.has(k)),
      h = p.map((k) => `${t.id}.${k}`);
    if (l) h.push(l);
    let g = {
      sheet: t,
      stage: i,
      target: o,
      rule: c,
      op: a,
      operands: p,
      deps: h,
      constant: i === 2 ? u : void 0,
      verdict: f,
    };
    ((g.degenerateWith = Rh(n, t, r, g, s, u)), e.push(g));
  }
  function Rh(e, n, t, r, i, o) {
    if (r.op !== "*") return;
    let s = n.constant.has(i) ? o : n.constant.has(o) ? i : null;
    if (s === null) return;
    let a = `${r.target} = ${s}`,
      u = Mo(e, n, a, t);
    return u.usable && u.misses.length === 0 && u.rows > 0 ? a : void 0;
  }
  function Ph(e, n, t) {
    let r = e.index.get(n),
      i = e.index.get(t);
    for (let o of e.table.rows) {
      let s = at(o.cells[r]?.text ?? ""),
        a = at(o.cells[i]?.text ?? "");
      if (s === null || a === null || a.isZero()) continue;
      let u = s.div(a);
      if (!u.isFinite() || u.isZero() || u.equals(1)) return null;
      if (u.decimalPlaces() > Ah) return null;
      return u.toString();
    }
    return null;
  }
  function Tu(e, n = new Map()) {
    let t = new Map(n),
      r = { accepted: [], weak: [], nearMisses: [], ambiguous: [], alsoFits: [], edges: t },
      i = new Map();
    for (let u of e) if (!i.has(u.sheet)) i.set(u.sheet, i.size);
    let o = e.filter(Lh),
      s = new Set(),
      a = new Map();
    for (;;) {
      let u = o.filter((C) => !s.has(wt(C)) && !Iu(t, wt(C), C.deps));
      if (u.length === 0) break;
      let l = Math.min(...u.map(Eu)),
        c = u.filter((C) => Eu(C) === l),
        f = (C) => (i.get(C.sheet) ?? 0) * 1000 + (C.sheet.index.get(C.target) ?? 0),
        p = c.reduce((C, b) => (f(C) <= f(b) ? C : b)),
        h = c.filter((C) => wt(C) === wt(p)),
        g = [...new Set(h.map((C) => C.rule))];
      if ((s.add(wt(p)), g.length > 1)) {
        r.ambiguous.push({ sheet: p.sheet, target: p.target, alternatives: g });
        continue;
      }
      let k = h[0];
      if (k.degenerateWith) {
        r.ambiguous.push({
          sheet: k.sheet,
          target: k.target,
          alternatives: [k.rule, k.degenerateWith],
        });
        continue;
      }
      if ((t.set(wt(k), k.deps), a.set(wt(k), k), k.verdict.misses.length > 0))
        r.nearMisses.push(k);
      else if (vu(k)) r.weak.push(k);
      else r.accepted.push(k);
    }
    for (let u of o) {
      if (u.verdict.misses.length > 0) continue;
      let l = a.get(wt(u));
      if (!l || l === u) continue;
      if (Iu(t, wt(u), u.deps)) continue;
      r.alsoFits.push({
        candidate: u,
        reason:
          Ro(l) < Ro(u)
            ? "prefers a rule over materialised columns"
            : "another rule for this column ranks higher",
      });
    }
    return r;
  }
  function Lh(e) {
    let { rows: n, misses: t } = e.verdict;
    if (t.length === 0) return n >= 2;
    return t.length === 1 && n >= 3;
  }
  function vu(e) {
    return e.verdict.rows === 2;
  }
  var wt = (e) => `${e.sheet.id}.${e.target}`,
    Ro = (e) => (e.stage === 1 ? 0 : e.stage === 4 ? 1 : 2);
  function Eu(e) {
    let n = e.verdict.misses.length === 0 ? 0 : 1,
      t = vu(e) ? 1 : 0,
      r = Ro(e),
      i = e.op === "*" || e.op === "+" ? 0 : 1;
    return ((n * 2 + t) * 3 + r) * 2 + i;
  }
  function Iu(e, n, t) {
    let r = new Set(),
      i = [...t];
    while (i.length > 0) {
      let o = i.pop();
      if (o === n) return !0;
      if (r.has(o)) continue;
      (r.add(o), i.push(...(e.get(o) ?? [])));
    }
    return !1;
  }
  var Dh = /^-?\d+(?:\.\d+)?%?$/,
    Bh = ["SUM", "AVG", "MIN", "MAX", "COUNT"],
    Nh = { SUM: "_total", AVG: "_avg", MIN: "_min", MAX: "_max", COUNT: "_count" };
  function Or(e) {
    let n = Nr(e),
      { picks: t, ambiguousFigures: r } = zh(n),
      i = t.map((l) => ({ sheet: l.candidate.sheet, rule: l.candidate.rule })),
      o = t.map((l) => ({ sheetId: l.candidate.sheet.id, name: l.candidate.name })),
      s = [];
    for (let l of n.sheets) (s.push(...yu(n, l, i)), s.push(...Su(n, l, o, i)));
    let a = new Map();
    for (let l of t)
      a.set(`${l.candidate.sheet.id}.${l.candidate.name}`, [
        `${l.candidate.sheet.id}.${l.candidate.column}`,
      ]);
    let u = Tu(s, a);
    return $h(n, u, t, r);
  }
  function zh(e) {
    let n = [];
    for (let o of e.sheets) {
      if (o.table.rows.length < 2) continue;
      let s = new Set(e.base.sheets.get(o.id)?.scalars.keys() ?? []);
      for (let a of o.numeric)
        for (let u of Bh) {
          let l = a.toLowerCase() + Nh[u];
          if (s.has(l)) continue;
          let c = `${l} = ${u}(${a})`,
            f = wu(e, o, c, [], a);
          if (!f.usable) continue;
          n.push({ sheet: o, column: a, reduce: u, name: l, rule: c, writes: f.writes });
        }
    }
    let t = [],
      r = [],
      i = new Set();
    for (let o of e.doc.figures) {
      if (o.anchored) continue;
      let s = n.filter((u) => u.writes(o.text));
      if (s.length === 0) continue;
      let a = s.filter((u) => !i.has(u) && u.sheet.table.span.end < o.value.start);
      if (a.length === 1) {
        (i.add(a[0]), t.push({ candidate: a[0], figure: o }));
        continue;
      }
      if (s.length >= 2) r.push({ figure: o, alternatives: s.map((u) => Oh(u)) });
    }
    return { picks: t, ambiguousFigures: r };
  }
  var Oh = (e) => `${e.sheet.id}.${e.name} = ${e.reduce}(${e.column})`;
  function $h(e, n, t, r) {
    let i = [];
    for (let o of e.sheets) {
      let s = (l) => l.sheet === o,
        a = { sheetId: o.id, mintedSheetId: o.minted || void 0, tableSpan: o.table.span },
        u = _h([...n.accepted, ...n.weak].filter(s), n.edges);
      for (let l of u) {
        let c = l.constant ? qh(e, l.constant) : void 0;
        if (
          (i.push({
            ...a,
            kind: "column",
            stage: l.stage,
            name: l.target,
            rule: l.rule,
            fits: l.verdict.fits,
            rows: l.verdict.rows,
            weak: n.weak.includes(l) || void 0,
            constantEcho: c,
          }),
          l.constant)
        ) {
          if (c)
            i.push({
              ...a,
              kind: "constant",
              stage: 2,
              name: l.constant,
              rule: l.rule,
              fits: l.verdict.fits,
              rows: l.verdict.rows,
              constantEcho: c,
            });
        }
      }
      for (let l of t.filter((c) => c.candidate.sheet === o))
        i.push({
          ...a,
          kind: "scalar",
          stage: 3,
          name: l.candidate.name,
          rule: l.candidate.rule,
          fits: o.table.rows.length,
          rows: o.table.rows.length,
          anchorSite: l.figure.anchorAt === null ? void 0 : l.figure.value,
          reason:
            l.figure.anchorAt === null ? "no anchorable inline node holds this figure" : void 0,
        });
      for (let l of n.nearMisses.filter(s)) {
        let c = l.verdict.misses[0];
        i.push({
          ...a,
          kind: "near-miss",
          stage: l.stage,
          name: l.target,
          rule: l.rule,
          fits: l.verdict.fits,
          rows: l.verdict.rows,
          disagreement: {
            rowIndex: c.rowIndex,
            rowLabel: c.rowLabel,
            stored: c.stored,
            computed: c.computed,
            span: c.span,
          },
        });
      }
      for (let l of n.ambiguous.filter((c) => c.sheet === o))
        i.push({
          ...a,
          kind: "ambiguous",
          stage: 1,
          name: l.target,
          rule: "",
          fits: 0,
          rows: o.table.rows.length,
          alternatives: l.alternatives,
        });
      for (let { candidate: l, reason: c } of n.alsoFits.filter((f) => s(f.candidate)))
        i.push({
          ...a,
          kind: "alternative",
          stage: l.stage,
          name: l.target,
          rule: l.rule,
          fits: l.verdict.fits,
          rows: l.verdict.rows,
          reason: c,
        });
    }
    for (let { figure: o, alternatives: s } of r)
      i.push({
        kind: "ambiguous",
        stage: 3,
        sheetId: "",
        name: o.text,
        rule: "",
        fits: 0,
        rows: 0,
        tableSpan: o.value,
        anchorSite: o.anchorAt === null ? void 0 : o.value,
        alternatives: s,
      });
    return i;
  }
  function _h(e, n) {
    let t = new Map(e.map((s) => [`${s.sheet.id}.${s.target}`, s])),
      r = [],
      i = new Set(),
      o = (s) => {
        if (i.has(s)) return;
        i.add(s);
        for (let u of n.get(s) ?? []) if (t.has(u)) o(u);
        let a = t.get(s);
        if (a) r.push(a);
      };
    for (let s of e) o(`${s.sheet.id}.${s.target}`);
    return r;
  }
  function qh(e, n) {
    let t = at(n);
    if (!t) return;
    for (let r of e.doc.figures) {
      if (r.text === n || !Dh.test(r.text)) continue;
      let i = at(r.text);
      if (i && i.equals(t)) return { text: r.text, span: r.value };
    }
    return;
  }
  function Mu(e, n) {
    let t = n ?? Or(e),
      r = Nr(e),
      i = new Map(r.sheets.map((c) => [c.id, c])),
      o = We(e),
      s = o.figures,
      a = Uh(e, o, t);
    if (a) return [a];
    let u = t.filter(
        (c) => !c.weak && (c.kind === "column" || (c.kind === "scalar" && c.anchorSite !== void 0)),
      ),
      l = [];
    for (let c of r.sheets) {
      let f = u.filter((k) => k.sheetId === c.id);
      if (f.length === 0) continue;
      let p = f.filter((k) => k.kind === "column"),
        h = f.filter((k) => k.kind === "scalar"),
        g = [Au(p), Au(h)].filter((k) => k.length > 0).join(`

`);
      l.push({ ...Vh(e, c, g), kind: "block", proposal: f[0], proposals: f });
    }
    for (let c of u) {
      if (c.kind !== "scalar" || !c.anchorSite) continue;
      let f = i.get(c.sheetId);
      if (!f) continue;
      let p = s.find(
        (h) => h.value.start === c.anchorSite.start && h.value.end === c.anchorSite.end,
      );
      if (!p || p.anchorAt === null) continue;
      l.push({
        start: p.anchorAt,
        end: p.anchorAt,
        text: `<!--vmark=${f.id}.${c.name}-->`,
        kind: "anchor",
        proposal: c,
        proposals: [c],
      });
    }
    return l;
  }
  function Uh(e, n, t) {
    if (t.length > 0) return null;
    if (n.tables.length === 0 || n.noFormulas !== null) return null;
    if (Co(ct(n)) > 0) return null;
    let r = e.endsWith(`

`)
      ? ""
      : e.endsWith(`
`)
        ? `
`
        : `

`;
    return {
      start: e.length,
      end: e.length,
      text: `${r}${Bn}
`,
      kind: "marker",
    };
  }
  function Vh(e, n, t) {
    if (n.block) {
      let i = e.lastIndexOf(
        `
`,
        n.block.span.end - 1,
      );
      return {
        start: i,
        end: i,
        text: `
${t}`,
      };
    }
    let r = n.table.span.end;
    return {
      start: r,
      end: r,
      text: `

\`\`\`vmark #${n.id}
${t}
\`\`\``,
    };
  }
  function Au(e) {
    let n = Math.max(0, ...e.map((t) => t.name.length));
    return e.map((t) => `${t.name.padEnd(n)} = ${t.rule.slice(t.rule.indexOf("=") + 2)}`).join(`
`);
  }
  var Hh = 10,
    Ue = 16,
    jh = 49,
    Wh = 11,
    Gh = 50,
    ft = " ".repeat(Hh);
  function Ru(e, n) {
    let t = [e, ""],
      r = n.filter((o) => o.code === "STALE"),
      i = n.filter((o) => o.code !== "STALE");
    for (let o of r) t.push(Zh(o));
    if (r.length > 0) t.push("");
    for (let o of i) (t.push(...Qh(o)), t.push(""));
    return (
      t.push(Yh(n)),
      t.join(`
`)
    );
  }
  function Ee(e) {
    let n = e.padEnd(8);
    return "  " + (n.length === e.length ? e + " " : n);
  }
  function Fu(e) {
    let n = Gh - 28;
    return e.length >= n ? e + " " : e.padEnd(n);
  }
  function ze(e) {
    return `${e.sheetId ?? ""}.${e.name ?? ""}`;
  }
  function _n(e) {
    return e.sheetId ? `#${e.sheetId}` : "";
  }
  var $r = (e) => e.source !== void 0 || (e.code === "NOTE" && !e.name);
  function Zh(e) {
    if (e.artifact !== void 0) return Ee("STALE") + ze(e).padEnd(Ue) + "  " + (e.message ?? "");
    if (e.anchorGroup)
      return Ee("STALE") + `${e.suppressedCount} prose anchors bound to the values above`;
    let n = e.rowLabel ? ze(e).padEnd(Ue) + "· " + e.rowLabel : ze(e),
      t = e.stored ?? "",
      r = Math.max(1, jh - n.length),
      i = e.formula ? (e.computed ?? "").padEnd(Wh) + e.formula : (e.computed ?? "");
    return Ee("STALE") + n + t.padStart(r) + " ≠ " + i;
  }
  function Qh(e) {
    switch (e.code) {
      case "DATE": {
        let n = Ee("DATE") + ze(e).padEnd(Ue) + "· " + Fu(e.rowLabel ?? "") + `"${e.raw}"`,
          t = [ft + "Dates must be ISO 8601 calendar dates: YYYY-MM-DD."];
        if (e.isoFix)
          t.push(ft + "Unambiguous — `visimark fmt --fix-dates` rewrites it to " + e.isoFix + ".");
        else if (e.altA && e.altB)
          t.push(ft + `Ambiguous: ${e.altA} or ${e.altB}, ${e.daysApart} days apart. Fix by hand.`);
        else t.push(ft + "Fix by hand.");
        return [n, ...t];
      }
      case "UNIT":
        return [
          Ee("UNIT") + ze(e).padEnd(Ue) + "· " + Fu(e.rowLabel ?? "") + `"${e.raw ?? ""}"`,
          ft + (e.message ?? ""),
        ];
      case "NOTE": {
        let n = $r(e) ? _n(e) : ze(e);
        return [Ee("NOTE") + n.padEnd(Ue) + "· " + (e.message ?? "")];
      }
      case "ASSERT":
        return [
          Ee("ASSERT") + _n(e).padEnd(Ue) + (e.source ?? "").replace(/^assert\s+/, ""),
          ft + (e.message ?? "") + "   is false",
        ];
      case "UNDEF": {
        let n = $r(e) ? _n(e) : ze(e);
        return [
          Ee("UNDEF") + n.padEnd(Ue) + "  unknown name `" + e.raw + "`",
          ...(e.suggestion ? [ft + "did you mean `" + e.suggestion + "`?"] : []),
        ];
      }
      case "DUP":
        return [
          Ee("DUP") +
            ze(e).padEnd(Ue) +
            "  `" +
            (e.name ?? "") +
            "` is already defined in this scope",
          ft + "the first binding wins; delete or rename one of them",
        ];
      case "VECTOR": {
        let n = $r(e) ? _n(e) : ze(e);
        return [
          Ee("VECTOR") + n.padEnd(Ue) + "  `" + e.raw + "` is a column, not a value.",
          ft + "Wrap it in an aggregate: SUM(" + e.raw + ")",
        ];
      }
      case "CYCLE":
        return [Ee("CYCLE") + (e.cyclePath ?? []).join(" → ")];
      case "SHEET":
        return [Ee("SHEET") + ze(e).padEnd(Ue) + "  " + (e.message ?? "")];
      case "COVERAGE": {
        let n = Ee("COVERAGE");
        return [
          n + (e.message ?? ""),
          ...(e.suggestion ? [" ".repeat(n.length) + e.suggestion] : []),
        ];
      }
      case "ARTIFACT":
        return [
          Ee("ARTIFACT") + ze(e).padEnd(Ue) + "  " + (e.message ?? ""),
          ...(e.suggestion
            ? [" ".repeat(Ee("ARTIFACT").length) + `did you mean \`${e.suggestion}\`?`]
            : []),
        ];
      case "ANCHOR":
        return [
          Ee("ANCHOR") +
            ze(e).padEnd(Ue) +
            "  " +
            (e.message ?? "no value to rewrite in front of this anchor"),
        ];
      case "TYPE": {
        let n = $r(e) ? _n(e) : ze(e);
        return [
          Ee("TYPE") +
            n.padEnd(Ue) +
            (e.rowLabel ? "· " + e.rowLabel + "  " : "  ") +
            (e.message ?? ""),
          ...(e.suggestion ? [ft + "did you mean `" + e.suggestion + "`?"] : []),
        ];
      }
      case "WARN":
        return [
          Ee("WARN") +
            ze(e).padEnd(Ue) +
            "  defined and never read" +
            (e.suggestion ? ` — did you mean \`${e.suggestion}\`?` : ""),
        ];
      default:
        return [Ee(e.code) + ze(e)];
    }
  }
  function Yh(e) {
    let n = 0,
      t = 0;
    for (let i of e)
      if (i.code === "STALE") n += i.anchorGroup ? (i.suppressedCount ?? 0) : 1;
      else if (uo.has(i.code)) t++;
    let r = n + t;
    return `  ${r} problem${r === 1 ? "" : "s"} (${n} stale, ${t} error${t === 1 ? "" : "s"})`;
  }
  function qn(e, n) {
    let t = 1,
      r = Math.min(n, e.length);
    for (let i = 0; i < r; i++)
      if (
        e[i] ===
        `
`
      )
        t++;
    return t;
  }
  var Lu = 46,
    Kh = 28,
    Xh = 26,
    Jh = 7;
  function Du(e, n, t) {
    let r = new Map();
    for (let c of We(n).tables) r.set(c.span.start, c);
    let i = [],
      o = new Map(),
      s = [];
    for (let c of t) {
      if (c.sheetId === "") {
        s.push(c);
        continue;
      }
      let f = o.get(c.sheetId) ?? [];
      (f.push(c), o.set(c.sheetId, f));
    }
    for (let [, c] of o) {
      let f = r.get(c[0].tableSpan.start);
      if (i.length > 0) i.push("");
      (i.push(
        `${e}  table at line ${qn(n, c[0].tableSpan.start)}` +
          ` — ${f?.rows.length ?? 0} rows, ${f?.headers.length ?? 0} columns`,
      ),
        zt(i, "column rules", em(c)),
        zt(i, "constants worth naming", tm(c, n)),
        zt(i, "scalars matching figures in prose", nm(c, n)),
        zt(i, "no rule found — treating as inputs", rm(c, f)),
        zt(i, "ambiguous — proposed neither", im(c)),
        zt(i, "near-miss — not proposed", om(c)),
        zt(i, "also fits, not proposed", sm(c)));
    }
    zt(i, "figures matching more than one value — not anchored", am(s, n));
    let a = t.filter((c) => c.kind === "column" && !c.weak).length,
      u = t.filter((c) => c.kind === "scalar").length,
      l = t.filter((c) => c.kind === "scalar" && c.anchorSite).length;
    if (i.length > 0) i.push("");
    return (
      i.push(`${Po(a, "rule")}, ${Po(u, "scalar")}, ${Po(l, "anchor")}.`),
      i.join(`
`)
    );
  }
  function zt(e, n, t) {
    if (t.length === 0) return;
    if (e.length > 0) e.push("");
    (e.push(`  ${n}`), e.push(...t));
  }
  function em(e) {
    let n = e.filter((o) => o.kind === "column"),
      t = tn(n.map((o) => o.name)),
      r = n.map((o) => `    ${o.name.padEnd(t)}= ${o.rule.slice(o.rule.indexOf("=") + 2)}`),
      i = Lo(r, Lu);
    return n.map((o, s) => {
      let a = o.weak ? "2 rows — weak, not written" : `${o.fits}/${o.rows} rows`;
      return r[s].padEnd(i) + a;
    });
  }
  function tm(e, n) {
    let t = e.filter((i) => i.kind === "constant" && i.constantEcho),
      r = tn(t.map((i) => i.name));
    return t.map((i) => {
      let o = i.constantEcho;
      return `    ${i.name.padEnd(r)}also appears as "${o.text}" in prose, line ${qn(n, o.span.start)}`;
    });
  }
  function nm(e, n) {
    let r = e
        .filter((s) => s.kind === "scalar")
        .map((s) => ({
          p: s,
          value: s.anchorSite ? n.slice(s.anchorSite.start, s.anchorSite.end) : "",
          line: s.anchorSite ? `line ${qn(n, s.anchorSite.start)}` : "",
        })),
      i = tn(r.map((s) => s.value)),
      o = tn(r.map((s) => s.line));
    return r.map(({ p: s, value: a, line: u }) => {
      let l = `= ${s.rule.slice(s.rule.indexOf("=") + 2)}`,
        c = `    ${a.padEnd(i)}${u.padEnd(o)}${l.padEnd(Kh)}${s.name}`;
      return s.reason
        ? `${c}
      ${s.reason}`
        : c;
    });
  }
  function rm(e, n) {
    if (!n) return [];
    let t = new Set(
        e.filter((i) => i.kind === "column" || i.kind === "near-miss").map((i) => i.name),
      ),
      r = n.headers.map((i) => i.text).filter((i) => !t.has(i));
    return r.length === 0 ? [] : [`    ${r.join(", ")}`];
  }
  function im(e) {
    let n = e.filter((r) => r.kind === "ambiguous"),
      t = tn(n.map((r) => r.name));
    return n.flatMap((r) =>
      (r.alternatives ?? []).map((i, o) => `    ${(o === 0 ? r.name : "").padEnd(t)}${i}`),
    );
  }
  function om(e) {
    let n = e.filter((o) => o.kind === "near-miss"),
      t = n.flatMap((o) => [
        `    ${o.rule}`,
        `      cell ${o.disagreement.stored}, rule gives ${o.disagreement.computed}`,
      ]),
      r = Lo(t, Lu),
      i = [];
    return (
      n.forEach((o, s) => {
        let a = o.disagreement;
        (i.push(t[s * 2].padEnd(r) + `${o.fits}/${o.rows} rows`),
          i.push(`      row ${a.rowIndex + 1}  ${a.rowLabel}`),
          i.push(t[s * 2 + 1].padEnd(r) + `differs by ${um(a.stored, a.computed)}`));
      }),
      i
    );
  }
  function sm(e) {
    let n = e.filter((i) => i.kind === "alternative"),
      t = n.map((i) => `    ${i.rule}`),
      r = Lo(t, 4 + Xh);
    return n.map((i, o) => t[o].padEnd(r) + (i.reason ?? ""));
  }
  function am(e, n) {
    let t = e.filter((s) => s.kind === "ambiguous"),
      r = tn(t.map((s) => s.name)),
      i = t.map((s) => ({ p: s, line: `line ${qn(n, s.tableSpan.start)}` })),
      o = tn(i.map((s) => s.line));
    return i.flatMap(({ p: s, line: a }) =>
      (s.alternatives ?? []).map((u, l) =>
        l === 0
          ? `    ${s.name.padEnd(r)}${a.padEnd(o)}${u}`
          : `    ${"".padEnd(r)}${"".padEnd(o)}${u}`,
      ),
    );
  }
  function um(e, n) {
    let t = new ue(e.replace(/[^\d.-]/g, "")),
      r = new ue(n.replace(/[^\d.-]/g, "")),
      i = Math.max(Pu(e), Pu(n));
    return r.minus(t).abs().toFixed(i);
  }
  var Pu = (e) => /\.(\d+)/.exec(e)?.[1].length ?? 0;
  function tn(e) {
    return Math.max(Jh, ...e.map((n) => n.length + 2));
  }
  function Lo(e, n) {
    return Math.max(n, ...e.map((t) => t.length + 2));
  }
  function Po(e, n) {
    return `${e} ${n}${e === 1 ? "" : "s"}`;
  }
  function lm(e, n, t) {
    let r = [],
      i = e.source,
      o = new Map();
    for (let a of n.findings) if (a.span) o.set(`${a.span.start}:${a.span.end}`, a);
    let s = (a, u) => o.get(`${a}:${u}`) ?? { code: "STALE" };
    for (let a of e.sheets.values()) {
      if (!a.table) continue;
      for (let [u, l] of a.columns) {
        let c = `${a.id}.${u}`;
        if (n.unitConflicts.has(c)) continue;
        let f = n.cells.get(c);
        if (!f) continue;
        let p = n.columnPrecision.get(c) ?? 2,
          h = n.columnUnits.get(c) ?? null,
          g = a.columnIndex.get(u);
        a.table.rows.forEach((k, C) => {
          let b = f[C],
            F = k.cells[g];
          if (!b || !F) return;
          if (F.text !== "" && !en(b, F.text, p))
            r.push({
              start: F.start,
              end: F.end,
              text: Ye(lt(b, p), h),
              finding: s(F.start, F.end),
            });
        });
      }
    }
    for (let a of e.anchors) {
      if (!a.value) continue;
      if (a.value.kind === "image") continue;
      let u = `${a.sheetId}.${a.name}`,
        l = n.values.get(u);
      if (!l) continue;
      let c = i.slice(a.value.start, a.value.end),
        f = $n(c, 2),
        p = n.scalarUnits.get(u) ?? null,
        h = wn(l, f);
      if (!en(h, c, f))
        r.push({
          start: a.value.start,
          end: a.value.end,
          text: Ye(lt(h, f), p),
          finding: s(a.value.start, a.value.end),
        });
    }
    if (t.fixDates)
      for (let a of n.findings) {
        if (a.code !== "DATE" || !a.isoFix || !a.sheetId || !a.name) continue;
        let u = e.sheets.get(a.sheetId),
          l = u?.table;
        if (!l) continue;
        let c = u.columnIndex.get(a.name);
        if (c === void 0) continue;
        let p = l.rows.find((h) => h.cells[0]?.text === a.rowLabel)?.cells[c];
        if (p && p.text === a.raw)
          r.push({ start: p.start, end: p.end, text: a.isoFix, finding: a });
      }
    return cm(r);
  }
  function cm(e) {
    let n = new Set(),
      t = [];
    for (let r of e) {
      let i = `${r.start}:${r.end}`;
      if (n.has(i)) continue;
      (n.add(i), t.push(r));
    }
    return t;
  }
  var fm = new Set(["STALE"]);
  function Bu(e, n = {}) {
    let t = ct(We(e)),
      r = xt(t, { docPath: n.docPath }),
      i = lm(t, r, n),
      o = Vn(e, i),
      s = dm(t, r, i),
      a = n.fixDates ? i.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.text)).length : 0,
      u = i.length - s - a,
      l = r.findings.filter((f) => {
        if (fm.has(f.code)) return !1;
        if (n.fixDates && f.code === "DATE" && f.isoFix) return !1;
        return !0;
      }),
      c = r.charts
        .filter((f) => (f.state === "stale" || f.state === "missing") && f.target && f.svg)
        .map((f) => ({ target: f.target, svg: f.svg }));
    return {
      output: o,
      changed: o !== e,
      cellsUpdated: s,
      anchorsUpdated: u,
      datesFixed: a,
      unfixable: l,
      artifacts: c,
    };
  }
  function dm(e, n, t) {
    let r = new Set();
    for (let i of e.sheets.values())
      for (let o of i.table?.rows ?? []) for (let s of o.cells) r.add(`${s.start}:${s.end}`);
    return t.filter((i) => r.has(`${i.start}:${i.end}`)).length;
  }
  function Nu(e) {
    if (e.t === "num") return e.d.toString();
    if (e.t === "date") return e.iso;
    if (e.t === "bool") return String(e.b);
    return e.s;
  }
  function pm(e) {
    let n = ct(We(e)),
      t = xt(n),
      r = new Map();
    for (let [i, o] of t.values) r.set(i, Nu(o));
    for (let [i, o] of t.cells) r.set(i, o.map((s) => (s ? Nu(s) : "?")).join(", "));
    return { ...Object.fromEntries(r), assertions: t.assertions, charts: t.charts };
  }
  function Do(e, n) {
    return e.source.slice(n.expr.start, n.expr.end);
  }
  function hm(e) {
    let n = [],
      t = ct(We(e)),
      { order: r, assertionIds: i, chartIds: o } = zn(t);
    if (t.docScope.size > 0) {
      n.push("document scope");
      for (let a of t.docScope.values()) n.push(`  ${a.name} = ${Do(t, a)}`);
      n.push("");
    }
    let s = new Map(xt(t).charts.map((a) => [`${a.sheetId}.${a.name}`, a]));
    for (let a of t.sheets.keys()) {
      let u = t.sheets.get(a);
      if ((n.push(`#${a}${u.table ? "" : "  (no table)"}`), u.inputColumns.size > 0))
        n.push(`  inputs:  ${[...u.inputColumns].join(", ")}`);
      if (u.columns.size > 0) {
        n.push("  rules:");
        for (let c of u.columns.values()) n.push(`    ${c.name} = ${Do(t, c)}`);
      }
      if (u.scalars.size > 0) {
        n.push("  scalars:");
        for (let c of u.scalars.values()) n.push(`    ${c.name} = ${Do(t, c)}`);
      }
      let l = r.filter((c) => c.sheetId === a && !i.has(c.id) && !o.has(c.id)).map((c) => c.name);
      if (l.length > 0) n.push(`  order:   ${l.join(" → ")}`);
      if (u.assertions.length > 0) {
        n.push("  assertions:");
        for (let c of u.assertions) n.push(`    ${c.source.replace(/^assert\s+/, "")}`);
      }
      if (u.charts.length > 0) {
        n.push("  charts:");
        for (let c of u.charts) {
          let f = s.get(`${c.sheetId}.${c.name}`),
            p = f?.path ? ` → ${f.path}` : "",
            h = f ? `  [${f.state}]` : "";
          n.push(
            `    ${c.name} = ${c.engine} of ${c.series.join(", ")} labelled ${c.labels}${p}${h}`,
          );
        }
      }
      n.push("");
    }
    return n;
  }
  var mm = {
    locate: We,
    build: ct,
    check: xt,
    fmt: Bu,
    infer: Or,
    planInfer: Mu,
    applyEdits: Vn,
    topoOrder: zn,
    formatCheck: Ru,
    formatInfer: Du,
    pgEval: pm,
    pgExplain: hm,
  };
  globalThis.VisiMark = mm;
})();
