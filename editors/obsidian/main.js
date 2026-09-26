"use strict";
var oc = Object.create;
var Mn = Object.defineProperty;
var sc = Object.getOwnPropertyDescriptor;
var ac = Object.getOwnPropertyNames;
var lc = Object.getPrototypeOf,
  uc = Object.prototype.hasOwnProperty;
var cc = (e, n, t) =>
  n in e ? Mn(e, n, { enumerable: !0, configurable: !0, writable: !0, value: t }) : (e[n] = t);
var dc = (e, n) => () => {
    try {
      return (n || e((n = { exports: {} }).exports, n), n.exports);
    } catch (t) {
      throw ((n = 0), t);
    }
  },
  gs = (e, n) => {
    for (var t in n) Mn(e, t, { get: n[t], enumerable: !0 });
  },
  ws = (e, n, t, r) => {
    if ((n && typeof n == "object") || typeof n == "function")
      for (let i of ac(n))
        !uc.call(e, i) &&
          i !== t &&
          Mn(e, i, { get: () => n[i], enumerable: !(r = sc(n, i)) || r.enumerable });
    return e;
  };
var fc = (e, n, t) => (
    (t = e != null ? oc(lc(e)) : {}),
    ws(n || !e || !e.__esModule ? Mn(t, "default", { value: e, enumerable: !0 }) : t, e)
  ),
  pc = (e) => ws(Mn({}, "__esModule", { value: !0 }), e);
var W = (e, n, t) => cc(e, typeof n != "symbol" ? n + "" : n, t);
var za = dc((av, Ba) => {
  "use strict";
  var Sr = Object.prototype.hasOwnProperty,
    Va = Object.prototype.toString,
    Na = Object.defineProperty,
    Da = Object.getOwnPropertyDescriptor,
    $a = function (n) {
      return typeof Array.isArray == "function"
        ? Array.isArray(n)
        : Va.call(n) === "[object Array]";
    },
    La = function (n) {
      if (!n || Va.call(n) !== "[object Object]") return !1;
      var t = Sr.call(n, "constructor"),
        r =
          n.constructor &&
          n.constructor.prototype &&
          Sr.call(n.constructor.prototype, "isPrototypeOf");
      if (n.constructor && !t && !r) return !1;
      var i;
      for (i in n);
      return typeof i == "undefined" || Sr.call(n, i);
    },
    Oa = function (n, t) {
      Na && t.name === "__proto__"
        ? Na(n, t.name, { enumerable: !0, configurable: !0, value: t.newValue, writable: !0 })
        : (n[t.name] = t.newValue);
    },
    _a = function (n, t) {
      if (t === "__proto__")
        if (Sr.call(n, t)) {
          if (Da) return Da(n, t).value;
        } else return;
      return n[t];
    };
  Ba.exports = function e() {
    var n,
      t,
      r,
      i,
      o,
      s,
      a = arguments[0],
      l = 1,
      u = arguments.length,
      c = !1;
    for (
      typeof a == "boolean" && ((c = a), (a = arguments[1] || {}), (l = 2)),
        (a == null || (typeof a != "object" && typeof a != "function")) && (a = {});
      l < u;
      ++l
    )
      if (((n = arguments[l]), n != null))
        for (t in n)
          ((r = _a(a, t)),
            (i = _a(n, t)),
            a !== i &&
              (c && i && (La(i) || (o = $a(i)))
                ? (o ? ((o = !1), (s = r && $a(r) ? r : [])) : (s = r && La(r) ? r : {}),
                  Oa(a, { name: t, newValue: e(c, s, i) }))
                : typeof i != "undefined" && Oa(a, { name: t, newValue: i })));
    return a;
  };
});
var lw = {};
gs(lw, { default: () => pi });
module.exports = pc(lw);
var ae = require("obsidian");
function mi(e, n) {
  let t = String(e);
  if (typeof n != "string") throw new TypeError("Expected character");
  let r = 0,
    i = t.indexOf(n);
  for (; i !== -1;) (r++, (i = t.indexOf(n, i + n.length)));
  return r;
}
var ve = Pt(/[A-Za-z]/),
  Se = Pt(/[\dA-Za-z]/),
  xs = Pt(/[#-'*+\--9=?A-Z^-~]/);
function Zt(e) {
  return e !== null && (e < 32 || e === 127);
}
var Fn = Pt(/\d/),
  ks = Pt(/[\dA-Fa-f]/),
  bs = Pt(/[!-/:-@[-`{-~]/);
function V(e) {
  return e !== null && e < -2;
}
function oe(e) {
  return e !== null && (e < 0 || e === 32);
}
function Z(e) {
  return e === -2 || e === -1 || e === 32;
}
var Kt = Pt(/\p{P}|\p{S}/u),
  st = Pt(/\s/);
function Pt(e) {
  return n;
  function n(t) {
    return t !== null && t > -1 && e.test(String.fromCharCode(t));
  }
}
function hi(e) {
  if (typeof e != "string") throw new TypeError("Expected a string");
  return e.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}
var Mt = function (e) {
  if (e == null) return wc;
  if (typeof e == "function") return rr(e);
  if (typeof e == "object") return Array.isArray(e) ? mc(e) : hc(e);
  if (typeof e == "string") return gc(e);
  throw new Error("Expected function, string, or object as test");
};
function mc(e) {
  let n = [],
    t = -1;
  for (; ++t < e.length;) n[t] = Mt(e[t]);
  return rr(r);
  function r(...i) {
    let o = -1;
    for (; ++o < n.length;) if (n[o].apply(this, i)) return !0;
    return !1;
  }
}
function hc(e) {
  let n = e;
  return rr(t);
  function t(r) {
    let i = r,
      o;
    for (o in e) if (i[o] !== n[o]) return !1;
    return !0;
  }
}
function gc(e) {
  return rr(n);
  function n(t) {
    return t && t.type === e;
  }
}
function rr(e) {
  return n;
  function n(t, r, i) {
    return !!(xc(t) && e.call(this, t, typeof r == "number" ? r : void 0, i || void 0));
  }
}
function wc() {
  return !0;
}
function xc(e) {
  return e !== null && typeof e == "object" && "type" in e;
}
var ys = [],
  ir = !0,
  Qt = !1,
  or = "skip";
function Nn(e, n, t, r) {
  let i;
  typeof n == "function" && typeof t != "function" ? ((r = t), (t = n)) : (i = n);
  let o = Mt(i),
    s = r ? -1 : 1;
  a(e, void 0, [])();
  function a(l, u, c) {
    let d = l && typeof l == "object" ? l : {};
    if (typeof d.type == "string") {
      let p =
        typeof d.tagName == "string" ? d.tagName : typeof d.name == "string" ? d.name : void 0;
      Object.defineProperty(f, "name", {
        value: "node (" + (l.type + (p ? "<" + p + ">" : "")) + ")",
      });
    }
    return f;
    function f() {
      let p = ys,
        m,
        h,
        w;
      if ((!n || o(l, u, c[c.length - 1] || void 0)) && ((p = kc(t(l, c))), p[0] === Qt)) return p;
      if ("children" in l && l.children) {
        let g = l;
        if (g.children && p[0] !== or)
          for (
            h = (r ? g.children.length : -1) + s, w = c.concat(g);
            h > -1 && h < g.children.length;
          ) {
            let S = g.children[h];
            if (((m = a(S, h, w)()), m[0] === Qt)) return m;
            h = typeof m[1] == "number" ? m[1] : h + s;
          }
      }
      return p;
    }
  }
}
function kc(e) {
  return Array.isArray(e) ? e : typeof e == "number" ? [ir, e] : e == null ? ys : [e];
}
function gi(e, n, t) {
  let i = Mt((t || {}).ignore || []),
    o = bc(n),
    s = -1;
  for (; ++s < o.length;) Nn(e, "text", a);
  function a(u, c) {
    let d = -1,
      f;
    for (; ++d < c.length;) {
      let p = c[d],
        m = f ? f.children : void 0;
      if (i(p, m ? m.indexOf(p) : void 0, f)) return;
      f = p;
    }
    if (f) return l(u, c);
  }
  function l(u, c) {
    let d = c[c.length - 1],
      f = o[s][0],
      p = o[s][1],
      m = 0,
      w = d.children.indexOf(u),
      g = !1,
      S = [];
    f.lastIndex = 0;
    let b = f.exec(u.value);
    for (; b;) {
      let I = b.index,
        R = { index: b.index, input: b.input, stack: [...c, u] },
        y = p(...b, R);
      if (
        (typeof y == "string" && (y = y.length > 0 ? { type: "text", value: y } : void 0),
        y === !1
          ? (f.lastIndex = I + 1)
          : (m !== I && S.push({ type: "text", value: u.value.slice(m, I) }),
            Array.isArray(y) ? S.push(...y) : y && S.push(y),
            (m = I + b[0].length),
            (g = !0)),
        !f.global)
      )
        break;
      b = f.exec(u.value);
    }
    return (
      g
        ? (m < u.value.length && S.push({ type: "text", value: u.value.slice(m) }),
          d.children.splice(w, 1, ...S))
        : (S = [u]),
      w + S.length
    );
  }
}
function bc(e) {
  let n = [];
  if (!Array.isArray(e)) throw new TypeError("Expected find and replace tuple or list of tuples");
  let t = !e[0] || Array.isArray(e[0]) ? e : [e],
    r = -1;
  for (; ++r < t.length;) {
    let i = t[r];
    n.push([yc(i[0]), vc(i[1])]);
  }
  return n;
}
function yc(e) {
  return typeof e == "string" ? new RegExp(hi(e), "g") : e;
}
function vc(e) {
  return typeof e == "function"
    ? e
    : function () {
        return e;
      };
}
var wi = "phrasing",
  xi = ["autolink", "link", "image", "label"];
function bi() {
  return {
    transforms: [Ac],
    enter: {
      literalAutolink: Sc,
      literalAutolinkEmail: ki,
      literalAutolinkHttp: ki,
      literalAutolinkWww: ki,
    },
    exit: {
      literalAutolink: Tc,
      literalAutolinkEmail: Cc,
      literalAutolinkHttp: Ec,
      literalAutolinkWww: Ic,
    },
  };
}
function yi() {
  return {
    unsafe: [
      {
        character: "@",
        before: "[+\\-.\\w]",
        after: "[\\-.\\w]",
        inConstruct: wi,
        notInConstruct: xi,
      },
      { character: ".", before: "[Ww]", after: "[\\-.\\w]", inConstruct: wi, notInConstruct: xi },
      { character: ":", before: "[ps]", after: "\\/", inConstruct: wi, notInConstruct: xi },
    ],
  };
}
function Sc(e) {
  this.enter({ type: "link", title: null, url: "", children: [] }, e);
}
function ki(e) {
  this.config.enter.autolinkProtocol.call(this, e);
}
function Ec(e) {
  this.config.exit.autolinkProtocol.call(this, e);
}
function Ic(e) {
  this.config.exit.data.call(this, e);
  let n = this.stack[this.stack.length - 1];
  (n.type, (n.url = "http://" + this.sliceSerialize(e)));
}
function Cc(e) {
  this.config.exit.autolinkEmail.call(this, e);
}
function Tc(e) {
  this.exit(e);
}
function Ac(e) {
  gi(
    e,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, Rc],
      [/(?<=^|\s|\p{P}|\p{S})([-.\w+]+)@([-\w]+(?:\.[-\w]+)+)/gu, Pc],
    ],
    { ignore: ["link", "linkReference"] },
  );
}
function Rc(e, n, t, r, i) {
  let o = "";
  if (!vs(i) || (/^w/i.test(n) && ((t = n + t), (n = ""), (o = "http://")), !Mc(t))) return !1;
  let s = Fc(t + r);
  if (!s[0]) return !1;
  let a = {
    type: "link",
    title: null,
    url: o + n + s[0],
    children: [{ type: "text", value: n + s[0] }],
  };
  return s[1] ? [a, { type: "text", value: s[1] }] : a;
}
function Pc(e, n, t, r) {
  return !vs(r, !0) || /[-\d_]$/.test(t)
    ? !1
    : {
        type: "link",
        title: null,
        url: "mailto:" + n + "@" + t,
        children: [{ type: "text", value: n + "@" + t }],
      };
}
function Mc(e) {
  let n = e.split(".");
  return !(
    n.length < 2 ||
    (n[n.length - 1] && (/_/.test(n[n.length - 1]) || !/[a-zA-Z\d]/.test(n[n.length - 1]))) ||
    (n[n.length - 2] && (/_/.test(n[n.length - 2]) || !/[a-zA-Z\d]/.test(n[n.length - 2])))
  );
}
function Fc(e) {
  let n = /[!"&'),.:;<>?\]}]+$/.exec(e);
  if (!n) return [e, void 0];
  e = e.slice(0, n.index);
  let t = n[0],
    r = t.indexOf(")"),
    i = mi(e, "("),
    o = mi(e, ")");
  for (; r !== -1 && i > o;)
    ((e += t.slice(0, r + 1)), (t = t.slice(r + 1)), (r = t.indexOf(")")), o++);
  return [e, t];
}
function vs(e, n) {
  let t = e.input.charCodeAt(e.index - 1);
  return (e.index === 0 || st(t) || Kt(t)) && (!n || t !== 47);
}
function Me(e) {
  return e
    .replace(/[\t\n\r ]+/g, " ")
    .replace(/^ | $/g, "")
    .toLowerCase()
    .toUpperCase();
}
Ss.peek = zc;
function Nc() {
  this.buffer();
}
function Dc(e) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, e);
}
function $c() {
  this.buffer();
}
function Lc(e) {
  this.enter({ type: "footnoteDefinition", identifier: "", label: "", children: [] }, e);
}
function Oc(e) {
  let n = this.resume(),
    t = this.stack[this.stack.length - 1];
  (t.type, (t.identifier = Me(this.sliceSerialize(e)).toLowerCase()), (t.label = n));
}
function _c(e) {
  this.exit(e);
}
function Vc(e) {
  let n = this.resume(),
    t = this.stack[this.stack.length - 1];
  (t.type, (t.identifier = Me(this.sliceSerialize(e)).toLowerCase()), (t.label = n));
}
function Bc(e) {
  this.exit(e);
}
function zc() {
  return "[";
}
function Ss(e, n, t, r) {
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
function vi() {
  return {
    enter: {
      gfmFootnoteCallString: Nc,
      gfmFootnoteCall: Dc,
      gfmFootnoteDefinitionLabelString: $c,
      gfmFootnoteDefinition: Lc,
    },
    exit: {
      gfmFootnoteCallString: Oc,
      gfmFootnoteCall: _c,
      gfmFootnoteDefinitionLabelString: Vc,
      gfmFootnoteDefinition: Bc,
    },
  };
}
function Si(e) {
  let n = !1;
  return (
    e && e.firstLineBlank && (n = !0),
    {
      handlers: { footnoteDefinition: t, footnoteReference: Ss },
      unsafe: [{ character: "[", inConstruct: ["label", "phrasing", "reference"] }],
    }
  );
  function t(r, i, o, s) {
    let a = o.createTracker(s),
      l = a.move("[^"),
      u = o.enter("footnoteDefinition"),
      c = o.enter("label");
    return (
      (l += a.move(o.safe(o.associationId(r), { before: l, after: "]" }))),
      c(),
      (l += a.move("]:")),
      r.children &&
        r.children.length > 0 &&
        (a.shift(4),
        (l += a.move(
          (n
            ? `
`
            : " ") + o.indentLines(o.containerFlow(r, a.current()), n ? Es : Uc),
        ))),
      u(),
      l
    );
  }
}
function Uc(e, n, t) {
  return n === 0 ? e : Es(e, n, t);
}
function Es(e, n, t) {
  return (t ? "" : "    ") + e;
}
var jc = [
  "autolink",
  "destinationLiteral",
  "destinationRaw",
  "reference",
  "titleQuote",
  "titleApostrophe",
];
Is.peek = qc;
function Ei() {
  return { canContainEols: ["delete"], enter: { strikethrough: Hc }, exit: { strikethrough: Wc } };
}
function Ii() {
  return {
    unsafe: [{ character: "~", inConstruct: "phrasing", notInConstruct: jc }],
    handlers: { delete: Is },
  };
}
function Hc(e) {
  this.enter({ type: "delete", children: [] }, e);
}
function Wc(e) {
  this.exit(e);
}
function Is(e, n, t, r) {
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
function qc() {
  return "~";
}
function Gc(e) {
  return e.length;
}
function Ts(e, n) {
  let t = n || {},
    r = (t.align || []).concat(),
    i = t.stringLength || Gc,
    o = [],
    s = [],
    a = [],
    l = [],
    u = 0,
    c = -1;
  for (; ++c < e.length;) {
    let h = [],
      w = [],
      g = -1;
    for (e[c].length > u && (u = e[c].length); ++g < e[c].length;) {
      let S = Yc(e[c][g]);
      if (t.alignDelimiters !== !1) {
        let b = i(S);
        ((w[g] = b), (l[g] === void 0 || b > l[g]) && (l[g] = b));
      }
      h.push(S);
    }
    ((s[c] = h), (a[c] = w));
  }
  let d = -1;
  if (typeof r == "object" && "length" in r) for (; ++d < u;) o[d] = Cs(r[d]);
  else {
    let h = Cs(r);
    for (; ++d < u;) o[d] = h;
  }
  d = -1;
  let f = [],
    p = [];
  for (; ++d < u;) {
    let h = o[d],
      w = "",
      g = "";
    h === 99 ? ((w = ":"), (g = ":")) : h === 108 ? (w = ":") : h === 114 && (g = ":");
    let S = t.alignDelimiters === !1 ? 1 : Math.max(1, l[d] - w.length - g.length),
      b = w + "-".repeat(S) + g;
    (t.alignDelimiters !== !1 &&
      ((S = w.length + S + g.length), S > l[d] && (l[d] = S), (p[d] = S)),
      (f[d] = b));
  }
  (s.splice(1, 0, f), a.splice(1, 0, p), (c = -1));
  let m = [];
  for (; ++c < s.length;) {
    let h = s[c],
      w = a[c];
    d = -1;
    let g = [];
    for (; ++d < u;) {
      let S = h[d] || "",
        b = "",
        I = "";
      if (t.alignDelimiters !== !1) {
        let R = l[d] - (w[d] || 0),
          y = o[d];
        y === 114
          ? (b = " ".repeat(R))
          : y === 99
            ? R % 2
              ? ((b = " ".repeat(R / 2 + 0.5)), (I = " ".repeat(R / 2 - 0.5)))
              : ((b = " ".repeat(R / 2)), (I = b))
            : (I = " ".repeat(R));
      }
      (t.delimiterStart !== !1 && !d && g.push("|"),
        t.padding !== !1 &&
          !(t.alignDelimiters === !1 && S === "") &&
          (t.delimiterStart !== !1 || d) &&
          g.push(" "),
        t.alignDelimiters !== !1 && g.push(b),
        g.push(S),
        t.alignDelimiters !== !1 && g.push(I),
        t.padding !== !1 && g.push(" "),
        (t.delimiterEnd !== !1 || d !== u - 1) && g.push("|"));
    }
    m.push(t.delimiterEnd === !1 ? g.join("").replace(/ +$/, "") : g.join(""));
  }
  return m.join(`
`);
}
function Yc(e) {
  return e == null ? "" : String(e);
}
function Cs(e) {
  let n = typeof e == "string" ? e.codePointAt(0) : 0;
  return n === 67 || n === 99 ? 99 : n === 76 || n === 108 ? 108 : n === 82 || n === 114 ? 114 : 0;
}
function As(e, n, t, r) {
  let i = t.enter("blockquote"),
    o = t.createTracker(r);
  (o.move("> "), o.shift(2));
  let s = t.indentLines(t.containerFlow(e, o.current()), Zc);
  return (i(), s);
}
function Zc(e, n, t) {
  return ">" + (t ? "" : " ") + e;
}
function Ps(e, n) {
  return Rs(e, n.inConstruct, !0) && !Rs(e, n.notInConstruct, !1);
}
function Rs(e, n, t) {
  if ((typeof n == "string" && (n = [n]), !n || n.length === 0)) return t;
  let r = -1;
  for (; ++r < n.length;) if (e.includes(n[r])) return !0;
  return !1;
}
function Ci(e, n, t, r) {
  let i = -1;
  for (; ++i < t.unsafe.length;)
    if (
      t.unsafe[i].character ===
        `
` &&
      Ps(t.stack, t.unsafe[i])
    )
      return /[ \t]/.test(r.before) ? "" : " ";
  return `\\
`;
}
function Ms(e, n) {
  let t = String(e),
    r = t.indexOf(n),
    i = r,
    o = 0,
    s = 0;
  if (typeof n != "string") throw new TypeError("Expected substring");
  for (; r !== -1;)
    (r === i ? ++o > s && (s = o) : (o = 1), (i = r + n.length), (r = t.indexOf(n, i)));
  return s;
}
function Fs(e, n) {
  return !!(
    n.options.fences === !1 &&
    e.value &&
    !e.lang &&
    /[^ \r\n]/.test(e.value) &&
    !/^[\t ]*(?:[\r\n]|$)|(?:^|[\r\n])[\t ]*$/.test(e.value)
  );
}
function Ns(e) {
  let n = e.options.fence || "`";
  if (n !== "`" && n !== "~")
    throw new Error(
      "Cannot serialize code with `" + n + "` for `options.fence`, expected `` ` `` or `~`",
    );
  return n;
}
function Ds(e, n, t, r) {
  let i = Ns(t),
    o = e.value || "",
    s = i === "`" ? "GraveAccent" : "Tilde";
  if (Fs(e, t)) {
    let d = t.enter("codeIndented"),
      f = t.indentLines(o, Kc);
    return (d(), f);
  }
  let a = t.createTracker(r),
    l = i.repeat(Math.max(Ms(o, i) + 1, 3)),
    u = t.enter("codeFenced"),
    c = a.move(l);
  if (e.lang) {
    let d = t.enter(`codeFencedLang${s}`);
    ((c += a.move(t.safe(e.lang, { before: c, after: " ", encode: ["`"], ...a.current() }))), d());
  }
  if (e.lang && e.meta) {
    let d = t.enter(`codeFencedMeta${s}`);
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
      d());
  }
  return (
    (c += a.move(`
`)),
    o &&
      (c += a.move(
        o +
          `
`,
      )),
    (c += a.move(l)),
    u(),
    c
  );
}
function Kc(e, n, t) {
  return (t ? "" : "    ") + e;
}
function un(e) {
  let n = e.options.quote || '"';
  if (n !== '"' && n !== "'")
    throw new Error(
      "Cannot serialize title with `" + n + "` for `options.quote`, expected `\"`, or `'`",
    );
  return n;
}
function $s(e, n, t, r) {
  let i = un(t),
    o = i === '"' ? "Quote" : "Apostrophe",
    s = t.enter("definition"),
    a = t.enter("label"),
    l = t.createTracker(r),
    u = l.move("[");
  return (
    (u += l.move(t.safe(t.associationId(e), { before: u, after: "]", ...l.current() }))),
    (u += l.move("]: ")),
    a(),
    !e.url || /[\0- \u007F]/.test(e.url)
      ? ((a = t.enter("destinationLiteral")),
        (u += l.move("<")),
        (u += l.move(t.safe(e.url, { before: u, after: ">", ...l.current() }))),
        (u += l.move(">")))
      : ((a = t.enter("destinationRaw")),
        (u += l.move(
          t.safe(e.url, {
            before: u,
            after: e.title
              ? " "
              : `
`,
            ...l.current(),
          }),
        ))),
    a(),
    e.title &&
      ((a = t.enter(`title${o}`)),
      (u += l.move(" " + i)),
      (u += l.move(t.safe(e.title, { before: u, after: i, ...l.current() }))),
      (u += l.move(i)),
      a()),
    s(),
    u
  );
}
function Ls(e) {
  let n = e.options.emphasis || "*";
  if (n !== "*" && n !== "_")
    throw new Error(
      "Cannot serialize emphasis with `" + n + "` for `options.emphasis`, expected `*`, or `_`",
    );
  return n;
}
function Ft(e) {
  return "&#x" + e.toString(16).toUpperCase() + ";";
}
function kt(e) {
  if (e === null || oe(e) || st(e)) return 1;
  if (Kt(e)) return 2;
}
function cn(e, n, t) {
  let r = kt(e),
    i = kt(n);
  return r === void 0
    ? i === void 0
      ? t === "_"
        ? { inside: !0, outside: !0 }
        : { inside: !1, outside: !1 }
      : i === 1
        ? { inside: !0, outside: !0 }
        : { inside: !1, outside: !0 }
    : r === 1
      ? i === void 0
        ? { inside: !1, outside: !1 }
        : i === 1
          ? { inside: !0, outside: !0 }
          : { inside: !1, outside: !1 }
      : i === void 0
        ? { inside: !1, outside: !1 }
        : i === 1
          ? { inside: !0, outside: !1 }
          : { inside: !1, outside: !1 };
}
Ti.peek = Qc;
function Ti(e, n, t, r) {
  let i = Ls(t),
    o = t.enter("emphasis"),
    s = t.createTracker(r),
    a = s.move(i),
    l = s.move(t.containerPhrasing(e, { after: i, before: a, ...s.current() })),
    u = l.charCodeAt(0),
    c = cn(r.before.charCodeAt(r.before.length - 1), u, i);
  c.inside && (l = Ft(u) + l.slice(1));
  let d = l.charCodeAt(l.length - 1),
    f = cn(r.after.charCodeAt(0), d, i);
  f.inside && (l = l.slice(0, -1) + Ft(d));
  let p = s.move(i);
  return (
    o(), (t.attentionEncodeSurroundingInfo = { after: f.outside, before: c.outside }), a + l + p
  );
}
function Qc(e, n, t) {
  return t.options.emphasis || "*";
}
function Ai(e, n, t, r) {
  let i, o, s;
  (typeof n == "function" && typeof t != "function"
    ? ((o = void 0), (s = n), (i = t))
    : ((o = n), (s = t), (i = r)),
    Nn(e, o, a, i));
  function a(l, u) {
    let c = u[u.length - 1],
      d = c ? c.children.indexOf(l) : void 0;
    return s(l, d, c);
  }
}
var Jc = {};
function Jt(e, n) {
  let t = n || Jc,
    r = typeof t.includeImageAlt == "boolean" ? t.includeImageAlt : !0,
    i = typeof t.includeHtml == "boolean" ? t.includeHtml : !0;
  return _s(e, r, i);
}
function _s(e, n, t) {
  if (Xc(e)) {
    if ("value" in e) return e.type === "html" && !t ? "" : e.value;
    if (n && "alt" in e && e.alt) return e.alt;
    if ("children" in e) return Os(e.children, n, t);
  }
  return Array.isArray(e) ? Os(e, n, t) : "";
}
function Os(e, n, t) {
  let r = [],
    i = -1;
  for (; ++i < e.length;) r[i] = _s(e[i], n, t);
  return r.join("");
}
function Xc(e) {
  return !!(e && typeof e == "object");
}
function Vs(e, n) {
  let t = !1;
  return (
    Ai(e, function (r) {
      if (("value" in r && /\r?\n|\r/.test(r.value)) || r.type === "break") return ((t = !0), Qt);
    }),
    !!((!e.depth || e.depth < 3) && Jt(e) && (n.options.setext || t))
  );
}
function Bs(e, n, t, r) {
  let i = Math.max(Math.min(6, e.depth || 1), 1),
    o = t.createTracker(r);
  if (Vs(e, t)) {
    let c = t.enter("headingSetext"),
      d = t.enter("phrasing"),
      f = t.containerPhrasing(e, {
        ...o.current(),
        before: `
`,
        after: `
`,
      });
    return (
      d(),
      c(),
      f +
        `
` +
        (i === 1 ? "=" : "-").repeat(
          f.length -
            (Math.max(
              f.lastIndexOf("\r"),
              f.lastIndexOf(`
`),
            ) +
              1),
        )
    );
  }
  let s = "#".repeat(i),
    a = t.enter("headingAtx"),
    l = t.enter("phrasing");
  o.move(s + " ");
  let u = t.containerPhrasing(e, {
    before: "# ",
    after: `
`,
    ...o.current(),
  });
  return (
    /^[\t ]/.test(u) && (u = Ft(u.charCodeAt(0)) + u.slice(1)),
    (u = u ? s + " " + u : s),
    t.options.closeAtx && (u += " " + s),
    l(),
    a(),
    u
  );
}
Ri.peek = ed;
function Ri(e) {
  return e.value || "";
}
function ed() {
  return "<";
}
Pi.peek = td;
function Pi(e, n, t, r) {
  let i = un(t),
    o = i === '"' ? "Quote" : "Apostrophe",
    s = t.enter("image"),
    a = t.enter("label"),
    l = t.createTracker(r),
    u = l.move("![");
  return (
    (u += l.move(t.safe(e.alt, { before: u, after: "]", ...l.current() }))),
    (u += l.move("](")),
    a(),
    (!e.url && e.title) || /[\0- \u007F]/.test(e.url)
      ? ((a = t.enter("destinationLiteral")),
        (u += l.move("<")),
        (u += l.move(t.safe(e.url, { before: u, after: ">", ...l.current() }))),
        (u += l.move(">")))
      : ((a = t.enter("destinationRaw")),
        (u += l.move(t.safe(e.url, { before: u, after: e.title ? " " : ")", ...l.current() })))),
    a(),
    e.title &&
      ((a = t.enter(`title${o}`)),
      (u += l.move(" " + i)),
      (u += l.move(t.safe(e.title, { before: u, after: i, ...l.current() }))),
      (u += l.move(i)),
      a()),
    (u += l.move(")")),
    s(),
    u
  );
}
function td() {
  return "!";
}
Mi.peek = nd;
function Mi(e, n, t, r) {
  let i = e.referenceType,
    o = t.enter("imageReference"),
    s = t.enter("label"),
    a = t.createTracker(r),
    l = a.move("!["),
    u = t.safe(e.alt, { before: l, after: "]", ...a.current() });
  ((l += a.move(u + "][")), s());
  let c = t.stack;
  ((t.stack = []), (s = t.enter("reference")));
  let d = t.safe(t.associationId(e), { before: l, after: "]", ...a.current() });
  return (
    s(),
    (t.stack = c),
    o(),
    i === "full" || !u || u !== d
      ? (l += a.move(d + "]"))
      : i === "shortcut"
        ? (l = l.slice(0, -1))
        : (l += a.move("]")),
    l
  );
}
function nd() {
  return "!";
}
Fi.peek = rd;
function Fi(e, n, t) {
  let r = e.value || "",
    i = "`",
    o = -1;
  for (; new RegExp("(^|[^`])" + i + "([^`]|$)").test(r);) i += "`";
  for (
    /[^ \r\n]/.test(r) &&
    ((/^[ \r\n]/.test(r) && /[ \r\n]$/.test(r)) || /^`|`$/.test(r)) &&
    (r = " " + r + " ");
    ++o < t.unsafe.length;
  ) {
    let s = t.unsafe[o],
      a = t.compilePattern(s),
      l;
    if (s.atBreak)
      for (; (l = a.exec(r));) {
        let u = l.index;
        (r.charCodeAt(u) === 10 && r.charCodeAt(u - 1) === 13 && u--,
          (r = r.slice(0, u) + " " + r.slice(l.index + 1)));
      }
  }
  return i + r + i;
}
function rd() {
  return "`";
}
function Ni(e, n) {
  let t = Jt(e);
  return !!(
    !n.options.resourceLink &&
    e.url &&
    !e.title &&
    e.children &&
    e.children.length === 1 &&
    e.children[0].type === "text" &&
    (t === e.url || "mailto:" + t === e.url) &&
    /^[a-z][a-z+.-]+:/i.test(e.url) &&
    !/[\0- <>\u007F]/.test(e.url)
  );
}
Di.peek = id;
function Di(e, n, t, r) {
  let i = un(t),
    o = i === '"' ? "Quote" : "Apostrophe",
    s = t.createTracker(r),
    a,
    l;
  if (Ni(e, t)) {
    let c = t.stack;
    ((t.stack = []), (a = t.enter("autolink")));
    let d = s.move("<");
    return (
      (d += s.move(t.containerPhrasing(e, { before: d, after: ">", ...s.current() }))),
      (d += s.move(">")),
      a(),
      (t.stack = c),
      d
    );
  }
  ((a = t.enter("link")), (l = t.enter("label")));
  let u = s.move("[");
  return (
    (u += s.move(t.containerPhrasing(e, { before: u, after: "](", ...s.current() }))),
    (u += s.move("](")),
    l(),
    (!e.url && e.title) || /[\0- \u007F]/.test(e.url)
      ? ((l = t.enter("destinationLiteral")),
        (u += s.move("<")),
        (u += s.move(t.safe(e.url, { before: u, after: ">", ...s.current() }))),
        (u += s.move(">")))
      : ((l = t.enter("destinationRaw")),
        (u += s.move(t.safe(e.url, { before: u, after: e.title ? " " : ")", ...s.current() })))),
    l(),
    e.title &&
      ((l = t.enter(`title${o}`)),
      (u += s.move(" " + i)),
      (u += s.move(t.safe(e.title, { before: u, after: i, ...s.current() }))),
      (u += s.move(i)),
      l()),
    (u += s.move(")")),
    a(),
    u
  );
}
function id(e, n, t) {
  return Ni(e, t) ? "<" : "[";
}
$i.peek = od;
function $i(e, n, t, r) {
  let i = e.referenceType,
    o = t.enter("linkReference"),
    s = t.enter("label"),
    a = t.createTracker(r),
    l = a.move("["),
    u = t.containerPhrasing(e, { before: l, after: "]", ...a.current() });
  ((l += a.move(u + "][")), s());
  let c = t.stack;
  ((t.stack = []), (s = t.enter("reference")));
  let d = t.safe(t.associationId(e), { before: l, after: "]", ...a.current() });
  return (
    s(),
    (t.stack = c),
    o(),
    i === "full" || !u || u !== d
      ? (l += a.move(d + "]"))
      : i === "shortcut"
        ? (l = l.slice(0, -1))
        : (l += a.move("]")),
    l
  );
}
function od() {
  return "[";
}
function dn(e) {
  let n = e.options.bullet || "*";
  if (n !== "*" && n !== "+" && n !== "-")
    throw new Error(
      "Cannot serialize items with `" + n + "` for `options.bullet`, expected `*`, `+`, or `-`",
    );
  return n;
}
function zs(e) {
  let n = dn(e),
    t = e.options.bulletOther;
  if (!t) return n === "*" ? "-" : "*";
  if (t !== "*" && t !== "+" && t !== "-")
    throw new Error(
      "Cannot serialize items with `" +
        t +
        "` for `options.bulletOther`, expected `*`, `+`, or `-`",
    );
  if (t === n)
    throw new Error(
      "Expected `bullet` (`" + n + "`) and `bulletOther` (`" + t + "`) to be different",
    );
  return t;
}
function Us(e) {
  let n = e.options.bulletOrdered || ".";
  if (n !== "." && n !== ")")
    throw new Error(
      "Cannot serialize items with `" + n + "` for `options.bulletOrdered`, expected `.` or `)`",
    );
  return n;
}
function sr(e) {
  let n = e.options.rule || "*";
  if (n !== "*" && n !== "-" && n !== "_")
    throw new Error(
      "Cannot serialize rules with `" + n + "` for `options.rule`, expected `*`, `-`, or `_`",
    );
  return n;
}
function js(e, n, t, r) {
  let i = t.enter("list"),
    o = t.bulletCurrent,
    s = e.ordered ? Us(t) : dn(t),
    a = e.ordered ? (s === "." ? ")" : ".") : zs(t),
    l = n && t.bulletLastUsed ? s === t.bulletLastUsed : !1;
  if (!e.ordered) {
    let c = e.children ? e.children[0] : void 0;
    if (
      ((s === "*" || s === "-") &&
        c &&
        (!c.children || !c.children[0]) &&
        t.stack[t.stack.length - 1] === "list" &&
        t.stack[t.stack.length - 2] === "listItem" &&
        t.stack[t.stack.length - 3] === "list" &&
        t.stack[t.stack.length - 4] === "listItem" &&
        t.indexStack[t.indexStack.length - 1] === 0 &&
        t.indexStack[t.indexStack.length - 2] === 0 &&
        t.indexStack[t.indexStack.length - 3] === 0 &&
        (l = !0),
      sr(t) === s && c)
    ) {
      let d = -1;
      for (; ++d < e.children.length;) {
        let f = e.children[d];
        if (
          f &&
          f.type === "listItem" &&
          f.children &&
          f.children[0] &&
          f.children[0].type === "thematicBreak"
        ) {
          l = !0;
          break;
        }
      }
    }
  }
  (l && (s = a), (t.bulletCurrent = s));
  let u = t.containerFlow(e, r);
  return ((t.bulletLastUsed = s), (t.bulletCurrent = o), i(), u);
}
function Hs(e) {
  let n = e.options.listItemIndent || "one";
  if (n !== "tab" && n !== "one" && n !== "mixed")
    throw new Error(
      "Cannot serialize items with `" +
        n +
        "` for `options.listItemIndent`, expected `tab`, `one`, or `mixed`",
    );
  return n;
}
function Ws(e, n, t, r) {
  let i = Hs(t),
    o = t.bulletCurrent || dn(t);
  n &&
    n.type === "list" &&
    n.ordered &&
    (o =
      (typeof n.start == "number" && n.start > -1 ? n.start : 1) +
      (t.options.incrementListMarker === !1 ? 0 : n.children.indexOf(e)) +
      o);
  let s = o.length + 1;
  (i === "tab" || (i === "mixed" && ((n && n.type === "list" && n.spread) || e.spread))) &&
    (s = Math.ceil(s / 4) * 4);
  let a = t.createTracker(r);
  (a.move(o + " ".repeat(s - o.length)), a.shift(s));
  let l = t.enter("listItem"),
    u = t.indentLines(t.containerFlow(e, a.current()), c);
  return (l(), u);
  function c(d, f, p) {
    return f ? (p ? "" : " ".repeat(s)) + d : (p ? o : o + " ".repeat(s - o.length)) + d;
  }
}
function qs(e, n, t, r) {
  let i = t.enter("paragraph"),
    o = t.enter("phrasing"),
    s = t.containerPhrasing(e, r);
  return (o(), i(), s);
}
var Li = Mt([
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
function Gs(e, n, t, r) {
  return (
    e.children.some(function (s) {
      return Li(s);
    })
      ? t.containerPhrasing
      : t.containerFlow
  ).call(t, e, r);
}
function Ys(e) {
  let n = e.options.strong || "*";
  if (n !== "*" && n !== "_")
    throw new Error(
      "Cannot serialize strong with `" + n + "` for `options.strong`, expected `*`, or `_`",
    );
  return n;
}
Oi.peek = sd;
function Oi(e, n, t, r) {
  let i = Ys(t),
    o = t.enter("strong"),
    s = t.createTracker(r),
    a = s.move(i + i),
    l = s.move(t.containerPhrasing(e, { after: i, before: a, ...s.current() })),
    u = l.charCodeAt(0),
    c = cn(r.before.charCodeAt(r.before.length - 1), u, i);
  c.inside && (l = Ft(u) + l.slice(1));
  let d = l.charCodeAt(l.length - 1),
    f = cn(r.after.charCodeAt(0), d, i);
  f.inside && (l = l.slice(0, -1) + Ft(d));
  let p = s.move(i + i);
  return (
    o(), (t.attentionEncodeSurroundingInfo = { after: f.outside, before: c.outside }), a + l + p
  );
}
function sd(e, n, t) {
  return t.options.strong || "*";
}
function Zs(e, n, t, r) {
  return t.safe(e.value, r);
}
function Ks(e) {
  let n = e.options.ruleRepetition || 3;
  if (n < 3)
    throw new Error(
      "Cannot serialize rules with repetition `" +
        n +
        "` for `options.ruleRepetition`, expected `3` or more",
    );
  return n;
}
function Qs(e, n, t) {
  let r = (sr(t) + (t.options.ruleSpaces ? " " : "")).repeat(Ks(t));
  return t.options.ruleSpaces ? r.slice(0, -1) : r;
}
var Dn = {
  blockquote: As,
  break: Ci,
  code: Ds,
  definition: $s,
  emphasis: Ti,
  hardBreak: Ci,
  heading: Bs,
  html: Ri,
  image: Pi,
  imageReference: Mi,
  inlineCode: Fi,
  link: Di,
  linkReference: $i,
  list: js,
  listItem: Ws,
  paragraph: qs,
  root: Gs,
  strong: Oi,
  text: Zs,
  thematicBreak: Qs,
};
var Js = document.createElement("i");
function fn(e) {
  let n = "&" + e + ";";
  Js.innerHTML = n;
  let t = Js.textContent;
  return (t.charCodeAt(t.length - 1) === 59 && e !== "semi") || t === n ? !1 : t;
}
function ar(e, n) {
  let t = Number.parseInt(e, n);
  return t < 9 ||
    t === 11 ||
    (t > 13 && t < 32) ||
    (t > 126 && t < 160) ||
    (t > 55295 && t < 57344) ||
    (t > 64975 && t < 65008) ||
    (t & 65535) === 65535 ||
    (t & 65535) === 65534 ||
    t > 1114111
    ? "\uFFFD"
    : String.fromCodePoint(t);
}
var ad = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function Xs(e) {
  return e.replace(ad, ld);
}
function ld(e, n, t) {
  if (n) return n;
  if (t.charCodeAt(0) === 35) {
    let i = t.charCodeAt(1),
      o = i === 120 || i === 88;
    return ar(t.slice(o ? 2 : 1), o ? 16 : 10);
  }
  return fn(t) || e;
}
function Vi() {
  return {
    enter: { table: ud, tableData: ea, tableHeader: ea, tableRow: dd },
    exit: { codeText: fd, table: cd, tableData: _i, tableHeader: _i, tableRow: _i },
  };
}
function ud(e) {
  let n = e._align;
  (this.enter(
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
function cd(e) {
  (this.exit(e), (this.data.inTable = void 0));
}
function dd(e) {
  this.enter({ type: "tableRow", children: [] }, e);
}
function _i(e) {
  this.exit(e);
}
function ea(e) {
  this.enter({ type: "tableCell", children: [] }, e);
}
function fd(e) {
  let n = this.resume();
  this.data.inTable && (n = n.replace(/\\([\\|])/g, pd));
  let t = this.stack[this.stack.length - 1];
  (t.type, (t.value = n), this.exit(e));
}
function pd(e, n) {
  return n === "|" ? n : e;
}
function Bi(e) {
  let n = e || {},
    t = n.tableCellPadding,
    r = n.tablePipeAlign,
    i = n.stringLength,
    o = t ? " " : "|";
  return {
    unsafe: [
      { character: "\r", inConstruct: "tableCell" },
      {
        character: `
`,
        inConstruct: "tableCell",
      },
      { atBreak: !0, character: "|", after: "[	 :-]" },
      { character: "|", inConstruct: "tableCell" },
      { atBreak: !0, character: ":", after: "-" },
      { atBreak: !0, character: "-", after: "[:|-]" },
    ],
    handlers: { inlineCode: f, table: s, tableCell: l, tableRow: a },
  };
  function s(p, m, h, w) {
    return u(c(p, h, w), p.align);
  }
  function a(p, m, h, w) {
    let g = d(p, h, w),
      S = u([g]);
    return S.slice(
      0,
      S.indexOf(`
`),
    );
  }
  function l(p, m, h, w) {
    let g = h.enter("tableCell"),
      S = h.enter("phrasing"),
      b = h.containerPhrasing(p, { ...w, before: o, after: o });
    return (S(), g(), b);
  }
  function u(p, m) {
    return Ts(p, { align: m, alignDelimiters: r, padding: t, stringLength: i });
  }
  function c(p, m, h) {
    let w = p.children,
      g = -1,
      S = [],
      b = m.enter("table");
    for (; ++g < w.length;) S[g] = d(w[g], m, h);
    return (b(), S);
  }
  function d(p, m, h) {
    let w = p.children,
      g = -1,
      S = [],
      b = m.enter("tableRow");
    for (; ++g < w.length;) S[g] = l(w[g], p, m, h);
    return (b(), S);
  }
  function f(p, m, h) {
    let w = Dn.inlineCode(p, m, h);
    return (h.stack.includes("tableCell") && (w = w.replace(/\|/g, "\\$&")), w);
  }
}
function zi() {
  return {
    exit: { taskListCheckValueChecked: ta, taskListCheckValueUnchecked: ta, paragraph: md },
  };
}
function Ui() {
  return { unsafe: [{ atBreak: !0, character: "-", after: "[:|-]" }], handlers: { listItem: hd } };
}
function ta(e) {
  let n = this.stack[this.stack.length - 2];
  (n.type, (n.checked = e.type === "taskListCheckValueChecked"));
}
function md(e) {
  let n = this.stack[this.stack.length - 2];
  if (n && n.type === "listItem" && typeof n.checked == "boolean") {
    let t = this.stack[this.stack.length - 1];
    t.type;
    let r = t.children[0];
    if (r && r.type === "text") {
      let i = n.children,
        o = -1,
        s;
      for (; ++o < i.length;) {
        let a = i[o];
        if (a.type === "paragraph") {
          s = a;
          break;
        }
      }
      s === t &&
        ((r.value = r.value.slice(1)),
        r.value.length === 0
          ? t.children.shift()
          : t.position &&
            r.position &&
            typeof r.position.start.offset == "number" &&
            (r.position.start.column++,
            r.position.start.offset++,
            (t.position.start = Object.assign({}, r.position.start))));
    }
  }
  this.exit(e);
}
function hd(e, n, t, r) {
  let i = e.children[0],
    o = typeof e.checked == "boolean" && i && i.type === "paragraph",
    s = "[" + (e.checked ? "x" : " ") + "] ",
    a = t.createTracker(r);
  o && a.move(s);
  let l = Dn.listItem(e, n, t, { ...r, ...a.current() });
  return (o && (l = l.replace(/^(?:[*+-]|\d+\.)([\r\n]| {1,3})/, u)), l);
  function u(c) {
    return c + s;
  }
}
function ji() {
  return [bi(), vi(), Ei(), Vi(), zi()];
}
function Hi(e) {
  return { extensions: [yi(), Si(e), Ii(), Bi(e), Ui()] };
}
function ke(e, n, t, r) {
  let i = e.length,
    o = 0,
    s;
  if ((n < 0 ? (n = -n > i ? 0 : i + n) : (n = n > i ? i : n), (t = t > 0 ? t : 0), r.length < 1e4))
    ((s = Array.from(r)), s.unshift(n, t), e.splice(...s));
  else
    for (t && e.splice(n, t); o < r.length;)
      ((s = r.slice(o, o + 1e4)), s.unshift(n, 0), e.splice(...s), (o += 1e4), (n += 1e4));
}
function Oe(e, n) {
  return e.length > 0 ? (ke(e, e.length, 0, n), e) : n;
}
var na = {}.hasOwnProperty;
function lr(e) {
  let n = {},
    t = -1;
  for (; ++t < e.length;) gd(n, e[t]);
  return n;
}
function gd(e, n) {
  let t;
  for (t in n) {
    let i = (na.call(e, t) ? e[t] : void 0) || (e[t] = {}),
      o = n[t],
      s;
    if (o)
      for (s in o) {
        na.call(i, s) || (i[s] = []);
        let a = o[s];
        wd(i[s], Array.isArray(a) ? a : a ? [a] : []);
      }
  }
}
function wd(e, n) {
  let t = -1,
    r = [];
  for (; ++t < n.length;) (n[t].add === "after" ? e : r).push(n[t]);
  ke(e, 0, 0, r);
}
var xd = { tokenize: Sd, partial: !0 },
  ra = { tokenize: Ed, partial: !0 },
  ia = { tokenize: Id, partial: !0 },
  oa = { tokenize: Cd, partial: !0 },
  kd = { tokenize: Td, partial: !0 },
  sa = { name: "wwwAutolink", tokenize: yd, previous: la },
  aa = { name: "protocolAutolink", tokenize: vd, previous: ua },
  bt = { name: "emailAutolink", tokenize: bd, previous: ca },
  at = {};
function qi() {
  return { text: at };
}
var Xt = 48;
for (; Xt < 123;) ((at[Xt] = bt), Xt++, Xt === 58 ? (Xt = 65) : Xt === 91 && (Xt = 97));
at[43] = bt;
at[45] = bt;
at[46] = bt;
at[95] = bt;
at[72] = [bt, aa];
at[104] = [bt, aa];
at[87] = [bt, sa];
at[119] = [bt, sa];
function bd(e, n, t) {
  let r = this,
    i,
    o;
  return s;
  function s(d) {
    return !Wi(d) || !ca.call(r, r.previous) || Gi(r.events)
      ? t(d)
      : (e.enter("literalAutolink"), e.enter("literalAutolinkEmail"), a(d));
  }
  function a(d) {
    return Wi(d) ? (e.consume(d), a) : d === 64 ? (e.consume(d), l) : t(d);
  }
  function l(d) {
    return d === 46
      ? e.check(kd, c, u)(d)
      : d === 45 || d === 95 || Se(d)
        ? ((o = !0), e.consume(d), l)
        : c(d);
  }
  function u(d) {
    return (e.consume(d), (i = !0), l);
  }
  function c(d) {
    return o && i && ve(r.previous)
      ? (e.exit("literalAutolinkEmail"), e.exit("literalAutolink"), n(d))
      : t(d);
  }
}
function yd(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return (s !== 87 && s !== 119) || !la.call(r, r.previous) || Gi(r.events)
      ? t(s)
      : (e.enter("literalAutolink"),
        e.enter("literalAutolinkWww"),
        e.check(xd, e.attempt(ra, e.attempt(ia, o), t), t)(s));
  }
  function o(s) {
    return (e.exit("literalAutolinkWww"), e.exit("literalAutolink"), n(s));
  }
}
function vd(e, n, t) {
  let r = this,
    i = "",
    o = !1;
  return s;
  function s(d) {
    return (d === 72 || d === 104) && ua.call(r, r.previous) && !Gi(r.events)
      ? (e.enter("literalAutolink"),
        e.enter("literalAutolinkHttp"),
        (i += String.fromCodePoint(d)),
        e.consume(d),
        a)
      : t(d);
  }
  function a(d) {
    if (ve(d) && i.length < 5) return ((i += String.fromCodePoint(d)), e.consume(d), a);
    if (d === 58) {
      let f = i.toLowerCase();
      if (f === "http" || f === "https") return (e.consume(d), l);
    }
    return t(d);
  }
  function l(d) {
    return d === 47 ? (e.consume(d), o ? u : ((o = !0), l)) : t(d);
  }
  function u(d) {
    return d === null || Zt(d) || oe(d) || st(d) || Kt(d)
      ? t(d)
      : e.attempt(ra, e.attempt(ia, c), t)(d);
  }
  function c(d) {
    return (e.exit("literalAutolinkHttp"), e.exit("literalAutolink"), n(d));
  }
}
function Sd(e, n, t) {
  let r = 0;
  return i;
  function i(s) {
    return (s === 87 || s === 119) && r < 3
      ? (r++, e.consume(s), i)
      : s === 46 && r === 3
        ? (e.consume(s), o)
        : t(s);
  }
  function o(s) {
    return s === null ? t(s) : n(s);
  }
}
function Ed(e, n, t) {
  let r, i, o;
  return s;
  function s(u) {
    return u === 46 || u === 95
      ? e.check(oa, l, a)(u)
      : u === null || oe(u) || st(u) || (u !== 45 && Kt(u))
        ? l(u)
        : ((o = !0), e.consume(u), s);
  }
  function a(u) {
    return (u === 95 ? (r = !0) : ((i = r), (r = void 0)), e.consume(u), s);
  }
  function l(u) {
    return i || r || !o ? t(u) : n(u);
  }
}
function Id(e, n) {
  let t = 0,
    r = 0;
  return i;
  function i(s) {
    return s === 40
      ? (t++, e.consume(s), i)
      : s === 41 && r < t
        ? o(s)
        : s === 33 ||
            s === 34 ||
            s === 38 ||
            s === 39 ||
            s === 41 ||
            s === 42 ||
            s === 44 ||
            s === 46 ||
            s === 58 ||
            s === 59 ||
            s === 60 ||
            s === 63 ||
            s === 93 ||
            s === 95 ||
            s === 126
          ? e.check(oa, n, o)(s)
          : s === null || oe(s) || st(s)
            ? n(s)
            : (e.consume(s), i);
  }
  function o(s) {
    return (s === 41 && r++, e.consume(s), i);
  }
}
function Cd(e, n, t) {
  return r;
  function r(a) {
    return a === 33 ||
      a === 34 ||
      a === 39 ||
      a === 41 ||
      a === 42 ||
      a === 44 ||
      a === 46 ||
      a === 58 ||
      a === 59 ||
      a === 63 ||
      a === 95 ||
      a === 126
      ? (e.consume(a), r)
      : a === 38
        ? (e.consume(a), o)
        : a === 93
          ? (e.consume(a), i)
          : a === 60 || a === null || oe(a) || st(a)
            ? n(a)
            : t(a);
  }
  function i(a) {
    return a === null || a === 40 || a === 91 || oe(a) || st(a) ? n(a) : r(a);
  }
  function o(a) {
    return ve(a) ? s(a) : t(a);
  }
  function s(a) {
    return a === 59 ? (e.consume(a), r) : ve(a) ? (e.consume(a), s) : t(a);
  }
}
function Td(e, n, t) {
  return r;
  function r(o) {
    return (e.consume(o), i);
  }
  function i(o) {
    return Se(o) ? t(o) : n(o);
  }
}
function la(e) {
  return (
    e === null || e === 40 || e === 42 || e === 95 || e === 91 || e === 93 || e === 126 || oe(e)
  );
}
function ua(e) {
  return !ve(e);
}
function ca(e) {
  return !(e === 47 || Wi(e));
}
function Wi(e) {
  return e === 43 || e === 45 || e === 46 || e === 95 || Se(e);
}
function Gi(e) {
  let n = e.length,
    t = !1;
  for (; n--;) {
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
  return (e.length > 0 && !t && (e[e.length - 1][1]._gfmAutolinkLiteralWalkedInto = !0), t);
}
function Nt(e, n, t) {
  let r = [],
    i = -1;
  for (; ++i < e.length;) {
    let o = e[i].resolveAll;
    o && !r.includes(o) && ((n = o(n, t)), r.push(o));
  }
  return n;
}
var $n = { name: "attention", resolveAll: Ad, tokenize: Rd };
function Ad(e, n) {
  let t = -1,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c;
  for (; ++t < e.length;)
    if (e[t][0] === "enter" && e[t][1].type === "attentionSequence" && e[t][1]._close) {
      for (r = t; r--;)
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
          l =
            e[r][1].end.offset - e[r][1].start.offset > 1 &&
            e[t][1].end.offset - e[t][1].start.offset > 1
              ? 2
              : 1;
          let d = { ...e[r][1].end },
            f = { ...e[t][1].start };
          (da(d, -l),
            da(f, l),
            (s = {
              type: l > 1 ? "strongSequence" : "emphasisSequence",
              start: d,
              end: { ...e[r][1].end },
            }),
            (a = {
              type: l > 1 ? "strongSequence" : "emphasisSequence",
              start: { ...e[t][1].start },
              end: f,
            }),
            (o = {
              type: l > 1 ? "strongText" : "emphasisText",
              start: { ...e[r][1].end },
              end: { ...e[t][1].start },
            }),
            (i = { type: l > 1 ? "strong" : "emphasis", start: { ...s.start }, end: { ...a.end } }),
            (e[r][1].end = { ...s.start }),
            (e[t][1].start = { ...a.end }),
            (u = []),
            e[r][1].end.offset - e[r][1].start.offset &&
              (u = Oe(u, [
                ["enter", e[r][1], n],
                ["exit", e[r][1], n],
              ])),
            (u = Oe(u, [
              ["enter", i, n],
              ["enter", s, n],
              ["exit", s, n],
              ["enter", o, n],
            ])),
            (u = Oe(u, Nt(n.parser.constructs.insideSpan.null, e.slice(r + 1, t), n))),
            (u = Oe(u, [
              ["exit", o, n],
              ["enter", a, n],
              ["exit", a, n],
              ["exit", i, n],
            ])),
            e[t][1].end.offset - e[t][1].start.offset
              ? ((c = 2),
                (u = Oe(u, [
                  ["enter", e[t][1], n],
                  ["exit", e[t][1], n],
                ])))
              : (c = 0),
            ke(e, r - 1, t - r + 3, u),
            (t = r + u.length - c - 2));
          break;
        }
    }
  for (t = -1; ++t < e.length;) e[t][1].type === "attentionSequence" && (e[t][1].type = "data");
  return e;
}
function Rd(e, n) {
  let t = this.parser.constructs.attentionMarkers.null,
    r = this.previous,
    i = kt(r),
    o;
  return s;
  function s(l) {
    return ((o = l), e.enter("attentionSequence"), a(l));
  }
  function a(l) {
    if (l === o) return (e.consume(l), a);
    let u = e.exit("attentionSequence"),
      c = kt(l),
      d = !c || (c === 2 && i) || t.includes(l),
      f = !i || (i === 2 && c) || t.includes(r);
    return (
      (u._open = !!(o === 42 ? d : d && (i || !f))),
      (u._close = !!(o === 42 ? f : f && (c || !d))),
      n(l)
    );
  }
}
function da(e, n) {
  ((e.column += n), (e.offset += n), (e._bufferIndex += n));
}
var Yi = { name: "autolink", tokenize: Pd };
function Pd(e, n, t) {
  let r = 0;
  return i;
  function i(p) {
    return (
      e.enter("autolink"),
      e.enter("autolinkMarker"),
      e.consume(p),
      e.exit("autolinkMarker"),
      e.enter("autolinkProtocol"),
      o
    );
  }
  function o(p) {
    return ve(p) ? (e.consume(p), s) : p === 64 ? t(p) : u(p);
  }
  function s(p) {
    return p === 43 || p === 45 || p === 46 || Se(p) ? ((r = 1), a(p)) : u(p);
  }
  function a(p) {
    return p === 58
      ? (e.consume(p), (r = 0), l)
      : (p === 43 || p === 45 || p === 46 || Se(p)) && r++ < 32
        ? (e.consume(p), a)
        : ((r = 0), u(p));
  }
  function l(p) {
    return p === 62
      ? (e.exit("autolinkProtocol"),
        e.enter("autolinkMarker"),
        e.consume(p),
        e.exit("autolinkMarker"),
        e.exit("autolink"),
        n)
      : p === null || p === 32 || p === 60 || Zt(p)
        ? t(p)
        : (e.consume(p), l);
  }
  function u(p) {
    return p === 64 ? (e.consume(p), c) : xs(p) ? (e.consume(p), u) : t(p);
  }
  function c(p) {
    return Se(p) ? d(p) : t(p);
  }
  function d(p) {
    return p === 46
      ? (e.consume(p), (r = 0), c)
      : p === 62
        ? ((e.exit("autolinkProtocol").type = "autolinkEmail"),
          e.enter("autolinkMarker"),
          e.consume(p),
          e.exit("autolinkMarker"),
          e.exit("autolink"),
          n)
        : f(p);
  }
  function f(p) {
    if ((p === 45 || Se(p)) && r++ < 63) {
      let m = p === 45 ? f : d;
      return (e.consume(p), m);
    }
    return t(p);
  }
}
function G(e, n, t, r) {
  let i = r ? r - 1 : Number.POSITIVE_INFINITY,
    o = 0;
  return s;
  function s(l) {
    return Z(l) ? (e.enter(t), a(l)) : n(l);
  }
  function a(l) {
    return Z(l) && o++ < i ? (e.consume(l), a) : (e.exit(t), n(l));
  }
}
var lt = { partial: !0, tokenize: Md };
function Md(e, n, t) {
  return r;
  function r(o) {
    return Z(o) ? G(e, i, "linePrefix")(o) : i(o);
  }
  function i(o) {
    return o === null || V(o) ? n(o) : t(o);
  }
}
var ur = { continuation: { tokenize: Nd }, exit: Dd, name: "blockQuote", tokenize: Fd };
function Fd(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    if (s === 62) {
      let a = r.containerState;
      return (
        a.open || (e.enter("blockQuote", { _container: !0 }), (a.open = !0)),
        e.enter("blockQuotePrefix"),
        e.enter("blockQuoteMarker"),
        e.consume(s),
        e.exit("blockQuoteMarker"),
        o
      );
    }
    return t(s);
  }
  function o(s) {
    return Z(s)
      ? (e.enter("blockQuotePrefixWhitespace"),
        e.consume(s),
        e.exit("blockQuotePrefixWhitespace"),
        e.exit("blockQuotePrefix"),
        n)
      : (e.exit("blockQuotePrefix"), n(s));
  }
}
function Nd(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return Z(s)
      ? G(
          e,
          o,
          "linePrefix",
          r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4,
        )(s)
      : o(s);
  }
  function o(s) {
    return e.attempt(ur, n, t)(s);
  }
}
function Dd(e) {
  e.exit("blockQuote");
}
var cr = { name: "characterEscape", tokenize: $d };
function $d(e, n, t) {
  return r;
  function r(o) {
    return (
      e.enter("characterEscape"), e.enter("escapeMarker"), e.consume(o), e.exit("escapeMarker"), i
    );
  }
  function i(o) {
    return bs(o)
      ? (e.enter("characterEscapeValue"),
        e.consume(o),
        e.exit("characterEscapeValue"),
        e.exit("characterEscape"),
        n)
      : t(o);
  }
}
var dr = { name: "characterReference", tokenize: Ld };
function Ld(e, n, t) {
  let r = this,
    i = 0,
    o,
    s;
  return a;
  function a(d) {
    return (
      e.enter("characterReference"),
      e.enter("characterReferenceMarker"),
      e.consume(d),
      e.exit("characterReferenceMarker"),
      l
    );
  }
  function l(d) {
    return d === 35
      ? (e.enter("characterReferenceMarkerNumeric"),
        e.consume(d),
        e.exit("characterReferenceMarkerNumeric"),
        u)
      : (e.enter("characterReferenceValue"), (o = 31), (s = Se), c(d));
  }
  function u(d) {
    return d === 88 || d === 120
      ? (e.enter("characterReferenceMarkerHexadecimal"),
        e.consume(d),
        e.exit("characterReferenceMarkerHexadecimal"),
        e.enter("characterReferenceValue"),
        (o = 6),
        (s = ks),
        c)
      : (e.enter("characterReferenceValue"), (o = 7), (s = Fn), c(d));
  }
  function c(d) {
    if (d === 59 && i) {
      let f = e.exit("characterReferenceValue");
      return s === Se && !fn(r.sliceSerialize(f))
        ? t(d)
        : (e.enter("characterReferenceMarker"),
          e.consume(d),
          e.exit("characterReferenceMarker"),
          e.exit("characterReference"),
          n);
    }
    return s(d) && i++ < o ? (e.consume(d), c) : t(d);
  }
}
var fa = { partial: !0, tokenize: _d },
  fr = { concrete: !0, name: "codeFenced", tokenize: Od };
function Od(e, n, t) {
  let r = this,
    i = { partial: !0, tokenize: R },
    o = 0,
    s = 0,
    a;
  return l;
  function l(y) {
    return u(y);
  }
  function u(y) {
    let T = r.events[r.events.length - 1];
    return (
      (o = T && T[1].type === "linePrefix" ? T[2].sliceSerialize(T[1], !0).length : 0),
      (a = y),
      e.enter("codeFenced"),
      e.enter("codeFencedFence"),
      e.enter("codeFencedFenceSequence"),
      c(y)
    );
  }
  function c(y) {
    return y === a
      ? (s++, e.consume(y), c)
      : s < 3
        ? t(y)
        : (e.exit("codeFencedFenceSequence"), Z(y) ? G(e, d, "whitespace")(y) : d(y));
  }
  function d(y) {
    return y === null || V(y)
      ? (e.exit("codeFencedFence"), r.interrupt ? n(y) : e.check(fa, h, I)(y))
      : (e.enter("codeFencedFenceInfo"), e.enter("chunkString", { contentType: "string" }), f(y));
  }
  function f(y) {
    return y === null || V(y)
      ? (e.exit("chunkString"), e.exit("codeFencedFenceInfo"), d(y))
      : Z(y)
        ? (e.exit("chunkString"), e.exit("codeFencedFenceInfo"), G(e, p, "whitespace")(y))
        : y === 96 && y === a
          ? t(y)
          : (e.consume(y), f);
  }
  function p(y) {
    return y === null || V(y)
      ? d(y)
      : (e.enter("codeFencedFenceMeta"), e.enter("chunkString", { contentType: "string" }), m(y));
  }
  function m(y) {
    return y === null || V(y)
      ? (e.exit("chunkString"), e.exit("codeFencedFenceMeta"), d(y))
      : y === 96 && y === a
        ? t(y)
        : (e.consume(y), m);
  }
  function h(y) {
    return e.attempt(i, I, w)(y);
  }
  function w(y) {
    return (e.enter("lineEnding"), e.consume(y), e.exit("lineEnding"), g);
  }
  function g(y) {
    return o > 0 && Z(y) ? G(e, S, "linePrefix", o + 1)(y) : S(y);
  }
  function S(y) {
    return y === null || V(y) ? e.check(fa, h, I)(y) : (e.enter("codeFlowValue"), b(y));
  }
  function b(y) {
    return y === null || V(y) ? (e.exit("codeFlowValue"), S(y)) : (e.consume(y), b);
  }
  function I(y) {
    return (e.exit("codeFenced"), n(y));
  }
  function R(y, T, M) {
    let P = 0;
    return E;
    function E(D) {
      return (y.enter("lineEnding"), y.consume(D), y.exit("lineEnding"), U);
    }
    function U(D) {
      return (
        y.enter("codeFencedFence"),
        Z(D)
          ? G(
              y,
              _,
              "linePrefix",
              r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4,
            )(D)
          : _(D)
      );
    }
    function _(D) {
      return D === a ? (y.enter("codeFencedFenceSequence"), C(D)) : M(D);
    }
    function C(D) {
      return D === a
        ? (P++, y.consume(D), C)
        : P >= s
          ? (y.exit("codeFencedFenceSequence"), Z(D) ? G(y, $, "whitespace")(D) : $(D))
          : M(D);
    }
    function $(D) {
      return D === null || V(D) ? (y.exit("codeFencedFence"), T(D)) : M(D);
    }
  }
}
function _d(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return s === null ? t(s) : (e.enter("lineEnding"), e.consume(s), e.exit("lineEnding"), o);
  }
  function o(s) {
    return r.parser.lazy[r.now().line] ? t(s) : n(s);
  }
}
var Ln = { name: "codeIndented", tokenize: Bd },
  Vd = { partial: !0, tokenize: zd };
function Bd(e, n, t) {
  let r = this;
  return i;
  function i(u) {
    return (e.enter("codeIndented"), G(e, o, "linePrefix", 5)(u));
  }
  function o(u) {
    let c = r.events[r.events.length - 1];
    return c && c[1].type === "linePrefix" && c[2].sliceSerialize(c[1], !0).length >= 4
      ? s(u)
      : t(u);
  }
  function s(u) {
    return u === null ? l(u) : V(u) ? e.attempt(Vd, s, l)(u) : (e.enter("codeFlowValue"), a(u));
  }
  function a(u) {
    return u === null || V(u) ? (e.exit("codeFlowValue"), s(u)) : (e.consume(u), a);
  }
  function l(u) {
    return (e.exit("codeIndented"), n(u));
  }
}
function zd(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return r.parser.lazy[r.now().line]
      ? t(s)
      : V(s)
        ? (e.enter("lineEnding"), e.consume(s), e.exit("lineEnding"), i)
        : G(e, o, "linePrefix", 5)(s);
  }
  function o(s) {
    let a = r.events[r.events.length - 1];
    return a && a[1].type === "linePrefix" && a[2].sliceSerialize(a[1], !0).length >= 4
      ? n(s)
      : V(s)
        ? i(s)
        : t(s);
  }
}
var Zi = { name: "codeText", previous: jd, resolve: Ud, tokenize: Hd };
function Ud(e) {
  let n = e.length - 4,
    t = 3,
    r,
    i;
  if (
    (e[t][1].type === "lineEnding" || e[t][1].type === "space") &&
    (e[n][1].type === "lineEnding" || e[n][1].type === "space")
  ) {
    for (r = t; ++r < n;)
      if (e[r][1].type === "codeTextData") {
        ((e[t][1].type = "codeTextPadding"),
          (e[n][1].type = "codeTextPadding"),
          (t += 2),
          (n -= 2));
        break;
      }
  }
  for (r = t - 1, n++; ++r <= n;)
    i === void 0
      ? r !== n && e[r][1].type !== "lineEnding" && (i = r)
      : (r === n || e[r][1].type === "lineEnding") &&
        ((e[i][1].type = "codeTextData"),
        r !== i + 2 &&
          ((e[i][1].end = e[r - 1][1].end),
          e.splice(i + 2, r - i - 2),
          (n -= r - i - 2),
          (r = i + 2)),
        (i = void 0));
  return e;
}
function jd(e) {
  return e !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function Hd(e, n, t) {
  let r = this,
    i = 0,
    o,
    s;
  return a;
  function a(f) {
    return (e.enter("codeText"), e.enter("codeTextSequence"), l(f));
  }
  function l(f) {
    return f === 96 ? (e.consume(f), i++, l) : (e.exit("codeTextSequence"), u(f));
  }
  function u(f) {
    return f === null
      ? t(f)
      : f === 32
        ? (e.enter("space"), e.consume(f), e.exit("space"), u)
        : f === 96
          ? ((s = e.enter("codeTextSequence")), (o = 0), d(f))
          : V(f)
            ? (e.enter("lineEnding"), e.consume(f), e.exit("lineEnding"), u)
            : (e.enter("codeTextData"), c(f));
  }
  function c(f) {
    return f === null || f === 32 || f === 96 || V(f)
      ? (e.exit("codeTextData"), u(f))
      : (e.consume(f), c);
  }
  function d(f) {
    return f === 96
      ? (e.consume(f), o++, d)
      : o === i
        ? (e.exit("codeTextSequence"), e.exit("codeText"), n(f))
        : ((s.type = "codeTextData"), c(f));
  }
}
var pr = class {
  constructor(n) {
    ((this.left = n ? [...n] : []), (this.right = []));
  }
  get(n) {
    if (n < 0 || n >= this.left.length + this.right.length)
      throw new RangeError(
        "Cannot access index `" +
          n +
          "` in a splice buffer of size `" +
          (this.left.length + this.right.length) +
          "`",
      );
    return n < this.left.length
      ? this.left[n]
      : this.right[this.right.length - n + this.left.length - 1];
  }
  get length() {
    return this.left.length + this.right.length;
  }
  shift() {
    return (this.setCursor(0), this.right.pop());
  }
  slice(n, t) {
    let r = t == null ? Number.POSITIVE_INFINITY : t;
    return r < this.left.length
      ? this.left.slice(n, r)
      : n > this.left.length
        ? this.right
            .slice(
              this.right.length - r + this.left.length,
              this.right.length - n + this.left.length,
            )
            .reverse()
        : this.left
            .slice(n)
            .concat(this.right.slice(this.right.length - r + this.left.length).reverse());
  }
  splice(n, t, r) {
    let i = t || 0;
    this.setCursor(Math.trunc(n));
    let o = this.right.splice(this.right.length - i, Number.POSITIVE_INFINITY);
    return (r && On(this.left, r), o.reverse());
  }
  pop() {
    return (this.setCursor(Number.POSITIVE_INFINITY), this.left.pop());
  }
  push(n) {
    (this.setCursor(Number.POSITIVE_INFINITY), this.left.push(n));
  }
  pushMany(n) {
    (this.setCursor(Number.POSITIVE_INFINITY), On(this.left, n));
  }
  unshift(n) {
    (this.setCursor(0), this.right.push(n));
  }
  unshiftMany(n) {
    (this.setCursor(0), On(this.right, n.reverse()));
  }
  setCursor(n) {
    if (
      !(
        n === this.left.length ||
        (n > this.left.length && this.right.length === 0) ||
        (n < 0 && this.left.length === 0)
      )
    )
      if (n < this.left.length) {
        let t = this.left.splice(n, Number.POSITIVE_INFINITY);
        On(this.right, t.reverse());
      } else {
        let t = this.right.splice(
          this.left.length + this.right.length - n,
          Number.POSITIVE_INFINITY,
        );
        On(this.left, t.reverse());
      }
  }
};
function On(e, n) {
  let t = 0;
  if (n.length < 1e4) e.push(...n);
  else for (; t < n.length;) (e.push(...n.slice(t, t + 1e4)), (t += 1e4));
}
function mr(e) {
  let n = {},
    t = -1,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c = new pr(e);
  for (; ++t < c.length;) {
    for (; t in n;) t = n[t];
    if (
      ((r = c.get(t)),
      t &&
        r[1].type === "chunkFlow" &&
        c.get(t - 1)[1].type === "listItemPrefix" &&
        ((l = r[1]._tokenizer.events),
        (o = 0),
        o < l.length && l[o][1].type === "lineEndingBlank" && (o += 2),
        o < l.length && l[o][1].type === "content"))
    )
      for (; ++o < l.length && l[o][1].type !== "content";)
        l[o][1].type === "chunkText" && ((l[o][1]._isInFirstContentOfListItem = !0), o++);
    if (r[0] === "enter") r[1].contentType && (Object.assign(n, Wd(c, t)), (t = n[t]), (u = !0));
    else if (r[1]._container) {
      for (o = t, i = void 0; o--;)
        if (((s = c.get(o)), s[1].type === "lineEnding" || s[1].type === "lineEndingBlank"))
          s[0] === "enter" &&
            (i && (c.get(i)[1].type = "lineEndingBlank"), (s[1].type = "lineEnding"), (i = o));
        else if (!(s[1].type === "linePrefix" || s[1].type === "listItemIndent")) break;
      i &&
        ((r[1].end = { ...c.get(i)[1].start }),
        (a = c.slice(i, t)),
        a.unshift(r),
        c.splice(i, t - i + 1, a));
    }
  }
  return (ke(e, 0, Number.POSITIVE_INFINITY, c.slice(0)), !u);
}
function Wd(e, n) {
  let t = e.get(n)[1],
    r = e.get(n)[2],
    i = n - 1,
    o = [],
    s = t._tokenizer;
  s ||
    ((s = r.parser[t.contentType](t.start)),
    t._contentTypeTextTrailing && (s._contentTypeTextTrailing = !0));
  let a = s.events,
    l = [],
    u = {},
    c,
    d,
    f = -1,
    p = t,
    m = 0,
    h = 0,
    w = [h];
  for (; p;) {
    for (; e.get(++i)[1] !== p;);
    (o.push(i),
      p._tokenizer ||
        ((c = r.sliceStream(p)),
        p.next || c.push(null),
        d && s.defineSkip(p.start),
        p._isInFirstContentOfListItem && (s._gfmTasklistFirstContentOfListItem = !0),
        s.write(c),
        p._isInFirstContentOfListItem && (s._gfmTasklistFirstContentOfListItem = void 0)),
      (d = p),
      (p = p.next));
  }
  for (p = t; ++f < a.length;)
    a[f][0] === "exit" &&
      a[f - 1][0] === "enter" &&
      a[f][1].type === a[f - 1][1].type &&
      a[f][1].start.line !== a[f][1].end.line &&
      ((h = f + 1), w.push(h), (p._tokenizer = void 0), (p.previous = void 0), (p = p.next));
  for (
    s.events = [], p ? ((p._tokenizer = void 0), (p.previous = void 0)) : w.pop(), f = w.length;
    f--;
  ) {
    let g = a.slice(w[f], w[f + 1]),
      S = o.pop();
    (l.push([S, S + g.length - 1]), e.splice(S, 2, g));
  }
  for (l.reverse(), f = -1; ++f < l.length;)
    ((u[m + l[f][0]] = m + l[f][1]), (m += l[f][1] - l[f][0] - 1));
  return u;
}
var Ki = { resolve: Gd, tokenize: Yd },
  qd = { partial: !0, tokenize: Zd };
function Gd(e) {
  return (mr(e), e);
}
function Yd(e, n) {
  let t;
  return r;
  function r(a) {
    return (e.enter("content"), (t = e.enter("chunkContent", { contentType: "content" })), i(a));
  }
  function i(a) {
    return a === null ? o(a) : V(a) ? e.check(qd, s, o)(a) : (e.consume(a), i);
  }
  function o(a) {
    return (e.exit("chunkContent"), e.exit("content"), n(a));
  }
  function s(a) {
    return (
      e.consume(a),
      e.exit("chunkContent"),
      (t.next = e.enter("chunkContent", { contentType: "content", previous: t })),
      (t = t.next),
      i
    );
  }
}
function Zd(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return (
      e.exit("chunkContent"),
      e.enter("lineEnding"),
      e.consume(s),
      e.exit("lineEnding"),
      G(e, o, "linePrefix")
    );
  }
  function o(s) {
    if (s === null || V(s)) return t(s);
    let a = r.events[r.events.length - 1];
    return !r.parser.constructs.disable.null.includes("codeIndented") &&
      a &&
      a[1].type === "linePrefix" &&
      a[2].sliceSerialize(a[1], !0).length >= 4
      ? n(s)
      : e.interrupt(r.parser.constructs.flow, t, n)(s);
  }
}
function hr(e, n, t, r, i, o, s, a, l) {
  let u = l || Number.POSITIVE_INFINITY,
    c = 0;
  return d;
  function d(g) {
    return g === 60
      ? (e.enter(r), e.enter(i), e.enter(o), e.consume(g), e.exit(o), f)
      : g === null || g === 32 || g === 41 || Zt(g)
        ? t(g)
        : (e.enter(r),
          e.enter(s),
          e.enter(a),
          e.enter("chunkString", { contentType: "string" }),
          h(g));
  }
  function f(g) {
    return g === 62
      ? (e.enter(o), e.consume(g), e.exit(o), e.exit(i), e.exit(r), n)
      : (e.enter(a), e.enter("chunkString", { contentType: "string" }), p(g));
  }
  function p(g) {
    return g === 62
      ? (e.exit("chunkString"), e.exit(a), f(g))
      : g === null || g === 60 || V(g)
        ? t(g)
        : (e.consume(g), g === 92 ? m : p);
  }
  function m(g) {
    return g === 60 || g === 62 || g === 92 ? (e.consume(g), p) : p(g);
  }
  function h(g) {
    return !c && (g === null || g === 41 || oe(g))
      ? (e.exit("chunkString"), e.exit(a), e.exit(s), e.exit(r), n(g))
      : c < u && g === 40
        ? (e.consume(g), c++, h)
        : g === 41
          ? (e.consume(g), c--, h)
          : g === null || g === 32 || g === 40 || Zt(g)
            ? t(g)
            : (e.consume(g), g === 92 ? w : h);
  }
  function w(g) {
    return g === 40 || g === 41 || g === 92 ? (e.consume(g), h) : h(g);
  }
}
function gr(e, n, t, r, i, o) {
  let s = this,
    a = 0,
    l;
  return u;
  function u(p) {
    return (e.enter(r), e.enter(i), e.consume(p), e.exit(i), e.enter(o), c);
  }
  function c(p) {
    return a > 999 ||
      p === null ||
      p === 91 ||
      (p === 93 && !l) ||
      (p === 94 && !a && "_hiddenFootnoteSupport" in s.parser.constructs)
      ? t(p)
      : p === 93
        ? (e.exit(o), e.enter(i), e.consume(p), e.exit(i), e.exit(r), n)
        : V(p)
          ? (e.enter("lineEnding"), e.consume(p), e.exit("lineEnding"), c)
          : (e.enter("chunkString", { contentType: "string" }), d(p));
  }
  function d(p) {
    return p === null || p === 91 || p === 93 || V(p) || a++ > 999
      ? (e.exit("chunkString"), c(p))
      : (e.consume(p), l || (l = !Z(p)), p === 92 ? f : d);
  }
  function f(p) {
    return p === 91 || p === 92 || p === 93 ? (e.consume(p), a++, d) : d(p);
  }
}
function wr(e, n, t, r, i, o) {
  let s;
  return a;
  function a(f) {
    return f === 34 || f === 39 || f === 40
      ? (e.enter(r), e.enter(i), e.consume(f), e.exit(i), (s = f === 40 ? 41 : f), l)
      : t(f);
  }
  function l(f) {
    return f === s ? (e.enter(i), e.consume(f), e.exit(i), e.exit(r), n) : (e.enter(o), u(f));
  }
  function u(f) {
    return f === s
      ? (e.exit(o), l(s))
      : f === null
        ? t(f)
        : V(f)
          ? (e.enter("lineEnding"), e.consume(f), e.exit("lineEnding"), G(e, u, "linePrefix"))
          : (e.enter("chunkString", { contentType: "string" }), c(f));
  }
  function c(f) {
    return f === s || f === null || V(f)
      ? (e.exit("chunkString"), u(f))
      : (e.consume(f), f === 92 ? d : c);
  }
  function d(f) {
    return f === s || f === 92 ? (e.consume(f), c) : c(f);
  }
}
function en(e, n) {
  let t;
  return r;
  function r(i) {
    return V(i)
      ? (e.enter("lineEnding"), e.consume(i), e.exit("lineEnding"), (t = !0), r)
      : Z(i)
        ? G(e, r, t ? "linePrefix" : "lineSuffix")(i)
        : n(i);
  }
}
var Qi = { name: "definition", tokenize: Qd },
  Kd = { partial: !0, tokenize: Jd };
function Qd(e, n, t) {
  let r = this,
    i;
  return o;
  function o(p) {
    return (e.enter("definition"), s(p));
  }
  function s(p) {
    return gr.call(
      r,
      e,
      a,
      t,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString",
    )(p);
  }
  function a(p) {
    return (
      (i = Me(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1))),
      p === 58 ? (e.enter("definitionMarker"), e.consume(p), e.exit("definitionMarker"), l) : t(p)
    );
  }
  function l(p) {
    return oe(p) ? en(e, u)(p) : u(p);
  }
  function u(p) {
    return hr(
      e,
      c,
      t,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString",
    )(p);
  }
  function c(p) {
    return e.attempt(Kd, d, d)(p);
  }
  function d(p) {
    return Z(p) ? G(e, f, "whitespace")(p) : f(p);
  }
  function f(p) {
    return p === null || V(p) ? (e.exit("definition"), r.parser.defined.push(i), n(p)) : t(p);
  }
}
function Jd(e, n, t) {
  return r;
  function r(a) {
    return oe(a) ? en(e, i)(a) : t(a);
  }
  function i(a) {
    return wr(e, o, t, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(a);
  }
  function o(a) {
    return Z(a) ? G(e, s, "whitespace")(a) : s(a);
  }
  function s(a) {
    return a === null || V(a) ? n(a) : t(a);
  }
}
var Ji = { name: "hardBreakEscape", tokenize: Xd };
function Xd(e, n, t) {
  return r;
  function r(o) {
    return (e.enter("hardBreakEscape"), e.consume(o), i);
  }
  function i(o) {
    return V(o) ? (e.exit("hardBreakEscape"), n(o)) : t(o);
  }
}
var Xi = { name: "headingAtx", resolve: ef, tokenize: tf };
function ef(e, n) {
  let t = e.length - 2,
    r = 3,
    i,
    o;
  return (
    e[r][1].type === "whitespace" && (r += 2),
    t - 2 > r && e[t][1].type === "whitespace" && (t -= 2),
    e[t][1].type === "atxHeadingSequence" &&
      (r === t - 1 || (t - 4 > r && e[t - 2][1].type === "whitespace")) &&
      (t -= r + 1 === t ? 2 : 4),
    t > r &&
      ((i = { type: "atxHeadingText", start: e[r][1].start, end: e[t][1].end }),
      (o = { type: "chunkText", start: e[r][1].start, end: e[t][1].end, contentType: "text" }),
      ke(e, r, t - r + 1, [
        ["enter", i, n],
        ["enter", o, n],
        ["exit", o, n],
        ["exit", i, n],
      ])),
    e
  );
}
function tf(e, n, t) {
  let r = 0;
  return i;
  function i(c) {
    return (e.enter("atxHeading"), o(c));
  }
  function o(c) {
    return (e.enter("atxHeadingSequence"), s(c));
  }
  function s(c) {
    return c === 35 && r++ < 6
      ? (e.consume(c), s)
      : c === null || oe(c)
        ? (e.exit("atxHeadingSequence"), a(c))
        : t(c);
  }
  function a(c) {
    return c === 35
      ? (e.enter("atxHeadingSequence"), l(c))
      : c === null || V(c)
        ? (e.exit("atxHeading"), n(c))
        : Z(c)
          ? G(e, a, "whitespace")(c)
          : (e.enter("atxHeadingText"), u(c));
  }
  function l(c) {
    return c === 35 ? (e.consume(c), l) : (e.exit("atxHeadingSequence"), a(c));
  }
  function u(c) {
    return c === null || c === 35 || oe(c) ? (e.exit("atxHeadingText"), a(c)) : (e.consume(c), u);
  }
}
var pa = [
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
  eo = ["pre", "script", "style", "textarea"];
var to = { concrete: !0, name: "htmlFlow", resolveTo: of, tokenize: sf },
  nf = { partial: !0, tokenize: lf },
  rf = { partial: !0, tokenize: af };
function of(e) {
  let n = e.length;
  for (; n-- && !(e[n][0] === "enter" && e[n][1].type === "htmlFlow"););
  return (
    n > 1 &&
      e[n - 2][1].type === "linePrefix" &&
      ((e[n][1].start = e[n - 2][1].start),
      (e[n + 1][1].start = e[n - 2][1].start),
      e.splice(n - 2, 2)),
    e
  );
}
function sf(e, n, t) {
  let r = this,
    i,
    o,
    s,
    a,
    l;
  return u;
  function u(k) {
    return c(k);
  }
  function c(k) {
    return (e.enter("htmlFlow"), e.enter("htmlFlowData"), e.consume(k), d);
  }
  function d(k) {
    return k === 33
      ? (e.consume(k), f)
      : k === 47
        ? (e.consume(k), (o = !0), h)
        : k === 63
          ? (e.consume(k), (i = 3), r.interrupt ? n : x)
          : ve(k)
            ? (e.consume(k), (s = String.fromCharCode(k)), w)
            : t(k);
  }
  function f(k) {
    return k === 45
      ? (e.consume(k), (i = 2), p)
      : k === 91
        ? (e.consume(k), (i = 5), (a = 0), m)
        : ve(k)
          ? (e.consume(k), (i = 4), r.interrupt ? n : x)
          : t(k);
  }
  function p(k) {
    return k === 45 ? (e.consume(k), r.interrupt ? n : x) : t(k);
  }
  function m(k) {
    let xe = "CDATA[";
    return k === xe.charCodeAt(a++)
      ? (e.consume(k), a === xe.length ? (r.interrupt ? n : _) : m)
      : t(k);
  }
  function h(k) {
    return ve(k) ? (e.consume(k), (s = String.fromCharCode(k)), w) : t(k);
  }
  function w(k) {
    if (k === null || k === 47 || k === 62 || oe(k)) {
      let xe = k === 47,
        Pe = s.toLowerCase();
      return !xe && !o && eo.includes(Pe)
        ? ((i = 1), r.interrupt ? n(k) : _(k))
        : pa.includes(s.toLowerCase())
          ? ((i = 6), xe ? (e.consume(k), g) : r.interrupt ? n(k) : _(k))
          : ((i = 7), r.interrupt && !r.parser.lazy[r.now().line] ? t(k) : o ? S(k) : b(k));
    }
    return k === 45 || Se(k) ? (e.consume(k), (s += String.fromCharCode(k)), w) : t(k);
  }
  function g(k) {
    return k === 62 ? (e.consume(k), r.interrupt ? n : _) : t(k);
  }
  function S(k) {
    return Z(k) ? (e.consume(k), S) : E(k);
  }
  function b(k) {
    return k === 47
      ? (e.consume(k), E)
      : k === 58 || k === 95 || ve(k)
        ? (e.consume(k), I)
        : Z(k)
          ? (e.consume(k), b)
          : E(k);
  }
  function I(k) {
    return k === 45 || k === 46 || k === 58 || k === 95 || Se(k) ? (e.consume(k), I) : R(k);
  }
  function R(k) {
    return k === 61 ? (e.consume(k), y) : Z(k) ? (e.consume(k), R) : b(k);
  }
  function y(k) {
    return k === null || k === 60 || k === 61 || k === 62 || k === 96
      ? t(k)
      : k === 34 || k === 39
        ? (e.consume(k), (l = k), T)
        : Z(k)
          ? (e.consume(k), y)
          : M(k);
  }
  function T(k) {
    return k === l ? (e.consume(k), (l = null), P) : k === null || V(k) ? t(k) : (e.consume(k), T);
  }
  function M(k) {
    return k === null ||
      k === 34 ||
      k === 39 ||
      k === 47 ||
      k === 60 ||
      k === 61 ||
      k === 62 ||
      k === 96 ||
      oe(k)
      ? R(k)
      : (e.consume(k), M);
  }
  function P(k) {
    return k === 47 || k === 62 || Z(k) ? b(k) : t(k);
  }
  function E(k) {
    return k === 62 ? (e.consume(k), U) : t(k);
  }
  function U(k) {
    return k === null || V(k) ? _(k) : Z(k) ? (e.consume(k), U) : t(k);
  }
  function _(k) {
    return k === 45 && i === 2
      ? (e.consume(k), z)
      : k === 60 && i === 1
        ? (e.consume(k), ue)
        : k === 62 && i === 4
          ? (e.consume(k), H)
          : k === 63 && i === 3
            ? (e.consume(k), x)
            : k === 93 && i === 5
              ? (e.consume(k), $e)
              : V(k) && (i === 6 || i === 7)
                ? (e.exit("htmlFlowData"), e.check(nf, ie, C)(k))
                : k === null || V(k)
                  ? (e.exit("htmlFlowData"), C(k))
                  : (e.consume(k), _);
  }
  function C(k) {
    return e.check(rf, $, ie)(k);
  }
  function $(k) {
    return (e.enter("lineEnding"), e.consume(k), e.exit("lineEnding"), D);
  }
  function D(k) {
    return k === null || V(k) ? C(k) : (e.enter("htmlFlowData"), _(k));
  }
  function z(k) {
    return k === 45 ? (e.consume(k), x) : _(k);
  }
  function ue(k) {
    return k === 47 ? (e.consume(k), (s = ""), we) : _(k);
  }
  function we(k) {
    if (k === 62) {
      let xe = s.toLowerCase();
      return eo.includes(xe) ? (e.consume(k), H) : _(k);
    }
    return ve(k) && s.length < 8 ? (e.consume(k), (s += String.fromCharCode(k)), we) : _(k);
  }
  function $e(k) {
    return k === 93 ? (e.consume(k), x) : _(k);
  }
  function x(k) {
    return k === 62 ? (e.consume(k), H) : k === 45 && i === 2 ? (e.consume(k), x) : _(k);
  }
  function H(k) {
    return k === null || V(k) ? (e.exit("htmlFlowData"), ie(k)) : (e.consume(k), H);
  }
  function ie(k) {
    return (e.exit("htmlFlow"), n(k));
  }
}
function af(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return V(s) ? (e.enter("lineEnding"), e.consume(s), e.exit("lineEnding"), o) : t(s);
  }
  function o(s) {
    return r.parser.lazy[r.now().line] ? t(s) : n(s);
  }
}
function lf(e, n, t) {
  return r;
  function r(i) {
    return (e.enter("lineEnding"), e.consume(i), e.exit("lineEnding"), e.attempt(lt, n, t));
  }
}
var no = { name: "htmlText", tokenize: uf };
function uf(e, n, t) {
  let r = this,
    i,
    o,
    s;
  return a;
  function a(x) {
    return (e.enter("htmlText"), e.enter("htmlTextData"), e.consume(x), l);
  }
  function l(x) {
    return x === 33
      ? (e.consume(x), u)
      : x === 47
        ? (e.consume(x), R)
        : x === 63
          ? (e.consume(x), b)
          : ve(x)
            ? (e.consume(x), M)
            : t(x);
  }
  function u(x) {
    return x === 45
      ? (e.consume(x), c)
      : x === 91
        ? (e.consume(x), (o = 0), m)
        : ve(x)
          ? (e.consume(x), S)
          : t(x);
  }
  function c(x) {
    return x === 45 ? (e.consume(x), p) : t(x);
  }
  function d(x) {
    return x === null
      ? t(x)
      : x === 45
        ? (e.consume(x), f)
        : V(x)
          ? ((s = d), ue(x))
          : (e.consume(x), d);
  }
  function f(x) {
    return x === 45 ? (e.consume(x), p) : d(x);
  }
  function p(x) {
    return x === 62 ? z(x) : x === 45 ? f(x) : d(x);
  }
  function m(x) {
    let H = "CDATA[";
    return x === H.charCodeAt(o++) ? (e.consume(x), o === H.length ? h : m) : t(x);
  }
  function h(x) {
    return x === null
      ? t(x)
      : x === 93
        ? (e.consume(x), w)
        : V(x)
          ? ((s = h), ue(x))
          : (e.consume(x), h);
  }
  function w(x) {
    return x === 93 ? (e.consume(x), g) : h(x);
  }
  function g(x) {
    return x === 62 ? z(x) : x === 93 ? (e.consume(x), g) : h(x);
  }
  function S(x) {
    return x === null || x === 62 ? z(x) : V(x) ? ((s = S), ue(x)) : (e.consume(x), S);
  }
  function b(x) {
    return x === null
      ? t(x)
      : x === 63
        ? (e.consume(x), I)
        : V(x)
          ? ((s = b), ue(x))
          : (e.consume(x), b);
  }
  function I(x) {
    return x === 62 ? z(x) : b(x);
  }
  function R(x) {
    return ve(x) ? (e.consume(x), y) : t(x);
  }
  function y(x) {
    return x === 45 || Se(x) ? (e.consume(x), y) : T(x);
  }
  function T(x) {
    return V(x) ? ((s = T), ue(x)) : Z(x) ? (e.consume(x), T) : z(x);
  }
  function M(x) {
    return x === 45 || Se(x) ? (e.consume(x), M) : x === 47 || x === 62 || oe(x) ? P(x) : t(x);
  }
  function P(x) {
    return x === 47
      ? (e.consume(x), z)
      : x === 58 || x === 95 || ve(x)
        ? (e.consume(x), E)
        : V(x)
          ? ((s = P), ue(x))
          : Z(x)
            ? (e.consume(x), P)
            : z(x);
  }
  function E(x) {
    return x === 45 || x === 46 || x === 58 || x === 95 || Se(x) ? (e.consume(x), E) : U(x);
  }
  function U(x) {
    return x === 61 ? (e.consume(x), _) : V(x) ? ((s = U), ue(x)) : Z(x) ? (e.consume(x), U) : P(x);
  }
  function _(x) {
    return x === null || x === 60 || x === 61 || x === 62 || x === 96
      ? t(x)
      : x === 34 || x === 39
        ? (e.consume(x), (i = x), C)
        : V(x)
          ? ((s = _), ue(x))
          : Z(x)
            ? (e.consume(x), _)
            : (e.consume(x), $);
  }
  function C(x) {
    return x === i
      ? (e.consume(x), (i = void 0), D)
      : x === null
        ? t(x)
        : V(x)
          ? ((s = C), ue(x))
          : (e.consume(x), C);
  }
  function $(x) {
    return x === null || x === 34 || x === 39 || x === 60 || x === 61 || x === 96
      ? t(x)
      : x === 47 || x === 62 || oe(x)
        ? P(x)
        : (e.consume(x), $);
  }
  function D(x) {
    return x === 47 || x === 62 || oe(x) ? P(x) : t(x);
  }
  function z(x) {
    return x === 62 ? (e.consume(x), e.exit("htmlTextData"), e.exit("htmlText"), n) : t(x);
  }
  function ue(x) {
    return (e.exit("htmlTextData"), e.enter("lineEnding"), e.consume(x), e.exit("lineEnding"), we);
  }
  function we(x) {
    return Z(x)
      ? G(
          e,
          $e,
          "linePrefix",
          r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4,
        )(x)
      : $e(x);
  }
  function $e(x) {
    return (e.enter("htmlTextData"), s(x));
  }
}
var tn = { name: "labelEnd", resolveAll: pf, resolveTo: mf, tokenize: hf },
  cf = { tokenize: gf },
  df = { tokenize: wf },
  ff = { tokenize: xf };
function pf(e) {
  let n = -1,
    t = [];
  for (; ++n < e.length;) {
    let r = e[n][1];
    if (
      (t.push(e[n]), r.type === "labelImage" || r.type === "labelLink" || r.type === "labelEnd")
    ) {
      let i = r.type === "labelImage" ? 4 : 2;
      ((r.type = "data"), (n += i));
    }
  }
  return (e.length !== t.length && ke(e, 0, e.length, t), e);
}
function mf(e, n) {
  let t = e.length,
    r = 0,
    i,
    o,
    s,
    a;
  for (; t--;)
    if (((i = e[t][1]), o)) {
      if (i.type === "link" || (i.type === "labelLink" && i._inactive)) break;
      e[t][0] === "enter" && i.type === "labelLink" && (i._inactive = !0);
    } else if (s) {
      if (
        e[t][0] === "enter" &&
        (i.type === "labelImage" || i.type === "labelLink") &&
        !i._balanced &&
        ((o = t), i.type !== "labelLink")
      ) {
        r = 2;
        break;
      }
    } else i.type === "labelEnd" && (s = t);
  let l = {
      type: e[o][1].type === "labelLink" ? "link" : "image",
      start: { ...e[o][1].start },
      end: { ...e[e.length - 1][1].end },
    },
    u = { type: "label", start: { ...e[o][1].start }, end: { ...e[s][1].end } },
    c = { type: "labelText", start: { ...e[o + r + 2][1].end }, end: { ...e[s - 2][1].start } };
  return (
    (a = [
      ["enter", l, n],
      ["enter", u, n],
    ]),
    (a = Oe(a, e.slice(o + 1, o + r + 3))),
    (a = Oe(a, [["enter", c, n]])),
    (a = Oe(a, Nt(n.parser.constructs.insideSpan.null, e.slice(o + r + 4, s - 3), n))),
    (a = Oe(a, [["exit", c, n], e[s - 2], e[s - 1], ["exit", u, n]])),
    (a = Oe(a, e.slice(s + 1))),
    (a = Oe(a, [["exit", l, n]])),
    ke(e, o, e.length, a),
    e
  );
}
function hf(e, n, t) {
  let r = this,
    i = r.events.length,
    o,
    s;
  for (; i--;)
    if (
      (r.events[i][1].type === "labelImage" || r.events[i][1].type === "labelLink") &&
      !r.events[i][1]._balanced
    ) {
      o = r.events[i][1];
      break;
    }
  return a;
  function a(f) {
    return o
      ? o._inactive
        ? d(f)
        : ((s = r.parser.defined.includes(Me(r.sliceSerialize({ start: o.end, end: r.now() })))),
          e.enter("labelEnd"),
          e.enter("labelMarker"),
          e.consume(f),
          e.exit("labelMarker"),
          e.exit("labelEnd"),
          l)
      : t(f);
  }
  function l(f) {
    return f === 40
      ? e.attempt(cf, c, s ? c : d)(f)
      : f === 91
        ? e.attempt(df, c, s ? u : d)(f)
        : s
          ? c(f)
          : d(f);
  }
  function u(f) {
    return e.attempt(ff, c, d)(f);
  }
  function c(f) {
    return n(f);
  }
  function d(f) {
    return ((o._balanced = !0), t(f));
  }
}
function gf(e, n, t) {
  return r;
  function r(d) {
    return (
      e.enter("resource"), e.enter("resourceMarker"), e.consume(d), e.exit("resourceMarker"), i
    );
  }
  function i(d) {
    return oe(d) ? en(e, o)(d) : o(d);
  }
  function o(d) {
    return d === 41
      ? c(d)
      : hr(
          e,
          s,
          a,
          "resourceDestination",
          "resourceDestinationLiteral",
          "resourceDestinationLiteralMarker",
          "resourceDestinationRaw",
          "resourceDestinationString",
          32,
        )(d);
  }
  function s(d) {
    return oe(d) ? en(e, l)(d) : c(d);
  }
  function a(d) {
    return t(d);
  }
  function l(d) {
    return d === 34 || d === 39 || d === 40
      ? wr(e, u, t, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(d)
      : c(d);
  }
  function u(d) {
    return oe(d) ? en(e, c)(d) : c(d);
  }
  function c(d) {
    return d === 41
      ? (e.enter("resourceMarker"), e.consume(d), e.exit("resourceMarker"), e.exit("resource"), n)
      : t(d);
  }
}
function wf(e, n, t) {
  let r = this;
  return i;
  function i(a) {
    return gr.call(r, e, o, s, "reference", "referenceMarker", "referenceString")(a);
  }
  function o(a) {
    return r.parser.defined.includes(
      Me(r.sliceSerialize(r.events[r.events.length - 1][1]).slice(1, -1)),
    )
      ? n(a)
      : t(a);
  }
  function s(a) {
    return t(a);
  }
}
function xf(e, n, t) {
  return r;
  function r(o) {
    return (
      e.enter("reference"), e.enter("referenceMarker"), e.consume(o), e.exit("referenceMarker"), i
    );
  }
  function i(o) {
    return o === 93
      ? (e.enter("referenceMarker"),
        e.consume(o),
        e.exit("referenceMarker"),
        e.exit("reference"),
        n)
      : t(o);
  }
}
var ro = { name: "labelStartImage", resolveAll: tn.resolveAll, tokenize: kf };
function kf(e, n, t) {
  let r = this;
  return i;
  function i(a) {
    return (
      e.enter("labelImage"),
      e.enter("labelImageMarker"),
      e.consume(a),
      e.exit("labelImageMarker"),
      o
    );
  }
  function o(a) {
    return a === 91
      ? (e.enter("labelMarker"), e.consume(a), e.exit("labelMarker"), e.exit("labelImage"), s)
      : t(a);
  }
  function s(a) {
    return a === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? t(a) : n(a);
  }
}
var io = { name: "labelStartLink", resolveAll: tn.resolveAll, tokenize: bf };
function bf(e, n, t) {
  let r = this;
  return i;
  function i(s) {
    return (
      e.enter("labelLink"),
      e.enter("labelMarker"),
      e.consume(s),
      e.exit("labelMarker"),
      e.exit("labelLink"),
      o
    );
  }
  function o(s) {
    return s === 94 && "_hiddenFootnoteSupport" in r.parser.constructs ? t(s) : n(s);
  }
}
var _n = { name: "lineEnding", tokenize: yf };
function yf(e, n) {
  return t;
  function t(r) {
    return (e.enter("lineEnding"), e.consume(r), e.exit("lineEnding"), G(e, n, "linePrefix"));
  }
}
var nn = { name: "thematicBreak", tokenize: vf };
function vf(e, n, t) {
  let r = 0,
    i;
  return o;
  function o(u) {
    return (e.enter("thematicBreak"), s(u));
  }
  function s(u) {
    return ((i = u), a(u));
  }
  function a(u) {
    return u === i
      ? (e.enter("thematicBreakSequence"), l(u))
      : r >= 3 && (u === null || V(u))
        ? (e.exit("thematicBreak"), n(u))
        : t(u);
  }
  function l(u) {
    return u === i
      ? (e.consume(u), r++, l)
      : (e.exit("thematicBreakSequence"), Z(u) ? G(e, a, "whitespace")(u) : a(u));
  }
}
var Fe = { continuation: { tokenize: Cf }, exit: Af, name: "list", tokenize: If },
  Sf = { partial: !0, tokenize: Rf },
  Ef = { partial: !0, tokenize: Tf };
function If(e, n, t) {
  let r = this,
    i = r.events[r.events.length - 1],
    o = i && i[1].type === "linePrefix" ? i[2].sliceSerialize(i[1], !0).length : 0,
    s = 0;
  return a;
  function a(p) {
    let m =
      r.containerState.type || (p === 42 || p === 43 || p === 45 ? "listUnordered" : "listOrdered");
    if (m === "listUnordered" ? !r.containerState.marker || p === r.containerState.marker : Fn(p)) {
      if (
        (r.containerState.type || ((r.containerState.type = m), e.enter(m, { _container: !0 })),
        m === "listUnordered")
      )
        return (e.enter("listItemPrefix"), p === 42 || p === 45 ? e.check(nn, t, u)(p) : u(p));
      if (!r.interrupt || p === 49)
        return (e.enter("listItemPrefix"), e.enter("listItemValue"), l(p));
    }
    return t(p);
  }
  function l(p) {
    return Fn(p) && ++s < 10
      ? (e.consume(p), l)
      : (!r.interrupt || s < 2) &&
          (r.containerState.marker ? p === r.containerState.marker : p === 41 || p === 46)
        ? (e.exit("listItemValue"), u(p))
        : t(p);
  }
  function u(p) {
    return (
      e.enter("listItemMarker"),
      e.consume(p),
      e.exit("listItemMarker"),
      (r.containerState.marker = r.containerState.marker || p),
      e.check(lt, r.interrupt ? t : c, e.attempt(Sf, f, d))
    );
  }
  function c(p) {
    return ((r.containerState.initialBlankLine = !0), o++, f(p));
  }
  function d(p) {
    return Z(p)
      ? (e.enter("listItemPrefixWhitespace"), e.consume(p), e.exit("listItemPrefixWhitespace"), f)
      : t(p);
  }
  function f(p) {
    return (
      (r.containerState.size = o + r.sliceSerialize(e.exit("listItemPrefix"), !0).length), n(p)
    );
  }
}
function Cf(e, n, t) {
  let r = this;
  return ((r.containerState._closeFlow = void 0), e.check(lt, i, o));
  function i(a) {
    return (
      (r.containerState.furtherBlankLines =
        r.containerState.furtherBlankLines || r.containerState.initialBlankLine),
      G(e, n, "listItemIndent", r.containerState.size + 1)(a)
    );
  }
  function o(a) {
    return r.containerState.furtherBlankLines || !Z(a)
      ? ((r.containerState.furtherBlankLines = void 0),
        (r.containerState.initialBlankLine = void 0),
        s(a))
      : ((r.containerState.furtherBlankLines = void 0),
        (r.containerState.initialBlankLine = void 0),
        e.attempt(Ef, n, s)(a));
  }
  function s(a) {
    return (
      (r.containerState._closeFlow = !0),
      (r.interrupt = void 0),
      G(
        e,
        e.attempt(Fe, n, t),
        "linePrefix",
        r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4,
      )(a)
    );
  }
}
function Tf(e, n, t) {
  let r = this;
  return G(e, i, "listItemIndent", r.containerState.size + 1);
  function i(o) {
    let s = r.events[r.events.length - 1];
    return s &&
      s[1].type === "listItemIndent" &&
      s[2].sliceSerialize(s[1], !0).length === r.containerState.size
      ? n(o)
      : t(o);
  }
}
function Af(e) {
  e.exit(this.containerState.type);
}
function Rf(e, n, t) {
  let r = this;
  return G(
    e,
    i,
    "listItemPrefixWhitespace",
    r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 5,
  );
  function i(o) {
    let s = r.events[r.events.length - 1];
    return !Z(o) && s && s[1].type === "listItemPrefixWhitespace" ? n(o) : t(o);
  }
}
var xr = { name: "setextUnderline", resolveTo: Pf, tokenize: Mf };
function Pf(e, n) {
  let t = e.length,
    r,
    i,
    o;
  for (; t--;)
    if (e[t][0] === "enter") {
      if (e[t][1].type === "content") {
        r = t;
        break;
      }
      e[t][1].type === "paragraph" && (i = t);
    } else
      (e[t][1].type === "content" && e.splice(t, 1),
        !o && e[t][1].type === "definition" && (o = t));
  let s = {
    type: "setextHeading",
    start: { ...e[r][1].start },
    end: { ...e[e.length - 1][1].end },
  };
  return (
    (e[i][1].type = "setextHeadingText"),
    o
      ? (e.splice(i, 0, ["enter", s, n]),
        e.splice(o + 1, 0, ["exit", e[r][1], n]),
        (e[r][1].end = { ...e[o][1].end }))
      : (e[r][1] = s),
    e.push(["exit", s, n]),
    e
  );
}
function Mf(e, n, t) {
  let r = this,
    i;
  return o;
  function o(u) {
    let c = r.events.length,
      d;
    for (; c--;)
      if (
        r.events[c][1].type !== "lineEnding" &&
        r.events[c][1].type !== "linePrefix" &&
        r.events[c][1].type !== "content"
      ) {
        d = r.events[c][1].type === "paragraph";
        break;
      }
    return !r.parser.lazy[r.now().line] && (r.interrupt || d)
      ? (e.enter("setextHeadingLine"), (i = u), s(u))
      : t(u);
  }
  function s(u) {
    return (e.enter("setextHeadingLineSequence"), a(u));
  }
  function a(u) {
    return u === i
      ? (e.consume(u), a)
      : (e.exit("setextHeadingLineSequence"), Z(u) ? G(e, l, "lineSuffix")(u) : l(u));
  }
  function l(u) {
    return u === null || V(u) ? (e.exit("setextHeadingLine"), n(u)) : t(u);
  }
}
var Ff = { tokenize: Vf, partial: !0 };
function oo() {
  return {
    document: {
      91: { name: "gfmFootnoteDefinition", tokenize: Lf, continuation: { tokenize: Of }, exit: _f },
    },
    text: {
      91: { name: "gfmFootnoteCall", tokenize: $f },
      93: { name: "gfmPotentialFootnoteCall", add: "after", tokenize: Nf, resolveTo: Df },
    },
  };
}
function Nf(e, n, t) {
  let r = this,
    i = r.events.length,
    o = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []),
    s;
  for (; i--;) {
    let l = r.events[i][1];
    if (l.type === "labelImage") {
      s = l;
      break;
    }
    if (
      l.type === "gfmFootnoteCall" ||
      l.type === "labelLink" ||
      l.type === "label" ||
      l.type === "image" ||
      l.type === "link"
    )
      break;
  }
  return a;
  function a(l) {
    if (!s || !s._balanced) return t(l);
    let u = Me(r.sliceSerialize({ start: s.end, end: r.now() }));
    return u.codePointAt(0) !== 94 || !o.includes(u.slice(1))
      ? t(l)
      : (e.enter("gfmFootnoteCallLabelMarker"),
        e.consume(l),
        e.exit("gfmFootnoteCallLabelMarker"),
        n(l));
  }
}
function Df(e, n) {
  let t = e.length,
    r;
  for (; t--;)
    if (e[t][1].type === "labelImage" && e[t][0] === "enter") {
      r = e[t][1];
      break;
    }
  ((e[t + 1][1].type = "data"), (e[t + 3][1].type = "gfmFootnoteCallLabelMarker"));
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
      type: "chunkString",
      contentType: "string",
      start: Object.assign({}, s.start),
      end: Object.assign({}, s.end),
    },
    l = [
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
  return (e.splice(t, e.length - t + 1, ...l), e);
}
function $f(e, n, t) {
  let r = this,
    i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []),
    o = 0,
    s;
  return a;
  function a(d) {
    return (
      e.enter("gfmFootnoteCall"),
      e.enter("gfmFootnoteCallLabelMarker"),
      e.consume(d),
      e.exit("gfmFootnoteCallLabelMarker"),
      l
    );
  }
  function l(d) {
    return d !== 94
      ? t(d)
      : (e.enter("gfmFootnoteCallMarker"),
        e.consume(d),
        e.exit("gfmFootnoteCallMarker"),
        e.enter("gfmFootnoteCallString"),
        (e.enter("chunkString").contentType = "string"),
        u);
  }
  function u(d) {
    if (o > 999 || (d === 93 && !s) || d === null || d === 91 || oe(d)) return t(d);
    if (d === 93) {
      e.exit("chunkString");
      let f = e.exit("gfmFootnoteCallString");
      return i.includes(Me(r.sliceSerialize(f)))
        ? (e.enter("gfmFootnoteCallLabelMarker"),
          e.consume(d),
          e.exit("gfmFootnoteCallLabelMarker"),
          e.exit("gfmFootnoteCall"),
          n)
        : t(d);
    }
    return (oe(d) || (s = !0), o++, e.consume(d), d === 92 ? c : u);
  }
  function c(d) {
    return d === 91 || d === 92 || d === 93 ? (e.consume(d), o++, u) : u(d);
  }
}
function Lf(e, n, t) {
  let r = this,
    i = r.parser.gfmFootnotes || (r.parser.gfmFootnotes = []),
    o,
    s = 0,
    a;
  return l;
  function l(m) {
    return (
      (e.enter("gfmFootnoteDefinition")._container = !0),
      e.enter("gfmFootnoteDefinitionLabel"),
      e.enter("gfmFootnoteDefinitionLabelMarker"),
      e.consume(m),
      e.exit("gfmFootnoteDefinitionLabelMarker"),
      u
    );
  }
  function u(m) {
    return m === 94
      ? (e.enter("gfmFootnoteDefinitionMarker"),
        e.consume(m),
        e.exit("gfmFootnoteDefinitionMarker"),
        e.enter("gfmFootnoteDefinitionLabelString"),
        (e.enter("chunkString").contentType = "string"),
        c)
      : t(m);
  }
  function c(m) {
    if (s > 999 || (m === 93 && !a) || m === null || m === 91 || oe(m)) return t(m);
    if (m === 93) {
      e.exit("chunkString");
      let h = e.exit("gfmFootnoteDefinitionLabelString");
      return (
        (o = Me(r.sliceSerialize(h))),
        e.enter("gfmFootnoteDefinitionLabelMarker"),
        e.consume(m),
        e.exit("gfmFootnoteDefinitionLabelMarker"),
        e.exit("gfmFootnoteDefinitionLabel"),
        f
      );
    }
    return (oe(m) || (a = !0), s++, e.consume(m), m === 92 ? d : c);
  }
  function d(m) {
    return m === 91 || m === 92 || m === 93 ? (e.consume(m), s++, c) : c(m);
  }
  function f(m) {
    return m === 58
      ? (e.enter("definitionMarker"),
        e.consume(m),
        e.exit("definitionMarker"),
        i.includes(o) || i.push(o),
        G(e, p, "gfmFootnoteDefinitionWhitespace"))
      : t(m);
  }
  function p(m) {
    return n(m);
  }
}
function Of(e, n, t) {
  return e.check(lt, n, e.attempt(Ff, n, t));
}
function _f(e) {
  e.exit("gfmFootnoteDefinition");
}
function Vf(e, n, t) {
  let r = this;
  return G(e, i, "gfmFootnoteDefinitionIndent", 5);
  function i(o) {
    let s = r.events[r.events.length - 1];
    return s &&
      s[1].type === "gfmFootnoteDefinitionIndent" &&
      s[2].sliceSerialize(s[1], !0).length === 4
      ? n(o)
      : t(o);
  }
}
function so(e) {
  let t = (e || {}).singleTilde,
    r = { name: "strikethrough", tokenize: o, resolveAll: i };
  return (
    t == null && (t = !0),
    { text: { 126: r }, insideSpan: { null: [r] }, attentionMarkers: { null: [126] } }
  );
  function i(s, a) {
    let l = -1;
    for (; ++l < s.length;)
      if (
        s[l][0] === "enter" &&
        s[l][1].type === "strikethroughSequenceTemporary" &&
        s[l][1]._close
      ) {
        let u = l;
        for (; u--;)
          if (
            s[u][0] === "exit" &&
            s[u][1].type === "strikethroughSequenceTemporary" &&
            s[u][1]._open &&
            s[l][1].end.offset - s[l][1].start.offset === s[u][1].end.offset - s[u][1].start.offset
          ) {
            ((s[l][1].type = "strikethroughSequence"), (s[u][1].type = "strikethroughSequence"));
            let c = {
                type: "strikethrough",
                start: Object.assign({}, s[u][1].start),
                end: Object.assign({}, s[l][1].end),
              },
              d = {
                type: "strikethroughText",
                start: Object.assign({}, s[u][1].end),
                end: Object.assign({}, s[l][1].start),
              },
              f = [
                ["enter", c, a],
                ["enter", s[u][1], a],
                ["exit", s[u][1], a],
                ["enter", d, a],
              ],
              p = a.parser.constructs.insideSpan.null;
            (p && ke(f, f.length, 0, Nt(p, s.slice(u + 1, l), a)),
              ke(f, f.length, 0, [
                ["exit", d, a],
                ["enter", s[l][1], a],
                ["exit", s[l][1], a],
                ["exit", c, a],
              ]),
              ke(s, u - 1, l - u + 3, f),
              (l = u + f.length - 2));
            break;
          }
      }
    for (l = -1; ++l < s.length;)
      s[l][1].type === "strikethroughSequenceTemporary" && (s[l][1].type = "data");
    return s;
  }
  function o(s, a, l) {
    let u = this.previous,
      c = this.events,
      d = 0;
    return f;
    function f(m) {
      return u === 126 && c[c.length - 1][1].type !== "characterEscape"
        ? l(m)
        : (s.enter("strikethroughSequenceTemporary"), p(m));
    }
    function p(m) {
      let h = kt(u);
      if (m === 126) return d > 1 ? l(m) : (s.consume(m), d++, p);
      if (d < 2 && !t) return l(m);
      let w = s.exit("strikethroughSequenceTemporary"),
        g = kt(m);
      return ((w._open = !g || (g === 2 && !!h)), (w._close = !h || (h === 2 && !!g)), a(m));
    }
  }
}
var kr = class {
  constructor() {
    this.map = [];
  }
  add(n, t, r) {
    Bf(this, n, t, r);
  }
  consume(n) {
    if (
      (this.map.sort(function (o, s) {
        return o[0] - s[0];
      }),
      this.map.length === 0)
    )
      return;
    let t = this.map.length,
      r = [];
    for (; t > 0;)
      ((t -= 1),
        r.push(n.slice(this.map[t][0] + this.map[t][1]), this.map[t][2]),
        (n.length = this.map[t][0]));
    (r.push(n.slice()), (n.length = 0));
    let i = r.pop();
    for (; i;) {
      for (let o of i) n.push(o);
      i = r.pop();
    }
    this.map.length = 0;
  }
};
function Bf(e, n, t, r) {
  let i = 0;
  if (!(t === 0 && r.length === 0)) {
    for (; i < e.map.length;) {
      if (e.map[i][0] === n) {
        ((e.map[i][1] += t), e.map[i][2].push(...r));
        return;
      }
      i += 1;
    }
    e.map.push([n, t, r]);
  }
}
function ma(e, n) {
  let t = !1,
    r = [];
  for (; n < e.length;) {
    let i = e[n];
    if (t) {
      if (i[0] === "enter")
        i[1].type === "tableContent" &&
          r.push(e[n + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
      else if (i[1].type === "tableContent") {
        if (e[n - 1][1].type === "tableDelimiterMarker") {
          let o = r.length - 1;
          r[o] = r[o] === "left" ? "center" : "right";
        }
      } else if (i[1].type === "tableDelimiterRow") break;
    } else i[0] === "enter" && i[1].type === "tableDelimiterRow" && (t = !0);
    n += 1;
  }
  return r;
}
function ao() {
  return { flow: { null: { name: "table", tokenize: zf, resolveAll: Uf } } };
}
function zf(e, n, t) {
  let r = this,
    i = 0,
    o = 0,
    s;
  return a;
  function a(E) {
    let U = r.events.length - 1;
    for (; U > -1;) {
      let $ = r.events[U][1].type;
      if ($ === "lineEnding" || $ === "linePrefix") U--;
      else break;
    }
    let _ = U > -1 ? r.events[U][1].type : null,
      C = _ === "tableHead" || _ === "tableRow" ? y : l;
    return C === y && r.parser.lazy[r.now().line] ? t(E) : C(E);
  }
  function l(E) {
    return (e.enter("tableHead"), e.enter("tableRow"), u(E));
  }
  function u(E) {
    return (E === 124 || ((s = !0), (o += 1)), c(E));
  }
  function c(E) {
    return E === null
      ? t(E)
      : V(E)
        ? o > 1
          ? ((o = 0),
            (r.interrupt = !0),
            e.exit("tableRow"),
            e.enter("lineEnding"),
            e.consume(E),
            e.exit("lineEnding"),
            p)
          : t(E)
        : Z(E)
          ? G(e, c, "whitespace")(E)
          : ((o += 1),
            s && ((s = !1), (i += 1)),
            E === 124
              ? (e.enter("tableCellDivider"), e.consume(E), e.exit("tableCellDivider"), (s = !0), c)
              : (e.enter("data"), d(E)));
  }
  function d(E) {
    return E === null || E === 124 || oe(E)
      ? (e.exit("data"), c(E))
      : (e.consume(E), E === 92 ? f : d);
  }
  function f(E) {
    return E === 92 || E === 124 ? (e.consume(E), d) : d(E);
  }
  function p(E) {
    return (
      (r.interrupt = !1),
      r.parser.lazy[r.now().line]
        ? t(E)
        : (e.enter("tableDelimiterRow"),
          (s = !1),
          Z(E)
            ? G(
                e,
                m,
                "linePrefix",
                r.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4,
              )(E)
            : m(E))
    );
  }
  function m(E) {
    return E === 45 || E === 58
      ? w(E)
      : E === 124
        ? ((s = !0), e.enter("tableCellDivider"), e.consume(E), e.exit("tableCellDivider"), h)
        : R(E);
  }
  function h(E) {
    return Z(E) ? G(e, w, "whitespace")(E) : w(E);
  }
  function w(E) {
    return E === 58
      ? ((o += 1),
        (s = !0),
        e.enter("tableDelimiterMarker"),
        e.consume(E),
        e.exit("tableDelimiterMarker"),
        g)
      : E === 45
        ? ((o += 1), g(E))
        : E === null || V(E)
          ? I(E)
          : R(E);
  }
  function g(E) {
    return E === 45 ? (e.enter("tableDelimiterFiller"), S(E)) : R(E);
  }
  function S(E) {
    return E === 45
      ? (e.consume(E), S)
      : E === 58
        ? ((s = !0),
          e.exit("tableDelimiterFiller"),
          e.enter("tableDelimiterMarker"),
          e.consume(E),
          e.exit("tableDelimiterMarker"),
          b)
        : (e.exit("tableDelimiterFiller"), b(E));
  }
  function b(E) {
    return Z(E) ? G(e, I, "whitespace")(E) : I(E);
  }
  function I(E) {
    return E === 124
      ? m(E)
      : E === null || V(E)
        ? !s || i !== o
          ? R(E)
          : (e.exit("tableDelimiterRow"), e.exit("tableHead"), n(E))
        : R(E);
  }
  function R(E) {
    return t(E);
  }
  function y(E) {
    return (e.enter("tableRow"), T(E));
  }
  function T(E) {
    return E === 124
      ? (e.enter("tableCellDivider"), e.consume(E), e.exit("tableCellDivider"), T)
      : E === null || V(E)
        ? (e.exit("tableRow"), n(E))
        : Z(E)
          ? G(e, T, "whitespace")(E)
          : (e.enter("data"), M(E));
  }
  function M(E) {
    return E === null || E === 124 || oe(E)
      ? (e.exit("data"), T(E))
      : (e.consume(E), E === 92 ? P : M);
  }
  function P(E) {
    return E === 92 || E === 124 ? (e.consume(E), M) : M(E);
  }
}
function Uf(e, n) {
  let t = -1,
    r = !0,
    i = 0,
    o = [0, 0, 0, 0],
    s = [0, 0, 0, 0],
    a = !1,
    l = 0,
    u,
    c,
    d,
    f = new kr();
  for (; ++t < e.length;) {
    let p = e[t],
      m = p[1];
    p[0] === "enter"
      ? m.type === "tableHead"
        ? ((a = !1),
          l !== 0 && (ha(f, n, l, u, c), (c = void 0), (l = 0)),
          (u = { type: "table", start: Object.assign({}, m.start), end: Object.assign({}, m.end) }),
          f.add(t, 0, [["enter", u, n]]))
        : m.type === "tableRow" || m.type === "tableDelimiterRow"
          ? ((r = !0),
            (d = void 0),
            (o = [0, 0, 0, 0]),
            (s = [0, t + 1, 0, 0]),
            a &&
              ((a = !1),
              (c = {
                type: "tableBody",
                start: Object.assign({}, m.start),
                end: Object.assign({}, m.end),
              }),
              f.add(t, 0, [["enter", c, n]])),
            (i = m.type === "tableDelimiterRow" ? 2 : c ? 3 : 1))
          : i &&
              (m.type === "data" ||
                m.type === "tableDelimiterMarker" ||
                m.type === "tableDelimiterFiller")
            ? ((r = !1),
              s[2] === 0 &&
                (o[1] !== 0 && ((s[0] = s[1]), (d = br(f, n, o, i, void 0, d)), (o = [0, 0, 0, 0])),
                (s[2] = t)))
            : m.type === "tableCellDivider" &&
              (r
                ? (r = !1)
                : (o[1] !== 0 && ((s[0] = s[1]), (d = br(f, n, o, i, void 0, d))),
                  (o = s),
                  (s = [o[1], t, 0, 0])))
      : m.type === "tableHead"
        ? ((a = !0), (l = t))
        : m.type === "tableRow" || m.type === "tableDelimiterRow"
          ? ((l = t),
            o[1] !== 0
              ? ((s[0] = s[1]), (d = br(f, n, o, i, t, d)))
              : s[1] !== 0 && (d = br(f, n, s, i, t, d)),
            (i = 0))
          : i &&
            (m.type === "data" ||
              m.type === "tableDelimiterMarker" ||
              m.type === "tableDelimiterFiller") &&
            (s[3] = t);
  }
  for (l !== 0 && ha(f, n, l, u, c), f.consume(n.events), t = -1; ++t < n.events.length;) {
    let p = n.events[t];
    p[0] === "enter" && p[1].type === "table" && (p[1]._align = ma(n.events, t));
  }
  return e;
}
function br(e, n, t, r, i, o) {
  let s = r === 1 ? "tableHeader" : r === 2 ? "tableDelimiter" : "tableData",
    a = "tableContent";
  t[0] !== 0 && ((o.end = Object.assign({}, pn(n.events, t[0]))), e.add(t[0], 0, [["exit", o, n]]));
  let l = pn(n.events, t[1]);
  if (
    ((o = { type: s, start: Object.assign({}, l), end: Object.assign({}, l) }),
    e.add(t[1], 0, [["enter", o, n]]),
    t[2] !== 0)
  ) {
    let u = pn(n.events, t[2]),
      c = pn(n.events, t[3]),
      d = { type: a, start: Object.assign({}, u), end: Object.assign({}, c) };
    if ((e.add(t[2], 0, [["enter", d, n]]), r !== 2)) {
      let f = n.events[t[2]],
        p = n.events[t[3]];
      if (
        ((f[1].end = Object.assign({}, p[1].end)),
        (f[1].type = "chunkText"),
        (f[1].contentType = "text"),
        t[3] > t[2] + 1)
      ) {
        let m = t[2] + 1,
          h = t[3] - t[2] - 1;
        e.add(m, h, []);
      }
    }
    e.add(t[3] + 1, 0, [["exit", d, n]]);
  }
  return (
    i !== void 0 &&
      ((o.end = Object.assign({}, pn(n.events, i))), e.add(i, 0, [["exit", o, n]]), (o = void 0)),
    o
  );
}
function ha(e, n, t, r, i) {
  let o = [],
    s = pn(n.events, t);
  (i && ((i.end = Object.assign({}, s)), o.push(["exit", i, n])),
    (r.end = Object.assign({}, s)),
    o.push(["exit", r, n]),
    e.add(t + 1, 0, o));
}
function pn(e, n) {
  let t = e[n],
    r = t[0] === "enter" ? "start" : "end";
  return t[1][r];
}
var jf = { name: "tasklistCheck", tokenize: Hf };
function lo() {
  return { text: { 91: jf } };
}
function Hf(e, n, t) {
  let r = this;
  return i;
  function i(l) {
    return r.previous !== null || !r._gfmTasklistFirstContentOfListItem
      ? t(l)
      : (e.enter("taskListCheck"),
        e.enter("taskListCheckMarker"),
        e.consume(l),
        e.exit("taskListCheckMarker"),
        o);
  }
  function o(l) {
    return oe(l)
      ? (e.enter("taskListCheckValueUnchecked"),
        e.consume(l),
        e.exit("taskListCheckValueUnchecked"),
        s)
      : l === 88 || l === 120
        ? (e.enter("taskListCheckValueChecked"),
          e.consume(l),
          e.exit("taskListCheckValueChecked"),
          s)
        : t(l);
  }
  function s(l) {
    return l === 93
      ? (e.enter("taskListCheckMarker"),
        e.consume(l),
        e.exit("taskListCheckMarker"),
        e.exit("taskListCheck"),
        a)
      : t(l);
  }
  function a(l) {
    return V(l) ? n(l) : Z(l) ? e.check({ tokenize: Wf }, n, t)(l) : t(l);
  }
}
function Wf(e, n, t) {
  return G(e, r, "whitespace");
  function r(i) {
    return i === null ? t(i) : n(i);
  }
}
function ga(e) {
  return lr([qi(), oo(), so(e), ao(), lo()]);
}
var qf = {};
function yr(e) {
  let n = this,
    t = e || qf,
    r = n.data(),
    i = r.micromarkExtensions || (r.micromarkExtensions = []),
    o = r.fromMarkdownExtensions || (r.fromMarkdownExtensions = []),
    s = r.toMarkdownExtensions || (r.toMarkdownExtensions = []);
  (i.push(ga(t)), o.push(ji()), s.push(Hi(t)));
}
var wa = { tokenize: Gf };
function Gf(e) {
  let n = e.attempt(this.parser.constructs.contentInitial, r, i),
    t;
  return n;
  function r(a) {
    if (a === null) {
      e.consume(a);
      return;
    }
    return (e.enter("lineEnding"), e.consume(a), e.exit("lineEnding"), G(e, n, "linePrefix"));
  }
  function i(a) {
    return (e.enter("paragraph"), o(a));
  }
  function o(a) {
    let l = e.enter("chunkText", { contentType: "text", previous: t });
    return (t && (t.next = l), (t = l), s(a));
  }
  function s(a) {
    if (a === null) {
      (e.exit("chunkText"), e.exit("paragraph"), e.consume(a));
      return;
    }
    return V(a) ? (e.consume(a), e.exit("chunkText"), o) : (e.consume(a), s);
  }
}
var ka = { tokenize: Yf },
  xa = { tokenize: Zf };
function Yf(e) {
  let n = this,
    t = [],
    r = 0,
    i,
    o,
    s;
  return a;
  function a(b) {
    if (r < t.length) {
      let I = t[r];
      return ((n.containerState = I[1]), e.attempt(I[0].continuation, l, u)(b));
    }
    return u(b);
  }
  function l(b) {
    if ((r++, n.containerState._closeFlow)) {
      ((n.containerState._closeFlow = void 0), i && S());
      let I = n.events.length,
        R = I,
        y;
      for (; R--;)
        if (n.events[R][0] === "exit" && n.events[R][1].type === "chunkFlow") {
          y = n.events[R][1].end;
          break;
        }
      g(r);
      let T = I;
      for (; T < n.events.length;) ((n.events[T][1].end = { ...y }), T++);
      return (ke(n.events, R + 1, 0, n.events.slice(I)), (n.events.length = T), u(b));
    }
    return a(b);
  }
  function u(b) {
    if (r === t.length) {
      if (!i) return f(b);
      if (i.currentConstruct && i.currentConstruct.concrete) return m(b);
      n.interrupt = !!(i.currentConstruct && !i._gfmTableDynamicInterruptHack);
    }
    return ((n.containerState = {}), e.check(xa, c, d)(b));
  }
  function c(b) {
    return (i && S(), g(r), f(b));
  }
  function d(b) {
    return ((n.parser.lazy[n.now().line] = r !== t.length), (s = n.now().offset), m(b));
  }
  function f(b) {
    return ((n.containerState = {}), e.attempt(xa, p, m)(b));
  }
  function p(b) {
    return (r++, t.push([n.currentConstruct, n.containerState]), f(b));
  }
  function m(b) {
    if (b === null) {
      (i && S(), g(0), e.consume(b));
      return;
    }
    return (
      (i = i || n.parser.flow(n.now())),
      e.enter("chunkFlow", { _tokenizer: i, contentType: "flow", previous: o }),
      h(b)
    );
  }
  function h(b) {
    if (b === null) {
      (w(e.exit("chunkFlow"), !0), g(0), e.consume(b));
      return;
    }
    return V(b)
      ? (e.consume(b), w(e.exit("chunkFlow")), (r = 0), (n.interrupt = void 0), a)
      : (e.consume(b), h);
  }
  function w(b, I) {
    let R = n.sliceStream(b);
    if (
      (I && R.push(null),
      (b.previous = o),
      o && (o.next = b),
      (o = b),
      i.defineSkip(b.start),
      i.write(R),
      n.parser.lazy[b.start.line])
    ) {
      let y = i.events.length;
      for (; y--;)
        if (
          i.events[y][1].start.offset < s &&
          (!i.events[y][1].end || i.events[y][1].end.offset > s)
        )
          return;
      let T = n.events.length,
        M = T,
        P,
        E;
      for (; M--;)
        if (n.events[M][0] === "exit" && n.events[M][1].type === "chunkFlow") {
          if (P) {
            E = n.events[M][1].end;
            break;
          }
          P = !0;
        }
      for (g(r), y = T; y < n.events.length;) ((n.events[y][1].end = { ...E }), y++);
      (ke(n.events, M + 1, 0, n.events.slice(T)), (n.events.length = y));
    }
  }
  function g(b) {
    let I = t.length;
    for (; I-- > b;) {
      let R = t[I];
      ((n.containerState = R[1]), R[0].exit.call(n, e));
    }
    t.length = b;
  }
  function S() {
    (i.write([null]), (o = void 0), (i = void 0), (n.containerState._closeFlow = void 0));
  }
}
function Zf(e, n, t) {
  return G(
    e,
    e.attempt(this.parser.constructs.document, n, t),
    "linePrefix",
    this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4,
  );
}
var ba = { tokenize: Kf };
function Kf(e) {
  let n = this,
    t = e.attempt(
      lt,
      r,
      e.attempt(
        this.parser.constructs.flowInitial,
        i,
        G(e, e.attempt(this.parser.constructs.flow, i, e.attempt(Ki, i)), "linePrefix"),
      ),
    );
  return t;
  function r(o) {
    if (o === null) {
      e.consume(o);
      return;
    }
    return (
      e.enter("lineEndingBlank"),
      e.consume(o),
      e.exit("lineEndingBlank"),
      (n.currentConstruct = void 0),
      t
    );
  }
  function i(o) {
    if (o === null) {
      e.consume(o);
      return;
    }
    return (
      e.enter("lineEnding"), e.consume(o), e.exit("lineEnding"), (n.currentConstruct = void 0), t
    );
  }
}
var ya = { resolveAll: Ia() },
  va = Ea("string"),
  Sa = Ea("text");
function Ea(e) {
  return { resolveAll: Ia(e === "text" ? Qf : void 0), tokenize: n };
  function n(t) {
    let r = this,
      i = this.parser.constructs[e],
      o = t.attempt(i, s, a);
    return s;
    function s(c) {
      return u(c) ? o(c) : a(c);
    }
    function a(c) {
      if (c === null) {
        t.consume(c);
        return;
      }
      return (t.enter("data"), t.consume(c), l);
    }
    function l(c) {
      return u(c) ? (t.exit("data"), o(c)) : (t.consume(c), l);
    }
    function u(c) {
      if (c === null) return !0;
      let d = i[c],
        f = -1;
      if (d)
        for (; ++f < d.length;) {
          let p = d[f];
          if (!p.previous || p.previous.call(r, r.previous)) return !0;
        }
      return !1;
    }
  }
}
function Ia(e) {
  return n;
  function n(t, r) {
    let i = -1,
      o;
    for (; ++i <= t.length;)
      o === void 0
        ? t[i] && t[i][1].type === "data" && ((o = i), i++)
        : (!t[i] || t[i][1].type !== "data") &&
          (i !== o + 2 &&
            ((t[o][1].end = t[i - 1][1].end), t.splice(o + 2, i - o - 2), (i = o + 2)),
          (o = void 0));
    return e ? e(t, r) : t;
  }
}
function Qf(e, n) {
  let t = 0;
  for (; ++t <= e.length;)
    if ((t === e.length || e[t][1].type === "lineEnding") && e[t - 1][1].type === "data") {
      let r = e[t - 1][1],
        i = n.sliceStream(r),
        o = i.length,
        s = -1,
        a = 0,
        l;
      for (; o--;) {
        let u = i[o];
        if (typeof u == "string") {
          for (s = u.length; u.charCodeAt(s - 1) === 32;) (a++, s--);
          if (s) break;
          s = -1;
        } else if (u === -2) ((l = !0), a++);
        else if (u !== -1) {
          o++;
          break;
        }
      }
      if ((n._contentTypeTextTrailing && t === e.length && (a = 0), a)) {
        let u = {
          type: t === e.length || l || a < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: o ? s : r.start._bufferIndex + s,
            _index: r.start._index + o,
            line: r.end.line,
            column: r.end.column - a,
            offset: r.end.offset - a,
          },
          end: { ...r.end },
        };
        ((r.end = { ...u.start }),
          r.start.offset === r.end.offset
            ? Object.assign(r, u)
            : (e.splice(t, 0, ["enter", u, n], ["exit", u, n]), (t += 2)));
      }
      t++;
    }
  return e;
}
var uo = {};
gs(uo, {
  attentionMarkers: () => op,
  contentInitial: () => Xf,
  disable: () => sp,
  document: () => Jf,
  flow: () => tp,
  flowInitial: () => ep,
  insideSpan: () => ip,
  string: () => np,
  text: () => rp,
});
var Jf = {
    42: Fe,
    43: Fe,
    45: Fe,
    48: Fe,
    49: Fe,
    50: Fe,
    51: Fe,
    52: Fe,
    53: Fe,
    54: Fe,
    55: Fe,
    56: Fe,
    57: Fe,
    62: ur,
  },
  Xf = { 91: Qi },
  ep = { [-2]: Ln, [-1]: Ln, 32: Ln },
  tp = { 35: Xi, 42: nn, 45: [xr, nn], 60: to, 61: xr, 95: nn, 96: fr, 126: fr },
  np = { 38: dr, 92: cr },
  rp = {
    [-5]: _n,
    [-4]: _n,
    [-3]: _n,
    33: ro,
    38: dr,
    42: $n,
    60: [Yi, no],
    91: io,
    92: [Ji, cr],
    93: tn,
    95: $n,
    96: Zi,
  },
  ip = { null: [$n, ya] },
  op = { null: [42, 95] },
  sp = { null: [] };
function Ca(e, n, t) {
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
    l = !0,
    u = {
      attempt: P(T),
      check: P(M),
      consume: I,
      enter: R,
      exit: y,
      interrupt: P(M, { interrupt: !0 }),
    },
    c = {
      code: null,
      containerState: {},
      defineSkip: g,
      events: [],
      now: w,
      parser: e,
      previous: null,
      sliceSerialize: m,
      sliceStream: h,
      write: p,
    },
    d = n.tokenize.call(c, u),
    f;
  return (n.resolveAll && o.push(n), c);
  function p(C) {
    return (
      (s = Oe(s, C)),
      S(),
      s[s.length - 1] !== null ? [] : (E(n, 0), (c.events = Nt(o, c.events, c)), c.events)
    );
  }
  function m(C, $) {
    return lp(h(C), $);
  }
  function h(C) {
    return ap(s, C);
  }
  function w() {
    let { _bufferIndex: C, _index: $, line: D, column: z, offset: ue } = r;
    return { _bufferIndex: C, _index: $, line: D, column: z, offset: ue };
  }
  function g(C) {
    ((i[C.line] = C.column), _());
  }
  function S() {
    let C;
    for (; r._index < s.length;) {
      let $ = s[r._index];
      if (typeof $ == "string")
        for (
          C = r._index, r._bufferIndex < 0 && (r._bufferIndex = 0);
          r._index === C && r._bufferIndex < $.length;
        )
          b($.charCodeAt(r._bufferIndex));
      else b($);
    }
  }
  function b(C) {
    ((l = void 0), (f = C), (d = d(C)));
  }
  function I(C) {
    (V(C)
      ? (r.line++, (r.column = 1), (r.offset += C === -3 ? 2 : 1), _())
      : C !== -1 && (r.column++, r.offset++),
      r._bufferIndex < 0
        ? r._index++
        : (r._bufferIndex++,
          r._bufferIndex === s[r._index].length && ((r._bufferIndex = -1), r._index++)),
      (c.previous = C),
      (l = !0));
  }
  function R(C, $) {
    let D = $ || {};
    return ((D.type = C), (D.start = w()), c.events.push(["enter", D, c]), a.push(D), D);
  }
  function y(C) {
    let $ = a.pop();
    return (($.end = w()), c.events.push(["exit", $, c]), $);
  }
  function T(C, $) {
    E(C, $.from);
  }
  function M(C, $) {
    $.restore();
  }
  function P(C, $) {
    return D;
    function D(z, ue, we) {
      let $e, x, H, ie;
      return Array.isArray(z) ? xe(z) : "tokenize" in z ? xe([z]) : k(z);
      function k(be) {
        return At;
        function At(v) {
          let B = v !== null && be[v],
            F = v !== null && be.null,
            L = [
              ...(Array.isArray(B) ? B : B ? [B] : []),
              ...(Array.isArray(F) ? F : F ? [F] : []),
            ];
          return xe(L)(v);
        }
      }
      function xe(be) {
        return (($e = be), (x = 0), be.length === 0 ? we : Pe(be[x]));
      }
      function Pe(be) {
        return At;
        function At(v) {
          return (
            (ie = U()),
            (H = be),
            be.partial || (c.currentConstruct = be),
            be.name && c.parser.constructs.disable.null.includes(be.name)
              ? He(v)
              : be.tokenize.call($ ? Object.assign(Object.create(c), $) : c, u, je, He)(v)
          );
        }
      }
      function je(be) {
        return ((l = !0), C(H, ie), ue);
      }
      function He(be) {
        return ((l = !0), ie.restore(), ++x < $e.length ? Pe($e[x]) : we);
      }
    }
  }
  function E(C, $) {
    (C.resolveAll && !o.includes(C) && o.push(C),
      C.resolve && ke(c.events, $, c.events.length - $, C.resolve(c.events.slice($), c)),
      C.resolveTo && (c.events = C.resolveTo(c.events, c)));
  }
  function U() {
    let C = w(),
      $ = c.previous,
      D = c.currentConstruct,
      z = c.events.length,
      ue = Array.from(a);
    return { from: z, restore: we };
    function we() {
      ((r = C), (c.previous = $), (c.currentConstruct = D), (c.events.length = z), (a = ue), _());
    }
  }
  function _() {
    r.line in i && r.column < 2 && ((r.column = i[r.line]), (r.offset += i[r.line] - 1));
  }
}
function ap(e, n) {
  let t = n.start._index,
    r = n.start._bufferIndex,
    i = n.end._index,
    o = n.end._bufferIndex,
    s;
  if (t === i) s = [e[t].slice(r, o)];
  else {
    if (((s = e.slice(t, i)), r > -1)) {
      let a = s[0];
      typeof a == "string" ? (s[0] = a.slice(r)) : s.shift();
    }
    o > 0 && s.push(e[i].slice(0, o));
  }
  return s;
}
function lp(e, n) {
  let t = -1,
    r = [],
    i;
  for (; ++t < e.length;) {
    let o = e[t],
      s;
    if (typeof o == "string") s = o;
    else
      switch (o) {
        case -5: {
          s = "\r";
          break;
        }
        case -4: {
          s = `
`;
          break;
        }
        case -3: {
          s = `\r
`;
          break;
        }
        case -2: {
          s = n ? " " : "	";
          break;
        }
        case -1: {
          if (!n && i) continue;
          s = " ";
          break;
        }
        default:
          s = String.fromCharCode(o);
      }
    ((i = o === -2), r.push(s));
  }
  return r.join("");
}
function co(e) {
  let r = {
    constructs: lr([uo, ...((e || {}).extensions || [])]),
    content: i(wa),
    defined: [],
    document: i(ka),
    flow: i(ba),
    lazy: {},
    string: i(va),
    text: i(Sa),
  };
  return r;
  function i(o) {
    return s;
    function s(a) {
      return Ca(r, o, a);
    }
  }
}
function fo(e) {
  for (; !mr(e););
  return e;
}
var Ta = /[\0\t\n\r]/g;
function po() {
  let e = 1,
    n = "",
    t = !0,
    r;
  return i;
  function i(o, s, a) {
    let l = [],
      u,
      c,
      d,
      f,
      p;
    for (
      o = n + (typeof o == "string" ? o.toString() : new TextDecoder(s || void 0).decode(o)),
        d = 0,
        n = "",
        t && (o.charCodeAt(0) === 65279 && d++, (t = void 0));
      d < o.length;
    ) {
      if (
        ((Ta.lastIndex = d),
        (u = Ta.exec(o)),
        (f = u && u.index !== void 0 ? u.index : o.length),
        (p = o.charCodeAt(f)),
        !u)
      ) {
        n = o.slice(d);
        break;
      }
      if (p === 10 && d === f && r) (l.push(-3), (r = void 0));
      else
        switch (
          (r && (l.push(-5), (r = void 0)), d < f && (l.push(o.slice(d, f)), (e += f - d)), p)
        ) {
          case 0: {
            (l.push(65533), e++);
            break;
          }
          case 9: {
            for (c = Math.ceil(e / 4) * 4, l.push(-2); e++ < c;) l.push(-1);
            break;
          }
          case 10: {
            (l.push(-4), (e = 1));
            break;
          }
          default:
            ((r = !0), (e = 1));
        }
      d = f + 1;
    }
    return (a && (r && l.push(-5), n && l.push(n), l.push(null)), l);
  }
}
function Dt(e) {
  return !e || typeof e != "object"
    ? ""
    : "position" in e || "type" in e
      ? Aa(e.position)
      : "start" in e || "end" in e
        ? Aa(e)
        : "line" in e || "column" in e
          ? mo(e)
          : "";
}
function mo(e) {
  return Ra(e && e.line) + ":" + Ra(e && e.column);
}
function Aa(e) {
  return mo(e && e.start) + "-" + mo(e && e.end);
}
function Ra(e) {
  return e && typeof e == "number" ? e : 1;
}
var Ma = {}.hasOwnProperty;
function ho(e, n, t) {
  return (
    n && typeof n == "object" && ((t = n), (n = void 0)),
    up(t)(
      fo(
        co(t)
          .document()
          .write(po()(e, n, !0)),
      ),
    )
  );
}
function up(e) {
  let n = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: o(ye),
      autolinkProtocol: P,
      autolinkEmail: P,
      atxHeading: o(j),
      blockQuote: o(v),
      characterEscape: P,
      characterReference: P,
      codeFenced: o(B),
      codeFencedFenceInfo: s,
      codeFencedFenceMeta: s,
      codeIndented: o(B, s),
      codeText: o(F, s),
      codeTextData: P,
      data: P,
      codeFlowValue: P,
      definition: o(L),
      definitionDestinationString: s,
      definitionLabelString: s,
      definitionTitleString: s,
      emphasis: o(X),
      hardBreakEscape: o(de),
      hardBreakTrailing: o(de),
      htmlFlow: o(ne, s),
      htmlFlowData: P,
      htmlText: o(ne, s),
      htmlTextData: P,
      image: o(Ie),
      label: s,
      link: o(ye),
      listItem: o(gt),
      listItemValue: f,
      listOrdered: o(fe, d),
      listUnordered: o(fe),
      paragraph: o(Rt),
      reference: k,
      referenceString: s,
      resourceDestinationString: s,
      resourceTitleString: s,
      setextHeading: o(j),
      strong: o(nr),
      thematicBreak: o(Le),
    },
    exit: {
      atxHeading: l(),
      atxHeadingSequence: R,
      autolink: l(),
      autolinkEmail: At,
      autolinkProtocol: be,
      blockQuote: l(),
      characterEscapeValue: E,
      characterReferenceMarkerHexadecimal: Pe,
      characterReferenceMarkerNumeric: Pe,
      characterReferenceValue: je,
      characterReference: He,
      codeFenced: l(w),
      codeFencedFence: h,
      codeFencedFenceInfo: p,
      codeFencedFenceMeta: m,
      codeFlowValue: E,
      codeIndented: l(g),
      codeText: l(D),
      codeTextData: E,
      data: E,
      definition: l(),
      definitionDestinationString: I,
      definitionLabelString: S,
      definitionTitleString: b,
      emphasis: l(),
      hardBreakEscape: l(_),
      hardBreakTrailing: l(_),
      htmlFlow: l(C),
      htmlFlowData: E,
      htmlText: l($),
      htmlTextData: E,
      image: l(ue),
      label: $e,
      labelText: we,
      lineEnding: U,
      link: l(z),
      listItem: l(),
      listOrdered: l(),
      listUnordered: l(),
      paragraph: l(),
      referenceString: xe,
      resourceDestinationString: x,
      resourceTitleString: H,
      resource: ie,
      setextHeading: l(M),
      setextHeadingLineSequence: T,
      setextHeadingText: y,
      strong: l(),
      thematicBreak: l(),
    },
  };
  Fa(n, (e || {}).mdastExtensions || []);
  let t = {};
  return r;
  function r(A) {
    let O = { type: "root", children: [] },
      Q = {
        stack: [O],
        tokenStack: [],
        config: n,
        enter: a,
        exit: u,
        buffer: s,
        resume: c,
        data: t,
      },
      se = [],
      pe = -1;
    for (; ++pe < A.length;)
      if (A[pe][1].type === "listOrdered" || A[pe][1].type === "listUnordered")
        if (A[pe][0] === "enter") se.push(pe);
        else {
          let tt = se.pop();
          pe = i(A, tt, pe);
        }
    for (pe = -1; ++pe < A.length;) {
      let tt = n[A[pe][0]];
      Ma.call(tt, A[pe][1].type) &&
        tt[A[pe][1].type].call(
          Object.assign({ sliceSerialize: A[pe][2].sliceSerialize }, Q),
          A[pe][1],
        );
    }
    if (Q.tokenStack.length > 0) {
      let tt = Q.tokenStack[Q.tokenStack.length - 1];
      (tt[1] || Pa).call(Q, void 0, tt[0]);
    }
    for (
      O.position = {
        start: $t(A.length > 0 ? A[0][1].start : { line: 1, column: 1, offset: 0 }),
        end: $t(A.length > 0 ? A[A.length - 2][1].end : { line: 1, column: 1, offset: 0 }),
      },
        pe = -1;
      ++pe < n.transforms.length;
    )
      O = n.transforms[pe](O) || O;
    return O;
  }
  function i(A, O, Q) {
    let se = O - 1,
      pe = -1,
      tt = !1,
      Yt,
      wt,
      Rn,
      Pn;
    for (; ++se <= Q;) {
      let We = A[se];
      switch (We[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          (We[0] === "enter" ? pe++ : pe--, (Pn = void 0));
          break;
        }
        case "lineEndingBlank": {
          We[0] === "enter" && (Yt && !Pn && !pe && !Rn && (Rn = se), (Pn = void 0));
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace":
          break;
        default:
          Pn = void 0;
      }
      if (
        (!pe && We[0] === "enter" && We[1].type === "listItemPrefix") ||
        (pe === -1 &&
          We[0] === "exit" &&
          (We[1].type === "listUnordered" || We[1].type === "listOrdered"))
      ) {
        if (Yt) {
          let ln = se;
          for (wt = void 0; ln--;) {
            let xt = A[ln];
            if (xt[1].type === "lineEnding" || xt[1].type === "lineEndingBlank") {
              if (xt[0] === "exit") continue;
              (wt && ((A[wt][1].type = "lineEndingBlank"), (tt = !0)),
                (xt[1].type = "lineEnding"),
                (wt = ln));
            } else if (
              !(
                xt[1].type === "linePrefix" ||
                xt[1].type === "blockQuotePrefix" ||
                xt[1].type === "blockQuotePrefixWhitespace" ||
                xt[1].type === "blockQuoteMarker" ||
                xt[1].type === "listItemIndent"
              )
            )
              break;
          }
          (Rn && (!wt || Rn < wt) && (Yt._spread = !0),
            (Yt.end = Object.assign({}, wt ? A[wt][1].start : We[1].end)),
            A.splice(wt || se, 0, ["exit", Yt, We[2]]),
            se++,
            Q++);
        }
        if (We[1].type === "listItemPrefix") {
          let ln = {
            type: "listItem",
            _spread: !1,
            start: Object.assign({}, We[1].start),
            end: void 0,
          };
          ((Yt = ln), A.splice(se, 0, ["enter", ln, We[2]]), se++, Q++, (Rn = void 0), (Pn = !0));
        }
      }
    }
    return ((A[O][1]._spread = tt), Q);
  }
  function o(A, O) {
    return Q;
    function Q(se) {
      (a.call(this, A(se), se), O && O.call(this, se));
    }
  }
  function s() {
    this.stack.push({ type: "fragment", children: [] });
  }
  function a(A, O, Q) {
    (this.stack[this.stack.length - 1].children.push(A),
      this.stack.push(A),
      this.tokenStack.push([O, Q || void 0]),
      (A.position = { start: $t(O.start), end: void 0 }));
  }
  function l(A) {
    return O;
    function O(Q) {
      (A && A.call(this, Q), u.call(this, Q));
    }
  }
  function u(A, O) {
    let Q = this.stack.pop(),
      se = this.tokenStack.pop();
    if (se)
      se[0].type !== A.type && (O ? O.call(this, A, se[0]) : (se[1] || Pa).call(this, A, se[0]));
    else
      throw new Error(
        "Cannot close `" +
          A.type +
          "` (" +
          Dt({ start: A.start, end: A.end }) +
          "): it\u2019s not open",
      );
    Q.position.end = $t(A.end);
  }
  function c() {
    return Jt(this.stack.pop());
  }
  function d() {
    this.data.expectingFirstListItemValue = !0;
  }
  function f(A) {
    if (this.data.expectingFirstListItemValue) {
      let O = this.stack[this.stack.length - 2];
      ((O.start = Number.parseInt(this.sliceSerialize(A), 10)),
        (this.data.expectingFirstListItemValue = void 0));
    }
  }
  function p() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.lang = A;
  }
  function m() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.meta = A;
  }
  function h() {
    this.data.flowCodeInside || (this.buffer(), (this.data.flowCodeInside = !0));
  }
  function w() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    ((O.value = A.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "")), (this.data.flowCodeInside = void 0));
  }
  function g() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.value = A.replace(/(\r?\n|\r)$/g, "");
  }
  function S(A) {
    let O = this.resume(),
      Q = this.stack[this.stack.length - 1];
    ((Q.label = O), (Q.identifier = Me(this.sliceSerialize(A)).toLowerCase()));
  }
  function b() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.title = A;
  }
  function I() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.url = A;
  }
  function R(A) {
    let O = this.stack[this.stack.length - 1];
    if (!O.depth) {
      let Q = this.sliceSerialize(A).length;
      O.depth = Q;
    }
  }
  function y() {
    this.data.setextHeadingSlurpLineEnding = !0;
  }
  function T(A) {
    let O = this.stack[this.stack.length - 1];
    O.depth = this.sliceSerialize(A).codePointAt(0) === 61 ? 1 : 2;
  }
  function M() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function P(A) {
    let Q = this.stack[this.stack.length - 1].children,
      se = Q[Q.length - 1];
    ((!se || se.type !== "text") &&
      ((se = Qe()), (se.position = { start: $t(A.start), end: void 0 }), Q.push(se)),
      this.stack.push(se));
  }
  function E(A) {
    let O = this.stack.pop();
    ((O.value += this.sliceSerialize(A)), (O.position.end = $t(A.end)));
  }
  function U(A) {
    let O = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      let Q = O.children[O.children.length - 1];
      ((Q.position.end = $t(A.end)), (this.data.atHardBreak = void 0));
      return;
    }
    !this.data.setextHeadingSlurpLineEnding &&
      n.canContainEols.includes(O.type) &&
      (P.call(this, A), E.call(this, A));
  }
  function _() {
    this.data.atHardBreak = !0;
  }
  function C() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.value = A;
  }
  function $() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.value = A;
  }
  function D() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.value = A;
  }
  function z() {
    let A = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      let O = this.data.referenceType || "shortcut";
      ((A.type += "Reference"), (A.referenceType = O), delete A.url, delete A.title);
    } else (delete A.identifier, delete A.label);
    this.data.referenceType = void 0;
  }
  function ue() {
    let A = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      let O = this.data.referenceType || "shortcut";
      ((A.type += "Reference"), (A.referenceType = O), delete A.url, delete A.title);
    } else (delete A.identifier, delete A.label);
    this.data.referenceType = void 0;
  }
  function we(A) {
    let O = this.sliceSerialize(A),
      Q = this.stack[this.stack.length - 2];
    ((Q.label = Xs(O)), (Q.identifier = Me(O).toLowerCase()));
  }
  function $e() {
    let A = this.stack[this.stack.length - 1],
      O = this.resume(),
      Q = this.stack[this.stack.length - 1];
    if (((this.data.inReference = !0), Q.type === "link")) {
      let se = A.children;
      Q.children = se;
    } else Q.alt = O;
  }
  function x() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.url = A;
  }
  function H() {
    let A = this.resume(),
      O = this.stack[this.stack.length - 1];
    O.title = A;
  }
  function ie() {
    this.data.inReference = void 0;
  }
  function k() {
    this.data.referenceType = "collapsed";
  }
  function xe(A) {
    let O = this.resume(),
      Q = this.stack[this.stack.length - 1];
    ((Q.label = O),
      (Q.identifier = Me(this.sliceSerialize(A)).toLowerCase()),
      (this.data.referenceType = "full"));
  }
  function Pe(A) {
    this.data.characterReferenceType = A.type;
  }
  function je(A) {
    let O = this.sliceSerialize(A),
      Q = this.data.characterReferenceType,
      se;
    Q
      ? ((se = ar(O, Q === "characterReferenceMarkerNumeric" ? 10 : 16)),
        (this.data.characterReferenceType = void 0))
      : (se = fn(O));
    let pe = this.stack[this.stack.length - 1];
    pe.value += se;
  }
  function He(A) {
    let O = this.stack.pop();
    O.position.end = $t(A.end);
  }
  function be(A) {
    E.call(this, A);
    let O = this.stack[this.stack.length - 1];
    O.url = this.sliceSerialize(A);
  }
  function At(A) {
    E.call(this, A);
    let O = this.stack[this.stack.length - 1];
    O.url = "mailto:" + this.sliceSerialize(A);
  }
  function v() {
    return { type: "blockquote", children: [] };
  }
  function B() {
    return { type: "code", lang: null, meta: null, value: "" };
  }
  function F() {
    return { type: "inlineCode", value: "" };
  }
  function L() {
    return { type: "definition", identifier: "", label: null, title: null, url: "" };
  }
  function X() {
    return { type: "emphasis", children: [] };
  }
  function j() {
    return { type: "heading", depth: 0, children: [] };
  }
  function de() {
    return { type: "break" };
  }
  function ne() {
    return { type: "html", value: "" };
  }
  function Ie() {
    return { type: "image", title: null, url: "", alt: null };
  }
  function ye() {
    return { type: "link", title: null, url: "", children: [] };
  }
  function fe(A) {
    return {
      type: "list",
      ordered: A.type === "listOrdered",
      start: null,
      spread: A._spread,
      children: [],
    };
  }
  function gt(A) {
    return { type: "listItem", spread: A._spread, checked: null, children: [] };
  }
  function Rt() {
    return { type: "paragraph", children: [] };
  }
  function nr() {
    return { type: "strong", children: [] };
  }
  function Qe() {
    return { type: "text", value: "" };
  }
  function Le() {
    return { type: "thematicBreak" };
  }
}
function $t(e) {
  return { line: e.line, column: e.column, offset: e.offset };
}
function Fa(e, n) {
  let t = -1;
  for (; ++t < n.length;) {
    let r = n[t];
    Array.isArray(r) ? Fa(e, r) : cp(e, r);
  }
}
function cp(e, n) {
  let t;
  for (t in n)
    if (Ma.call(n, t))
      switch (t) {
        case "canContainEols": {
          let r = n[t];
          r && e[t].push(...r);
          break;
        }
        case "transforms": {
          let r = n[t];
          r && e[t].push(...r);
          break;
        }
        case "enter":
        case "exit": {
          let r = n[t];
          r && Object.assign(e[t], r);
          break;
        }
      }
}
function Pa(e, n) {
  throw e
    ? new Error(
        "Cannot close `" +
          e.type +
          "` (" +
          Dt({ start: e.start, end: e.end }) +
          "): a different token (`" +
          n.type +
          "`, " +
          Dt({ start: n.start, end: n.end }) +
          ") is open",
      )
    : new Error(
        "Cannot close document, a token (`" +
          n.type +
          "`, " +
          Dt({ start: n.start, end: n.end }) +
          ") is still open",
      );
}
function vr(e) {
  let n = this;
  n.parser = t;
  function t(r) {
    return ho(r, {
      ...n.data("settings"),
      ...e,
      extensions: n.data("micromarkExtensions") || [],
      mdastExtensions: n.data("fromMarkdownExtensions") || [],
    });
  }
}
function go(e) {
  if (e) throw e;
}
var Ir = fc(za(), 1);
function Vn(e) {
  if (typeof e != "object" || e === null) return !1;
  let n = Object.getPrototypeOf(e);
  return (
    (n === null || n === Object.prototype || Object.getPrototypeOf(n) === null) &&
    !(Symbol.toStringTag in e) &&
    !(Symbol.iterator in e)
  );
}
function wo() {
  let e = [],
    n = { run: t, use: r };
  return n;
  function t(...i) {
    let o = -1,
      s = i.pop();
    if (typeof s != "function") throw new TypeError("Expected function as last argument, not " + s);
    a(null, ...i);
    function a(l, ...u) {
      let c = e[++o],
        d = -1;
      if (l) {
        s(l);
        return;
      }
      for (; ++d < i.length;) (u[d] === null || u[d] === void 0) && (u[d] = i[d]);
      ((i = u), c ? Ua(c, a)(...u) : s(null, ...u));
    }
  }
  function r(i) {
    if (typeof i != "function")
      throw new TypeError("Expected `middelware` to be a function, not " + i);
    return (e.push(i), n);
  }
}
function Ua(e, n) {
  let t;
  return r;
  function r(...s) {
    let a = e.length > s.length,
      l;
    a && s.push(i);
    try {
      l = e.apply(this, s);
    } catch (u) {
      let c = u;
      if (a && t) throw c;
      return i(c);
    }
    a ||
      (l && l.then && typeof l.then == "function"
        ? l.then(o, i)
        : l instanceof Error
          ? i(l)
          : o(l));
  }
  function i(s, ...a) {
    t || ((t = !0), n(s, ...a));
  }
  function o(s) {
    i(null, s);
  }
}
var Ce = class extends Error {
  constructor(n, t, r) {
    (super(), typeof t == "string" && ((r = t), (t = void 0)));
    let i = "",
      o = {},
      s = !1;
    if (
      (t &&
        ("line" in t && "column" in t
          ? (o = { place: t })
          : "start" in t && "end" in t
            ? (o = { place: t })
            : "type" in t
              ? (o = { ancestors: [t], place: t.position })
              : (o = { ...t })),
      typeof n == "string" ? (i = n) : !o.cause && n && ((s = !0), (i = n.message), (o.cause = n)),
      !o.ruleId && !o.source && typeof r == "string")
    ) {
      let l = r.indexOf(":");
      l === -1 ? (o.ruleId = r) : ((o.source = r.slice(0, l)), (o.ruleId = r.slice(l + 1)));
    }
    if (!o.place && o.ancestors && o.ancestors) {
      let l = o.ancestors[o.ancestors.length - 1];
      l && (o.place = l.position);
    }
    let a = o.place && "start" in o.place ? o.place.start : o.place;
    ((this.ancestors = o.ancestors || void 0),
      (this.cause = o.cause || void 0),
      (this.column = a ? a.column : void 0),
      (this.fatal = void 0),
      (this.file = ""),
      (this.message = i),
      (this.line = a ? a.line : void 0),
      (this.name = Dt(o.place) || "1:1"),
      (this.place = o.place || void 0),
      (this.reason = this.message),
      (this.ruleId = o.ruleId || void 0),
      (this.source = o.source || void 0),
      (this.stack = s && o.cause && typeof o.cause.stack == "string" ? o.cause.stack : ""),
      (this.actual = void 0),
      (this.expected = void 0),
      (this.note = void 0),
      (this.url = void 0));
  }
};
Ce.prototype.file = "";
Ce.prototype.name = "";
Ce.prototype.reason = "";
Ce.prototype.message = "";
Ce.prototype.stack = "";
Ce.prototype.column = void 0;
Ce.prototype.line = void 0;
Ce.prototype.ancestors = void 0;
Ce.prototype.cause = void 0;
Ce.prototype.fatal = void 0;
Ce.prototype.place = void 0;
Ce.prototype.ruleId = void 0;
Ce.prototype.source = void 0;
var nt = { basename: dp, dirname: fp, extname: pp, join: mp, sep: "/" };
function dp(e, n) {
  if (n !== void 0 && typeof n != "string") throw new TypeError('"ext" argument must be a string');
  Bn(e);
  let t = 0,
    r = -1,
    i = e.length,
    o;
  if (n === void 0 || n.length === 0 || n.length > e.length) {
    for (; i--;)
      if (e.codePointAt(i) === 47) {
        if (o) {
          t = i + 1;
          break;
        }
      } else r < 0 && ((o = !0), (r = i + 1));
    return r < 0 ? "" : e.slice(t, r);
  }
  if (n === e) return "";
  let s = -1,
    a = n.length - 1;
  for (; i--;)
    if (e.codePointAt(i) === 47) {
      if (o) {
        t = i + 1;
        break;
      }
    } else
      (s < 0 && ((o = !0), (s = i + 1)),
        a > -1 &&
          (e.codePointAt(i) === n.codePointAt(a--) ? a < 0 && (r = i) : ((a = -1), (r = s))));
  return (t === r ? (r = s) : r < 0 && (r = e.length), e.slice(t, r));
}
function fp(e) {
  if ((Bn(e), e.length === 0)) return ".";
  let n = -1,
    t = e.length,
    r;
  for (; --t;)
    if (e.codePointAt(t) === 47) {
      if (r) {
        n = t;
        break;
      }
    } else r || (r = !0);
  return n < 0
    ? e.codePointAt(0) === 47
      ? "/"
      : "."
    : n === 1 && e.codePointAt(0) === 47
      ? "//"
      : e.slice(0, n);
}
function pp(e) {
  Bn(e);
  let n = e.length,
    t = -1,
    r = 0,
    i = -1,
    o = 0,
    s;
  for (; n--;) {
    let a = e.codePointAt(n);
    if (a === 47) {
      if (s) {
        r = n + 1;
        break;
      }
      continue;
    }
    (t < 0 && ((s = !0), (t = n + 1)),
      a === 46 ? (i < 0 ? (i = n) : o !== 1 && (o = 1)) : i > -1 && (o = -1));
  }
  return i < 0 || t < 0 || o === 0 || (o === 1 && i === t - 1 && i === r + 1) ? "" : e.slice(i, t);
}
function mp(...e) {
  let n = -1,
    t;
  for (; ++n < e.length;) (Bn(e[n]), e[n] && (t = t === void 0 ? e[n] : t + "/" + e[n]));
  return t === void 0 ? "." : hp(t);
}
function hp(e) {
  Bn(e);
  let n = e.codePointAt(0) === 47,
    t = gp(e, !n);
  return (
    t.length === 0 && !n && (t = "."),
    t.length > 0 && e.codePointAt(e.length - 1) === 47 && (t += "/"),
    n ? "/" + t : t
  );
}
function gp(e, n) {
  let t = "",
    r = 0,
    i = -1,
    o = 0,
    s = -1,
    a,
    l;
  for (; ++s <= e.length;) {
    if (s < e.length) a = e.codePointAt(s);
    else {
      if (a === 47) break;
      a = 47;
    }
    if (a === 47) {
      if (!(i === s - 1 || o === 1))
        if (i !== s - 1 && o === 2) {
          if (
            t.length < 2 ||
            r !== 2 ||
            t.codePointAt(t.length - 1) !== 46 ||
            t.codePointAt(t.length - 2) !== 46
          ) {
            if (t.length > 2) {
              if (((l = t.lastIndexOf("/")), l !== t.length - 1)) {
                (l < 0
                  ? ((t = ""), (r = 0))
                  : ((t = t.slice(0, l)), (r = t.length - 1 - t.lastIndexOf("/"))),
                  (i = s),
                  (o = 0));
                continue;
              }
            } else if (t.length > 0) {
              ((t = ""), (r = 0), (i = s), (o = 0));
              continue;
            }
          }
          n && ((t = t.length > 0 ? t + "/.." : ".."), (r = 2));
        } else
          (t.length > 0 ? (t += "/" + e.slice(i + 1, s)) : (t = e.slice(i + 1, s)),
            (r = s - i - 1));
      ((i = s), (o = 0));
    } else a === 46 && o > -1 ? o++ : (o = -1);
  }
  return t;
}
function Bn(e) {
  if (typeof e != "string")
    throw new TypeError("Path must be a string. Received " + JSON.stringify(e));
}
var ja = { cwd: wp };
function wp() {
  return "/";
}
function mn(e) {
  return !!(
    e !== null &&
    typeof e == "object" &&
    "href" in e &&
    e.href &&
    "protocol" in e &&
    e.protocol &&
    e.auth === void 0
  );
}
function Ha(e) {
  if (typeof e == "string") e = new URL(e);
  else if (!mn(e)) {
    let n = new TypeError(
      'The "path" argument must be of type string or an instance of URL. Received `' + e + "`",
    );
    throw ((n.code = "ERR_INVALID_ARG_TYPE"), n);
  }
  if (e.protocol !== "file:") {
    let n = new TypeError("The URL must be of scheme file");
    throw ((n.code = "ERR_INVALID_URL_SCHEME"), n);
  }
  return xp(e);
}
function xp(e) {
  if (e.hostname !== "") {
    let r = new TypeError('File URL host must be "localhost" or empty on darwin');
    throw ((r.code = "ERR_INVALID_FILE_URL_HOST"), r);
  }
  let n = e.pathname,
    t = -1;
  for (; ++t < n.length;)
    if (n.codePointAt(t) === 37 && n.codePointAt(t + 1) === 50) {
      let r = n.codePointAt(t + 2);
      if (r === 70 || r === 102) {
        let i = new TypeError("File URL path must not include encoded / characters");
        throw ((i.code = "ERR_INVALID_FILE_URL_PATH"), i);
      }
    }
  return decodeURIComponent(n);
}
var xo = ["history", "path", "basename", "stem", "extname", "dirname"],
  zn = class {
    constructor(n) {
      let t;
      (n
        ? mn(n)
          ? (t = { path: n })
          : typeof n == "string" || kp(n)
            ? (t = { value: n })
            : (t = n)
        : (t = {}),
        (this.cwd = "cwd" in t ? "" : ja.cwd()),
        (this.data = {}),
        (this.history = []),
        (this.messages = []),
        this.value,
        this.map,
        this.result,
        this.stored);
      let r = -1;
      for (; ++r < xo.length;) {
        let o = xo[r];
        o in t &&
          t[o] !== void 0 &&
          t[o] !== null &&
          (this[o] = o === "history" ? [...t[o]] : t[o]);
      }
      let i;
      for (i in t) xo.includes(i) || (this[i] = t[i]);
    }
    get basename() {
      return typeof this.path == "string" ? nt.basename(this.path) : void 0;
    }
    set basename(n) {
      (bo(n, "basename"), ko(n, "basename"), (this.path = nt.join(this.dirname || "", n)));
    }
    get dirname() {
      return typeof this.path == "string" ? nt.dirname(this.path) : void 0;
    }
    set dirname(n) {
      (Wa(this.basename, "dirname"), (this.path = nt.join(n || "", this.basename)));
    }
    get extname() {
      return typeof this.path == "string" ? nt.extname(this.path) : void 0;
    }
    set extname(n) {
      if ((ko(n, "extname"), Wa(this.dirname, "extname"), n)) {
        if (n.codePointAt(0) !== 46) throw new Error("`extname` must start with `.`");
        if (n.includes(".", 1)) throw new Error("`extname` cannot contain multiple dots");
      }
      this.path = nt.join(this.dirname, this.stem + (n || ""));
    }
    get path() {
      return this.history[this.history.length - 1];
    }
    set path(n) {
      (mn(n) && (n = Ha(n)), bo(n, "path"), this.path !== n && this.history.push(n));
    }
    get stem() {
      return typeof this.path == "string" ? nt.basename(this.path, this.extname) : void 0;
    }
    set stem(n) {
      (bo(n, "stem"),
        ko(n, "stem"),
        (this.path = nt.join(this.dirname || "", n + (this.extname || ""))));
    }
    fail(n, t, r) {
      let i = this.message(n, t, r);
      throw ((i.fatal = !0), i);
    }
    info(n, t, r) {
      let i = this.message(n, t, r);
      return ((i.fatal = void 0), i);
    }
    message(n, t, r) {
      let i = new Ce(n, t, r);
      return (
        this.path && ((i.name = this.path + ":" + i.name), (i.file = this.path)),
        (i.fatal = !1),
        this.messages.push(i),
        i
      );
    }
    toString(n) {
      return this.value === void 0
        ? ""
        : typeof this.value == "string"
          ? this.value
          : new TextDecoder(n || void 0).decode(this.value);
    }
  };
function ko(e, n) {
  if (e && e.includes(nt.sep))
    throw new Error("`" + n + "` cannot be a path: did not expect `" + nt.sep + "`");
}
function bo(e, n) {
  if (!e) throw new Error("`" + n + "` cannot be empty");
}
function Wa(e, n) {
  if (!e) throw new Error("Setting `" + n + "` requires `path` to be set too");
}
function kp(e) {
  return !!(e && typeof e == "object" && "byteLength" in e && "byteOffset" in e);
}
var qa = function (e) {
  let r = this.constructor.prototype,
    i = r[e],
    o = function () {
      return i.apply(o, arguments);
    };
  return (Object.setPrototypeOf(o, r), o);
};
var bp = {}.hasOwnProperty,
  Eo = class e extends qa {
    constructor() {
      (super("copy"),
        (this.Compiler = void 0),
        (this.Parser = void 0),
        (this.attachers = []),
        (this.compiler = void 0),
        (this.freezeIndex = -1),
        (this.frozen = void 0),
        (this.namespace = {}),
        (this.parser = void 0),
        (this.transformers = wo()));
    }
    copy() {
      let n = new e(),
        t = -1;
      for (; ++t < this.attachers.length;) {
        let r = this.attachers[t];
        n.use(...r);
      }
      return (n.data((0, Ir.default)(!0, {}, this.namespace)), n);
    }
    data(n, t) {
      return typeof n == "string"
        ? arguments.length === 2
          ? (So("data", this.frozen), (this.namespace[n] = t), this)
          : (bp.call(this.namespace, n) && this.namespace[n]) || void 0
        : n
          ? (So("data", this.frozen), (this.namespace = n), this)
          : this.namespace;
    }
    freeze() {
      if (this.frozen) return this;
      let n = this;
      for (; ++this.freezeIndex < this.attachers.length;) {
        let [t, ...r] = this.attachers[this.freezeIndex];
        if (r[0] === !1) continue;
        r[0] === !0 && (r[0] = void 0);
        let i = t.call(n, ...r);
        typeof i == "function" && this.transformers.use(i);
      }
      return ((this.frozen = !0), (this.freezeIndex = Number.POSITIVE_INFINITY), this);
    }
    parse(n) {
      this.freeze();
      let t = Er(n),
        r = this.parser || this.Parser;
      return (yo("parse", r), r(String(t), t));
    }
    process(n, t) {
      let r = this;
      return (
        this.freeze(),
        yo("process", this.parser || this.Parser),
        vo("process", this.compiler || this.Compiler),
        t ? i(void 0, t) : new Promise(i)
      );
      function i(o, s) {
        let a = Er(n),
          l = r.parse(a);
        r.run(l, a, function (c, d, f) {
          if (c || !d || !f) return u(c);
          let p = d,
            m = r.stringify(p, f);
          (vp(m) ? (f.value = m) : (f.result = m), u(c, f));
        });
        function u(c, d) {
          c || !d ? s(c) : o ? o(d) : t(void 0, d);
        }
      }
    }
    processSync(n) {
      let t = !1,
        r;
      return (
        this.freeze(),
        yo("processSync", this.parser || this.Parser),
        vo("processSync", this.compiler || this.Compiler),
        this.process(n, i),
        Ya("processSync", "process", t),
        r
      );
      function i(o, s) {
        ((t = !0), go(o), (r = s));
      }
    }
    run(n, t, r) {
      (Ga(n), this.freeze());
      let i = this.transformers;
      return (
        !r && typeof t == "function" && ((r = t), (t = void 0)), r ? o(void 0, r) : new Promise(o)
      );
      function o(s, a) {
        let l = Er(t);
        i.run(n, l, u);
        function u(c, d, f) {
          let p = d || n;
          c ? a(c) : s ? s(p) : r(void 0, p, f);
        }
      }
    }
    runSync(n, t) {
      let r = !1,
        i;
      return (this.run(n, t, o), Ya("runSync", "run", r), i);
      function o(s, a) {
        (go(s), (i = a), (r = !0));
      }
    }
    stringify(n, t) {
      this.freeze();
      let r = Er(t),
        i = this.compiler || this.Compiler;
      return (vo("stringify", i), Ga(n), i(n, r));
    }
    use(n, ...t) {
      let r = this.attachers,
        i = this.namespace;
      if ((So("use", this.frozen), n != null))
        if (typeof n == "function") l(n, t);
        else if (typeof n == "object") Array.isArray(n) ? a(n) : s(n);
        else throw new TypeError("Expected usable value, not `" + n + "`");
      return this;
      function o(u) {
        if (typeof u == "function") l(u, []);
        else if (typeof u == "object")
          if (Array.isArray(u)) {
            let [c, ...d] = u;
            l(c, d);
          } else s(u);
        else throw new TypeError("Expected usable value, not `" + u + "`");
      }
      function s(u) {
        if (!("plugins" in u) && !("settings" in u))
          throw new Error(
            "Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither",
          );
        (a(u.plugins), u.settings && (i.settings = (0, Ir.default)(!0, i.settings, u.settings)));
      }
      function a(u) {
        let c = -1;
        if (u != null)
          if (Array.isArray(u))
            for (; ++c < u.length;) {
              let d = u[c];
              o(d);
            }
          else throw new TypeError("Expected a list of plugins, not `" + u + "`");
      }
      function l(u, c) {
        let d = -1,
          f = -1;
        for (; ++d < r.length;)
          if (r[d][0] === u) {
            f = d;
            break;
          }
        if (f === -1) r.push([u, ...c]);
        else if (c.length > 0) {
          let [p, ...m] = c,
            h = r[f][1];
          (Vn(h) && Vn(p) && (p = (0, Ir.default)(!0, h, p)), (r[f] = [u, p, ...m]));
        }
      }
    }
  },
  Io = new Eo().freeze();
function yo(e, n) {
  if (typeof n != "function") throw new TypeError("Cannot `" + e + "` without `parser`");
}
function vo(e, n) {
  if (typeof n != "function") throw new TypeError("Cannot `" + e + "` without `compiler`");
}
function So(e, n) {
  if (n)
    throw new Error(
      "Cannot call `" +
        e +
        "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.",
    );
}
function Ga(e) {
  if (!Vn(e) || typeof e.type != "string") throw new TypeError("Expected node, got `" + e + "`");
}
function Ya(e, n, t) {
  if (!t) throw new Error("`" + e + "` finished async. Use `" + n + "` instead");
}
function Er(e) {
  return yp(e) ? e : new zn(e);
}
function yp(e) {
  return !!(e && typeof e == "object" && "message" in e && "messages" in e);
}
function vp(e) {
  return typeof e == "string" || Sp(e);
}
function Sp(e) {
  return !!(e && typeof e == "object" && "byteLength" in e && "byteOffset" in e);
}
function Za(e, n) {
  let t = [],
    r = 0,
    i = e.split(`
`);
  for (let o of i) {
    let s = Ep(o),
      a = o.slice(0, s),
      l = a.length - a.trimStart().length,
      u = a.trim();
    if (u.length > 0) {
      let c = n + r + l;
      t.push({ raw: u, start: c, end: c + u.length });
    }
    r += o.length + 1;
  }
  return t;
}
function Ep(e) {
  let n = !1;
  for (let t = 0; t < e.length; t++) {
    let r = e[t];
    if (r === '"') n = !n;
    else if (r === "#" && !n) return t;
  }
  return e.length;
}
var Ip = /^(\S+)/,
  Cp = /\b(?:at|labelled|unlabelled|delimited)\b/,
  Tp = /[A-Za-z0-9".\-\s]/;
function Ka(e) {
  if (!e) return { sheetId: null, importDecl: null, grammarError: null };
  let n = /^#(\S+)/.exec(e.trim());
  if (!n) return { sheetId: null, importDecl: null, grammarError: null };
  let t = n[1],
    i = e.length - e.trimStart().length + n[0].length,
    o = e.slice(i),
    s = /^\s*from\b/.exec(o);
  if (!s) return { sheetId: t, importDecl: null, grammarError: null };
  let a = i,
    l = i + s[0].length,
    u = (T, M, P) => ({
      sheetId: t,
      importDecl: null,
      grammarError: { message: T, span: { start: M, end: P } },
    }),
    c = () => {
      for (; l < e.length && /\s/.test(e[l]);) l++;
    },
    d = () => {
      c();
      let T = Ip.exec(e.slice(l));
      if (!T) return null;
      let M = l;
      return { text: T[1], start: M, end: M + T[1].length };
    };
  c();
  let f = d();
  if (!f) return u("`from` needs a path", a, l);
  l = f.end;
  let p = { start: f.start, end: f.end },
    m = ",",
    h = null,
    w = null,
    g = null,
    S = null,
    b = null,
    I = null,
    R = 0;
  for (; c(), !(l >= e.length);) {
    let T = d();
    if (T.text === "delimited") {
      if (R >= 1) return u("`delimited` is out of order or repeated", T.start, T.end);
      ((R = 1), (l = T.end));
      let M = d();
      if (!M) return u("`delimited` needs a character", T.start, l);
      if (((l = M.end), M.text.length !== 1))
        return u("`delimited` takes exactly one character, got `" + M.text + "`", M.start, M.end);
      if (Tp.test(M.text))
        return u(
          "`delimited " +
            M.text +
            "` is not allowed \u2014 a delimiter may not be a letter, digit, quote, `.`, `-`, or whitespace",
          M.start,
          M.end,
        );
      m = M.text;
      continue;
    }
    if (T.text === "labelled" || T.text === "unlabelled") {
      if (R >= 2) return u(`\`${T.text}\` is out of order or repeated`, T.start, T.end);
      let M = T.text;
      ((R = 2), (l = T.end));
      let P = e.slice(l),
        E = Cp.exec(P),
        U = E ? l + E.index : e.length,
        C = e
          .slice(l, U)
          .split(",")
          .map(($) => $.trim())
          .filter(($) => $.length > 0);
      if (C.length === 0) return u(`\`${M}\` needs at least one column name`, T.start, U);
      ((h = C), (w = { start: T.start, end: U }), (g = M), (l = U));
      continue;
    }
    if (T.text === "at") {
      if (R >= 3) return u("`at` is out of order or repeated", T.start, T.end);
      ((R = 3), (l = T.end));
      let M = d();
      if (!M) return u("`at` needs a stamp", T.start, l);
      l = M.end;
      let P = M.text.indexOf(":");
      (P === -1
        ? ((S = M.text), (b = null))
        : ((S = M.text.slice(0, P)), (b = M.text.slice(P + 1))),
        (I = { start: T.start, end: M.end }));
      continue;
    }
    return u("unrecognised token `" + T.text + "` in import declaration", T.start, T.end);
  }
  let y = { start: a, end: l };
  return {
    sheetId: t,
    importDecl: {
      path: f.text,
      pathSpan: p,
      delimiter: m,
      labels: h,
      labelsSpan: w,
      labelsMode: g,
      stampPrefix: S,
      stampDigest: b,
      stampSpan: I,
      declSpan: y,
    },
    grammarError: null,
  };
}
var Ap = /^<!--\s*vmark\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)(%)?\s*-->$/,
  Rp = /^<!--\s*vmark\s*=/,
  Un = "<!--vmark:no-formulas-->",
  Pp = /^<!--\s*vmark\s*:\s*no-formulas\s*-->$/,
  Xa = /(-?\d+(?:\.\d+)?)\s*$/,
  Mp = /(\S+?)\s*$/,
  me = (e, n) => {
    var r;
    let t = (r = e.position) == null ? void 0 : r[n].offset;
    if (t === void 0) throw new Error(`mdast node ${e.type} is missing a byte offset`);
    return t;
  };
function Te(e) {
  var p, m, h, w, g;
  let n = Io().use(vr).use(yr).parse(e),
    t = (p = n.children) != null ? p : [],
    r = [],
    i = [],
    o = [],
    s = [],
    a = new Map(),
    l = new Set(),
    u = new Map(),
    c = null;
  for (let S = 0; S < t.length; S++) {
    let b = t[S];
    if (b.type === "table") {
      let I = Dp(b, e);
      (i.push(I), u.set(I.span.start, I));
    }
    b.type === "html" &&
      c === null &&
      Pp.test(((m = b.value) != null ? m : "").trim()) &&
      (c = { start: me(b, "start"), end: me(b, "end") });
  }
  for (let S = 0; S < t.length; S++) {
    let b = t[S];
    if (b.type === "code" && b.lang === "vmark") {
      let I = { start: me(b, "start"), end: me(b, "end") },
        R =
          e.indexOf(
            `
`,
            I.start,
          ) + 1,
        y = (h = b.meta) != null ? h : null,
        T = y ? Fp(e, I.start).indexOf(y) : -1,
        M = T === -1 ? 0 : I.start + T,
        P = Ka(y),
        E = {
          sheetId: P.sheetId,
          importDecl: P.importDecl ? Np(P.importDecl, M) : null,
          grammarError: P.grammarError
            ? {
                message: P.grammarError.message,
                span: { start: M + P.grammarError.span.start, end: M + P.grammarError.span.end },
              }
            : null,
          bindings: Za((w = b.value) != null ? w : "", R),
          span: I,
        };
      r.push(E);
      let U = t[S - 1];
      if (U && U.type === "table") a.set(E, (g = u.get(me(U, "start"))) != null ? g : null);
      else {
        a.set(E, null);
        for (let _ = S - 1; _ >= 0; _--) {
          let C = t[_];
          if ((C.type === "code" && C.lang === "vmark") || C.type === "heading") break;
          if (C.type === "table") {
            l.add(E);
            break;
          }
        }
      }
    }
  }
  Lp(n, e, o, s);
  let d = [];
  To(n, e, d);
  let f = new Set(o.filter((S) => S.value).map((S) => `${S.value.start}:${S.value.end}`));
  for (let S of d) S.anchored = f.has(`${S.value.start}:${S.value.end}`);
  return {
    source: e,
    blocks: r,
    tables: i,
    anchors: o,
    malformedAnchors: s,
    figures: d,
    noFormulas: c,
    tableBeforeBlock: a,
    detachedTableBlocks: l,
  };
}
function Fp(e, n) {
  let t = e.indexOf(
    `
`,
    n,
  );
  return t === -1 ? e.slice(n) : e.slice(n, t);
}
function Np(e, n) {
  let t = (r) => ({ start: r.start + n, end: r.end + n });
  return {
    path: e.path,
    pathSpan: t(e.pathSpan),
    delimiter: e.delimiter,
    labels: e.labels,
    labelsSpan: e.labelsSpan ? t(e.labelsSpan) : null,
    labelsMode: e.labelsMode,
    stampPrefix: e.stampPrefix,
    stampDigest: e.stampDigest,
    stampSpan: e.stampSpan ? t(e.stampSpan) : null,
    declSpan: t(e.declSpan),
  };
}
function Dp(e, n) {
  var o;
  let t = ((o = e.children) != null ? o : []).map((s) => {
      var a;
      return ((a = s.children) != null ? a : []).map((l) => $p(l, n));
    }),
    [r = [], ...i] = t;
  return {
    headers: r,
    rows: i.map((s) => ({ cells: s })),
    span: { start: me(e, "start"), end: me(e, "end") },
  };
}
function $p(e, n) {
  var u;
  let t = (u = e.children) == null ? void 0 : u[0];
  if (t) {
    let c = Cr(t);
    if (c) return { ...c, text: n.slice(c.start, c.end) };
  }
  let r = me(e, "start"),
    i = me(e, "end"),
    o = n.slice(r, i),
    s = o.replace(/^\|?\s*/, ""),
    a = o.length - s.length,
    l = s.replace(/\s*\|?\s*$/, "");
  return { start: r + a, end: r + a + l.length, text: l };
}
function Cr(e) {
  var n;
  if (e.type === "strong" || e.type === "emphasis") {
    let t = (n = e.children) == null ? void 0 : n[0];
    return t && t.type === "text"
      ? { start: me(t, "start"), end: me(t, "end"), kind: e.type }
      : null;
  }
  return e.type === "inlineCode"
    ? { start: me(e, "start") + 1, end: me(e, "end") - 1, kind: "inlineCode" }
    : e.type === "text"
      ? { start: me(e, "start"), end: me(e, "end"), kind: "text" }
      : null;
}
function Lp(e, n, t, r) {
  el(e, (i) => {
    var s;
    let o = i.children;
    if (o)
      for (let a = 0; a < o.length; a++) {
        let l = o[a];
        if (l.type !== "html") continue;
        let u = ((s = l.value) != null ? s : "").trim(),
          c = Ap.exec(u);
        if (!c) {
          Rp.test(u) && r.push({ start: me(l, "start"), end: me(l, "end") });
          continue;
        }
        let d = { start: me(l, "start"), end: me(l, "end") },
          f = o[a - 1];
        t.push({
          sheetId: c[1],
          name: c[2],
          commentSpan: d,
          value: f ? Op(f) : null,
          ...((f == null ? void 0 : f.type) === "image" && f.url !== void 0
            ? { imageUrl: f.url }
            : {}),
          ...(c[3] ? { percent: !0 } : {}),
        });
      }
  });
}
function Op(e) {
  var n;
  if (e.type === "image") return { start: me(e, "start"), end: me(e, "end"), kind: "image" };
  if (e.type === "strong" || e.type === "emphasis" || e.type === "inlineCode") return Cr(e);
  if (e.type === "text") {
    let t = (n = e.value) != null ? n : "",
      r = Xa.exec(t);
    if (r) {
      let s = me(e, "start") + r.index;
      return { start: s, end: s + r[1].length, kind: "text" };
    }
    let i = Mp.exec(t);
    if (!i) return null;
    let o = me(e, "start") + i.index;
    return { start: o, end: o + i[1].length, kind: "text" };
  }
  return null;
}
function el(e, n) {
  var t;
  n(e);
  for (let r of (t = e.children) != null ? t : []) el(r, n);
}
var Qa = /^-?\s*[^\d\s.\-%]*\s*\d+(?:\.\d+)?\s*(?:%|[^\d\s.\-%]*)$/,
  Co = /\d+(?:\.\d+)?%?/g,
  Ja = /[\w./\-:%]/;
function To(e, n, t) {
  var i, o, s, a;
  if (e.type === "table" || e.type === "code" || e.type === "html") return;
  let r = e.children;
  if (r)
    for (let l of r)
      switch (l.type) {
        case "strong":
        case "emphasis": {
          let u = (i = l.children) == null ? void 0 : i[0];
          if (
            ((o = l.children) == null ? void 0 : o.length) === 1 &&
            (u == null ? void 0 : u.type) === "text" &&
            Qa.test(((s = u.value) != null ? s : "").trim())
          ) {
            let c = Cr(u);
            if (c) {
              t.push({
                text: n.slice(c.start, c.end),
                value: { ...c, kind: l.type },
                anchorAt: me(l, "end"),
                anchored: !1,
              });
              continue;
            }
          }
          To(l, n, t);
          continue;
        }
        case "inlineCode": {
          let u = ((a = l.value) != null ? a : "").trim();
          if (Qa.test(u)) {
            let c = Cr(l);
            t.push({
              text: n.slice(c.start, c.end),
              value: c,
              anchorAt: me(l, "end"),
              anchored: !1,
            });
          }
          continue;
        }
        case "text": {
          _p(l, n, t);
          continue;
        }
        default:
          To(l, n, t);
      }
}
function _p(e, n, t) {
  var a, l, u;
  let r = (a = e.value) != null ? a : "",
    i = me(e, "start"),
    o = Xa.exec(r),
    s = o ? o.index : -1;
  Co.lastIndex = 0;
  for (let c = Co.exec(r); c; c = Co.exec(r)) {
    let d = c.index,
      f = d + c[0].length,
      p = (l = r[d - 1]) != null ? l : " ",
      m = (u = r[f]) != null ? u : " ";
    if (Ja.test(p) || Ja.test(m)) continue;
    let h = d === s && !c[0].endsWith("%");
    t.push({
      text: c[0],
      value: { start: i + d, end: i + f, kind: "text" },
      anchorAt: h ? me(e, "end") : null,
      anchored: !1,
    });
  }
}
var hn = 9e15,
  Vt = 1e9,
  Ao = "0123456789abcdef",
  Rr =
    "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058",
  Pr =
    "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789",
  Ro = {
    precision: 20,
    rounding: 4,
    modulo: 1,
    toExpNeg: -7,
    toExpPos: 21,
    minE: -hn,
    maxE: hn,
    crypto: !1,
  },
  il,
  yt,
  ee = !0,
  Fr = "[DecimalError] ",
  _t = Fr + "Invalid argument: ",
  ol = Fr + "Precision limit exceeded",
  sl = Fr + "crypto unavailable",
  al = "[object Decimal]",
  Ne = Math.floor,
  Ee = Math.pow,
  Vp = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i,
  Bp = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i,
  zp = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i,
  ll = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
  rt = 1e7,
  K = 7,
  Up = 9007199254740991,
  jp = Rr.length - 1,
  Po = Pr.length - 1,
  N = { toStringTag: al };
N.absoluteValue = N.abs = function () {
  var e = new this.constructor(this);
  return (e.s < 0 && (e.s = 1), q(e));
};
N.ceil = function () {
  return q(new this.constructor(this), this.e + 1, 2);
};
N.clampedTo = N.clamp = function (e, n) {
  var t,
    r = this,
    i = r.constructor;
  if (((e = new i(e)), (n = new i(n)), !e.s || !n.s)) return new i(NaN);
  if (e.gt(n)) throw Error(_t + n);
  return ((t = r.cmp(e)), t < 0 ? e : r.cmp(n) > 0 ? n : new i(r));
};
N.comparedTo = N.cmp = function (e) {
  var n,
    t,
    r,
    i,
    o = this,
    s = o.d,
    a = (e = new o.constructor(e)).d,
    l = o.s,
    u = e.s;
  if (!s || !a) return !l || !u ? NaN : l !== u ? l : s === a ? 0 : !s ^ (l < 0) ? 1 : -1;
  if (!s[0] || !a[0]) return s[0] ? l : a[0] ? -u : 0;
  if (l !== u) return l;
  if (o.e !== e.e) return (o.e > e.e) ^ (l < 0) ? 1 : -1;
  for (r = s.length, i = a.length, n = 0, t = r < i ? r : i; n < t; ++n)
    if (s[n] !== a[n]) return (s[n] > a[n]) ^ (l < 0) ? 1 : -1;
  return r === i ? 0 : (r > i) ^ (l < 0) ? 1 : -1;
};
N.cosine = N.cos = function () {
  var e,
    n,
    t = this,
    r = t.constructor;
  return t.d
    ? t.d[0]
      ? ((e = r.precision),
        (n = r.rounding),
        (r.precision = e + Math.max(t.e, t.sd()) + K),
        (r.rounding = 1),
        (t = Hp(r, pl(r, t))),
        (r.precision = e),
        (r.rounding = n),
        q(yt == 2 || yt == 3 ? t.neg() : t, e, n, !0))
      : new r(1)
    : new r(NaN);
};
N.cubeRoot = N.cbrt = function () {
  var e,
    n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c = this,
    d = c.constructor;
  if (!c.isFinite() || c.isZero()) return new d(c);
  for (
    ee = !1,
      o = c.s * Ee(c.s * c, 1 / 3),
      !o || Math.abs(o) == 1 / 0
        ? ((t = Ae(c.d)),
          (e = c.e),
          (o = (e - t.length + 1) % 3) && (t += o == 1 || o == -2 ? "0" : "00"),
          (o = Ee(t, 1 / 3)),
          (e = Ne((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2))),
          o == 1 / 0
            ? (t = "5e" + e)
            : ((t = o.toExponential()), (t = t.slice(0, t.indexOf("e") + 1) + e)),
          (r = new d(t)),
          (r.s = c.s))
        : (r = new d(o.toString())),
      s = (e = d.precision) + 3;
    ;
  )
    if (
      ((a = r),
      (l = a.times(a).times(a)),
      (u = l.plus(c)),
      (r = he(u.plus(c).times(a), u.plus(l), s + 2, 1)),
      Ae(a.d).slice(0, s) === (t = Ae(r.d)).slice(0, s))
    )
      if (((t = t.slice(s - 3, s + 1)), t == "9999" || (!i && t == "4999"))) {
        if (!i && (q(a, e + 1, 0), a.times(a).times(a).eq(c))) {
          r = a;
          break;
        }
        ((s += 4), (i = 1));
      } else {
        (!+t || (!+t.slice(1) && t.charAt(0) == "5")) &&
          (q(r, e + 1, 1), (n = !r.times(r).times(r).eq(c)));
        break;
      }
  return ((ee = !0), q(r, e, d.rounding, n));
};
N.decimalPlaces = N.dp = function () {
  var e,
    n = this.d,
    t = NaN;
  if (n) {
    if (((e = n.length - 1), (t = (e - Ne(this.e / K)) * K), (e = n[e]), e))
      for (; e % 10 == 0; e /= 10) t--;
    t < 0 && (t = 0);
  }
  return t;
};
N.dividedBy = N.div = function (e) {
  return he(this, new this.constructor(e));
};
N.dividedToIntegerBy = N.divToInt = function (e) {
  var n = this,
    t = n.constructor;
  return q(he(n, new t(e), 0, 1, 1), t.precision, t.rounding);
};
N.equals = N.eq = function (e) {
  return this.cmp(e) === 0;
};
N.floor = function () {
  return q(new this.constructor(this), this.e + 1, 3);
};
N.greaterThan = N.gt = function (e) {
  return this.cmp(e) > 0;
};
N.greaterThanOrEqualTo = N.gte = function (e) {
  var n = this.cmp(e);
  return n == 1 || n === 0;
};
N.hyperbolicCosine = N.cosh = function () {
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
  ((t = s.precision),
    (r = s.rounding),
    (s.precision = t + Math.max(o.e, o.sd()) + 4),
    (s.rounding = 1),
    (i = o.d.length),
    i < 32
      ? ((e = Math.ceil(i / 3)), (n = (1 / Dr(4, e)).toString()))
      : ((e = 16), (n = "2.3283064365386962890625e-10")),
    (o = gn(s, 1, o.times(n), new s(1), !0)));
  for (var l, u = e, c = new s(8); u--;)
    ((l = o.times(o)), (o = a.minus(l.times(c.minus(l.times(c))))));
  return q(o, (s.precision = t), (s.rounding = r), !0);
};
N.hyperbolicSine = N.sinh = function () {
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
    i = gn(o, 2, i, i, !0);
  else {
    ((e = 1.4 * Math.sqrt(r)),
      (e = e > 16 ? 16 : e | 0),
      (i = i.times(1 / Dr(5, e))),
      (i = gn(o, 2, i, i, !0)));
    for (var s, a = new o(5), l = new o(16), u = new o(20); e--;)
      ((s = i.times(i)), (i = i.times(a.plus(s.times(l.times(s).plus(u))))));
  }
  return ((o.precision = n), (o.rounding = t), q(i, n, t, !0));
};
N.hyperbolicTangent = N.tanh = function () {
  var e,
    n,
    t = this,
    r = t.constructor;
  return t.isFinite()
    ? t.isZero()
      ? new r(t)
      : ((e = r.precision),
        (n = r.rounding),
        (r.precision = e + 7),
        (r.rounding = 1),
        he(t.sinh(), t.cosh(), (r.precision = e), (r.rounding = n)))
    : new r(t.s);
};
N.inverseCosine = N.acos = function () {
  var e = this,
    n = e.constructor,
    t = e.abs().cmp(1),
    r = n.precision,
    i = n.rounding;
  return t !== -1
    ? t === 0
      ? e.isNeg()
        ? ut(n, r, i)
        : new n(0)
      : new n(NaN)
    : e.isZero()
      ? ut(n, r + 4, i).times(0.5)
      : ((n.precision = r + 6),
        (n.rounding = 1),
        (e = new n(1).minus(e).div(e.plus(1)).sqrt().atan()),
        (n.precision = r),
        (n.rounding = i),
        e.times(2));
};
N.inverseHyperbolicCosine = N.acosh = function () {
  var e,
    n,
    t = this,
    r = t.constructor;
  return t.lte(1)
    ? new r(t.eq(1) ? 0 : NaN)
    : t.isFinite()
      ? ((e = r.precision),
        (n = r.rounding),
        (r.precision = e + Math.max(Math.abs(t.e), t.sd()) + 4),
        (r.rounding = 1),
        (ee = !1),
        (t = t.times(t).minus(1).sqrt().plus(t)),
        (ee = !0),
        (r.precision = e),
        (r.rounding = n),
        t.ln())
      : new r(t);
};
N.inverseHyperbolicSine = N.asinh = function () {
  var e,
    n,
    t = this,
    r = t.constructor;
  return !t.isFinite() || t.isZero()
    ? new r(t)
    : ((e = r.precision),
      (n = r.rounding),
      (r.precision = e + 2 * Math.max(Math.abs(t.e), t.sd()) + 6),
      (r.rounding = 1),
      (ee = !1),
      (t = t.times(t).plus(1).sqrt().plus(t)),
      (ee = !0),
      (r.precision = e),
      (r.rounding = n),
      t.ln());
};
N.inverseHyperbolicTangent = N.atanh = function () {
  var e,
    n,
    t,
    r,
    i = this,
    o = i.constructor;
  return i.isFinite()
    ? i.e >= 0
      ? new o(i.abs().eq(1) ? i.s / 0 : i.isZero() ? i : NaN)
      : ((e = o.precision),
        (n = o.rounding),
        (r = i.sd()),
        Math.max(r, e) < 2 * -i.e - 1
          ? q(new o(i), e, n, !0)
          : ((o.precision = t = r - i.e),
            (i = he(i.plus(1), new o(1).minus(i), t + e, 1)),
            (o.precision = e + 4),
            (o.rounding = 1),
            (i = i.ln()),
            (o.precision = e),
            (o.rounding = n),
            i.times(0.5)))
    : new o(NaN);
};
N.inverseSine = N.asin = function () {
  var e,
    n,
    t,
    r,
    i = this,
    o = i.constructor;
  return i.isZero()
    ? new o(i)
    : ((n = i.abs().cmp(1)),
      (t = o.precision),
      (r = o.rounding),
      n !== -1
        ? n === 0
          ? ((e = ut(o, t + 4, r).times(0.5)), (e.s = i.s), e)
          : new o(NaN)
        : ((o.precision = t + 6),
          (o.rounding = 1),
          (i = i.div(new o(1).minus(i.times(i)).sqrt().plus(1)).atan()),
          (o.precision = t),
          (o.rounding = r),
          i.times(2)));
};
N.inverseTangent = N.atan = function () {
  var e,
    n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u = this,
    c = u.constructor,
    d = c.precision,
    f = c.rounding;
  if (u.isFinite()) {
    if (u.isZero()) return new c(u);
    if (u.abs().eq(1) && d + 4 <= Po) return ((s = ut(c, d + 4, f).times(0.25)), (s.s = u.s), s);
  } else {
    if (!u.s) return new c(NaN);
    if (d + 4 <= Po) return ((s = ut(c, d + 4, f).times(0.5)), (s.s = u.s), s);
  }
  for (c.precision = a = d + 10, c.rounding = 1, t = Math.min(28, (a / K + 2) | 0), e = t; e; --e)
    u = u.div(u.times(u).plus(1).sqrt().plus(1));
  for (ee = !1, n = Math.ceil(a / K), r = 1, l = u.times(u), s = new c(u), i = u; e !== -1;)
    if (
      ((i = i.times(l)),
      (o = s.minus(i.div((r += 2)))),
      (i = i.times(l)),
      (s = o.plus(i.div((r += 2)))),
      s.d[n] !== void 0)
    )
      for (e = n; s.d[e] === o.d[e] && e--;);
  return (
    t && (s = s.times(2 << (t - 1))), (ee = !0), q(s, (c.precision = d), (c.rounding = f), !0)
  );
};
N.isFinite = function () {
  return !!this.d;
};
N.isInteger = N.isInt = function () {
  return !!this.d && Ne(this.e / K) > this.d.length - 2;
};
N.isNaN = function () {
  return !this.s;
};
N.isNegative = N.isNeg = function () {
  return this.s < 0;
};
N.isPositive = N.isPos = function () {
  return this.s > 0;
};
N.isZero = function () {
  return !!this.d && this.d[0] === 0;
};
N.lessThan = N.lt = function (e) {
  return this.cmp(e) < 0;
};
N.lessThanOrEqualTo = N.lte = function (e) {
  return this.cmp(e) < 1;
};
N.logarithm = N.log = function (e) {
  var n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u = this,
    c = u.constructor,
    d = c.precision,
    f = c.rounding,
    p = 5;
  if (e == null) ((e = new c(10)), (n = !0));
  else {
    if (((e = new c(e)), (t = e.d), e.s < 0 || !t || !t[0] || e.eq(1))) return new c(NaN);
    n = e.eq(10);
  }
  if (((t = u.d), u.s < 0 || !t || !t[0] || u.eq(1)))
    return new c(t && !t[0] ? -1 / 0 : u.s != 1 ? NaN : t ? 0 : 1 / 0);
  if (n)
    if (t.length > 1) o = !0;
    else {
      for (i = t[0]; i % 10 === 0;) i /= 10;
      o = i !== 1;
    }
  if (
    ((ee = !1),
    (a = d + p),
    (s = Ot(u, a)),
    (r = n ? Mr(c, a + 10) : Ot(e, a)),
    (l = he(s, r, a, 1)),
    jn(l.d, (i = d), f))
  )
    do
      if (
        ((a += 10), (s = Ot(u, a)), (r = n ? Mr(c, a + 10) : Ot(e, a)), (l = he(s, r, a, 1)), !o)
      ) {
        +Ae(l.d).slice(i + 1, i + 15) + 1 == 1e14 && (l = q(l, d + 1, 0));
        break;
      }
    while (jn(l.d, (i += 10), f));
  return ((ee = !0), q(l, d, f));
};
N.minus = N.sub = function (e) {
  var n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c,
    d,
    f,
    p = this,
    m = p.constructor;
  if (((e = new m(e)), !p.d || !e.d))
    return (
      !p.s || !e.s
        ? (e = new m(NaN))
        : p.d
          ? (e.s = -e.s)
          : (e = new m(e.d || p.s !== e.s ? p : NaN)),
      e
    );
  if (p.s != e.s) return ((e.s = -e.s), p.plus(e));
  if (((u = p.d), (f = e.d), (a = m.precision), (l = m.rounding), !u[0] || !f[0])) {
    if (f[0]) e.s = -e.s;
    else if (u[0]) e = new m(p);
    else return new m(l === 3 ? -0 : 0);
    return ee ? q(e, a, l) : e;
  }
  if (((t = Ne(e.e / K)), (c = Ne(p.e / K)), (u = u.slice()), (o = c - t), o)) {
    for (
      d = o < 0,
        d ? ((n = u), (o = -o), (s = f.length)) : ((n = f), (t = c), (s = u.length)),
        r = Math.max(Math.ceil(a / K), s) + 2,
        o > r && ((o = r), (n.length = 1)),
        n.reverse(),
        r = o;
      r--;
    )
      n.push(0);
    n.reverse();
  } else {
    for (r = u.length, s = f.length, d = r < s, d && (s = r), r = 0; r < s; r++)
      if (u[r] != f[r]) {
        d = u[r] < f[r];
        break;
      }
    o = 0;
  }
  for (d && ((n = u), (u = f), (f = n), (e.s = -e.s)), s = u.length, r = f.length - s; r > 0; --r)
    u[s++] = 0;
  for (r = f.length; r > o;) {
    if (u[--r] < f[r]) {
      for (i = r; i && u[--i] === 0;) u[i] = rt - 1;
      (--u[i], (u[r] += rt));
    }
    u[r] -= f[r];
  }
  for (; u[--s] === 0;) u.pop();
  for (; u[0] === 0; u.shift()) --t;
  return u[0] ? ((e.d = u), (e.e = Nr(u, t)), ee ? q(e, a, l) : e) : new m(l === 3 ? -0 : 0);
};
N.modulo = N.mod = function (e) {
  var n,
    t = this,
    r = t.constructor;
  return (
    (e = new r(e)),
    !t.d || !e.s || (e.d && !e.d[0])
      ? new r(NaN)
      : !e.d || (t.d && !t.d[0])
        ? q(new r(t), r.precision, r.rounding)
        : ((ee = !1),
          r.modulo == 9
            ? ((n = he(t, e.abs(), 0, 3, 1)), (n.s *= e.s))
            : (n = he(t, e, 0, r.modulo, 1)),
          (n = n.times(e)),
          (ee = !0),
          t.minus(n))
  );
};
N.naturalExponential = N.exp = function () {
  return Mo(this);
};
N.naturalLogarithm = N.ln = function () {
  return Ot(this);
};
N.negated = N.neg = function () {
  var e = new this.constructor(this);
  return ((e.s = -e.s), q(e));
};
N.plus = N.add = function (e) {
  var n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c,
    d = this,
    f = d.constructor;
  if (((e = new f(e)), !d.d || !e.d))
    return (!d.s || !e.s ? (e = new f(NaN)) : d.d || (e = new f(e.d || d.s === e.s ? d : NaN)), e);
  if (d.s != e.s) return ((e.s = -e.s), d.minus(e));
  if (((u = d.d), (c = e.d), (a = f.precision), (l = f.rounding), !u[0] || !c[0]))
    return (c[0] || (e = new f(d)), ee ? q(e, a, l) : e);
  if (((o = Ne(d.e / K)), (r = Ne(e.e / K)), (u = u.slice()), (i = o - r), i)) {
    for (
      i < 0 ? ((t = u), (i = -i), (s = c.length)) : ((t = c), (r = o), (s = u.length)),
        o = Math.ceil(a / K),
        s = o > s ? o + 1 : s + 1,
        i > s && ((i = s), (t.length = 1)),
        t.reverse();
      i--;
    )
      t.push(0);
    t.reverse();
  }
  for (s = u.length, i = c.length, s - i < 0 && ((i = s), (t = c), (c = u), (u = t)), n = 0; i;)
    ((n = ((u[--i] = u[i] + c[i] + n) / rt) | 0), (u[i] %= rt));
  for (n && (u.unshift(n), ++r), s = u.length; u[--s] == 0;) u.pop();
  return ((e.d = u), (e.e = Nr(u, r)), ee ? q(e, a, l) : e);
};
N.precision = N.sd = function (e) {
  var n,
    t = this;
  if (e !== void 0 && e !== !!e && e !== 1 && e !== 0) throw Error(_t + e);
  return (t.d ? ((n = ul(t.d)), e && t.e + 1 > n && (n = t.e + 1)) : (n = NaN), n);
};
N.round = function () {
  var e = this,
    n = e.constructor;
  return q(new n(e), e.e + 1, n.rounding);
};
N.sine = N.sin = function () {
  var e,
    n,
    t = this,
    r = t.constructor;
  return t.isFinite()
    ? t.isZero()
      ? new r(t)
      : ((e = r.precision),
        (n = r.rounding),
        (r.precision = e + Math.max(t.e, t.sd()) + K),
        (r.rounding = 1),
        (t = qp(r, pl(r, t))),
        (r.precision = e),
        (r.rounding = n),
        q(yt > 2 ? t.neg() : t, e, n, !0))
    : new r(NaN);
};
N.squareRoot = N.sqrt = function () {
  var e,
    n,
    t,
    r,
    i,
    o,
    s = this,
    a = s.d,
    l = s.e,
    u = s.s,
    c = s.constructor;
  if (u !== 1 || !a || !a[0]) return new c(!u || (u < 0 && (!a || a[0])) ? NaN : a ? s : 1 / 0);
  for (
    ee = !1,
      u = Math.sqrt(+s),
      u == 0 || u == 1 / 0
        ? ((n = Ae(a)),
          (n.length + l) % 2 == 0 && (n += "0"),
          (u = Math.sqrt(n)),
          (l = Ne((l + 1) / 2) - (l < 0 || l % 2)),
          u == 1 / 0
            ? (n = "5e" + l)
            : ((n = u.toExponential()), (n = n.slice(0, n.indexOf("e") + 1) + l)),
          (r = new c(n)))
        : (r = new c(u.toString())),
      t = (l = c.precision) + 3;
    ;
  )
    if (
      ((o = r),
      (r = o.plus(he(s, o, t + 2, 1)).times(0.5)),
      Ae(o.d).slice(0, t) === (n = Ae(r.d)).slice(0, t))
    )
      if (((n = n.slice(t - 3, t + 1)), n == "9999" || (!i && n == "4999"))) {
        if (!i && (q(o, l + 1, 0), o.times(o).eq(s))) {
          r = o;
          break;
        }
        ((t += 4), (i = 1));
      } else {
        (!+n || (!+n.slice(1) && n.charAt(0) == "5")) && (q(r, l + 1, 1), (e = !r.times(r).eq(s)));
        break;
      }
  return ((ee = !0), q(r, l, c.rounding, e));
};
N.tangent = N.tan = function () {
  var e,
    n,
    t = this,
    r = t.constructor;
  return t.isFinite()
    ? t.isZero()
      ? new r(t)
      : ((e = r.precision),
        (n = r.rounding),
        (r.precision = e + 10),
        (r.rounding = 1),
        (t = t.sin()),
        (t.s = 1),
        (t = he(t, new r(1).minus(t.times(t)).sqrt(), e + 10, 0)),
        (r.precision = e),
        (r.rounding = n),
        q(yt == 2 || yt == 4 ? t.neg() : t, e, n, !0))
    : new r(NaN);
};
N.times = N.mul = function (e) {
  var n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c = this,
    d = c.constructor,
    f = c.d,
    p = (e = new d(e)).d;
  if (((e.s *= c.s), !f || !f[0] || !p || !p[0]))
    return new d(
      !e.s || (f && !f[0] && !p) || (p && !p[0] && !f) ? NaN : !f || !p ? e.s / 0 : e.s * 0,
    );
  for (
    t = Ne(c.e / K) + Ne(e.e / K),
      l = f.length,
      u = p.length,
      l < u && ((o = f), (f = p), (p = o), (s = l), (l = u), (u = s)),
      o = [],
      s = l + u,
      r = s;
    r--;
  )
    o.push(0);
  for (r = u; --r >= 0;) {
    for (n = 0, i = l + r; i > r;)
      ((a = o[i] + p[r] * f[i - r - 1] + n), (o[i--] = (a % rt) | 0), (n = (a / rt) | 0));
    o[i] = ((o[i] + n) % rt) | 0;
  }
  for (; !o[--s];) o.pop();
  return (n ? ++t : o.shift(), (e.d = o), (e.e = Nr(o, t)), ee ? q(e, d.precision, d.rounding) : e);
};
N.toBinary = function (e, n) {
  return Fo(this, 2, e, n);
};
N.toDecimalPlaces = N.toDP = function (e, n) {
  var t = this,
    r = t.constructor;
  return (
    (t = new r(t)),
    e === void 0
      ? t
      : (Ve(e, 0, Vt), n === void 0 ? (n = r.rounding) : Ve(n, 0, 8), q(t, e + t.e + 1, n))
  );
};
N.toExponential = function (e, n) {
  var t,
    r = this,
    i = r.constructor;
  return (
    e === void 0
      ? (t = ct(r, !0))
      : (Ve(e, 0, Vt),
        n === void 0 ? (n = i.rounding) : Ve(n, 0, 8),
        (r = q(new i(r), e + 1, n)),
        (t = ct(r, !0, e + 1))),
    r.isNeg() && !r.isZero() ? "-" + t : t
  );
};
N.toFixed = function (e, n) {
  var t,
    r,
    i = this,
    o = i.constructor;
  return (
    e === void 0
      ? (t = ct(i))
      : (Ve(e, 0, Vt),
        n === void 0 ? (n = o.rounding) : Ve(n, 0, 8),
        (r = q(new o(i), e + i.e + 1, n)),
        (t = ct(r, !1, e + r.e + 1))),
    i.isNeg() && !i.isZero() ? "-" + t : t
  );
};
N.toFraction = function (e) {
  var n,
    t,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c,
    d,
    f,
    p = this,
    m = p.d,
    h = p.constructor;
  if (!m) return new h(p);
  if (
    ((u = t = new h(1)),
    (r = l = new h(0)),
    (n = new h(r)),
    (o = n.e = ul(m) - p.e - 1),
    (s = o % K),
    (n.d[0] = Ee(10, s < 0 ? K + s : s)),
    e == null)
  )
    e = o > 0 ? n : u;
  else {
    if (((a = new h(e)), !a.isInt() || a.lt(u))) throw Error(_t + a);
    e = a.gt(n) ? (o > 0 ? n : u) : a;
  }
  for (
    ee = !1, a = new h(Ae(m)), c = h.precision, h.precision = o = m.length * K * 2;
    (d = he(a, n, 0, 1, 1)), (i = t.plus(d.times(r))), i.cmp(e) != 1;
  )
    ((t = r),
      (r = i),
      (i = u),
      (u = l.plus(d.times(i))),
      (l = i),
      (i = n),
      (n = a.minus(d.times(i))),
      (a = i));
  return (
    (i = he(e.minus(t), r, 0, 1, 1)),
    (l = l.plus(i.times(u))),
    (t = t.plus(i.times(r))),
    (l.s = u.s = p.s),
    (f =
      he(u, r, o, 1)
        .minus(p)
        .abs()
        .cmp(he(l, t, o, 1).minus(p).abs()) < 1
        ? [u, r]
        : [l, t]),
    (h.precision = c),
    (ee = !0),
    f
  );
};
N.toHexadecimal = N.toHex = function (e, n) {
  return Fo(this, 16, e, n);
};
N.toNearest = function (e, n) {
  var t = this,
    r = t.constructor;
  if (((t = new r(t)), e == null)) {
    if (!t.d) return t;
    ((e = new r(1)), (n = r.rounding));
  } else {
    if (((e = new r(e)), n === void 0 ? (n = r.rounding) : Ve(n, 0, 8), !t.d)) return e.s ? t : e;
    if (!e.d) return (e.s && (e.s = t.s), e);
  }
  return (
    e.d[0]
      ? ((ee = !1), (t = he(t, e, 0, n, 1).times(e)), (ee = !0), q(t))
      : ((e.s = t.s), (t = e)),
    t
  );
};
N.toNumber = function () {
  return +this;
};
N.toOctal = function (e, n) {
  return Fo(this, 8, e, n);
};
N.toPower = N.pow = function (e) {
  var n,
    t,
    r,
    i,
    o,
    s,
    a = this,
    l = a.constructor,
    u = +(e = new l(e));
  if (!a.d || !e.d || !a.d[0] || !e.d[0]) return new l(Ee(+a, u));
  if (((a = new l(a)), a.eq(1))) return a;
  if (((r = l.precision), (o = l.rounding), e.eq(1))) return q(a, r, o);
  if (((n = Ne(e.e / K)), n >= e.d.length - 1 && (t = u < 0 ? -u : u) <= Up))
    return ((i = cl(l, a, t, r)), e.s < 0 ? new l(1).div(i) : q(i, r, o));
  if (((s = a.s), s < 0)) {
    if (n < e.d.length - 1) return new l(NaN);
    if (((e.d[n] & 1) == 0 && (s = 1), a.e == 0 && a.d[0] == 1 && a.d.length == 1))
      return ((a.s = s), a);
  }
  return (
    (t = Ee(+a, u)),
    (n =
      t == 0 || !isFinite(t)
        ? Ne(u * (Math.log("0." + Ae(a.d)) / Math.LN10 + a.e + 1))
        : new l(t + "").e),
    n > l.maxE + 1 || n < l.minE - 1
      ? new l(n > 0 ? s / 0 : 0)
      : ((ee = !1),
        (l.rounding = a.s = 1),
        (t = Math.min(12, (n + "").length)),
        (i = Mo(e.times(Ot(a, r + t)), r)),
        i.d &&
          ((i = q(i, r + 5, 1)),
          jn(i.d, r, o) &&
            ((n = r + 10),
            (i = q(Mo(e.times(Ot(a, n + t)), n), n + 5, 1)),
            +Ae(i.d).slice(r + 1, r + 15) + 1 == 1e14 && (i = q(i, r + 1, 0)))),
        (i.s = s),
        (ee = !0),
        (l.rounding = o),
        q(i, r, o))
  );
};
N.toPrecision = function (e, n) {
  var t,
    r = this,
    i = r.constructor;
  return (
    e === void 0
      ? (t = ct(r, r.e <= i.toExpNeg || r.e >= i.toExpPos))
      : (Ve(e, 1, Vt),
        n === void 0 ? (n = i.rounding) : Ve(n, 0, 8),
        (r = q(new i(r), e, n)),
        (t = ct(r, e <= r.e || r.e <= i.toExpNeg, e))),
    r.isNeg() && !r.isZero() ? "-" + t : t
  );
};
N.toSignificantDigits = N.toSD = function (e, n) {
  var t = this,
    r = t.constructor;
  return (
    e === void 0
      ? ((e = r.precision), (n = r.rounding))
      : (Ve(e, 1, Vt), n === void 0 ? (n = r.rounding) : Ve(n, 0, 8)),
    q(new r(t), e, n)
  );
};
N.toString = function () {
  var e = this,
    n = e.constructor,
    t = ct(e, e.e <= n.toExpNeg || e.e >= n.toExpPos);
  return e.isNeg() && !e.isZero() ? "-" + t : t;
};
N.truncated = N.trunc = function () {
  return q(new this.constructor(this), this.e + 1, 1);
};
N.valueOf = N.toJSON = function () {
  var e = this,
    n = e.constructor,
    t = ct(e, e.e <= n.toExpNeg || e.e >= n.toExpPos);
  return e.isNeg() ? "-" + t : t;
};
function Ae(e) {
  var n,
    t,
    r,
    i = e.length - 1,
    o = "",
    s = e[0];
  if (i > 0) {
    for (o += s, n = 1; n < i; n++)
      ((r = e[n] + ""), (t = K - r.length), t && (o += Lt(t)), (o += r));
    ((s = e[n]), (r = s + ""), (t = K - r.length), t && (o += Lt(t)));
  } else if (s === 0) return "0";
  for (; s % 10 === 0;) s /= 10;
  return o + s;
}
function Ve(e, n, t) {
  if (e !== ~~e || e < n || e > t) throw Error(_t + e);
}
function jn(e, n, t, r) {
  var i, o, s, a;
  for (o = e[0]; o >= 10; o /= 10) --n;
  return (
    --n < 0 ? ((n += K), (i = 0)) : ((i = Math.ceil((n + 1) / K)), (n %= K)),
    (o = Ee(10, K - n)),
    (a = (e[i] % o) | 0),
    r == null
      ? n < 3
        ? (n == 0 ? (a = (a / 100) | 0) : n == 1 && (a = (a / 10) | 0),
          (s = (t < 4 && a == 99999) || (t > 3 && a == 49999) || a == 5e4 || a == 0))
        : (s =
            (((t < 4 && a + 1 == o) || (t > 3 && a + 1 == o / 2)) &&
              ((e[i + 1] / o / 100) | 0) == Ee(10, n - 2) - 1) ||
            ((a == o / 2 || a == 0) && ((e[i + 1] / o / 100) | 0) == 0))
      : n < 4
        ? (n == 0
            ? (a = (a / 1e3) | 0)
            : n == 1
              ? (a = (a / 100) | 0)
              : n == 2 && (a = (a / 10) | 0),
          (s = ((r || t < 4) && a == 9999) || (!r && t > 3 && a == 4999)))
        : (s =
            (((r || t < 4) && a + 1 == o) || (!r && t > 3 && a + 1 == o / 2)) &&
            ((e[i + 1] / o / 1e3) | 0) == Ee(10, n - 3) - 1),
    s
  );
}
function Tr(e, n, t) {
  for (var r, i = [0], o, s = 0, a = e.length; s < a;) {
    for (o = i.length; o--;) i[o] *= n;
    for (i[0] += Ao.indexOf(e.charAt(s++)), r = 0; r < i.length; r++)
      i[r] > t - 1 &&
        (i[r + 1] === void 0 && (i[r + 1] = 0), (i[r + 1] += (i[r] / t) | 0), (i[r] %= t));
  }
  return i.reverse();
}
function Hp(e, n) {
  var t, r, i;
  if (n.isZero()) return n;
  ((r = n.d.length),
    r < 32
      ? ((t = Math.ceil(r / 3)), (i = (1 / Dr(4, t)).toString()))
      : ((t = 16), (i = "2.3283064365386962890625e-10")),
    (e.precision += t),
    (n = gn(e, 1, n.times(i), new e(1))));
  for (var o = t; o--;) {
    var s = n.times(n);
    n = s.times(s).minus(s).times(8).plus(1);
  }
  return ((e.precision -= t), n);
}
var he = (function () {
  function e(r, i, o) {
    var s,
      a = 0,
      l = r.length;
    for (r = r.slice(); l--;) ((s = r[l] * i + a), (r[l] = (s % o) | 0), (a = (s / o) | 0));
    return (a && r.unshift(a), r);
  }
  function n(r, i, o, s) {
    var a, l;
    if (o != s) l = o > s ? 1 : -1;
    else
      for (a = l = 0; a < o; a++)
        if (r[a] != i[a]) {
          l = r[a] > i[a] ? 1 : -1;
          break;
        }
    return l;
  }
  function t(r, i, o, s) {
    for (var a = 0; o--;) ((r[o] -= a), (a = r[o] < i[o] ? 1 : 0), (r[o] = a * s + r[o] - i[o]));
    for (; !r[0] && r.length > 1;) r.shift();
  }
  return function (r, i, o, s, a, l) {
    var u,
      c,
      d,
      f,
      p,
      m,
      h,
      w,
      g,
      S,
      b,
      I,
      R,
      y,
      T,
      M,
      P,
      E,
      U,
      _,
      C = r.constructor,
      $ = r.s == i.s ? 1 : -1,
      D = r.d,
      z = i.d;
    if (!D || !D[0] || !z || !z[0])
      return new C(
        !r.s || !i.s || (D ? z && D[0] == z[0] : !z) ? NaN : (D && D[0] == 0) || !z ? $ * 0 : $ / 0,
      );
    for (
      l ? ((p = 1), (c = r.e - i.e)) : ((l = rt), (p = K), (c = Ne(r.e / p) - Ne(i.e / p))),
        U = z.length,
        P = D.length,
        g = new C($),
        S = g.d = [],
        d = 0;
      z[d] == (D[d] || 0);
      d++
    );
    if (
      (z[d] > (D[d] || 0) && c--,
      o == null
        ? ((y = o = C.precision), (s = C.rounding))
        : a
          ? (y = o + (r.e - i.e) + 1)
          : (y = o),
      y < 0)
    )
      (S.push(1), (m = !0));
    else {
      if (((y = (y / p + 2) | 0), (d = 0), U == 1)) {
        for (f = 0, z = z[0], y++; (d < P || f) && y--; d++)
          ((T = f * l + (D[d] || 0)), (S[d] = (T / z) | 0), (f = (T % z) | 0));
        m = f || d < P;
      } else {
        for (
          f = (l / (z[0] + 1)) | 0,
            f > 1 && ((z = e(z, f, l)), (D = e(D, f, l)), (U = z.length), (P = D.length)),
            M = U,
            b = D.slice(0, U),
            I = b.length;
          I < U;
        )
          b[I++] = 0;
        ((_ = z.slice()), _.unshift(0), (E = z[0]), z[1] >= l / 2 && ++E);
        do
          ((f = 0),
            (u = n(z, b, U, I)),
            u < 0
              ? ((R = b[0]),
                U != I && (R = R * l + (b[1] || 0)),
                (f = (R / E) | 0),
                f > 1
                  ? (f >= l && (f = l - 1),
                    (h = e(z, f, l)),
                    (w = h.length),
                    (I = b.length),
                    (u = n(h, b, w, I)),
                    u == 1 && (f--, t(h, U < w ? _ : z, w, l)))
                  : (f == 0 && (u = f = 1), (h = z.slice())),
                (w = h.length),
                w < I && h.unshift(0),
                t(b, h, I, l),
                u == -1 &&
                  ((I = b.length), (u = n(z, b, U, I)), u < 1 && (f++, t(b, U < I ? _ : z, I, l))),
                (I = b.length))
              : u === 0 && (f++, (b = [0])),
            (S[d++] = f),
            u && b[0] ? (b[I++] = D[M] || 0) : ((b = [D[M]]), (I = 1)));
        while ((M++ < P || b[0] !== void 0) && y--);
        m = b[0] !== void 0;
      }
      S[0] || S.shift();
    }
    if (p == 1) ((g.e = c), (il = m));
    else {
      for (d = 1, f = S[0]; f >= 10; f /= 10) d++;
      ((g.e = d + c * p - 1), q(g, a ? o + g.e + 1 : o, s, m));
    }
    return g;
  };
})();
function q(e, n, t, r) {
  var i,
    o,
    s,
    a,
    l,
    u,
    c,
    d,
    f,
    p = e.constructor;
  e: if (n != null) {
    if (((d = e.d), !d)) return e;
    for (i = 1, a = d[0]; a >= 10; a /= 10) i++;
    if (((o = n - i), o < 0))
      ((o += K), (s = n), (c = d[(f = 0)]), (l = ((c / Ee(10, i - s - 1)) % 10) | 0));
    else if (((f = Math.ceil((o + 1) / K)), (a = d.length), f >= a))
      if (r) {
        for (; a++ <= f;) d.push(0);
        ((c = l = 0), (i = 1), (o %= K), (s = o - K + 1));
      } else break e;
    else {
      for (c = a = d[f], i = 1; a >= 10; a /= 10) i++;
      ((o %= K), (s = o - K + i), (l = s < 0 ? 0 : ((c / Ee(10, i - s - 1)) % 10) | 0));
    }
    if (
      ((r = r || n < 0 || d[f + 1] !== void 0 || (s < 0 ? c : c % Ee(10, i - s - 1))),
      (u =
        t < 4
          ? (l || r) && (t == 0 || t == (e.s < 0 ? 3 : 2))
          : l > 5 ||
            (l == 5 &&
              (t == 4 ||
                r ||
                (t == 6 && ((o > 0 ? (s > 0 ? c / Ee(10, i - s) : 0) : d[f - 1]) % 10) & 1) ||
                t == (e.s < 0 ? 8 : 7)))),
      n < 1 || !d[0])
    )
      return (
        (d.length = 0),
        u
          ? ((n -= e.e + 1), (d[0] = Ee(10, (K - (n % K)) % K)), (e.e = -n || 0))
          : (d[0] = e.e = 0),
        e
      );
    if (
      (o == 0
        ? ((d.length = f), (a = 1), f--)
        : ((d.length = f + 1),
          (a = Ee(10, K - o)),
          (d[f] = s > 0 ? (((c / Ee(10, i - s)) % Ee(10, s)) | 0) * a : 0)),
      u)
    )
      for (;;)
        if (f == 0) {
          for (o = 1, s = d[0]; s >= 10; s /= 10) o++;
          for (s = d[0] += a, a = 1; s >= 10; s /= 10) a++;
          o != a && (e.e++, d[0] == rt && (d[0] = 1));
          break;
        } else {
          if (((d[f] += a), d[f] != rt)) break;
          ((d[f--] = 0), (a = 1));
        }
    for (o = d.length; d[--o] === 0;) d.pop();
  }
  return (
    ee && (e.e > p.maxE ? ((e.d = null), (e.e = NaN)) : e.e < p.minE && ((e.e = 0), (e.d = [0]))), e
  );
}
function ct(e, n, t) {
  if (!e.isFinite()) return fl(e);
  var r,
    i = e.e,
    o = Ae(e.d),
    s = o.length;
  return (
    n
      ? (t && (r = t - s) > 0
          ? (o = o.charAt(0) + "." + o.slice(1) + Lt(r))
          : s > 1 && (o = o.charAt(0) + "." + o.slice(1)),
        (o = o + (e.e < 0 ? "e" : "e+") + e.e))
      : i < 0
        ? ((o = "0." + Lt(-i - 1) + o), t && (r = t - s) > 0 && (o += Lt(r)))
        : i >= s
          ? ((o += Lt(i + 1 - s)), t && (r = t - i - 1) > 0 && (o = o + "." + Lt(r)))
          : ((r = i + 1) < s && (o = o.slice(0, r) + "." + o.slice(r)),
            t && (r = t - s) > 0 && (i + 1 === s && (o += "."), (o += Lt(r)))),
    o
  );
}
function Nr(e, n) {
  var t = e[0];
  for (n *= K; t >= 10; t /= 10) n++;
  return n;
}
function Mr(e, n, t) {
  if (n > jp) throw ((ee = !0), t && (e.precision = t), Error(ol));
  return q(new e(Rr), n, 1, !0);
}
function ut(e, n, t) {
  if (n > Po) throw Error(ol);
  return q(new e(Pr), n, t, !0);
}
function ul(e) {
  var n = e.length - 1,
    t = n * K + 1;
  if (((n = e[n]), n)) {
    for (; n % 10 == 0; n /= 10) t--;
    for (n = e[0]; n >= 10; n /= 10) t++;
  }
  return t;
}
function Lt(e) {
  for (var n = ""; e--;) n += "0";
  return n;
}
function cl(e, n, t, r) {
  var i,
    o = new e(1),
    s = Math.ceil(r / K + 4);
  for (ee = !1; ;) {
    if ((t % 2 && ((o = o.times(n)), nl(o.d, s) && (i = !0)), (t = Ne(t / 2)), t === 0)) {
      ((t = o.d.length - 1), i && o.d[t] === 0 && ++o.d[t]);
      break;
    }
    ((n = n.times(n)), nl(n.d, s));
  }
  return ((ee = !0), o);
}
function tl(e) {
  return e.d[e.d.length - 1] & 1;
}
function dl(e, n, t) {
  for (var r, i, o = new e(n[0]), s = 0; ++s < n.length;) {
    if (((i = new e(n[s])), !i.s)) {
      o = i;
      break;
    }
    ((r = o.cmp(i)), (r === t || (r === 0 && o.s === t)) && (o = i));
  }
  return o;
}
function Mo(e, n) {
  var t,
    r,
    i,
    o,
    s,
    a,
    l,
    u = 0,
    c = 0,
    d = 0,
    f = e.constructor,
    p = f.rounding,
    m = f.precision;
  if (!e.d || !e.d[0] || e.e > 17)
    return new f(e.d ? (e.d[0] ? (e.s < 0 ? 0 : 1 / 0) : 1) : e.s ? (e.s < 0 ? 0 : e) : NaN);
  for (n == null ? ((ee = !1), (l = m)) : (l = n), a = new f(0.03125); e.e > -2;)
    ((e = e.times(a)), (d += 5));
  for (
    r = ((Math.log(Ee(2, d)) / Math.LN10) * 2 + 5) | 0,
      l += r,
      t = o = s = new f(1),
      f.precision = l;
    ;
  ) {
    if (
      ((o = q(o.times(e), l, 1)),
      (t = t.times(++c)),
      (a = s.plus(he(o, t, l, 1))),
      Ae(a.d).slice(0, l) === Ae(s.d).slice(0, l))
    ) {
      for (i = d; i--;) s = q(s.times(s), l, 1);
      if (n == null)
        if (u < 3 && jn(s.d, l - r, p, u))
          ((f.precision = l += 10), (t = o = a = new f(1)), (c = 0), u++);
        else return q(s, (f.precision = m), p, (ee = !0));
      else return ((f.precision = m), s);
    }
    s = a;
  }
}
function Ot(e, n) {
  var t,
    r,
    i,
    o,
    s,
    a,
    l,
    u,
    c,
    d,
    f,
    p = 1,
    m = 10,
    h = e,
    w = h.d,
    g = h.constructor,
    S = g.rounding,
    b = g.precision;
  if (h.s < 0 || !w || !w[0] || (!h.e && w[0] == 1 && w.length == 1))
    return new g(w && !w[0] ? -1 / 0 : h.s != 1 ? NaN : w ? 0 : h);
  if (
    (n == null ? ((ee = !1), (c = b)) : (c = n),
    (g.precision = c += m),
    (t = Ae(w)),
    (r = t.charAt(0)),
    Math.abs((o = h.e)) < 15e14)
  ) {
    for (; (r < 7 && r != 1) || (r == 1 && t.charAt(1) > 3);)
      ((h = h.times(e)), (t = Ae(h.d)), (r = t.charAt(0)), p++);
    ((o = h.e), r > 1 ? ((h = new g("0." + t)), o++) : (h = new g(r + "." + t.slice(1))));
  } else
    return (
      (u = Mr(g, c + 2, b).times(o + "")),
      (h = Ot(new g(r + "." + t.slice(1)), c - m).plus(u)),
      (g.precision = b),
      n == null ? q(h, b, S, (ee = !0)) : h
    );
  for (d = h, l = s = h = he(h.minus(1), h.plus(1), c, 1), f = q(h.times(h), c, 1), i = 3; ;) {
    if (
      ((s = q(s.times(f), c, 1)),
      (u = l.plus(he(s, new g(i), c, 1))),
      Ae(u.d).slice(0, c) === Ae(l.d).slice(0, c))
    )
      if (
        ((l = l.times(2)),
        o !== 0 && (l = l.plus(Mr(g, c + 2, b).times(o + ""))),
        (l = he(l, new g(p), c, 1)),
        n == null)
      )
        if (jn(l.d, c - m, S, a))
          ((g.precision = c += m),
            (u = s = h = he(d.minus(1), d.plus(1), c, 1)),
            (f = q(h.times(h), c, 1)),
            (i = a = 1));
        else return q(l, (g.precision = b), S, (ee = !0));
      else return ((g.precision = b), l);
    ((l = u), (i += 2));
  }
}
function fl(e) {
  return String((e.s * e.s) / 0);
}
function Ar(e, n) {
  var t, r, i;
  for (
    (t = n.indexOf(".")) > -1 && (n = n.replace(".", "")),
      (r = n.search(/e/i)) > 0
        ? (t < 0 && (t = r), (t += +n.slice(r + 1)), (n = n.substring(0, r)))
        : t < 0 && (t = n.length),
      r = 0;
    n.charCodeAt(r) === 48;
    r++
  );
  for (i = n.length; n.charCodeAt(i - 1) === 48; --i);
  if (((n = n.slice(r, i)), n)) {
    if (
      ((i -= r), (e.e = t = t - r - 1), (e.d = []), (r = (t + 1) % K), t < 0 && (r += K), r < i)
    ) {
      for (r && e.d.push(+n.slice(0, r)), i -= K; r < i;) e.d.push(+n.slice(r, (r += K)));
      ((n = n.slice(r)), (r = K - n.length));
    } else r -= i;
    for (; r--;) n += "0";
    (e.d.push(+n),
      ee &&
        (e.e > e.constructor.maxE
          ? ((e.d = null), (e.e = NaN))
          : e.e < e.constructor.minE && ((e.e = 0), (e.d = [0]))));
  } else ((e.e = 0), (e.d = [0]));
  return e;
}
function Wp(e, n) {
  var t, r, i, o, s, a, l, u, c;
  if (n.indexOf("_") > -1) {
    if (((n = n.replace(/(\d)_(?=\d)/g, "$1")), ll.test(n))) return Ar(e, n);
  } else if (n === "Infinity" || n === "NaN")
    return (+n || (e.s = NaN), (e.e = NaN), (e.d = null), e);
  if (Bp.test(n)) ((t = 16), (n = n.toLowerCase()));
  else if (Vp.test(n)) t = 2;
  else if (zp.test(n)) t = 8;
  else throw Error(_t + n);
  for (
    o = n.search(/p/i),
      o > 0 ? ((l = +n.slice(o + 1)), (n = n.substring(2, o))) : (n = n.slice(2)),
      o = n.indexOf("."),
      s = o >= 0,
      r = e.constructor,
      s && ((n = n.replace(".", "")), (a = n.length), (o = a - o), (i = cl(r, new r(t), o, o * 2))),
      u = Tr(n, t, rt),
      c = u.length - 1,
      o = c;
    u[o] === 0;
    --o
  )
    u.pop();
  return o < 0
    ? new r(e.s * 0)
    : ((e.e = Nr(u, c)),
      (e.d = u),
      (ee = !1),
      s && (e = he(e, i, a * 4)),
      l && (e = e.times(Math.abs(l) < 54 ? Ee(2, l) : J.pow(2, l))),
      (ee = !0),
      e);
}
function qp(e, n) {
  var t,
    r = n.d.length;
  if (r < 3) return n.isZero() ? n : gn(e, 2, n, n);
  ((t = 1.4 * Math.sqrt(r)),
    (t = t > 16 ? 16 : t | 0),
    (n = n.times(1 / Dr(5, t))),
    (n = gn(e, 2, n, n)));
  for (var i, o = new e(5), s = new e(16), a = new e(20); t--;)
    ((i = n.times(n)), (n = n.times(o.plus(i.times(s.times(i).minus(a))))));
  return n;
}
function gn(e, n, t, r, i) {
  var o,
    s,
    a,
    l,
    u = 1,
    c = e.precision,
    d = Math.ceil(c / K);
  for (ee = !1, l = t.times(t), a = new e(r); ;) {
    if (
      ((s = he(a.times(l), new e(n++ * n++), c, 1)),
      (a = i ? r.plus(s) : r.minus(s)),
      (r = he(s.times(l), new e(n++ * n++), c, 1)),
      (s = a.plus(r)),
      s.d[d] !== void 0)
    ) {
      for (o = d; s.d[o] === a.d[o] && o--;);
      if (o == -1) break;
    }
    ((o = a), (a = r), (r = s), (s = o), u++);
  }
  return ((ee = !0), (s.d.length = d + 1), s);
}
function Dr(e, n) {
  for (var t = e; --n;) t *= e;
  return t;
}
function pl(e, n) {
  var t,
    r = n.s < 0,
    i = ut(e, e.precision, 1),
    o = i.times(0.5);
  if (((n = n.abs()), n.lte(o))) return ((yt = r ? 4 : 1), n);
  if (((t = n.divToInt(i)), t.isZero())) yt = r ? 3 : 2;
  else {
    if (((n = n.minus(t.times(i))), n.lte(o))) return ((yt = tl(t) ? (r ? 2 : 3) : r ? 4 : 1), n);
    yt = tl(t) ? (r ? 1 : 4) : r ? 3 : 2;
  }
  return n.minus(i).abs();
}
function Fo(e, n, t, r) {
  var i,
    o,
    s,
    a,
    l,
    u,
    c,
    d,
    f,
    p = e.constructor,
    m = t !== void 0;
  if (
    (m
      ? (Ve(t, 1, Vt), r === void 0 ? (r = p.rounding) : Ve(r, 0, 8))
      : ((t = p.precision), (r = p.rounding)),
    !e.isFinite())
  )
    c = fl(e);
  else {
    for (
      c = ct(e),
        s = c.indexOf("."),
        m ? ((i = 2), n == 16 ? (t = t * 4 - 3) : n == 8 && (t = t * 3 - 2)) : (i = n),
        s >= 0 &&
          ((c = c.replace(".", "")),
          (f = new p(1)),
          (f.e = c.length - s),
          (f.d = Tr(ct(f), 10, i)),
          (f.e = f.d.length)),
        d = Tr(c, 10, i),
        o = l = d.length;
      d[--l] == 0;
    )
      d.pop();
    if (!d[0]) c = m ? "0p+0" : "0";
    else {
      if (
        (s < 0
          ? o--
          : ((e = new p(e)),
            (e.d = d),
            (e.e = o),
            (e = he(e, f, t, r, 0, i)),
            (d = e.d),
            (o = e.e),
            (u = il)),
        (s = d[t]),
        (a = i / 2),
        (u = u || d[t + 1] !== void 0),
        (u =
          r < 4
            ? (s !== void 0 || u) && (r === 0 || r === (e.s < 0 ? 3 : 2))
            : s > a ||
              (s === a && (r === 4 || u || (r === 6 && d[t - 1] & 1) || r === (e.s < 0 ? 8 : 7)))),
        (d.length = t),
        u)
      )
        for (; ++d[--t] > i - 1;) ((d[t] = 0), t || (++o, d.unshift(1)));
      for (l = d.length; !d[l - 1]; --l);
      for (s = 0, c = ""; s < l; s++) c += Ao.charAt(d[s]);
      if (m) {
        if (l > 1)
          if (n == 16 || n == 8) {
            for (s = n == 16 ? 4 : 3, --l; l % s; l++) c += "0";
            for (d = Tr(c, i, n), l = d.length; !d[l - 1]; --l);
            for (s = 1, c = "1."; s < l; s++) c += Ao.charAt(d[s]);
          } else c = c.charAt(0) + "." + c.slice(1);
        c = c + (o < 0 ? "p" : "p+") + o;
      } else if (o < 0) {
        for (; ++o;) c = "0" + c;
        c = "0." + c;
      } else if (++o > l) for (o -= l; o--;) c += "0";
      else o < l && (c = c.slice(0, o) + "." + c.slice(o));
    }
    c = (n == 16 ? "0x" : n == 2 ? "0b" : n == 8 ? "0o" : "") + c;
  }
  return e.s < 0 ? "-" + c : c;
}
function nl(e, n) {
  if (e.length > n) return ((e.length = n), !0);
}
function Gp(e) {
  return new this(e).abs();
}
function Yp(e) {
  return new this(e).acos();
}
function Zp(e) {
  return new this(e).acosh();
}
function Kp(e, n) {
  return new this(e).plus(n);
}
function Qp(e) {
  return new this(e).asin();
}
function Jp(e) {
  return new this(e).asinh();
}
function Xp(e) {
  return new this(e).atan();
}
function em(e) {
  return new this(e).atanh();
}
function tm(e, n) {
  ((e = new this(e)), (n = new this(n)));
  var t,
    r = this.precision,
    i = this.rounding,
    o = r + 4;
  return (
    !e.s || !n.s
      ? (t = new this(NaN))
      : !e.d && !n.d
        ? ((t = ut(this, o, 1).times(n.s > 0 ? 0.25 : 0.75)), (t.s = e.s))
        : !n.d || e.isZero()
          ? ((t = n.s < 0 ? ut(this, r, i) : new this(0)), (t.s = e.s))
          : !e.d || n.isZero()
            ? ((t = ut(this, o, 1).times(0.5)), (t.s = e.s))
            : n.s < 0
              ? ((this.precision = o),
                (this.rounding = 1),
                (t = this.atan(he(e, n, o, 1))),
                (n = ut(this, o, 1)),
                (this.precision = r),
                (this.rounding = i),
                (t = e.s < 0 ? t.minus(n) : t.plus(n)))
              : (t = this.atan(he(e, n, o, 1))),
    t
  );
}
function nm(e) {
  return new this(e).cbrt();
}
function rm(e) {
  return q((e = new this(e)), e.e + 1, 2);
}
function im(e, n, t) {
  return new this(e).clamp(n, t);
}
function om(e) {
  if (!e || typeof e != "object") throw Error(Fr + "Object expected");
  var n,
    t,
    r,
    i = e.defaults === !0,
    o = [
      "precision",
      1,
      Vt,
      "rounding",
      0,
      8,
      "toExpNeg",
      -hn,
      0,
      "toExpPos",
      0,
      hn,
      "maxE",
      0,
      hn,
      "minE",
      -hn,
      0,
      "modulo",
      0,
      9,
    ];
  for (n = 0; n < o.length; n += 3)
    if (((t = o[n]), i && (this[t] = Ro[t]), (r = e[t]) !== void 0))
      if (Ne(r) === r && r >= o[n + 1] && r <= o[n + 2]) this[t] = r;
      else throw Error(_t + t + ": " + r);
  if (((t = "crypto"), i && (this[t] = Ro[t]), (r = e[t]) !== void 0))
    if (r === !0 || r === !1 || r === 0 || r === 1)
      if (r)
        if (
          typeof crypto != "undefined" &&
          crypto &&
          (crypto.getRandomValues || crypto.randomBytes)
        )
          this[t] = !0;
        else throw Error(sl);
      else this[t] = !1;
    else throw Error(_t + t + ": " + r);
  return this;
}
function sm(e) {
  return new this(e).cos();
}
function am(e) {
  return new this(e).cosh();
}
function ml(e) {
  var n, t, r;
  function i(o) {
    var s,
      a,
      l,
      u = this;
    if (!(u instanceof i)) return new i(o);
    if (((u.constructor = i), rl(o))) {
      ((u.s = o.s),
        ee
          ? !o.d || o.e > i.maxE
            ? ((u.e = NaN), (u.d = null))
            : o.e < i.minE
              ? ((u.e = 0), (u.d = [0]))
              : ((u.e = o.e), (u.d = o.d.slice()))
          : ((u.e = o.e), (u.d = o.d ? o.d.slice() : o.d)));
      return;
    }
    if (((l = typeof o), l === "number")) {
      if (o === 0) {
        ((u.s = 1 / o < 0 ? -1 : 1), (u.e = 0), (u.d = [0]));
        return;
      }
      if ((o < 0 ? ((o = -o), (u.s = -1)) : (u.s = 1), o === ~~o && o < 1e7)) {
        for (s = 0, a = o; a >= 10; a /= 10) s++;
        ee
          ? s > i.maxE
            ? ((u.e = NaN), (u.d = null))
            : s < i.minE
              ? ((u.e = 0), (u.d = [0]))
              : ((u.e = s), (u.d = [o]))
          : ((u.e = s), (u.d = [o]));
        return;
      }
      if (o * 0 !== 0) {
        (o || (u.s = NaN), (u.e = NaN), (u.d = null));
        return;
      }
      return Ar(u, o.toString());
    }
    if (l === "string")
      return (
        (a = o.charCodeAt(0)) === 45
          ? ((o = o.slice(1)), (u.s = -1))
          : (a === 43 && (o = o.slice(1)), (u.s = 1)),
        ll.test(o) ? Ar(u, o) : Wp(u, o)
      );
    if (l === "bigint") return (o < 0 ? ((o = -o), (u.s = -1)) : (u.s = 1), Ar(u, o.toString()));
    throw Error(_t + o);
  }
  if (
    ((i.prototype = N),
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
    (i.config = i.set = om),
    (i.clone = ml),
    (i.isDecimal = rl),
    (i.abs = Gp),
    (i.acos = Yp),
    (i.acosh = Zp),
    (i.add = Kp),
    (i.asin = Qp),
    (i.asinh = Jp),
    (i.atan = Xp),
    (i.atanh = em),
    (i.atan2 = tm),
    (i.cbrt = nm),
    (i.ceil = rm),
    (i.clamp = im),
    (i.cos = sm),
    (i.cosh = am),
    (i.div = lm),
    (i.exp = um),
    (i.floor = cm),
    (i.hypot = dm),
    (i.ln = fm),
    (i.log = pm),
    (i.log10 = hm),
    (i.log2 = mm),
    (i.max = gm),
    (i.min = wm),
    (i.mod = xm),
    (i.mul = km),
    (i.pow = bm),
    (i.random = ym),
    (i.round = vm),
    (i.sign = Sm),
    (i.sin = Em),
    (i.sinh = Im),
    (i.sqrt = Cm),
    (i.sub = Tm),
    (i.sum = Am),
    (i.tan = Rm),
    (i.tanh = Pm),
    (i.trunc = Mm),
    e === void 0 && (e = {}),
    e && e.defaults !== !0)
  )
    for (
      r = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"],
        n = 0;
      n < r.length;
    )
      e.hasOwnProperty((t = r[n++])) || (e[t] = this[t]);
  return (i.config(e), i);
}
function lm(e, n) {
  return new this(e).div(n);
}
function um(e) {
  return new this(e).exp();
}
function cm(e) {
  return q((e = new this(e)), e.e + 1, 3);
}
function dm() {
  var e,
    n,
    t = new this(0);
  for (ee = !1, e = 0; e < arguments.length;)
    if (((n = new this(arguments[e++])), n.d)) t.d && (t = t.plus(n.times(n)));
    else {
      if (n.s) return ((ee = !0), new this(1 / 0));
      t = n;
    }
  return ((ee = !0), t.sqrt());
}
function rl(e) {
  return e instanceof J || (e && e.toStringTag === al) || !1;
}
function fm(e) {
  return new this(e).ln();
}
function pm(e, n) {
  return new this(e).log(n);
}
function mm(e) {
  return new this(e).log(2);
}
function hm(e) {
  return new this(e).log(10);
}
function gm() {
  return dl(this, arguments, -1);
}
function wm() {
  return dl(this, arguments, 1);
}
function xm(e, n) {
  return new this(e).mod(n);
}
function km(e, n) {
  return new this(e).mul(n);
}
function bm(e, n) {
  return new this(e).pow(n);
}
function ym(e) {
  var n,
    t,
    r,
    i,
    o = 0,
    s = new this(1),
    a = [];
  if ((e === void 0 ? (e = this.precision) : Ve(e, 1, Vt), (r = Math.ceil(e / K)), this.crypto))
    if (crypto.getRandomValues)
      for (n = crypto.getRandomValues(new Uint32Array(r)); o < r;)
        ((i = n[o]),
          i >= 429e7 ? (n[o] = crypto.getRandomValues(new Uint32Array(1))[0]) : (a[o++] = i % 1e7));
    else if (crypto.randomBytes) {
      for (n = crypto.randomBytes((r *= 4)); o < r;)
        ((i = n[o] + (n[o + 1] << 8) + (n[o + 2] << 16) + ((n[o + 3] & 127) << 24)),
          i >= 214e7 ? crypto.randomBytes(4).copy(n, o) : (a.push(i % 1e7), (o += 4)));
      o = r / 4;
    } else throw Error(sl);
  else for (; o < r;) a[o++] = (Math.random() * 1e7) | 0;
  for (
    r = a[--o], e %= K, r && e && ((i = Ee(10, K - e)), (a[o] = ((r / i) | 0) * i));
    a[o] === 0;
    o--
  )
    a.pop();
  if (o < 0) ((t = 0), (a = [0]));
  else {
    for (t = -1; a[0] === 0; t -= K) a.shift();
    for (r = 1, i = a[0]; i >= 10; i /= 10) r++;
    r < K && (t -= K - r);
  }
  return ((s.e = t), (s.d = a), s);
}
function vm(e) {
  return q((e = new this(e)), e.e + 1, this.rounding);
}
function Sm(e) {
  return ((e = new this(e)), e.d ? (e.d[0] ? e.s : 0 * e.s) : e.s || NaN);
}
function Em(e) {
  return new this(e).sin();
}
function Im(e) {
  return new this(e).sinh();
}
function Cm(e) {
  return new this(e).sqrt();
}
function Tm(e, n) {
  return new this(e).sub(n);
}
function Am() {
  var e = 0,
    n = arguments,
    t = new this(n[e]);
  for (ee = !1; t.s && ++e < n.length;) t = t.plus(n[e]);
  return ((ee = !0), q(t, this.precision, this.rounding));
}
function Rm(e) {
  return new this(e).tan();
}
function Pm(e) {
  return new this(e).tanh();
}
function Mm(e) {
  return q((e = new this(e)), e.e + 1, 1);
}
N[Symbol.for("nodejs.util.inspect.custom")] = N.toString;
N[Symbol.toStringTag] = "Decimal";
var J = (N.constructor = ml(Ro));
Rr = new J(Rr);
Pr = new J(Pr);
var No = new Set(["==", "!=", "<", "<=", ">", ">="]);
var hl = { Σ: "SUM", "\u2211": "SUM", "\u221A": "SQRT" },
  $r = {
    "|": { close: "|", fn: "ABS" },
    "\u230A": { close: "\u230B", fn: "FLOOR", step: "1" },
    "\u2308": { close: "\u2309", fn: "CEILING", step: "1" },
  },
  gl = Object.fromEntries(
    Object.entries($r)
      .filter(([e, n]) => n.close !== e)
      .map(([e, n]) => [n.close, e]),
  ),
  wl = new Set(Object.entries($r).flatMap(([e, n]) => [e, n.close]));
var Y = class extends Error {
  constructor(t, r, i) {
    super(t);
    W(this, "start");
    W(this, "end");
    W(this, "bindingName");
    ((this.name = "LangError"), (this.start = r), (this.end = i));
  }
};
var Fm = new Set(["and", "or", "not"]),
  Nm = /^\d{4}-\d{2}-\d{2}/,
  Dm = "VisiMark has no boolean literals; use `IF()` to produce a number or a string",
  wn = (e) => e >= "0" && e <= "9",
  $m = (e) => /[A-Za-z_]/.test(e),
  Lm = (e) => /[A-Za-z0-9_]/.test(e),
  Om = ["==", "!=", "<=", ">=", "^", "*", "/", "+", "-", "<", ">", "="];
function Do(e) {
  var i, o, s;
  let n = [],
    t = 0,
    r = (a, l, u, c) => n.push({ kind: a, value: l, start: u, end: c });
  for (; t < e.length;) {
    let a = e[t];
    if (
      a === " " ||
      a === "	" ||
      a ===
        `
` ||
      a === "\r"
    ) {
      t++;
      continue;
    }
    if (a === "#") throw new Y("unexpected `#` in expression", t, t + 1);
    if (a === "(") {
      (r("lparen", "(", t, t + 1), t++);
      continue;
    }
    if (a === ")") {
      (r("rparen", ")", t, t + 1), t++);
      continue;
    }
    if (a === ",") {
      (r("comma", ",", t, t + 1), t++);
      continue;
    }
    if (a === ":") {
      (r("colon", ":", t, t + 1), t++);
      continue;
    }
    if (a === '"') {
      let c = t;
      t++;
      let d = "";
      for (; t < e.length && e[t] !== '"';) ((d += e[t]), t++);
      if (t >= e.length) throw new Y("unterminated string literal", c, e.length);
      (t++, r("string", d, c, t));
      continue;
    }
    if (wn(a)) {
      let c = e.slice(t),
        d = Nm.exec(c);
      if (d && !wn((i = c[10]) != null ? i : "")) {
        (r("date", d[0], t, t + 10), (t += 10));
        continue;
      }
      let f = t;
      for (; t < e.length && wn(e[t]);) t++;
      if (e[t] === "." && wn((o = e[t + 1]) != null ? o : ""))
        for (t++; t < e.length && wn(e[t]);) t++;
      if (e[t] === "," && wn((s = e[t + 1]) != null ? s : ""))
        throw new Y(
          "thousands separators are not allowed; write the number without separators",
          f,
          t + 1,
        );
      let p = e.slice(f, t);
      e[t] === "%" ? (t++, r("percent", p, f, t)) : r("number", p, f, t);
      continue;
    }
    if (a === ".") {
      (r("dot", ".", t, t + 1), t++);
      continue;
    }
    let l = hl[a];
    if (l !== void 0) {
      (r("ident", l, t, t + 1), t++);
      continue;
    }
    if (wl.has(a)) {
      (r("delim", a, t, t + 1), t++);
      continue;
    }
    if ($m(a)) {
      let c = t;
      for (; t < e.length && Lm(e[t]);) t++;
      let d = e.slice(c, t);
      if (d === "true" || d === "false") throw new Y(Dm, c, t);
      Fm.has(d)
        ? r("op", d, c, t)
        : r(
            d === "chart"
              ? "chart"
              : d === "assert"
                ? "assert"
                : d === "precision"
                  ? "precision"
                  : d === "is"
                    ? "is"
                    : "ident",
            d,
            c,
            t,
          );
      continue;
    }
    let u = Om.find((c) => e.startsWith(c, t));
    if (u) {
      (r("op", u, t, t + u.length), (t += u.length));
      continue;
    }
    throw new Y(`unexpected character ${JSON.stringify(a)}`, t, t + 1);
  }
  return (r("eof", "", e.length, e.length), n);
}
var _m = {
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
  Vm = new Set(["^"]),
  Bm = 5,
  zm = 2,
  $o = 256,
  xl = `expression nests more than ${$o} levels deep`;
function Um(e) {
  let n = { depth: 0, at: e },
    t = [{ node: e, depth: 1 }];
  for (;;) {
    let r = t.pop();
    if (r === void 0) break;
    let { node: i, depth: o } = r;
    switch ((o > n.depth && (n = { depth: o, at: i }), i.type)) {
      case "unary":
        t.push({ node: i.operand, depth: o + 1 });
        break;
      case "binary":
        (t.push({ node: i.left, depth: o + 1 }), t.push({ node: i.right, depth: o + 1 }));
        break;
      case "call":
        for (let s of i.args) t.push({ node: s, depth: o + 1 });
        break;
      default:
        break;
    }
  }
  return n;
}
var Or = class {
  constructor(n) {
    W(this, "toks", n);
    W(this, "pos", 0);
    W(this, "depth", 0);
  }
  peek() {
    return this.toks[this.pos];
  }
  next() {
    return this.toks[this.pos++];
  }
  expect(n, t) {
    let r = this.peek();
    if (r.kind !== n) throw new Y(`expected ${t}`, r.start, r.end);
    return this.next();
  }
  parseTopLevel() {
    let n = this.parseBp(0),
      t = this.peek();
    if (t.kind !== "eof")
      throw new Y(
        `unexpected ${t.kind === "op" ? `operator \`${t.value}\`` : t.kind === "delim" ? `\`${t.value}\`` : t.kind}`,
        t.start,
        t.end,
      );
    let r = Um(n);
    if (r.depth > $o) throw new Y(xl, r.at.start, r.at.end);
    return n;
  }
  parseBp(n) {
    if (++this.depth > $o) {
      this.depth--;
      let t = this.peek();
      throw new Y(xl, t.start, t.end);
    }
    try {
      return this.parseBpInner(n);
    } finally {
      this.depth--;
    }
  }
  parseBpInner(n) {
    let t = this.nud();
    for (;;) {
      let r = this.peek();
      if (r.kind !== "op") break;
      let i = _m[r.value];
      if (i === void 0 || i <= n) break;
      if (No.has(r.value) && t.type === "binary" && No.has(t.op))
        throw new Y("comparisons do not chain; use `and` to combine them", r.start, r.end);
      this.next();
      let o = Vm.has(r.value) ? i - 1 : i,
        s = this.parseBp(o);
      t = { type: "binary", op: r.value, left: t, right: s, start: t.start, end: s.end };
    }
    return t;
  }
  nud() {
    let n = this.next();
    switch (n.kind) {
      case "number":
        return { type: "num", value: n.value, start: n.start, end: n.end };
      case "percent":
        return {
          type: "num",
          value: new J(n.value).div(100).toString(),
          start: n.start,
          end: n.end,
        };
      case "date":
        return { type: "date", value: n.value, start: n.start, end: n.end };
      case "string":
        return { type: "str", value: n.value, start: n.start, end: n.end };
      case "ident":
        return this.identTail(n);
      case "lparen": {
        let t = this.parseBp(0),
          r = this.expect("rparen", "`)`");
        return ((t.start = n.start), (t.end = r.end), t);
      }
      case "delim": {
        let t = $r[n.value];
        if (!t) throw new Y(`\`${n.value}\` has no opening \`${gl[n.value]}\``, n.start, n.end);
        let r = this.parseBp(0),
          i = this.peek();
        if (i.kind !== "delim" || i.value !== t.close)
          throw new Y(`expected \`${t.close}\``, i.start, i.end);
        this.next();
        let o = [r];
        return (
          t.step !== void 0 && o.push({ type: "num", value: t.step, start: i.start, end: i.end }),
          { type: "call", name: t.fn, args: o, start: n.start, end: i.end }
        );
      }
      case "op":
        if (n.value === "-") {
          let t = this.parseBp(Bm);
          return { type: "unary", op: "-", operand: t, start: n.start, end: t.end };
        }
        if (n.value === "not") {
          let t = this.parseBp(zm);
          return { type: "unary", op: "not", operand: t, start: n.start, end: t.end };
        }
        throw new Y(`unexpected operator \`${n.value}\``, n.start, n.end);
      default:
        throw new Y(`unexpected ${n.kind}`, n.start, n.end);
    }
  }
  identTail(n) {
    if (this.peek().kind === "dot") {
      this.next();
      let t = this.expect("ident", "a name after `.`");
      return { type: "ref", qualifier: n.value, name: t.value, start: n.start, end: t.end };
    }
    if (this.peek().kind === "lparen") {
      this.next();
      let t = [];
      if (this.peek().kind !== "rparen")
        for (t.push(this.parseBp(0)); this.peek().kind === "comma";)
          (this.next(), t.push(this.parseBp(0)));
      let r = this.expect("rparen", "`)`");
      return { type: "call", name: n.value, args: t, start: n.start, end: r.end };
    }
    return { type: "ref", name: n.value, start: n.start, end: n.end };
  }
};
var bl = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/;
function Lo(e) {
  try {
    return Hm(e);
  } catch (n) {
    if (n instanceof Y && n.bindingName === void 0) {
      let t = bl.exec(e);
      t && (n.bindingName = t[1]);
    }
    throw n;
  }
}
function yl(e) {
  try {
    return jm(e);
  } catch (n) {
    if (n instanceof Y && n.bindingName === void 0) {
      let t = bl.exec(e);
      t && (n.bindingName = t[1]);
    }
    throw n;
  }
}
function jm(e) {
  var o;
  let n = Do(e),
    t = n.find((s) => s.kind !== "eof");
  if ((t == null ? void 0 : t.kind) === "chart") return Km(n, t);
  if (n.some((s) => s.kind === "chart")) {
    let s = n.find((a) => a.kind === "chart");
    throw new Y("`chart` is a keyword", s.start, s.end);
  }
  if ((t == null ? void 0 : t.kind) === "assert") {
    let s = n.slice(n.indexOf(t) + 1);
    if (((o = s[0]) == null ? void 0 : o.kind) === "op" && s[0].value === "=")
      throw new Y("`assert` is a keyword", t.start, t.end);
    if (s.length === 1 && s[0].kind === "eof")
      throw new Y("assert needs an expression", t.start, t.end);
    let a = new Or(s).parseTopLevel();
    return { type: "assert", expr: a, start: t.start, end: a.end };
  }
  if (n.some((s) => s.kind === "assert")) {
    let s = n.find((a) => a.kind === "assert");
    throw new Y("`assert` is a keyword", s.start, s.end);
  }
  if ((t == null ? void 0 : t.kind) === "string") {
    let s = n.indexOf(t) + 1,
      a = n[s];
    if ((a == null ? void 0 : a.kind) === "is") return Qm(n, t, a);
  }
  if (n.some((s) => s.kind === "is")) {
    let s = n.find((a) => a.kind === "is");
    throw new Y("`is` is a keyword", s.start, s.end);
  }
  if ((t == null ? void 0 : t.kind) === "ident" && t.value === "param") {
    let s = n[n.indexOf(t) + 1];
    if ((s == null ? void 0 : s.kind) === "ident" || (s == null ? void 0 : s.kind) === "string")
      return qm(e, n, t, s);
  }
  let r = n.findIndex((s) => s.kind === "op" && s.value === "="),
    i = n.findIndex((s) => s.kind === "precision");
  if (i !== -1 && r !== -1 && i > r) {
    let s = n[i];
    throw new Y("`precision` is a keyword", s.start, s.end);
  }
  return Lo(e);
}
function Hm(e) {
  var c, d, f, p;
  let n = Do(e),
    t = n.findIndex((m) => m.kind === "op" && m.value === "=");
  if (t === -1) throw new Y("binding has no `=`", 0, e.length);
  let i = n.slice(0, t).filter((m) => m.kind !== "eof"),
    { nameToks: o, precision: s } = vl(i);
  if (o.length !== 1 || (o[0].kind !== "ident" && o[0].kind !== "string")) {
    let m = (d = (c = o[0]) == null ? void 0 : c.start) != null ? d : 0,
      h = (p = (f = o[o.length - 1]) == null ? void 0 : f.end) != null ? p : e.length;
    throw new Y("the left of `=` must be a name or a quoted column header", m, h);
  }
  let a = o[0],
    l = n.slice(t + 1),
    u = new Or(l).parseTopLevel();
  return {
    name: a.value,
    expr: u,
    nameStart: a.start,
    nameEnd: a.end,
    quoted: a.kind === "string",
    ...(s === void 0 ? {} : { precision: s }),
  };
}
var Wm = "a param default must be a number literal";
function qm(e, n, t, r) {
  try {
    return Gm(e, n, t, r);
  } catch (i) {
    throw (i instanceof Y && i.bindingName === void 0 && (i.bindingName = r.value), i);
  }
}
function Gm(e, n, t, r) {
  var w, g, S;
  if (r.kind === "string")
    throw new Y("a param name must be an identifier, not a quoted header", r.start, r.end);
  let i = n.findIndex((b) => b.kind === "op" && b.value === "=");
  if (i === -1) throw new Y("binding has no `=`", t.start, e.length);
  let o = n.slice(n.indexOf(r), i),
    { nameToks: s, precision: a } = vl(o);
  if (s.length !== 1) {
    let b = (w = s[1]) != null ? w : s[0];
    throw new Y(`unexpected ${b.kind}`, b.start, b.end);
  }
  let l = n[i + 1];
  if (l.kind !== "ident" || l.value !== "default")
    throw new Y("expected `default` after `=` in a param", l.start, l.end);
  let u = i + 2,
    c = !1,
    d = n[u].start;
  ((g = n[u]) == null ? void 0 : g.kind) === "op" && n[u].value === "-" && ((c = !0), u++);
  let f = n[u];
  if (
    (f.kind !== "number" && f.kind !== "percent") ||
    ((S = n[u + 1]) == null ? void 0 : S.kind) !== "eof"
  ) {
    let b = n[i + 2];
    throw new Y(Wm, b.start, Math.max(e.length, b.end));
  }
  let p = f.kind === "percent",
    m = p ? new J(f.value).div(100).toString() : f.value,
    h = c ? `-${m}` : m;
  return {
    name: r.value,
    expr: { type: "num", value: h, start: d, end: f.end },
    nameStart: r.start,
    nameEnd: r.end,
    quoted: !1,
    ...(a === void 0 ? {} : { precision: a }),
    param: { text: e.slice(d, f.end), percent: p },
  };
}
var kl = "precision must be a whole number from 0 to 18",
  Ym = "`precision` is a keyword \u2014 write `precision 2`, not `precision = 2`",
  Zm = 18;
function vl(e) {
  var s, a, l;
  let n = e.findIndex((u) => u.kind === "precision");
  if (n === -1) return { nameToks: e };
  let t = e[n];
  if (n === 0) throw new Y(Ym, t.start, t.end);
  let r = e.slice(n + 1),
    i = r[0];
  if (r.length !== 1 || (i == null ? void 0 : i.kind) !== "number" || !/^\d+$/.test(i.value)) {
    let u = (s = i == null ? void 0 : i.start) != null ? s : t.start,
      c = (l = (a = r[r.length - 1]) == null ? void 0 : a.end) != null ? l : t.end;
    throw new Y(kl, u, c);
  }
  let o = Number(i.value);
  if (!Number.isInteger(o) || o < 0 || o > Zm) throw new Y(kl, i.start, i.end);
  return { nameToks: e.slice(0, n), precision: o };
}
var Lr = "aspect needs two positive integers, as `16:9`";
function Km(e, n) {
  let t = e.indexOf(n) + 1,
    r = () => {
      var m;
      return (m = e[t]) != null ? m : e[e.length - 1];
    },
    i = (m) => {
      let h = r();
      if (h.kind === "op") throw new Y("a chart takes a column, not an expression", h.start, h.end);
      if (h.kind !== "ident") throw new Y(`expected ${m}`, h.start, h.end);
      return (t++, h);
    },
    o = (m) => {
      let h = r();
      if (h.kind === "op") throw new Y("a chart takes a column, not an expression", h.start, h.end);
      if (h.kind !== "ident" || h.value !== m) throw new Y(`expected \`${m}\``, h.start, h.end);
      t++;
    };
  if (r().kind === "op" && r().value === "=") throw new Y("`chart` is a keyword", n.start, n.end);
  if (r().kind === "ident" && r().value === "as")
    throw new Y("a chart needs a name", n.start, r().end);
  let s = i("a chart name").value;
  o("as");
  let a = i("a chart type"),
    l = a.value;
  if (r().kind === "op" && r().value === "-" && r().start === a.end) {
    let m = r();
    t++;
    let h = r();
    if (h.kind !== "ident" || h.start !== m.end)
      throw new Y("expected a chart type", a.start, m.end);
    (t++, (l = `${l}-${h.value}`));
  }
  o("of");
  let u = (m) => {
      let h = i(m).value;
      return r().kind === "dot" ? (t++, `${h}.${i(m).value}`) : h;
    },
    c = [];
  for (;;) {
    if ((c.push(u("a column name")), r().kind === "comma")) {
      t++;
      continue;
    }
    break;
  }
  o("labelled");
  let d = u("a label column"),
    f = null;
  if (r().kind === "ident" && r().value === "aspect") {
    let m = r();
    t++;
    let h = r();
    if (h.kind !== "number") throw new Y(Lr, m.start, h.end);
    if ((t++, r().kind !== "colon")) throw new Y(Lr, m.start, r().end);
    t++;
    let w = r();
    if (w.kind !== "number") throw new Y(Lr, m.start, w.end);
    t++;
    let g = Number(h.value),
      S = Number(w.value);
    if (!Number.isInteger(g) || !Number.isInteger(S) || g < 1 || S < 1)
      throw new Y(Lr, m.start, w.end);
    f = { w: g, h: S };
  }
  let p = r();
  if (p.kind !== "eof")
    throw new Y(
      `unexpected ${p.kind === "op" ? `operator \`${p.value}\`` : p.kind}`,
      p.start,
      p.end,
    );
  return {
    type: "chart",
    name: s,
    engine: l,
    series: c,
    labels: d,
    aspect: f,
    start: n.start,
    end: p.start,
  };
}
function Qm(e, n, t) {
  let r = e.indexOf(t) + 1,
    i = () => {
      var a;
      return (a = e[r]) != null ? a : e[e.length - 1];
    },
    o = i();
  if (o.kind !== "ident") throw new Y("expected a name after `is`", o.start, o.end);
  r++;
  let s = i();
  if (s.kind !== "eof")
    throw new Y(
      `unexpected ${s.kind === "op" ? `operator \`${s.value}\`` : s.kind}`,
      s.start,
      s.end,
    );
  return { type: "alias", header: n.value, symbol: o.value, start: n.start, end: o.end };
}
function Sl(e, n) {
  let t = e.length,
    r = n.length;
  if (t === 0) return r;
  if (r === 0) return t;
  let i = Array.from({ length: r + 1 }, (s, a) => a),
    o = Array.from({ length: r + 1 });
  for (let s = 1; s <= t; s++) {
    o[0] = s;
    for (let a = 1; a <= r; a++) {
      let l = e[s - 1] === n[a - 1] ? 0 : 1;
      o[a] = Math.min(i[a] + 1, o[a - 1] + 1, i[a - 1] + l);
    }
    [i, o] = [o, i];
  }
  return i[r];
}
function Jm(e, n) {
  let t = 0;
  for (; t < e.length && t < n.length && e[t] === n[t];) t++;
  return t;
}
function De(e, n, t = 1 / 0) {
  let r = null,
    i = 1 / 0,
    o = -1;
  for (let s of n) {
    if (s === e) continue;
    let a = Sl(e, s);
    if (a > t) continue;
    let l = Jm(e, s);
    (a < i || (a === i && l > o) || (a === i && l === o && r !== null && s < r)) &&
      ((r = s), (i = a), (o = l));
  }
  return r;
}
var _r = new Set([
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
  "PRECISION",
  "ARTIFACT",
  "IMPORT",
  "COVERAGE",
]);
function Vr(e) {
  return e.code === "STALE" || _r.has(e.code);
}
var Br = "";
var Xm = /^[A-Za-z_][A-Za-z0-9_]*$/;
function eh(e) {
  var i;
  let n = new Set(),
    t = [],
    r = (o) => {
      n.has(o) || (n.add(o), t.push(o));
    };
  /[0-9]/.test((i = e[0]) != null ? i : "") && r(e[0]);
  for (let o of e) /[A-Za-z0-9_]/.test(o) || r(o);
  return t;
}
function th(e, n, t, r) {
  for (let i of e.bindings) {
    let o = El(i, n, r, Br);
    if (!o) continue;
    if (o.kind === "assert") {
      r.push({
        code: "SHEET",
        message: "`assert` must be in a `#id` sheet block",
        sourceOffset: o.assertion.span.start,
        span: o.assertion.span,
      });
      continue;
    }
    if (o.kind === "chart") {
      r.push({
        code: "SHEET",
        message: "`chart` must be in a `#id` sheet block",
        sourceOffset: o.chart.span.start,
        span: o.chart.span,
      });
      continue;
    }
    if (o.kind === "alias") {
      r.push({
        code: "SHEET",
        message: "`is` must be in a `#id` sheet block",
        sourceOffset: o.alias.span.start,
        span: o.alias.span,
      });
      continue;
    }
    if (o.quoted) {
      r.push({
        code: "SHEET",
        message: "a quoted column header must be in a `#id` sheet block",
        sourceOffset: o.binding.span.start,
        span: o.binding.span,
      });
      continue;
    }
    let s = o.binding,
      a = t.get(s.name);
    if (a) {
      r.push({ code: "DUP", name: s.name, span: s.span, relatedSpan: a.span });
      continue;
    }
    t.set(s.name, s);
  }
}
function qe(e) {
  var o, s, a, l, u, c, d, f, p, m, h, w, g, S, b, I, R, y, T, M, P, E, U;
  let n = new Map(),
    t = new Map(),
    r = [],
    i = new Map();
  for (let _ of e.blocks) {
    if (_.sheetId === null) {
      th(_, e.source, t, r);
      continue;
    }
    let C = _.sheetId;
    i.set(C, _);
    let $ = (o = e.tableBeforeBlock.get(_)) != null ? o : null,
      D = nh(n, C, $, _.importDecl);
    if (
      (_.grammarError &&
        r.push({
          code: "TYPE",
          sheetId: C,
          message: _.grammarError.message,
          sourceOffset: _.grammarError.span.start,
          span: _.grammarError.span,
        }),
      _.importDecl &&
        $ !== null &&
        r.push({
          code: "SHEET",
          sheetId: C,
          message: "an imported sheet may not also own an inline table",
          sourceOffset: _.importDecl.declSpan.start,
          span: _.importDecl.declSpan,
        }),
      !Xm.test(C))
    ) {
      let x = eh(C),
        H = x.length === 1 ? "invalid character" : "invalid characters",
        ie = x.map((k) => "`" + k + "`").join(", ");
      r.push({
        code: "SHEET",
        sheetId: C,
        message: `sheet id \`${C}\` is not a valid identifier \u2014 ${H} ${ie}`,
        sourceOffset: _.span.start,
        span: _.span,
      });
    }
    e.detachedTableBlocks.has(_) &&
      r.push({
        code: "SHEET",
        sheetId: C,
        message: "this block declares column rules but no table immediately precedes it",
        sourceOffset: _.span.start,
        span: _.span,
      });
    let z = new Map(),
      ue = new Map();
    ((s = $ == null ? void 0 : $.headers) != null ? s : []).forEach((x, H) => {
      let ie = ue.get(x.text);
      if (ie) {
        (r.push({
          code: "DUP",
          sheetId: C,
          name: x.text,
          span: { start: x.start, end: x.end },
          relatedSpan: ie,
        }),
          z.delete(x.text));
        return;
      }
      (ue.set(x.text, { start: x.start, end: x.end }), z.set(x.text, H));
    });
    let we = [];
    for (let x of _.bindings) {
      let H = El(x, e.source, r, C);
      H && we.push(H);
    }
    let $e = new Set(we.flatMap((x) => (x.kind === "chart" ? [x.chart.name] : [])));
    for (let x of we) {
      if (x.kind !== "alias") continue;
      let { header: H, symbol: ie, span: k } = x.alias;
      if (!z.has(H)) {
        r.push({
          code: "UNDEF",
          sheetId: C,
          name: ie,
          raw: H,
          suggestion: (a = De(H, z.keys())) != null ? a : void 0,
          span: k,
        });
        continue;
      }
      let xe = z.has(ie) ? ue.get(ie) : void 0,
        Pe =
          (w =
            (h =
              (m =
                (f =
                  (c = (l = D.columns.get(ie)) == null ? void 0 : l.span) != null
                    ? c
                    : (u = D.scalars.get(ie)) == null
                      ? void 0
                      : u.span) != null
                  ? f
                  : (d = D.aliases.get(ie)) == null
                    ? void 0
                    : d.span) != null
                ? m
                : (p = D.charts.find((je) => je.name === ie)) == null
                  ? void 0
                  : p.span) != null
              ? h
              : xe) != null
            ? w
            : $e.has(ie)
              ? k
              : void 0;
      if (Pe) {
        r.push({ code: "DUP", sheetId: C, name: ie, span: k, relatedSpan: Pe });
        continue;
      }
      D.aliases.set(ie, { header: H, span: k });
    }
    for (let x of we) {
      if (x.kind === "alias") continue;
      if (x.kind === "assert") {
        D.assertions.push(x.assertion);
        continue;
      }
      if (x.kind === "chart") {
        if ($ === null) {
          r.push({
            code: "SHEET",
            sheetId: C,
            message: "a chart needs a table",
            sourceOffset: x.chart.span.start,
            span: x.chart.span,
          });
          continue;
        }
        let je =
          (T =
            (R =
              (b = (g = D.columns.get(x.chart.name)) == null ? void 0 : g.span) != null
                ? b
                : (S = D.scalars.get(x.chart.name)) == null
                  ? void 0
                  : S.span) != null
              ? R
              : (I = D.charts.find((He) => He.name === x.chart.name)) == null
                ? void 0
                : I.span) != null
            ? T
            : (y = D.aliases.get(x.chart.name)) == null
              ? void 0
              : y.span;
        if (je) {
          r.push({
            code: "DUP",
            sheetId: C,
            name: x.chart.name,
            span: x.chart.span,
            relatedSpan: je,
          });
          continue;
        }
        D.charts.push(x.chart);
        continue;
      }
      let H = x.binding,
        ie = x.quoted ? void 0 : D.aliases.get(H.name);
      if (ie) {
        let je = D.columns.get(ie.header);
        if (je) {
          r.push({ code: "DUP", sheetId: C, name: H.name, span: H.span, relatedSpan: je.span });
          continue;
        }
        ((H.name = ie.header),
          (H.id = `${C}.${ie.header}`),
          (H.kind = "column"),
          D.columns.set(ie.header, H));
        let He = (M = z.get(ie.header)) != null ? M : D.columnIndex.get(ie.header);
        (He !== void 0 && D.columnIndex.set(ie.header, He), D.inputColumns.delete(ie.header));
        continue;
      }
      let k = H.param !== void 0 ? ue.get(H.name) : void 0;
      if (k) {
        r.push({ code: "DUP", sheetId: C, name: H.name, span: H.span, relatedSpan: k });
        continue;
      }
      let xe = (P = D.columns.get(H.name)) != null ? P : D.scalars.get(H.name);
      if (xe) {
        r.push({ code: "DUP", sheetId: C, name: H.name, span: H.span, relatedSpan: xe.span });
        continue;
      }
      if (x.quoted && !z.has(H.name)) {
        r.push({
          code: "UNDEF",
          sheetId: C,
          name: H.name,
          raw: H.name,
          suggestion: (E = De(H.name, z.keys())) != null ? E : void 0,
          span: H.span,
        });
        continue;
      }
      let Pe = $ !== null && z.has(H.name);
      ((H.kind = Pe ? "column" : "scalar"),
        Pe
          ? (D.columns.set(H.name, H), D.columnIndex.set(H.name, z.get(H.name)))
          : D.scalars.set(H.name, H));
    }
    for (let [x, H] of z) D.columns.has(x) || (D.inputColumns.add(x), D.columnIndex.set(x, H));
  }
  for (let _ of n.values())
    for (let [C, $] of _.scalars) {
      if ($.param === void 0 || !_.columnIndex.has(C)) continue;
      let D = (U = _.table) == null ? void 0 : U.headers.find((z) => z.text === C);
      (_.scalars.delete(C),
        r.push({
          code: "DUP",
          sheetId: _.id,
          name: C,
          span: $.span,
          ...(D ? { relatedSpan: { start: D.start, end: D.end } } : {}),
        }));
    }
  for (let _ of e.malformedAnchors)
    r.push({
      code: "ANCHOR",
      message:
        "malformed anchor comment \u2014 expected `<!--vmark=sheet.name-->` or `<!--vmark=sheet.name%-->`",
      sourceOffset: _.start,
      span: _,
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
function nh(e, n, t, r = null) {
  let i = e.get(n);
  return (
    i
      ? (i.table === null && t !== null && (i.table = t),
        i.imported === null && r !== null && (i.imported = r))
      : ((i = {
          id: n,
          table: t,
          columns: new Map(),
          scalars: new Map(),
          columnIndex: new Map(),
          inputColumns: new Set(),
          aliases: new Map(),
          assertions: [],
          charts: [],
          imported: r,
        }),
        e.set(n, i)),
    i
  );
}
function El(e, n, t, r) {
  try {
    let i = yl(e.raw);
    return "type" in i && i.type === "chart"
      ? {
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
        }
      : "type" in i && i.type === "alias"
        ? {
            kind: "alias",
            alias: { header: i.header, symbol: i.symbol, span: { start: e.start, end: e.end } },
          }
        : "type" in i
          ? (xn(i.expr, e.start),
            {
              kind: "assert",
              assertion: {
                sheetId: r,
                expr: i.expr,
                span: { start: e.start, end: e.end },
                source: e.raw,
                id: `${r}::assert@${e.start}`,
              },
            })
          : (xn(i.expr, e.start),
            {
              kind: "binding",
              quoted: i.quoted,
              binding: {
                id: r === Br ? i.name : `${r}.${i.name}`,
                sheetId: r,
                name: i.name,
                expr: i.expr,
                kind: "scalar",
                ...(i.precision === void 0 ? {} : { precision: i.precision }),
                ...(i.param === void 0 ? {} : { param: i.param }),
                span: { start: e.start, end: e.end },
              },
            });
  } catch (i) {
    if (i instanceof Y)
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
function xn(e, n) {
  switch (((e.start += n), (e.end += n), e.type)) {
    case "unary":
      xn(e.operand, n);
      break;
    case "binary":
      (xn(e.left, n), xn(e.right, n));
      break;
    case "call":
      for (let t of e.args) xn(t, n);
      break;
  }
}
var kn = 40;
J.set({ precision: kn, rounding: J.ROUND_HALF_UP });
var le = (e) => {
    let n = e instanceof J ? e : new J(e);
    if (!n.isFinite()) throw new re("result is not a finite decimal");
    return { t: "num", d: n };
  },
  vt = (e) => ({ t: "date", iso: e }),
  Ur = (e) => ({ t: "str", s: e }),
  bn = (e) => ({ t: "bool", b: e }),
  re = class extends Error {
    constructor(t) {
      super(t);
      W(this, "code", "TYPE");
      this.name = "EvalError";
    }
  },
  zr = class extends re {
    constructor(t) {
      super(t);
      W(this, "code", "DATE");
      this.name = "DateError";
    }
  };
function Oo(e, n) {
  return Math.max(1, e.abs().truncated().sd(!0)) + n > J.precision;
}
function Je(e, n) {
  let t = e.toDecimalPlaces(n, J.ROUND_HALF_UP);
  return t.isZero() ? new J(0) : t;
}
function _o(e, n) {
  return e.t !== n.t
    ? !1
    : e.t === "num" && n.t === "num"
      ? e.d.equals(n.d)
      : e.t === "date" && n.t === "date"
        ? e.iso === n.iso
        : e.t === "str" && n.t === "str"
          ? e.s === n.s
          : e.t === "bool" && n.t === "bool"
            ? e.b === n.b
            : !1;
}
var rh = /^(\d{4})-(\d{2})-(\d{2})$/,
  ih = /^(\d{1,4})([./-])(\d{1,4})\2(\d{1,4})$/;
function oh(e) {
  return (e % 4 === 0 && e % 100 !== 0) || e % 400 === 0;
}
function Il(e, n) {
  return [31, oh(e) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][n - 1];
}
function Vo(e, n, t) {
  return e >= 1 && e <= 9999 && n >= 1 && n <= 12 && t >= 1 && t <= Il(e, n);
}
var jr = (e, n, t) =>
  `${String(e).padStart(4, "0")}-${String(n).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
function Cl(e) {
  let n = rh.exec(e);
  if (n) {
    let [, r, i, o] = n;
    return Vo(+r, +i, +o) ? { ok: !0, iso: e } : { ok: !1, reason: "not a valid calendar date" };
  }
  let t = ih.exec(e);
  if (t) {
    let r = [t[1], t[3], t[4]].map(Number),
      i,
      o;
    if (t[1].length === 4) ((i = r[0]), (o = [r[1], r[2]]));
    else if (t[4].length === 4) ((i = r[2]), (o = [r[0], r[1]]));
    else return { ok: !1, reason: "not a date VisiMark can read" };
    let [s, a] = o,
      l = [];
    if (
      (Vo(i, a, s) && l.push(jr(i, a, s)),
      Vo(i, s, a) && s !== a && l.push(jr(i, s, a)),
      l.length === 0)
    )
      return { ok: !1, reason: "not a valid calendar date" };
    if (l.length === 1) return { ok: !1, reason: "non-ISO date order", decidable: l[0] };
    let [u, c] = l;
    return {
      ok: !1,
      reason: "ambiguous date order",
      ambiguous: { a: u, b: c, daysApart: Math.abs(zo(u, c).toNumber()) },
    };
  }
  return { ok: !1, reason: "not a date VisiMark can read" };
}
function Bo(e) {
  let [n, t, r] = e.split("-").map(Number);
  return Math.round(Date.UTC(n, t - 1, r) / 864e5);
}
function zo(e, n) {
  return new J(Bo(e) - Bo(n));
}
function Hr(e, n) {
  let t = (Bo(e) + n) * 864e5,
    r = new Date(t);
  return jr(r.getUTCFullYear(), r.getUTCMonth() + 1, r.getUTCDate());
}
function Tl(e, n) {
  let [t, r] = e.split("-").map(Number),
    i = t * 12 + (r - 1) + n,
    o = Math.floor(i / 12),
    s = i - o * 12 + 1;
  if (o < 1 || o > 9999)
    throw new zr(
      `EOMONTH result ${String(o).padStart(4, "0")}-${String(s).padStart(2, "0")} is outside the supported date range`,
    );
  return jr(o, s, Il(o, s));
}
var Al = {
    SUM: { kind: "reduce", arity: 1, column: 0 },
    MIN: { kind: "reduce", arity: 1, column: 0 },
    MAX: { kind: "reduce", arity: 1, column: 0 },
    AVG: { kind: "reduce", arity: 1, column: 0 },
    COUNT: { kind: "reduce", arity: 1, column: 0 },
    NPV: { kind: "reduce", arity: 2, column: 1 },
    IRR: { kind: "reduce", arity: 1, column: 0 },
    ROUND: { kind: "map", arity: 2 },
    ABS: { kind: "map", arity: 1 },
    MOD: { kind: "map", arity: 2 },
    SQRT: { kind: "map", arity: 1 },
    FLOOR: { kind: "map", arity: 2 },
    CEILING: { kind: "map", arity: 2 },
    IF: { kind: "map", arity: 3 },
    EOMONTH: { kind: "map", arity: 2 },
    PMT: { kind: "map", arity: 3 },
  },
  Be = new Map(Object.entries(Al)),
  yn = (e) => {
    var n;
    return ((n = Be.get(e)) == null ? void 0 : n.kind) === "reduce";
  };
function Wr(e, n) {
  let t = Be.get(e);
  return t
    ? n.length !== t.arity
      ? { kind: "arity", expected: t.arity, got: n.length }
      : t.kind === "reduce" && n[t.column].type !== "ref"
        ? { kind: "shape" }
        : null
    : { kind: "unknown" };
}
function vn(e, n) {
  switch (n.kind) {
    case "unknown":
      return `unknown function \`${e}\``;
    case "arity":
      return `${e}() takes ${n.expected} argument${n.expected === 1 ? "" : "s"}, got ${n.got}`;
    case "shape":
      return `${e}() takes a column reference, not an expression`;
    case "not-column":
      return `${e}() expects a column`;
  }
}
var Rl = new WeakMap();
function Pl(e) {
  return Rl.get(e);
}
function Ml(e, n, t) {
  return !Je(e, t).eq(Je(n, t));
}
function St(e, n) {
  switch (e.type) {
    case "num":
      return le(new J(e.value));
    case "date":
      return vt(e.value);
    case "str":
      return Ur(e.value);
    case "ref":
      return n.scalar(e);
    case "unary":
      return ah(e.op, St(e.operand, n));
    case "binary":
      return lh(e.op, St(e.left, n), St(e.right, n));
    case "call":
      return ch(e, n);
  }
}
function ce(e, n) {
  if (e.t !== "num") throw new re(`${n} expects a number`);
  return e.d;
}
function sh(e, n) {
  if (e.t !== "date") throw new re(`${n} expects a date`);
  return e.iso;
}
function ah(e, n) {
  if (e === "-") return le(ce(n, "unary minus").negated());
  if (n.t !== "bool") throw new re("`not` expects a boolean");
  return bn(!n.b);
}
function lh(e, n, t) {
  switch (e) {
    case "+":
      if (n.t === "num" && t.t === "num") return le(n.d.plus(t.d));
      if (n.t === "date" && t.t === "num") return vt(Hr(n.iso, Uo(t.d)));
      if (n.t === "num" && t.t === "date") return vt(Hr(t.iso, Uo(n.d)));
      throw new re("`+` needs two numbers or a date and a number");
    case "-":
      if (n.t === "num" && t.t === "num") return le(n.d.minus(t.d));
      if (n.t === "date" && t.t === "date") return le(zo(n.iso, t.iso));
      if (n.t === "date" && t.t === "num") return vt(Hr(n.iso, -Uo(t.d)));
      throw new re("`-` needs two numbers, two dates, or a date and a number");
    case "*":
      return le(ce(n, "`*`").times(ce(t, "`*`")));
    case "/": {
      let r = ce(n, "`/`"),
        i = ce(t, "`/`");
      if (i.isZero()) throw new re("division by zero");
      return le(r.div(i));
    }
    case "^":
      return le(ce(n, "`^`").pow(ce(t, "`^`")));
    case "and":
    case "or": {
      if (n.t !== "bool" || t.t !== "bool") throw new re(`\`${e}\` expects booleans`);
      return bn(e === "and" ? n.b && t.b : n.b || t.b);
    }
    case "==":
      return bn(_o(n, t));
    case "!=":
      return bn(!_o(n, t));
    case "<":
    case "<=":
    case ">":
    case ">=":
      return bn(uh(e, n, t));
    default:
      throw new re(`unknown operator \`${e}\``);
  }
}
function Uo(e) {
  if (!e.isInteger()) throw new re("date arithmetic needs a whole number of days");
  return e.toNumber();
}
function uh(e, n, t) {
  let r;
  if (n.t === "num" && t.t === "num") r = n.d.comparedTo(t.d);
  else if (n.t === "date" && t.t === "date") r = n.iso < t.iso ? -1 : n.iso > t.iso ? 1 : 0;
  else if (n.t === "str" && t.t === "str") r = n.s < t.s ? -1 : n.s > t.s ? 1 : 0;
  else throw new re(`\`${e}\` cannot compare those operands`);
  return e === "<" ? r < 0 : e === "<=" ? r <= 0 : e === ">" ? r > 0 : r >= 0;
}
function ch(e, n) {
  let { name: t, args: r } = e,
    i = Wr(t, r);
  if (i) throw new re(vn(t, i));
  if (yn(t)) {
    let s = Be.get(t),
      a = (s == null ? void 0 : s.kind) === "reduce" ? s.column : 0,
      l = r[a];
    if (!l || l.type !== "ref") throw new re(vn(t, { kind: "shape" }));
    if (t === "NPV") {
      let u = St(r[0], n);
      return fh(u, n.vector(l));
    }
    return t === "IRR" ? dh(n.vector(l)) : ph(t, n.vector(l));
  }
  let o = r.map((s) => St(s, n));
  switch (t) {
    case "ROUND":
      return le(Je(ce(o[0], "ROUND"), Number(ce(o[1], "ROUND"))));
    case "ABS":
      return le(ce(o[0], "ABS").abs());
    case "MOD": {
      let s = ce(o[0], "MOD"),
        a = ce(o[1], "MOD");
      if (a.isZero()) throw new re("division by zero");
      return le(s.mod(a));
    }
    case "SQRT": {
      let s = ce(o[0], "SQRT");
      if (s.isNegative() && !s.isZero()) throw new re("SQRT of a negative number");
      return le(s.sqrt());
    }
    case "FLOOR": {
      let s = ce(o[0], "FLOOR"),
        a = ce(o[1], "FLOOR");
      if (!a.gt(0)) throw new re("FLOOR significance must be a positive number");
      let l = s.div(a).floor().times(a);
      return le(l.isZero() ? new J(0) : l);
    }
    case "CEILING": {
      let s = ce(o[0], "CEILING"),
        a = ce(o[1], "CEILING");
      if (!a.gt(0)) throw new re("CEILING significance must be a positive number");
      let l = s.div(a).ceil().times(a);
      return le(l.isZero() ? new J(0) : l);
    }
    case "IF": {
      let s = o[0];
      if (s.t !== "bool") throw new re("IF() needs a boolean condition");
      return s.b ? o[1] : o[2];
    }
    case "EOMONTH": {
      let s = sh(o[0], "EOMONTH"),
        a = ce(o[1], "EOMONTH");
      if (!a.isInteger()) throw new re("EOMONTH expects a whole number of months");
      return vt(Tl(s, a.toNumber()));
    }
    case "PMT": {
      let s = ce(o[0], "PMT"),
        a = ce(o[1], "PMT"),
        l = ce(o[2], "PMT");
      if (!a.isInteger() || !a.gt(0))
        throw new re("PMT expects a positive whole number of periods");
      if (!s.gt(-1)) throw new re("PMT rate must be greater than -1");
      if (s.isZero()) return le(l.div(a));
      let u = s.plus(1).pow(a),
        c = l.times(s).times(u).div(u.minus(1));
      return le(c.isZero() ? new J(0) : c);
    }
    default:
      throw new re(`unknown function \`${t}\``);
  }
}
function dh(e) {
  if (e.length === 0) throw new re("IRR() of an empty column");
  let n = e.map((m) => ce(m, "IRR"));
  if (n.every((m) => m.isZero())) throw new re("IRR() of an all-zero column");
  let t = 0,
    r = null;
  for (let m of n) m.isZero() || (r !== null && r.isNegative() !== m.isNegative() && t++, (r = m));
  if (t === 0) throw new re("IRR needs one sign change");
  if (t > 1) throw new re("IRR has more than one sign change");
  if (n.reduce((m, h) => m.plus(h), new J(0)).isZero()) return le(new J(0));
  let o = (m) => {
      let h = new J(0),
        w = m.plus(1);
      for (let g = 0; g < n.length; g++) h = h.plus(n[g].div(w.pow(g)));
      return h;
    },
    s = (m) => {
      let h = o(m);
      return h.isZero() ? 0 : h.isNeg() ? -1 : 1;
    },
    a = new J(-1).plus(new J(10).pow(-kn));
  a.gt(-1) || (a = new J(-1).plus(new J(10).pow(1 - kn)));
  let l = new J(1),
    u = s(a);
  if (u === 0) return le(a);
  let c = 0;
  for (; s(l) === u && c < 200;) ((l = l.times(2).plus(1)), c++);
  if (s(l) === 0) return le(l);
  if (s(l) === u) return le(a);
  for (let m = 0; m < 400; m++) {
    let h = a.plus(l).div(2),
      w = s(h);
    if (w === 0) return le(p(h));
    if ((w === u ? (a = h) : (l = h), l.minus(a).lt(new J(10).pow(-40)))) break;
  }
  let d = a.plus(l).div(2),
    f = p(d);
  if (o(f).isZero()) return le(f);
  return (Rl.set(d, { lo: a, hi: l }), le(d));
  function p(m) {
    for (let h = 0; h <= 20; h++) {
      let w = m.toDecimalPlaces(h, J.ROUND_HALF_UP);
      if (w.gt(-1) && o(w).isZero()) return w.isZero() ? new J(0) : w;
    }
    return m;
  }
}
function fh(e, n) {
  let t = ce(e, "NPV");
  if (!t.gt(-1)) throw new re("NPV rate must be greater than -1");
  if (n.length === 0) throw new re("NPV() of an empty column");
  let r = new J(0);
  for (let i = 0; i < n.length; i++) {
    let o = ce(n[i], "NPV");
    r = r.plus(o.div(t.plus(1).pow(i)));
  }
  return le(r.isZero() ? new J(0) : r);
}
function ph(e, n) {
  if (e === "COUNT") return le(n.length);
  if (e === "SUM") return le(n.reduce((r, i) => r.plus(ce(i, "SUM")), new J(0)));
  if (n.length === 0) throw new re(`${e}() of an empty column`);
  if (e === "AVG") {
    let r = n.reduce((i, o) => i.plus(ce(o, "AVG")), new J(0));
    return le(r.div(n.length));
  }
  let t = n[0];
  if (t.t === "num") {
    let r = ce(t, e);
    for (let i of n.slice(1)) {
      let o = ce(i, e);
      ((e === "MIN" && o.lt(r)) || (e === "MAX" && o.gt(r))) && (r = o);
    }
    return le(r);
  }
  if (t.t === "date") {
    let r = t.iso;
    for (let i of n.slice(1)) {
      if (i.t !== "date") throw new re(`${e}() over mixed types`);
      ((e === "MIN" && i.iso < r) || (e === "MAX" && i.iso > r)) && (r = i.iso);
    }
    return vt(r);
  }
  throw new re(`${e}() needs numbers or dates`);
}
function mh(e) {
  return { id: e.id, sheetId: e.sheetId, name: "", expr: e.expr, kind: "scalar", span: e.span };
}
function jo(e) {
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
function Hn(e, n) {
  var t, r;
  return (r = (t = e == null ? void 0 : e.aliases.get(n)) == null ? void 0 : t.header) != null
    ? r
    : n;
}
function Bt(e) {
  return e.qualifier ? `${e.qualifier}.${e.name}` : e.name;
}
function ze(e, n, t) {
  if (t.qualifier) {
    let a = e.sheets.get(t.qualifier);
    if (!a)
      return {
        kind: "unknown",
        badName: `${t.qualifier}.${t.name}`,
        suggestion: De(t.qualifier, e.sheets.keys()),
      };
    let l = Hn(a, t.name),
      u = a.columns.get(l);
    if (u) return { kind: "column", binding: u, sheetId: a.id };
    if (a.inputColumns.has(l)) return { kind: "input-column", sheetId: a.id, column: l };
    let c = a.scalars.get(l);
    return c
      ? { kind: "scalar", binding: c, sheetId: a.id }
      : {
          kind: "unknown",
          badName: `${t.qualifier}.${t.name}`,
          suggestion: De(t.name, [
            ...a.columns.keys(),
            ...a.inputColumns,
            ...a.scalars.keys(),
            ...a.aliases.keys(),
          ]),
        };
  }
  let r = e.sheets.get(n),
    i = Hn(r, t.name);
  if (r) {
    let a = r.columns.get(i);
    if (a) return { kind: "column", binding: a, sheetId: r.id };
    if (r.inputColumns.has(i)) return { kind: "input-column", sheetId: r.id, column: i };
    let l = r.scalars.get(i);
    if (l) return { kind: "scalar", binding: l, sheetId: r.id };
  }
  let o = e.docScope.get(t.name);
  if (o) return { kind: "doc-scalar", binding: o, sheetId: "" };
  let s = new Set(e.docScope.keys());
  if (r) {
    for (let a of r.columns.keys()) s.add(a);
    for (let a of r.inputColumns) s.add(a);
    for (let a of r.scalars.keys()) s.add(a);
    for (let a of r.aliases.keys()) s.add(a);
  }
  return { kind: "unknown", badName: t.name, suggestion: De(t.name, s) };
}
function Sn(e, n) {
  let t = { refs: [], deps: new Set(), vectorRefs: [], undefRefs: [], callErrors: [] },
    r = (i, o) => {
      switch (i.type) {
        case "ref": {
          let s = ze(e, n.sheetId, i);
          if ((t.refs.push({ ref: i, res: s }), s.kind === "unknown")) {
            t.undefRefs.push(i);
            return;
          }
          if (s.kind === "column") {
            let a = s.sheetId !== n.sheetId,
              l = n.kind === "column" && !a;
            o || l ? t.deps.add(s.binding.id) : t.vectorRefs.push(i);
          } else if (s.kind === "input-column") {
            let a = s.sheetId !== n.sheetId,
              l = n.kind === "column" && !a;
            !o && !l && t.vectorRefs.push(i);
          } else t.deps.add(s.binding.id);
          return;
        }
        case "call": {
          let s = Wr(i.name, i.args);
          s && t.callErrors.push({ call: i, problem: s });
          let a = Be.get(i.name);
          if ((a == null ? void 0 : a.kind) === "reduce") {
            if (!s && (i.name === "NPV" || i.name === "IRR")) {
              let c = i.args[a.column];
              if ((c == null ? void 0 : c.type) === "ref") {
                let d = ze(e, n.sheetId, c);
                (d.kind === "scalar" || d.kind === "doc-scalar") &&
                  t.callErrors.push({ call: i, problem: { kind: "not-column" } });
              }
            }
            let l = t.callErrors.some((c) => c.call === i),
              u = a.column;
            i.args.forEach((c, d) => {
              r(c, o || l || d === u);
            });
            return;
          }
          for (let l of i.args) r(l, o);
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
  return (n.parseError || r(n.expr, !1), t);
}
function qr(e) {
  let n = new Map(),
    t = new Set(),
    r = new Set();
  for (let h of e.docScope.values()) n.set(h.id, h);
  for (let h of e.sheets.values()) {
    for (let w of h.columns.values()) n.set(w.id, w);
    for (let w of h.scalars.values()) n.set(w.id, w);
    for (let w of h.assertions) (n.set(w.id, mh(w)), t.add(w.id));
    for (let w of h.charts) (n.set(w.id, jo(w)), r.add(w.id));
  }
  let i = [...n.keys()],
    o = new Map(i.map((h, w) => [h, w])),
    s = new Map(),
    a = new Map();
  for (let [h, w] of n) {
    let g = Sn(e, w);
    (s.set(h, g), a.set(h, new Set([...g.deps].filter((S) => n.has(S)))));
  }
  let l = new Map(),
    u = new Map();
  for (let h of n.keys()) (l.set(h, 0), u.set(h, []));
  for (let [h, w] of a) for (let g of w) (l.set(h, l.get(h) + 1), u.get(g).push(h));
  let c = i.filter((h) => l.get(h) === 0);
  c.sort((h, w) => o.get(h) - o.get(w));
  let d = [],
    f = new Set();
  for (; c.length;) {
    let h = c.shift();
    (d.push(n.get(h)), f.add(h));
    for (let w of u.get(h))
      if ((l.set(w, l.get(w) - 1), l.get(w) === 0)) {
        let g = o.get(w),
          S = 0;
        for (; S < c.length && o.get(c[S]) < g;) S++;
        c.splice(S, 0, w);
      }
  }
  let p = i.filter((h) => !f.has(h)),
    m = hh(p, a, n, o);
  return { order: d, cycles: m, depMap: s, assertionIds: t, chartIds: r };
}
function hh(e, n, t, r) {
  let i = new Set(e),
    o = gh(e, n, i),
    s = [];
  for (let a of o) {
    if (a.length === 1 && !n.get(a[0]).has(a[0])) continue;
    let l = new Set(a),
      u = new Map();
    for (let p of a) u.set(p, []);
    for (let p of a) for (let m of n.get(p)) l.has(m) && u.get(m).push(p);
    for (let p of u.values()) p.sort((m, h) => r.get(m) - r.get(h));
    let c = [...a].sort((p, m) => r.get(p) - r.get(m))[0],
      d = [c],
      f = c;
    for (;;) {
      let p = u.get(f),
        m = p.find((w) => !d.includes(w)),
        h = m != null ? m : p.includes(c) ? c : void 0;
      if (h === void 0 || (d.push(h), h === c)) break;
      f = h;
    }
    s.push(d.map((p) => t.get(p)));
  }
  return s;
}
function gh(e, n, t) {
  let r = 0,
    i = new Map(),
    o = new Map(),
    s = new Set(),
    a = [],
    l = [],
    u = (c) => {
      var d;
      (i.set(c, r), o.set(c, r), r++, a.push(c), s.add(c));
      for (let f of (d = n.get(c)) != null ? d : [])
        t.has(f) &&
          (i.has(f)
            ? s.has(f) && o.set(c, Math.min(o.get(c), i.get(f)))
            : (u(f), o.set(c, Math.min(o.get(c), o.get(f)))));
      if (o.get(c) === i.get(c)) {
        let f = [];
        for (;;) {
          let p = a.pop();
          if ((s.delete(p), f.push(p), p === c)) break;
        }
        l.push(f);
      }
    };
  for (let c of e) i.has(c) || u(c);
  return l;
}
function Fl(e, n) {
  if (e.length === 0) return { ok: !1, message: "empty file (not even a header row)" };
  let t = e.includes(`\r
`),
    r = e.replace(/\r\n/g, "").includes(`
`),
    i = e.replace(/\r\n/g, "").includes("\r");
  if (t && (r || i))
    return { ok: !1, message: "mixed line endings \u2014 the file mixes CRLF and bare LF/CR" };
  let o = [],
    s = "",
    a = [],
    l = !1,
    u = 0,
    c = () => {
      (a.push(s), (s = ""));
    },
    d = () => {
      (c(), o.push(a), (a = []));
    };
  for (; u < e.length;) {
    let m = e[u];
    if (l) {
      if (m === '"') {
        if (e[u + 1] === '"') {
          ((s += '"'), (u += 2));
          continue;
        }
        ((l = !1), u++);
        continue;
      }
      ((s += m), u++);
      continue;
    }
    if (m === '"') {
      ((l = !0), u++);
      continue;
    }
    if (m === n) {
      (c(), u++);
      continue;
    }
    if (
      m === "\r" &&
      e[u + 1] ===
        `
`
    ) {
      (d(), (u += 2));
      continue;
    }
    if (
      m ===
        `
` ||
      m === "\r"
    ) {
      (d(), u++);
      continue;
    }
    ((s += m), u++);
  }
  if (l) return { ok: !1, message: "unterminated quoted field" };
  if (((s !== "" || a.length > 0) && d(), o.length === 0))
    return { ok: !1, message: "empty file (not even a header row)" };
  let [f, ...p] = o;
  return { ok: !0, header: f, rows: p };
}
function Nl(e) {
  return e.startsWith("/");
}
function Ho(e) {
  if (e.length === 0) return ".";
  let n = e.startsWith("/"),
    t = e.length;
  for (; t > 1 && e[t - 1] === "/";) t--;
  let r = e.lastIndexOf("/", t - 1);
  return r < 0 ? (n ? "/" : ".") : r === 0 ? "/" : e.slice(0, r);
}
function Wo(...e) {
  let n = "",
    t = !1;
  for (let i of e)
    i.length !== 0 &&
      (i.startsWith("/") ? ((n = i), (t = !0)) : (n = n.length === 0 ? i : n + "/" + i));
  t || (n = "/" + n);
  let r = [];
  for (let i of n.split("/"))
    if (!(i.length === 0 || i === ".")) {
      if (i === "..") {
        r.pop();
        continue;
      }
      r.push(i);
    }
  return "/" + r.join("/");
}
var wh = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i,
  xh = /[\x00-\x1f\x7f]/;
function Gr(e, n, t) {
  let { noun: r, ext: i } = t,
    { reader: o } = e;
  if (n.length === 0) return { err: r + " is empty" };
  if (xh.test(n)) return { err: r + " contains a control character" };
  if (/^[A-Za-z]:/.test(n)) return { err: r + " must be relative, not a drive letter" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(n)) return { err: r + " must be a relative path, not a URL" };
  if (Nl(n) || n.startsWith("/") || n.startsWith("\\")) return { err: r + " must be relative" };
  if (!n.endsWith(i)) return { err: r + " must end in `" + i + "`" };
  for (let u of n.split(/[\\/]/))
    if (wh.test(u)) return { err: r + " uses a reserved device name `" + u + "`" };
  let s = o.realpath(Ho(Wo(e.path))),
    a = Wo(s, n);
  if (!qo(s, a)) return { err: r + " escapes the document's directory" };
  if (o.exists(a)) {
    let u = o.realpath(a);
    if (u !== a && !qo(s, u))
      return { err: r + " resolves through a symlink out of the document's directory" };
  }
  let l = Ho(a);
  if (o.exists(l)) {
    let u = o.realpath(l);
    if (u !== l && !qo(s, u))
      return { err: r + " resolves through a symlink out of the document's directory" };
  }
  return { ok: a };
}
function qo(e, n) {
  return n === e || n.startsWith(e.endsWith("/") ? e : e + "/");
}
var kh = { noun: "imported file path", ext: ".csv" };
function $l(e, n) {
  return Gr(e, n, kh);
}
var bh = /^[0-9a-f]{64}$/,
  yh = /^[A-Za-z_][A-Za-z0-9_]*$/,
  vh = "\uFEFF";
function Ll(e, n) {
  var i, o, s, a, l, u;
  let t = [],
    r = new Map();
  for (let c of e.sheets.values()) {
    let d = c.imported;
    if (!d) continue;
    let f = (C, $, D = "error") => {
      (t.push({ code: "IMPORT", sheetId: c.id, message: C, span: $, sourceOffset: $.start }),
        r.set(c.id, { sheetId: c.id, target: null, digest: null, state: D }));
    };
    if (n === void 0) {
      r.set(c.id, { sheetId: c.id, target: null, digest: null, state: "skipped" });
      continue;
    }
    let p = $l(n, d.path);
    if ("err" in p) {
      f(p.err, d.pathSpan);
      continue;
    }
    let m = n.reader.readSealed(p.ok);
    if (m === null) {
      f("imported file not found: `" + d.path + "`", d.pathSpan);
      continue;
    }
    let h = m.sha256;
    if (d.stampSpan) {
      if (d.stampPrefix !== "sha256") {
        f(
          "unrecognised stamp prefix `" +
            ((i = d.stampPrefix) != null ? i : "") +
            "` \u2014 only `sha256:` is supported",
          d.stampSpan,
        );
        continue;
      }
      let C = (o = d.stampDigest) != null ? o : "";
      if (!bh.test(C)) {
        let $ =
          C.length !== 64
            ? "wrong length"
            : /[A-F]/.test(C)
              ? "uppercase hex"
              : "non-hex character";
        f("malformed digest (" + $ + ")", d.stampSpan);
        continue;
      }
    }
    let w = "ok";
    d.stampSpan && d.stampDigest !== h
      ? (t.push({
          code: "STALE",
          sheetId: c.id,
          artifact: d.path,
          message: `\`${d.path}\` does not match its recorded stamp \u2014 expected sha256:${d.stampDigest}, got sha256:${h}`,
          span: d.stampSpan,
          sourceOffset: d.stampSpan.start,
        }),
        (w = "stale"))
      : d.stampSpan || (w = "unstamped");
    let g = m.text.startsWith(vh) ? m.text.slice(1) : m.text,
      S = Fl(g, d.delimiter);
    if (!S.ok) {
      f(S.message, d.declSpan);
      continue;
    }
    let b = d.labelsMode === "unlabelled",
      I = b ? d.labels : S.header,
      R = b ? [S.header, ...S.rows] : S.rows,
      y = new Set(),
      T = new Set();
    for (let C of I) (T.has(C) && y.add(C), T.add(C));
    if (y.size > 0) {
      f(
        "duplicate column " +
          [...y].map((C) => "`" + C + "`").join(", ") +
          (b ? " in `unlabelled` declaration" : " in imported header"),
        b && (s = d.labelsSpan) != null ? s : d.declSpan,
      );
      continue;
    }
    let M = I.find((C) => !yh.test(C));
    if (M !== void 0) {
      f(
        b
          ? "declared column `" + M + "` is not a valid identifier"
          : "imported column `" + M + "` is not a valid identifier",
        b && (a = d.labelsSpan) != null ? a : d.declSpan,
      );
      continue;
    }
    if (
      !b &&
      d.labels &&
      !(d.labels.length === S.header.length && d.labels.every(($, D) => $ === S.header[D]))
    ) {
      f(
        "labelled header does not match: expected [" +
          d.labels.join(", ") +
          "], got [" +
          S.header.join(", ") +
          "]",
        (l = d.labelsSpan) != null ? l : d.declSpan,
      );
      continue;
    }
    if (b) {
      let C = R.findIndex(($) => $.length !== I.length);
      if (C !== -1) {
        let $ = R[C],
          D = I.length < $.length ? "too few" : "too many";
        f(
          `${D} names: declared ${I.length}, row ${C + 1} has ${$.length} fields`,
          (u = d.labelsSpan) != null ? u : d.declSpan,
        );
        continue;
      }
    }
    let P = d.declSpan,
      E = I.map((C) => ({ text: C, ...P })),
      U = R.map((C) => ({ cells: C.map(($) => ({ text: $, ...P })) })),
      _ = { headers: E, rows: U, span: P };
    ((c.table = _),
      (c.columnIndex = new Map(I.map((C, $) => [C, $]))),
      (c.inputColumns = new Set(I)));
    for (let C of I) {
      let $ = c.scalars.get(C);
      if ($) {
        if ((c.scalars.delete(C), $.param !== void 0)) {
          t.push({ code: "DUP", sheetId: c.id, name: C, span: $.span, sourceOffset: $.span.start });
          continue;
        }
        t.push({
          code: "IMPORT",
          sheetId: c.id,
          name: C,
          message: "column rule on an imported sheet: `" + C + "` is a read-only imported column",
          span: $.span,
          sourceOffset: $.span.start,
        });
      }
    }
    (w === "unstamped" &&
      t.push({
        code: "IMPORT",
        sheetId: c.id,
        message: "unstamped import",
        span: d.declSpan,
        sourceOffset: d.declSpan.start,
      }),
      r.set(c.id, { sheetId: c.id, target: p.ok, digest: h, state: w }));
  }
  return { findings: t, statuses: r };
}
function Et(e, n) {
  switch (e.type) {
    case "num":
      return Ih(e.value);
    case "date":
      return "date";
    case "str":
      return null;
    case "ref":
      return n(e);
    case "unary":
      return e.op === "-" ? Et(e.operand, n) : null;
    case "binary":
      return Sh(e.op, e.left, e.right, n);
    case "call":
      return Eh(e.name, e.args, n);
  }
}
function Sh(e, n, t, r) {
  switch (e) {
    case "+":
    case "-": {
      let i = Et(n, r),
        o = Et(t, r);
      return i === "date" && o === "date"
        ? e === "-"
          ? 0
          : null
        : i === "date" || o === "date"
          ? "date"
          : Go([i, o]);
    }
    case "*": {
      let i = Et(n, r),
        o = Et(t, r);
      return typeof i == "number" && typeof o == "number" ? i + o : null;
    }
    case "^": {
      let i = Ol(t);
      if (i === null) return null;
      let o = Et(n, r);
      return typeof o == "number" ? o * i : null;
    }
    default:
      return null;
  }
}
function Eh(e, n, t) {
  let r = (i) => {
    let o = n[i];
    return o === void 0 ? null : Et(o, t);
  };
  switch (e) {
    case "SUM":
    case "MIN":
    case "MAX":
      return r(0);
    case "COUNT":
      return 0;
    case "ROUND":
      return Ol(n[1]);
    case "FLOOR":
    case "CEILING":
      return r(1);
    case "ABS":
      return r(0);
    case "MOD":
      return Go([r(0), r(1)]);
    case "IF":
      return Go([r(1), r(2)]);
    case "EOMONTH":
      return "date";
    default:
      return null;
  }
}
function Go(e) {
  let n = 0;
  for (let t of e) {
    if (typeof t != "number") return null;
    t > n && (n = t);
  }
  return n;
}
function Ol(e) {
  return (e == null ? void 0 : e.type) !== "num" || !/^\d+$/.test(e.value) ? null : Number(e.value);
}
function Ih(e) {
  let n = /\.(\d+)$/.exec(e);
  return n ? n[1].length : 0;
}
var Ch = /^(-?)(\d+(?:\.\d+)?)%$/;
function _l(e) {
  return Ch.test(e.trim());
}
function Yr(e, n) {
  if (e.t !== "num") throw new Error("percentDisplay expects a number");
  let t = Je(e.d.abs().mul(100), n - 2).toFixed(n - 2);
  return `${e.d.isNeg() && !e.d.isZero() ? "-" : ""}${t}%`;
}
var Vl = "[^\\d\\s.\\-%]",
  Th = new RegExp(
    `^(?<sign1>-?)\\s*(?<pre>${Vl}*)\\s*(?<sign2>-?)\\s*(?<num>\\d+(?:\\.\\d+)?)\\s*(?<post>${Vl}*)$`,
  );
function Xe(e) {
  let n = e.trim();
  if (n === "") return { kind: "not-a-number" };
  let t = Th.exec(n);
  if (!(t != null && t.groups)) return { kind: "not-a-number" };
  let { sign1: r, pre: i, sign2: o, num: s, post: a } = t.groups;
  if (r && o) return { kind: "not-a-number" };
  if (i && a) return { kind: "both-sides", pre: i, post: a };
  let l = r || o ? "-" : "",
    u = i ? { text: i, side: "prefix" } : a ? { text: a, side: "suffix" } : null;
  return { kind: "number", num: l + s, unit: u };
}
function Ah(e) {
  return e ? `${e.side}:${e.text}` : "(none)";
}
function Bl(e) {
  return e ? e.text : "(none)";
}
function et(e, n) {
  return n
    ? n.side === "suffix"
      ? `${e} ${n.text}`
      : e.startsWith("-")
        ? `-${n.text}${e.slice(1)}`
        : `${n.text}${e}`
    : e;
}
function zl(e) {
  let n = [];
  if (
    (e.forEach((o, s) => {
      let a = Xe(o != null ? o : "");
      a.kind === "number" && n.push({ key: Ah(a.unit), unit: a.unit, row: s });
    }),
    n.length === 0)
  )
    return { unit: null, conflict: !1, forms: [], firstDeviantRow: null };
  let t = n[0],
    r = n.find((o) => o.key !== t.key);
  if (!r) return { unit: t.unit, conflict: !1, forms: [Bl(t.unit)], firstDeviantRow: null };
  let i = [];
  for (let o of n) {
    let s = Bl(o.unit);
    i.includes(s) || i.push(s);
  }
  return { unit: null, conflict: !0, forms: i, firstDeviantRow: r.row };
}
function it(e) {
  var i;
  let n = e.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(n)) return new J(n);
  let t = /^(-?)(\d+(?:\.\d+)?)%$/.exec(n);
  if (t) return new J(((i = t[1]) != null ? i : "") + t[2]).div(100);
  let r = Xe(n);
  return r.kind === "number" ? new J(r.num) : null;
}
function rn(e) {
  var t, r;
  if (it(e) === null) return null;
  let n = /^\s*(-?)(\d+(?:\.(\d+))?)%\s*$/.exec(e);
  return n ? ((r = (t = n[3]) == null ? void 0 : t.length) != null ? r : 0) + 2 : Zr(e, 0);
}
function Zr(e, n) {
  let t = Xe(e),
    r = (t.kind === "number" ? t.num : e).trim(),
    i = /\.(\d+)\s*$/.exec(r);
  return i ? i[1].length : /^-?\d+$/.test(r) ? 0 : n;
}
var _e = class extends Error {},
  Rh = /^\d{1,4}[./-]\d{1,4}[./-]\d{1,4}$/;
function It(e, n) {
  var t, r, i;
  return (i = (r = (t = e.rows[n]) == null ? void 0 : t.cells[0]) == null ? void 0 : r.text) != null
    ? i
    : `row ${n + 1}`;
}
function Wn(e, n, t) {
  var i, o;
  let r = ze(e.model, n.sheetId, t);
  if (r.kind === "column") {
    let s = e.cells.get(r.binding.id);
    if (!s || s.some((a) => a === null)) throw new _e();
    return s;
  }
  if (r.kind === "input-column") {
    let s = e.model.sheets.get(r.sheetId),
      a = s.columnIndex.get(r.column);
    return ((o = (i = s.table) == null ? void 0 : i.rows) != null ? o : []).map((l, u) => {
      var d;
      let c = l.cells[a];
      return Yo(e, (d = c == null ? void 0 : c.text) != null ? d : "", s.id, r.column, u, c);
    });
  }
  throw new _e();
}
function Yo(e, n, t, r, i, o) {
  var u, c, d;
  let s = n.trim(),
    a = it(s);
  if (a !== null) return le(a);
  let l = Cl(s);
  if (l.ok) return vt(l.iso);
  if (Rh.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    let f = `${t}.${r}#${i}`;
    if (!e.dateErrorRows.has(f)) {
      e.dateErrorRows.add(f);
      let p = e.model.sheets.get(t).table;
      e.emit(
        {
          code: "DATE",
          sheetId: t,
          name: r,
          rowLabel: It(p, i),
          raw: s,
          isoFix: l.ok ? void 0 : l.decidable,
          altA: l.ok || (u = l.ambiguous) == null ? void 0 : u.a,
          altB: l.ok || (c = l.ambiguous) == null ? void 0 : c.b,
          daysApart: l.ok || (d = l.ambiguous) == null ? void 0 : d.daysApart,
          span: o ? { start: o.start, end: o.end } : void 0,
        },
        { sheetId: t },
      );
    }
    throw new _e();
  }
  return Ur(s);
}
var Ph = /<visimark\s+sheet="([^"]*)"\s+chart="([^"]*)"\s*\/>/;
function jl(e, n) {
  return `<metadata><visimark sheet="${e}" chart="${n}"/></metadata>`;
}
function Kr(e) {
  let n = Ph.exec(e);
  return n ? { sheet: n[1], chart: n[2] } : null;
}
function Ul(e) {
  return e.replace(
    /\r\n/g,
    `
`,
  );
}
function Hl(e, n, t, r, i) {
  let o = e.readText(n);
  if (o === null) return { state: "missing" };
  let s = Kr(o);
  return s
    ? s.sheet !== r || s.chart !== i
      ? { state: "foreign", sheet: s.sheet, chart: s.chart }
      : Ul(o) === Ul(t)
        ? { state: "current" }
        : { state: "stale" }
    : { state: "unowned" };
}
var Re = 640,
  dt = "#808080",
  Ge = 1,
  Mh = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  Fh = 0.6;
function ft(e) {
  return Math.round((Re * e.h) / e.w);
}
function qn(e, n) {
  return e.length * Fh * n;
}
function te(e) {
  return (Object.is(e, -0) ? 0 : e).toFixed(2);
}
function Nh(e) {
  return e
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
var Wl = 51,
  Dh = 204;
function pt(e) {
  if (e <= 0) return [];
  if (e === 1) return ["#808080"];
  let n = (Dh - Wl) / (e - 1);
  return Array.from({ length: e }, (t, r) => {
    let o = Math.round(Wl + r * n)
      .toString(16)
      .padStart(2, "0");
    return `#${o}${o}${o}`;
  });
}
function Ye(e, n, t, r = {}) {
  var a, l;
  let i = (a = r.size) != null ? a : 12,
    o = (l = r.anchor) != null ? l : "middle",
    s = r.length !== void 0 ? ` textLength="${te(r.length)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${te(e)}" y="${te(n)}" font-family="${Mh}" font-size="${i}" text-anchor="${o}" fill="${dt}"${s}>${Nh(t)}</text>`;
}
function zt(e, n) {
  return et(e.toFixed(n.precision), n.unit);
}
function ql(e, n, t, r) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Re} ${t}" role="img">` +
    jl(e, n) +
    r.join("") +
    `</svg>
`
  );
}
function Ut(e, n, t = 5) {
  let r = Math.min(0, e),
    i = Math.max(0, n);
  if (r === i) return [0];
  let o = (i - r) / t,
    s = Math.pow(10, Math.floor(Math.log10(o))),
    a = o / s,
    l = s * (a <= 1 ? 1 : a <= 2 ? 2 : a <= 5 ? 5 : 10),
    u = Math.floor(r / l) * l,
    c = Math.ceil(i / l) * l,
    d = [];
  for (let f = u; f <= c + l / 2; f += l) d.push(Math.abs(f) < l / 1e6 ? 0 : f);
  return d;
}
function $h(e) {
  let n = e.toFixed(2);
  return n.endsWith(".00") ? n.slice(0, -3) : n;
}
function jt(e, n, t, r) {
  let i = [];
  for (let o of e) {
    let s = n(o);
    i.push(
      `<line x1="${te(t)}" y1="${te(s)}" x2="${te(r)}" y2="${te(s)}" stroke="${dt}" stroke-width="${o === 0 ? Ge : 0.5}"/>`,
    );
    let a = $h(o);
    i.push(Ye(t - 6, s + 4, a, { anchor: "end", size: 11, length: qn(a, 11) }));
  }
  return i;
}
function En(e, n, t, r, i) {
  var s;
  let o = [];
  for (let a = 0; a < n; a++) {
    let l = (s = e[a]) != null ? s : "";
    o.push(Ye(r + t * a + t / 2, i + 16, l, { size: 11, length: Math.min(qn(l, 11), t - 4) }));
  }
  return o;
}
function Ht(e, n, t, r) {
  let i = [],
    o = t;
  return (
    e.forEach((s, a) => {
      (i.push(
        `<rect x="${te(o)}" y="${te(r - 8)}" width="10" height="10" fill="${n[a]}" stroke="${dt}" stroke-width="${Ge}"/>`,
      ),
        i.push(Ye(o + 14, r + 1, s.name, { anchor: "start", size: 11 })),
        (o += 14 + qn(s.name, 11) + 16));
    }),
    i
  );
}
var Gn = 70,
  Gl = 16,
  Yl = 18,
  Lh = 26,
  Oh = 2.5,
  _h = 0.55;
function Zl(e) {
  let { series: n, labels: t } = e;
  if (n.length === 0) return { err: "an area chart needs a series" };
  let r = n[0].values.length,
    i = ft(e.aspect),
    o = n.length > 1 ? 20 : 0,
    s = Yl + o,
    a = i - Lh,
    l = a - s,
    u = Re - Gn - Gl,
    c = n.flatMap((R) => R.values.map((y) => y.toNumber())),
    d = Ut(Math.min(...c), Math.max(...c)),
    f = d[0],
    m = d[d.length - 1] - f || 1,
    h = (R) => a - ((R - f) / m) * l,
    w = pt(n.length),
    g = [];
  g.push(...jt(d, h, Gn, Re - Gl));
  let S = u / Math.max(r, 1),
    b = (R) => Gn + S * R + S / 2,
    I = h(0);
  if (
    (n.forEach((R, y) => {
      let T = R.values.map((P, E) => `${te(b(E))},${te(h(P.toNumber()))}`),
        M = `M ${te(b(0))} ${te(I)} L ${T.join(" L ")} L ${te(b(r - 1))} ${te(I)} Z`;
      (g.push(`<path d="${M}" fill="${w[y]}" fill-opacity="${_h}"/>`),
        g.push(
          `<polyline points="${T.join(" ")}" fill="none" stroke="${w[y]}" stroke-width="${Ge * 1.5}"/>`,
        ),
        R.values.forEach((P, E) => {
          g.push(`<circle cx="${te(b(E))}" cy="${te(h(P.toNumber()))}" r="${Oh}" fill="${w[y]}"/>`);
        }));
    }),
    g.push(...En(t, r, S, Gn, a)),
    n.length > 1 && g.push(...Ht(n, w, Gn, Yl)),
    n.length === 1)
  ) {
    let R = n[0];
    for (let y = 0; y < r; y++) {
      let T = R.values[y];
      g.push(Ye(b(y), h(T.toNumber()) - 8, zt(T, R), { size: 10 }));
    }
  }
  return { body: g, height: i };
}
var In = 70,
  Kl = 16,
  Ql = 18,
  Vh = 26;
function Jl(e) {
  var R;
  let { series: n, labels: t } = e;
  if (n.length === 0) return { err: "a bar chart needs a series" };
  let r = n[0].values.length,
    i = ft(e.aspect),
    o = n.length > 1 ? 20 : 0,
    s = Ql + o,
    a = i - Vh,
    l = a - s,
    u = Re - In - Kl,
    c = n.flatMap((y) => y.values.map((T) => T.toNumber())),
    d = Ut(Math.min(...c), Math.max(...c)),
    f = d[0],
    m = d[d.length - 1] - f || 1,
    h = (y) => a - ((y - f) / m) * l,
    w = pt(n.length),
    g = [];
  g.push(...jt(d, h, In, Re - Kl));
  let S = u / Math.max(r, 1),
    b = S * 0.7,
    I = b / n.length;
  for (let y = 0; y < r; y++) {
    let T = In + S * y + (S - b) / 2;
    n.forEach((P, E) => {
      var $, D;
      let U = (D = ($ = P.values[y]) == null ? void 0 : $.toNumber()) != null ? D : 0,
        _ = Math.min(h(U), h(0)),
        C = Math.abs(h(U) - h(0));
      g.push(
        `<rect x="${te(T + I * E)}" y="${te(_)}" width="${te(I)}" height="${te(C)}" fill="${w[E]}" stroke="${dt}" stroke-width="${Ge}"/>`,
      );
    });
    let M = (R = t[y]) != null ? R : "";
    g.push(Ye(In + S * y + S / 2, a + 16, M, { size: 11, length: Math.min(qn(M, 11), S - 4) }));
  }
  if ((n.length > 1 && g.push(...Ht(n, w, In, Ql)), n.length === 1)) {
    let y = n[0];
    for (let T = 0; T < r; T++) {
      let M = y.values[T],
        P = h(M.toNumber());
      g.push(Ye(In + S * T + S / 2, P - 5, zt(M, y), { size: 10 }));
    }
  }
  return { body: g, height: i };
}
var Yn = 70,
  Xl = 16,
  eu = 18,
  Bh = 26,
  zh = 2.5;
function tu(e) {
  let { series: n, labels: t } = e;
  if (n.length === 0) return { err: "a line chart needs a series" };
  let r = n[0].values.length,
    i = ft(e.aspect),
    o = n.length > 1 ? 20 : 0,
    s = eu + o,
    a = i - Bh,
    l = a - s,
    u = Re - Yn - Xl,
    c = n.flatMap((I) => I.values.map((R) => R.toNumber())),
    d = Ut(Math.min(...c), Math.max(...c)),
    f = d[0],
    m = d[d.length - 1] - f || 1,
    h = (I) => a - ((I - f) / m) * l,
    w = pt(n.length),
    g = [];
  g.push(...jt(d, h, Yn, Re - Xl));
  let S = u / Math.max(r, 1),
    b = (I) => Yn + S * I + S / 2;
  if (
    (n.forEach((I, R) => {
      let y = I.values.map((T, M) => `${te(b(M))},${te(h(T.toNumber()))}`);
      (g.push(
        `<polyline points="${y.join(" ")}" fill="none" stroke="${w[R]}" stroke-width="${Ge * 1.5}"/>`,
      ),
        I.values.forEach((T, M) => {
          g.push(`<circle cx="${te(b(M))}" cy="${te(h(T.toNumber()))}" r="${zh}" fill="${w[R]}"/>`);
        }));
    }),
    g.push(...En(t, r, S, Yn, a)),
    n.length > 1 && g.push(...Ht(n, w, Yn, eu)),
    n.length === 1)
  ) {
    let I = n[0];
    for (let R = 0; R < r; R++) {
      let y = I.values[R];
      g.push(Ye(b(R), h(y.toNumber()) - 8, zt(y, I), { size: 10 }));
    }
  }
  return { body: g, height: i };
}
function nu(e) {
  if (e.series.length !== 1) return { err: "a pie takes one series" };
  let n = e.series[0],
    t = n.values.findIndex((d) => d.isNegative());
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
  let r = n.values.reduce((d, f) => d.plus(f), n.values[0].mul(0));
  if (r.isZero()) return { err: "pie of `" + n.name + "` sums to zero" };
  let i = ft(e.aspect),
    o = Re / 2,
    s = i / 2,
    a = Math.min(Re, i) * 0.34,
    l = pt(n.values.length),
    u = [],
    c = -90;
  return (
    n.values.forEach((d, f) => {
      var R;
      let p = d.div(r),
        m = p.toNumber() * 360,
        h = l[f];
      if (n.values.length === 1)
        u.push(
          `<circle cx="${te(o)}" cy="${te(s)}" r="${te(a)}" fill="${h}" stroke="${dt}" stroke-width="${Ge}"/>`,
        );
      else {
        let y = (c * Math.PI) / 180,
          T = ((c + m) * Math.PI) / 180,
          M = o + a * Math.cos(y),
          P = s + a * Math.sin(y),
          E = o + a * Math.cos(T),
          U = s + a * Math.sin(T),
          _ = m > 180 ? 1 : 0;
        u.push(
          `<path d="M ${te(o)} ${te(s)} L ${te(M)} ${te(P)} A ${te(a)} ${te(a)} 0 ${_} 1 ${te(E)} ${te(U)} Z" fill="${h}" stroke="${dt}" stroke-width="${Ge}"/>`,
        );
      }
      let w = ((c + m / 2) * Math.PI) / 180,
        g = o + a * 1.28 * Math.cos(w),
        S = s + a * 1.28 * Math.sin(w),
        b = p.mul(100).toFixed(1),
        I = (R = e.labels[f]) != null ? R : "";
      (u.push(Ye(g, S, `${I} ${b}%`, { size: 12 })),
        u.push(Ye(g, S + 14, zt(d, n), { size: 11 })),
        (c += m));
    }),
    { body: u, height: i }
  );
}
var Zn = 70,
  ru = 16,
  iu = 18,
  Uh = 26;
function ou(e) {
  var R, y;
  let { series: n, labels: t } = e;
  if (n.length === 0) return { err: "a stacked-bar chart needs a series" };
  let r = n[0].values.length,
    i = ft(e.aspect),
    o = n.length > 1 ? 20 : 0,
    s = iu + o,
    a = i - Uh,
    l = a - s,
    u = Re - Zn - ru,
    c = [],
    d = [];
  for (let T = 0; T < r; T++) {
    let M = 0,
      P = 0;
    for (let E of n) {
      let U = (y = (R = E.values[T]) == null ? void 0 : R.toNumber()) != null ? y : 0;
      U >= 0 ? (M += U) : (P += U);
    }
    (c.push(M), d.push(P));
  }
  let f = Ut(Math.min(...d, 0), Math.max(...c, 0)),
    p = f[0],
    h = f[f.length - 1] - p || 1,
    w = (T) => a - ((T - p) / h) * l,
    g = pt(n.length),
    S = [];
  S.push(...jt(f, w, Zn, Re - ru));
  let b = u / Math.max(r, 1),
    I = b * 0.7;
  for (let T = 0; T < r; T++) {
    let M = Zn + b * T + (b - I) / 2,
      P = 0,
      E = 0;
    n.forEach((U, _) => {
      var ue, we;
      let C = (we = (ue = U.values[T]) == null ? void 0 : ue.toNumber()) != null ? we : 0,
        $ = C >= 0 ? P : E,
        D = Math.min(w($ + C), w($)),
        z = Math.abs(w($ + C) - w($));
      (S.push(
        `<rect x="${te(M)}" y="${te(D)}" width="${te(I)}" height="${te(z)}" fill="${g[_]}" stroke="${dt}" stroke-width="${Ge}"/>`,
      ),
        C >= 0 ? (P += C) : (E += C));
    });
  }
  return (
    S.push(...En(t, r, b, Zn, a)),
    n.length > 1 && S.push(...Ht(n, g, Zn, iu)),
    { body: S, height: i }
  );
}
var Qr = new Map();
function Kn(e, n) {
  Qr.set(e, n);
}
function su(e) {
  return Qr.has(e);
}
function au(e) {
  return De(e, Qr.keys(), 3);
}
function lu(e, n, t) {
  let r = Qr.get(e);
  if (!r) return { err: "unknown chart type `" + e + "`" };
  let i = r(n);
  return "err" in i ? i : { svg: ql(t.sheetId, t.chart, i.height, i.body) };
}
Kn("pie", nu);
Kn("bar", Jl);
Kn("line", tu);
Kn("area", Zl);
Kn("stacked-bar", ou);
var jh = { noun: "artifact path", ext: ".svg" };
function Zo(e, n) {
  return Gr(e, n, jh);
}
function uu(e) {
  var r, i, o, s;
  let n = [],
    t = new Map();
  for (let a of e.model.sheets.values()) {
    let l = 0;
    for (let u of a.charts) {
      let c = `${u.sheetId}.${u.name}`,
        d = (P, E) =>
          e.emit(
            {
              code: "ARTIFACT",
              sheetId: u.sheetId,
              name: u.name,
              message: P,
              ...(E ? { suggestion: E } : {}),
              sourceOffset: u.span.start,
              span: u.span,
            },
            { sheetId: u.sheetId },
          );
      if (!e.buildableCharts.has(u.id)) {
        (l++, n.push({ ...Ze(u), path: null, state: "skipped" }));
        continue;
      }
      if (!su(u.engine)) {
        (d("unknown chart type `" + u.engine + "`", (r = au(u.engine)) != null ? r : void 0),
          n.push({ ...Ze(u), path: null, state: "error" }));
        continue;
      }
      let f = jo(u),
        p = [],
        m = null;
      for (let P of u.series) {
        let E = Hh(e, f, P);
        if (typeof E == "string") {
          m = E;
          break;
        }
        if (E.length === 0) {
          m = "`" + P + "` has no rows";
          break;
        }
        if (E.some(($) => $.t !== "num")) {
          m = "`" + P + "` needs numbers";
          break;
        }
        let U = P.includes(".") ? P.slice(P.indexOf(".") + 1) : P,
          _ = Hn(a, U),
          C = `${u.sheetId}.${_}`;
        p.push({
          name: P,
          values: E.map(($) => $.d),
          unit: (i = e.columnUnits.get(C)) != null ? i : null,
          precision: (o = e.columnPrecision.get(C)) != null ? o : qh(e.model, u.sheetId, _),
        });
      }
      if (m) {
        (d(m), n.push({ ...Ze(u), path: null, state: "error" }));
        continue;
      }
      let h = p.map((P) => (P.unit ? `${P.unit.side}:${P.unit.text}` : ""));
      if (new Set(h).size > 1) {
        (e.emit(
          {
            code: "UNIT",
            sheetId: u.sheetId,
            name: u.name,
            message: "a chart's series must agree about their unit",
            sourceOffset: u.span.start,
            span: u.span,
          },
          { sheetId: u.sheetId },
        ),
          n.push({ ...Ze(u), path: null, state: "error" }));
        continue;
      }
      let w = Wh(e.model, u.sheetId, u.labels);
      if (typeof w == "string") {
        (d(w), n.push({ ...Ze(u), path: null, state: "error" }));
        continue;
      }
      let g = w,
        S = e.model.anchors.find(
          (P) => P.sheetId === u.sheetId && P.name === u.name && P.imageUrl !== void 0,
        );
      if (!(S != null && S.imageUrl)) {
        (d("no image reference for this chart \u2014 add `![...](path)<!--vmark=" + c + "-->`"),
          n.push({ ...Ze(u), path: null, state: "error" }));
        continue;
      }
      let b = S.imageUrl,
        I = t.get(b);
      if (I && I !== c) {
        (d("two charts write to `" + b + "`"), n.push({ ...Ze(u), path: b, state: "error" }));
        continue;
      }
      t.set(b, c);
      let R = lu(
        u.engine,
        { series: p, labels: g, aspect: (s = u.aspect) != null ? s : { w: 16, h: 10 } },
        { sheetId: u.sheetId, chart: u.name },
      );
      if ("err" in R) {
        (d(R.err), n.push({ ...Ze(u), path: b, state: "error" }));
        continue;
      }
      let y = e.opts.doc;
      if (y === void 0) {
        n.push({ ...Ze(u), path: b, state: "skipped", svg: R.svg });
        continue;
      }
      let T = Zo(y, b);
      if ("err" in T) {
        (d(T.err), n.push({ ...Ze(u), path: b, state: "error" }));
        continue;
      }
      let M = Hl(y.reader, T.ok, R.svg, u.sheetId, u.name);
      if (M.state === "unowned") {
        (d("`" + b + "` exists and was not generated by visimark"),
          n.push({ ...Ze(u), path: b, state: "error", target: T.ok }));
        continue;
      }
      if (M.state === "foreign") {
        (d("`" + b + "` belongs to chart `" + M.sheet + "." + M.chart + "`"),
          n.push({ ...Ze(u), path: b, state: "error", target: T.ok }));
        continue;
      }
      (M.state !== "current" &&
        e.emit(
          {
            code: "STALE",
            sheetId: u.sheetId,
            name: u.name,
            artifact: b,
            message:
              M.state === "missing"
                ? "artifact missing at `" + b + "`"
                : "artifact is out of date \u2014 run `visimark fmt`",
            sourceOffset: u.span.start,
            span: u.span,
          },
          { sheetId: u.sheetId },
        ),
        n.push({
          ...Ze(u),
          path: b,
          state: M.state === "current" ? "current" : M.state,
          target: T.ok,
          svg: R.svg,
        }));
    }
    l > 0 &&
      e.emit(
        {
          code: "NOTE",
          sheetId: a.id,
          message: `${l} chart${l === 1 ? "" : "s"} not built (upstream errors)`,
        },
        { sheetId: a.id },
      );
  }
  return n;
}
function Ze(e) {
  return { sheetId: e.sheetId, name: e.name, engine: e.engine, series: e.series, labels: e.labels };
}
function Hh(e, n, t) {
  let r = t.indexOf("."),
    i =
      r === -1
        ? { type: "ref", name: t, start: n.span.start, end: n.span.end }
        : {
            type: "ref",
            qualifier: t.slice(0, r),
            name: t.slice(r + 1),
            start: n.span.start,
            end: n.span.end,
          };
  try {
    return Wn(e, n, i);
  } catch (o) {
    return "`" + t + "` contains a blank cell";
  }
}
function Wh(e, n, t) {
  let r = e.sheets.get(n),
    i = r == null ? void 0 : r.columnIndex.get(Hn(r, t));
  return !(r != null && r.table) || i === void 0
    ? "`" + t + "` is not a column of this sheet"
    : r.table.rows.map((o) => {
        var s, a;
        return ((a = (s = o.cells[i]) == null ? void 0 : s.text) != null ? a : "").trim();
      });
}
function qh(e, n, t) {
  var o, s;
  let r = e.sheets.get(n),
    i = r == null ? void 0 : r.columnIndex.get(t);
  if (r != null && r.table && i !== void 0)
    for (let a of r.table.rows) {
      let l = ((s = (o = a.cells[i]) == null ? void 0 : o.text) != null ? s : "").trim();
      if (l) return Zr(l, 2);
    }
  return 2;
}
function cu(e) {
  for (let n of e.model.sheets.values()) {
    let t = n.table;
    if (t)
      for (let [r, i] of n.columnIndex) {
        let o = `${n.id}.${r}`,
          s = t.rows.map((u) => {
            var c;
            return (c = u.cells[i]) == null ? void 0 : c.text;
          }),
          a = s.findIndex((u) => Xe(u != null ? u : "").kind === "both-sides");
        if (a !== -1) {
          let u = t.rows[a].cells[i];
          (e.unitConflicts.add(o),
            e.columnUnits.set(o, null),
            e.emit(
              {
                code: "UNIT",
                sheetId: n.id,
                name: r,
                rowLabel: It(t, a),
                raw: s[a],
                message: `\`${s[a]}\` is decorated on both sides; a unit sits before the number or after it, not both`,
                span: u ? { start: u.start, end: u.end } : void 0,
              },
              { sheetId: n.id },
            ));
          continue;
        }
        let l = zl(s);
        if ((e.columnUnits.set(o, l.unit), l.conflict)) {
          e.unitConflicts.add(o);
          let u = l.firstDeviantRow,
            c = t.rows[u].cells[i];
          e.emit(
            {
              code: "UNIT",
              sheetId: n.id,
              name: r,
              rowLabel: It(t, u),
              raw: s[u],
              message: `column mixes units: ${l.forms.join(" and ")}`,
              span: c ? { start: c.start, end: c.end } : void 0,
            },
            { sheetId: n.id },
          );
        }
      }
  }
}
function du(e, n) {
  var t, r;
  for (let i of n) {
    e.emit({
      code: "CYCLE",
      sheetId: (t = i[0]) == null ? void 0 : t.sheetId,
      cyclePath: i.map((o) => o.id),
      span: (r = i[0]) == null ? void 0 : r.span,
    });
    for (let o of i) e.unevaluable.add(o.id);
  }
}
function fu(e, n, t) {
  for (let r of t) {
    if (n.handled.has(r)) continue;
    let i = n.byId.get(r);
    (n.results.set(r, {
      sheetId: i.sheetId,
      source: i.source,
      holds: null,
      operands: {},
      substituted: i.source.replace(/^assert\s+/, ""),
    }),
      n.bumpSuppressed(i.sheetId));
  }
  for (let [r, i] of n.suppressed)
    i > 0 &&
      e.emit(
        {
          code: "NOTE",
          sheetId: r,
          suppressedCount: i,
          message: `${i} assertion${i === 1 ? "" : "s"} not verified (upstream errors)`,
        },
        { sheetId: r },
      );
}
function pu(e) {
  let n = new Set();
  for (let r of e.model.sheets.values()) for (let i of r.charts) n.add(`${i.sheetId}.${i.name}`);
  let t = 0;
  for (let r of e.model.anchors) {
    let i = `${r.sheetId}.${r.name}`;
    e.staleScalars.has(i) && t++;
    let o = (a) =>
      e.emit({
        code: "ANCHOR",
        sheetId: r.sheetId,
        name: r.name,
        sourceOffset: r.commentSpan.start,
        span: r.commentSpan,
        ...(a ? { message: a } : {}),
      });
    if (r.value === null) {
      o();
      continue;
    }
    let s = n.has(i);
    if (r.value.kind === "image" && !s) {
      o("an image anchor must name a chart");
      continue;
    }
    (r.value.kind !== "image" && s && o("a chart must be anchored to an image"),
      r.percent &&
        (s || r.value.kind === "image") &&
        e.emit({
          code: "TYPE",
          sheetId: r.sheetId,
          name: r.name,
          message: "a % sigil is only legal on a numeric scalar",
          sourceOffset: r.commentSpan.start,
          span: r.commentSpan,
        }));
  }
  t > 0 && e.emit({ code: "STALE", anchorGroup: !0, suppressedCount: t });
}
function mu(e, n) {
  var o;
  let { referenced: t, usedAliases: r } = Gh(e.model),
    i = new Set(e.model.anchors.map((s) => `${s.sheetId}.${s.name}`));
  for (let s of e.model.sheets.values())
    for (let a of s.scalars.values())
      t.has(a.id) ||
        i.has(a.id) ||
        e.unevaluable.has(a.id) ||
        n.some((l) => l.f.sheetId === a.sheetId && l.f.name === a.name) ||
        e.emit({
          code: "WARN",
          sheetId: a.sheetId,
          name: a.name,
          suggestion: (o = De(a.name, [...t].map(Yh))) != null ? o : void 0,
          span: a.span,
        });
  for (let s of e.model.sheets.values())
    for (let [a, l] of s.aliases)
      r.has(`${s.id}.${a}`) || e.emit({ code: "WARN", sheetId: s.id, name: a, span: l.span });
}
function Gh(e) {
  let n = new Set(),
    t = new Set(),
    r = (o, s) => {
      let a = e.sheets.get(o);
      a != null && a.aliases.has(s) && t.add(`${o}.${s}`);
    },
    i = (o, s) => {
      var a;
      if (o.type === "ref") {
        r((a = o.qualifier) != null ? a : s, o.name);
        let l = ze(e, s, o);
        (l.kind === "scalar" || l.kind === "doc-scalar" || l.kind === "column") &&
          n.add(l.binding.id);
      } else if (o.type === "unary") i(o.operand, s);
      else if (o.type === "binary") (i(o.left, s), i(o.right, s));
      else if (o.type === "call") for (let l of o.args) i(l, s);
    };
  for (let o of e.docScope.values()) i(o.expr, o.sheetId);
  for (let o of e.sheets.values()) {
    for (let s of o.columns.values()) i(s.expr, s.sheetId);
    for (let s of o.scalars.values()) i(s.expr, s.sheetId);
    for (let s of o.assertions) i(s.expr, s.sheetId);
    for (let s of o.charts)
      for (let a of [...s.series, s.labels]) {
        let l = a.indexOf(".");
        l === -1 ? r(s.sheetId, a) : r(a.slice(0, l), a.slice(l + 1));
      }
  }
  return { referenced: n, usedAliases: t };
}
function Yh(e) {
  let n = e.lastIndexOf(".");
  return n === -1 ? e : e.slice(n + 1);
}
function hu(e) {
  let n = new Map();
  for (let r of e.sheets.values()) for (let i of r.assertions) n.set(i.id, i);
  let t = new Map();
  return {
    byId: n,
    handled: new Set(),
    results: new Map(),
    suppressed: t,
    bumpSuppressed(r) {
      var i;
      t.set(r, ((i = t.get(r)) != null ? i : 0) + 1);
    },
  };
}
function gu(e, n, t) {
  let r = 0;
  return {
    model: e,
    opts: n,
    values: new Map(),
    cells: new Map(),
    columnPrecision: new Map(),
    scalarPrecision: new Map(),
    columnUnits: new Map(),
    scalarUnits: new Map(),
    unitConflicts: new Set(),
    unevaluable: new Set(),
    staleScalars: new Set(),
    dateErrorRows: new Set(),
    buildableCharts: new Set(),
    emit(i, o = {}) {
      t.push({ f: i, det: r++, ...o });
    },
  };
}
var wu = 2,
  xu = "a boolean cannot be stored; wrap it in `IF()` to produce a number or a string",
  Zh = /^(-?)(\d+(?:\.\d+)?)%$/;
function ge(e, n = {}) {
  var be, At;
  let t = Ll(e, n.doc),
    { order: r, cycles: i, assertionIds: o, chartIds: s } = qr(e),
    a = hu(e),
    l = [],
    u = gu(e, n, l),
    {
      values: c,
      cells: d,
      unevaluable: f,
      columnPrecision: p,
      scalarPrecision: m,
      columnUnits: h,
      scalarUnits: w,
      unitConflicts: g,
      staleScalars: S,
      buildableCharts: b,
    } = u,
    I = u.emit;
  for (let v of e.findings) I(v);
  for (let v of t.findings) I(v, { sheetId: v.sheetId });
  (Jh(e, I), cu(u));
  for (let v of e.sheets.values()) {
    let B = v.table;
    if (B)
      for (let [F, L] of v.columnIndex) {
        if (v.columns.has(F)) continue;
        let X = Qh(B, L);
        X !== null && p.set(`${v.id}.${F}`, X);
      }
  }
  let R = [];
  for (let v of r) {
    let B = e.sheets.get(v.sheetId);
    v.sheetId && !R.includes(v.sheetId) && R.push(v.sheetId);
    let F = Sn(e, v);
    if (o.has(v.id)) {
      x(a.byId.get(v.id), v, F);
      continue;
    }
    if (F.callErrors.length > 0) {
      for (let { call: L, problem: X } of F.callErrors)
        I(
          {
            code: "TYPE",
            sheetId: v.sheetId,
            name: v.name,
            message: vn(L.name, X),
            suggestion:
              X.kind === "unknown" && (be = De(L.name, Be.keys(), wu)) != null ? be : void 0,
            sourceOffset: L.start,
            span: { start: L.start, end: L.end },
          },
          { sheetId: v.sheetId },
        );
      f.add(v.id);
      continue;
    }
    if (F.undefRefs.length > 0) {
      for (let L of F.undefRefs) {
        let X = ze(e, v.sheetId, L);
        I(
          {
            code: "UNDEF",
            sheetId: v.sheetId,
            name: v.name,
            raw: Bt(L),
            suggestion: X.kind === "unknown" && (At = X.suggestion) != null ? At : void 0,
            sourceOffset: L.start,
            span: { start: L.start, end: L.end },
          },
          { sheetId: v.sheetId },
        );
      }
      f.add(v.id);
      continue;
    }
    if (F.vectorRefs.length > 0) {
      for (let L of F.vectorRefs)
        I(
          {
            code: "VECTOR",
            sheetId: v.sheetId,
            name: v.name,
            raw: Bt(L),
            sourceOffset: L.start,
            span: { start: L.start, end: L.end },
          },
          { sheetId: v.sheetId },
        );
      f.add(v.id);
      continue;
    }
    if ([...F.deps].some((L) => f.has(L))) {
      f.add(v.id);
      continue;
    }
    if (s.has(v.id)) {
      b.add(v.id);
      continue;
    }
    (([...F.deps].some((L) => g.has(L)) ||
      F.refs.some(
        (L) => L.res.kind === "input-column" && g.has(`${L.res.sheetId}.${L.res.column}`),
      )) &&
      g.add(v.id),
      v.kind === "column" && B != null && B.table ? ue(v, B, B.table) : we(v));
  }
  (du(u, i), fu(u, a, o));
  let y = uu(u);
  (pu(u), mu(u, l));
  let T = new Set(
      [...t.statuses.values()].filter((v) => v.state === "skipped").map((v) => v.sheetId),
    ),
    M =
      T.size === 0
        ? l
        : l.filter(
            (v) =>
              !(
                (v.f.code === "UNDEF" || v.f.code === "VECTOR") &&
                v.f.sheetId !== void 0 &&
                T.has(v.f.sheetId)
              ),
          ),
    P = Kh(M, R),
    E = [];
  for (let v of e.sheets.values())
    for (let B of v.assertions) {
      let F = a.results.get(B.id);
      F && E.push(F);
    }
  return {
    findings: P,
    values: c,
    cells: d,
    columnPrecision: p,
    scalarPrecision: m,
    columnUnits: h,
    scalarUnits: w,
    unitConflicts: g,
    assertions: E,
    charts: y,
    imports: t.statuses,
    exitCode: P.some(Vr) ? 1 : 0,
  };
  function U(v) {
    if (v.precision !== void 0) return v.precision;
    let B = Et(v.expr, (F) => _(v.sheetId, F));
    return typeof B == "number" ? B : null;
  }
  function _(v, B) {
    var L, X, j, de;
    let F = ze(e, v, B);
    switch (F.kind) {
      case "column":
        return (L = p.get(`${F.sheetId}.${F.binding.name}`)) != null ? L : null;
      case "input-column":
        return (X = p.get(`${F.sheetId}.${F.column}`)) != null
          ? X
          : Xh(e, F.sheetId, F.column)
            ? "date"
            : null;
      case "scalar":
      case "doc-scalar":
        return (de = m.get(F.binding.id)) != null
          ? de
          : ((j = c.get(F.binding.id)) == null ? void 0 : j.t) === "date"
            ? "date"
            : null;
      default:
        return null;
    }
  }
  function C(v) {
    var X;
    let B = v.param;
    if (v.precision === void 0)
      return (
        I(
          {
            code: "PRECISION",
            sheetId: v.sheetId,
            name: v.name,
            message: `param ${v.name} declares no width`,
            suggestion: `param ${v.name} precision N = default \u2026`,
            span: v.span,
          },
          { sheetId: v.sheetId },
        ),
        !1
      );
    let F = v.expr.type === "num" ? new J(v.expr.value) : null,
      L = (X = F == null ? void 0 : F.decimalPlaces()) != null ? X : 0;
    return L > v.precision
      ? (I(
          {
            code: "PRECISION",
            sheetId: v.sheetId,
            name: v.name,
            message: `default ${B.text} has ${L} decimal${L === 1 ? "" : "s"}; param ${v.name} declares ${v.precision}`,
            span: v.span,
          },
          { sheetId: v.sheetId },
        ),
        !1)
      : !0;
  }
  function $(v) {
    I(
      { code: "PRECISION", sheetId: v.sheetId, name: v.name, raw: tg(e, v), span: v.span },
      { sheetId: v.sheetId },
    );
  }
  function D(v, B, F) {
    I(
      {
        code: "PRECISION",
        sheetId: v.sheetId,
        name: v.name,
        ...(F === void 0 ? {} : { rowLabel: F }),
        message: `this value is too large to carry ${B} decimal${B === 1 ? "" : "s"}: ${B} decimals past its integer digits exceeds the ${kn}-significant-digit working precision`,
        span: v.span,
      },
      { sheetId: v.sheetId },
    );
  }
  function z(v, B, F, L) {
    if (F === null || B.t !== "num") return !1;
    let X = Pl(B.d);
    return !X || !Ml(X.lo, X.hi, F)
      ? !1
      : (I(
          {
            code: "PRECISION",
            sheetId: v.sheetId,
            name: v.name,
            ...(L === void 0 ? {} : { rowLabel: L }),
            message: `IRR did not determine a rate at precision ${F}`,
            span: v.span,
          },
          { sheetId: v.sheetId },
        ),
        f.add(v.id),
        !0);
  }
  function ue(v, B, F) {
    var gt, Rt, nr;
    let L = `${B.id}.${v.name}`,
      X = B.columnIndex.get(v.name),
      j = U(v);
    j !== null && p.set(L, j);
    let de = !1,
      ne = (gt = h.get(L)) != null ? gt : null,
      Ie = g.has(L),
      ye = [],
      fe = 0;
    for (let Qe = 0; Qe < F.rows.length; Qe++)
      try {
        let Le = St(v.expr, je(v, B, Qe));
        if (Le.t === "bool") {
          (I(
            { code: "TYPE", sheetId: B.id, name: v.name, message: xu, span: v.span },
            { sheetId: B.id },
          ),
            f.add(v.id));
          return;
        }
        if (
          (j === null && Le.t === "num" && (de = !0), j !== null && Le.t === "num" && Oo(Le.d, j))
        ) {
          (D(v, j, It(F, Qe)), f.add(v.id));
          return;
        }
        if (z(v, Le, j, It(F, Qe))) return;
        let A = j === null ? Le : Cn(Le, j);
        ye.push(A);
        let O = F.rows[Qe].cells[X],
          Q = (Rt = O == null ? void 0 : O.text) != null ? Rt : "";
        !Ie &&
          j !== null &&
          Q !== "" &&
          !on(A, Q, j) &&
          I(
            {
              code: "STALE",
              sheetId: B.id,
              name: v.name,
              rowLabel: It(F, Qe),
              stored: Q,
              computed: et(mt(A, j), ne),
              formula: ku(e, v),
              span: O ? { start: O.start, end: O.end } : void 0,
            },
            { sheetId: B.id, rowIndex: Qe, isColumnCell: !0 },
          );
      } catch (Le) {
        if (Le instanceof _e) (ye.push(null), fe++);
        else if (Le instanceof re) {
          ye.push(null);
          let A = (nr = F.rows[Qe]) == null ? void 0 : nr.cells[X];
          I(
            {
              code: Le.code,
              sheetId: B.id,
              name: v.name,
              rowLabel: It(F, Qe),
              message: Le.message,
              span: A ? { start: A.start, end: A.end } : void 0,
            },
            { sheetId: B.id },
          );
        } else throw Le;
      }
    if ((d.set(L, ye), de)) {
      ($(v), f.add(v.id));
      return;
    }
    fe > 0 &&
      I(
        {
          code: "NOTE",
          sheetId: B.id,
          name: v.name,
          suppressedCount: fe,
          message: `${fe} row${fe === 1 ? "" : "s"} not verified (upstream DATE errors)`,
        },
        { sheetId: B.id },
      );
  }
  function we(v) {
    var B;
    if (v.param !== void 0 && !C(v)) {
      f.add(v.id);
      return;
    }
    try {
      let F = St(v.expr, $e(v));
      if (F.t === "bool") {
        (I(
          { code: "TYPE", sheetId: v.sheetId, name: v.name, message: xu, span: v.span },
          { sheetId: v.sheetId },
        ),
          f.add(v.id));
        return;
      }
      let L = ig(e, v.id),
        X =
          L !== void 0
            ? (() => {
                let fe = Xe(L);
                return fe.kind === "number" ? fe.unit : null;
              })()
            : null;
      w.set(v.id, X);
      let j = U(v);
      if ((j !== null && m.set(v.id, j), j === null && L !== void 0 && F.t === "num")) {
        ($(v), f.add(v.id));
        return;
      }
      if (j !== null && F.t === "num" && Oo(F.d, j)) {
        (D(v, j), f.add(v.id));
        return;
      }
      if (z(v, F, j)) return;
      let de = j === null ? F : Cn(F, j);
      c.set(v.id, de);
      let ne = rg(e, v.id),
        Ie = ne.filter((fe) => fe.percent),
        ye = !1;
      (Ie.length > 0 &&
        de.t !== "num" &&
        (I(
          {
            code: "TYPE",
            sheetId: v.sheetId,
            name: v.name,
            message: "a % sigil is only legal on a numeric scalar",
            span: Ie[0].commentSpan,
          },
          { sheetId: v.sheetId },
        ),
        (ye = !0)),
        j !== null &&
          j < 2 &&
          Ie.length > 0 &&
          de.t === "num" &&
          (I(
            {
              code: "PRECISION",
              sheetId: v.sheetId,
              name: v.name,
              message: `percent display needs precision 2 or more; ${v.name} has ${j}`,
              span: Ie[0].commentSpan,
            },
            { sheetId: v.sheetId },
          ),
          (ye = !0)));
      for (let fe of Ie) {
        let gt = e.source.slice(fe.value.start, fe.value.end),
          Rt = Xe(gt);
        (Rt.kind === "both-sides" || (Rt.kind === "number" && Rt.unit)) &&
          (I(
            {
              code: "UNIT",
              sheetId: v.sheetId,
              name: v.name,
              message: "cannot mix a unit with percent display",
              span: (B = fe.value) != null ? B : fe.commentSpan,
            },
            { sheetId: v.sheetId },
          ),
          (ye = !0));
      }
      if (!ye && j !== null && de.t === "num" && ne.length > 0)
        for (let fe of ne) {
          let gt = e.source.slice(fe.value.start, fe.value.end);
          on(de, gt, j) ||
            (S.add(v.id),
            ng(e, v) ||
              I(
                {
                  code: "STALE",
                  sheetId: v.sheetId,
                  name: v.name,
                  stored: gt,
                  computed: fe.percent ? Yr(de, j) : et(mt(de, j), X),
                  formula: ku(e, v),
                  span: { start: fe.value.start, end: fe.value.end },
                },
                { sheetId: v.sheetId },
              ));
        }
    } catch (F) {
      if (F instanceof _e) f.add(v.id);
      else if (F instanceof re)
        (f.add(v.id),
          I(
            { code: F.code, sheetId: v.sheetId, name: v.name, message: F.message, span: v.span },
            { sheetId: v.sheetId },
          ));
      else throw F;
    }
  }
  function $e(v) {
    return { scalar: (B) => He(v, B, null), vector: (B) => Wn(u, v, B) };
  }
  function x(v, B, F) {
    var j, de;
    a.handled.add(v.id);
    let L = { sheetId: v.sheetId, source: v.source, span: v.span },
      X = (ne) => {
        a.results.set(v.id, {
          sheetId: v.sheetId,
          source: v.source,
          holds: ne,
          operands: ne === null ? {} : H(B),
          substituted: ne === null ? ie(v) : xe(B),
        });
      };
    if (F.callErrors.length > 0) {
      X(null);
      for (let { call: ne, problem: Ie } of F.callErrors)
        I(
          {
            ...L,
            code: "TYPE",
            message: vn(ne.name, Ie),
            suggestion:
              Ie.kind === "unknown" && (j = De(ne.name, Be.keys(), wu)) != null ? j : void 0,
            span: { start: ne.start, end: ne.end },
          },
          { sheetId: v.sheetId },
        );
      return;
    }
    if (F.undefRefs.length > 0) {
      X(null);
      for (let ne of F.undefRefs) {
        let Ie = ze(e, v.sheetId, ne);
        I(
          {
            ...L,
            code: "UNDEF",
            raw: Bt(ne),
            suggestion: Ie.kind === "unknown" && (de = Ie.suggestion) != null ? de : void 0,
            span: { start: ne.start, end: ne.end },
          },
          { sheetId: v.sheetId },
        );
      }
      return;
    }
    if (F.vectorRefs.length > 0) {
      X(null);
      for (let ne of F.vectorRefs)
        I(
          { ...L, code: "VECTOR", raw: Bt(ne), span: { start: ne.start, end: ne.end } },
          { sheetId: v.sheetId },
        );
      return;
    }
    if ([...F.deps].some((ne) => f.has(ne))) {
      (X(null), a.bumpSuppressed(v.sheetId));
      return;
    }
    try {
      let ne = St(B.expr, $e(B));
      if (ne.t !== "bool") {
        (X(null),
          I(
            { ...L, code: "TYPE", message: `assert needs a boolean; \`${ie(v)}\` is ${k(ne)}` },
            { sheetId: v.sheetId },
          ));
        return;
      }
      (X(ne.b), ne.b === !1 && I({ ...L, code: "ASSERT", message: xe(B) }, { sheetId: v.sheetId }));
    } catch (ne) {
      if (ne instanceof _e) (X(null), a.bumpSuppressed(v.sheetId));
      else if (ne instanceof re)
        (X(null), I({ ...L, code: ne.code, message: ne.message }, { sheetId: v.sheetId }));
      else throw ne;
    }
  }
  function H(v) {
    let B = {},
      F = (L) => {
        L.type === "ref"
          ? (B[Bt(L)] = Pe(v, L))
          : L.type === "unary"
            ? F(L.operand)
            : L.type === "binary"
              ? (F(L.left), F(L.right))
              : L.type === "call" && L.args.forEach(F);
      };
    return (F(v.expr), B);
  }
  function ie(v) {
    return v.source.replace(/^assert\s+/, "");
  }
  function k(v) {
    return v.t === "num" ? "a number" : v.t === "date" ? "a date" : "a string";
  }
  function xe(v) {
    let B = v.expr.start,
      F = e.source.slice(v.expr.start, v.expr.end),
      L = [],
      X = (j) => {
        switch (j.type) {
          case "ref": {
            L.push({ at: j.start - B, to: j.end - B, text: Pe(v, j) });
            break;
          }
          case "unary":
            X(j.operand);
            break;
          case "binary":
            (X(j.left), X(j.right));
            break;
          case "call":
            j.args.forEach(X);
            break;
        }
      };
    (X(v.expr), L.sort((j, de) => de.at - j.at));
    for (let j of L) F = F.slice(0, j.at) + j.text + F.slice(j.to);
    return F;
  }
  function Pe(v, B) {
    var de;
    let F;
    try {
      F = He(v, B, null);
    } catch (ne) {
      return Bt(B);
    }
    if (F.t === "date") return F.iso;
    if (F.t === "str") return F.s;
    if (F.t === "bool") return String(F.b);
    let L = ze(e, v.sheetId, B),
      X = L.kind === "scalar" || L.kind === "doc-scalar" ? L.binding.id : void 0,
      j = (de = X !== void 0 ? m.get(X) : void 0) != null ? de : F.d.decimalPlaces();
    return mt(F, j);
  }
  function je(v, B, F) {
    return { scalar: (L) => He(v, L, { sheet: B, row: F }), vector: (L) => Wn(u, v, L) };
  }
  function He(v, B, F) {
    var de, ne, Ie;
    let L = ze(e, v.sheetId, B);
    if (L.kind === "unknown") throw new _e();
    if (L.kind === "doc-scalar" || L.kind === "scalar") {
      if (f.has(L.binding.id)) throw new _e();
      let ye = c.get(L.binding.id);
      if (!ye) throw new _e();
      return ye;
    }
    if (L.kind === "column") {
      if (!F) throw new _e();
      let ye = d.get(L.binding.id),
        fe = ye == null ? void 0 : ye[F.row];
      if (fe == null) throw new _e();
      return fe;
    }
    if (!F) throw new _e();
    let X = F.sheet.columnIndex.get(L.column),
      j =
        (ne = (de = F.sheet.table) == null ? void 0 : de.rows[F.row]) == null
          ? void 0
          : ne.cells[X];
    return Yo(
      u,
      (Ie = j == null ? void 0 : j.text) != null ? Ie : "",
      F.sheet.id,
      L.column,
      F.row,
      j,
    );
  }
}
function Kh(e, n) {
  var d;
  let t = e.filter((f) => f.f.code === "STALE" && f.isColumnCell),
    r = e.filter((f) => f.f.code === "STALE" && !f.isColumnCell && !f.f.anchorGroup),
    i = e.find((f) => f.f.anchorGroup),
    o = e.filter((f) => f.f.code !== "STALE"),
    s = (f) => {
      let p = f ? n.indexOf(f) : -1;
      return p === -1 ? Number.MAX_SAFE_INTEGER : p;
    },
    a = [],
    l = [
      ...new Set(
        [...t, ...r].map((f) => {
          var p;
          return (p = f.sheetId) != null ? p : "";
        }),
      ),
    ].sort((f, p) => s(f) - s(p));
  for (let f of l) {
    let p = t.filter((w) => {
        var g;
        return ((g = w.sheetId) != null ? g : "") === f;
      }),
      m = new Map();
    for (let w of p) {
      let g = (d = m.get(w.rowIndex)) != null ? d : [];
      (g.push(w), m.set(w.rowIndex, g));
    }
    let h = [...m.entries()].sort(
      (w, g) => Math.min(...w[1].map((S) => S.det)) - Math.min(...g[1].map((S) => S.det)),
    );
    for (let [, w] of h) {
      w.sort((g, S) => g.det - S.det);
      for (let g of w) a.push(g.f);
    }
    r.filter((w) => {
      var g;
      return ((g = w.sheetId) != null ? g : "") === f;
    })
      .sort((w, g) => w.det - g.det)
      .forEach((w) => a.push(w.f));
  }
  i && a.push(i.f);
  let u = {
      COVERAGE: 0,
      SHEET: 0,
      TYPE: 0,
      IMPORT: 0,
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
      .sort((f, p) => {
        var m, h;
        return (
          ((m = u[f.f.code]) != null ? m : 9) - ((h = u[p.f.code]) != null ? h : 9) || f.det - p.det
        );
      })
      .map((f) => f.f);
  return [...a, ...c];
}
function Qh(e, n) {
  var r, i;
  let t = -1;
  for (let o of e.rows) {
    let s = rn((i = (r = o.cells[n]) == null ? void 0 : r.text) != null ? i : "");
    s !== null && (t = Math.max(t, s));
  }
  return t === -1 ? null : t;
}
function Cn(e, n) {
  return e.t === "num" ? le(Je(e.d, n)) : e;
}
function on(e, n, t) {
  var i;
  let r = n.trim();
  if (e.t === "num") {
    let o = Xe(r);
    if (o.kind === "number") return Je(new J(o.num), t).equals(Je(e.d, t));
    let s = Zh.exec(r);
    if (!s) return !1;
    let a = new J(((i = s[1]) != null ? i : "") + s[2]).div(100);
    return Je(a, t).equals(Je(e.d, t));
  }
  return e.t === "date" ? r === e.iso : e.t === "bool" ? r === String(e.b) : r === e.s;
}
function mt(e, n) {
  return e.t === "num"
    ? e.d.toFixed(n)
    : e.t === "date"
      ? e.iso
      : e.t === "bool"
        ? String(e.b)
        : e.s;
}
function Ko(e) {
  let n = e.docScope.size;
  for (let t of e.sheets.values()) n += t.columns.size + t.scalars.size + t.assertions.length;
  return n;
}
function Jh(e, n) {
  var i;
  let t = Ko(e),
    r = e.located.noFormulas !== null;
  if (r && t > 0) {
    n({
      code: "COVERAGE",
      message: `marked \`${Un}\`, but the document has ${t} rule${t === 1 ? "" : "s"}`,
      suggestion: "delete the marker \u2014 those rules are checked either way",
      span: (i = e.located.noFormulas) != null ? i : void 0,
    });
    return;
  }
  !r &&
    t === 0 &&
    e.located.tables.length > 0 &&
    n({
      code: "COVERAGE",
      message: "a table with no `vmark` rules \u2014 nothing in this document is checked",
      suggestion: `run \`visimark infer\` to derive them, or mark it \`${Un}\``,
    });
}
function Xh(e, n, t) {
  var a, l;
  let r = e.sheets.get(n),
    i = r == null ? void 0 : r.table,
    o = r == null ? void 0 : r.columnIndex.get(t);
  if (!i || o === void 0) return !1;
  let s = !1;
  for (let u of i.rows) {
    let c = ((l = (a = u.cells[o]) == null ? void 0 : a.text) != null ? l : "").trim();
    if (c !== "") {
      if (rn(c) !== null) return !1;
      eg.test(c) && (s = !0);
    }
  }
  return s;
}
var eg = /^\d{4}-\d{2}-\d{2}$/;
function tg(e, n) {
  return e.source.slice(n.expr.start, n.expr.end);
}
function ku(e, n) {
  let t = n.expr.type === "call" && yn(n.expr.name);
  if (!(n.kind !== "column" && !t)) return e.source.slice(n.expr.start, n.expr.end);
}
function ng(e, n) {
  let t = n.expr;
  if (t.type !== "call" || !yn(t.name)) return !1;
  let r = Be.get(t.name);
  if (!r || r.kind !== "reduce") return !1;
  let i = t.args[r.column];
  if (!i || i.type !== "ref") return !1;
  let o = ze(e, n.sheetId, i);
  return (o.kind === "column" || o.kind === "input-column") && o.sheetId !== n.sheetId;
}
function rg(e, n) {
  return e.anchors.filter(
    (t) => `${t.sheetId}.${t.name}` === n && t.value !== null && t.value.kind !== "image",
  );
}
function ig(e, n) {
  for (let t of e.anchors)
    if (`${t.sheetId}.${t.name}` === n && t.value)
      return e.source.slice(t.value.start, t.value.end);
}
function Jr(e, n) {
  let t = [...n].sort((o, s) => s.start - o.start),
    r = e,
    i = e.length + 1;
  for (let o of t) {
    if (o.end > i) throw new Error(`overlapping edits at ${o.start}..${o.end} and ${i}`);
    if (o.start < 0 || o.end > r.length || o.start > o.end)
      throw new Error(`edit out of range: ${o.start}..${o.end}`);
    ((r = r.slice(0, o.start) + o.text + r.slice(o.end)), (i = o.start));
  }
  return r;
}
function Qo(e, n, t) {
  var l, u, c;
  let r = [],
    i = e.source,
    o = new Map();
  for (let d of n.findings) d.span && o.set(`${d.span.start}:${d.span.end}`, d);
  let s = (d, f) => {
    var p;
    return (p = o.get(`${d}:${f}`)) != null ? p : { code: "STALE" };
  };
  for (let d of e.sheets.values())
    if (d.table)
      for (let [f, p] of d.columns) {
        let m = `${d.id}.${f}`;
        if (n.unitConflicts.has(m)) continue;
        let h = n.cells.get(m);
        if (!h) continue;
        let w = (l = n.columnPrecision.get(m)) != null ? l : 2,
          g = (u = n.columnUnits.get(m)) != null ? u : null,
          S = d.columnIndex.get(f);
        d.table.rows.forEach((b, I) => {
          let R = h[I],
            y = b.cells[S];
          !R ||
            !y ||
            (y.text !== "" &&
              !on(R, y.text, w) &&
              r.push({
                start: y.start,
                end: y.end,
                text: et(mt(R, w), g),
                finding: s(y.start, y.end),
              }));
        });
      }
  let a = new Set(
    n.findings
      .filter((d) => d.code === "PRECISION" || d.code === "TYPE" || d.code === "UNIT")
      .map((d) => {
        var f, p;
        return `${(f = d.sheetId) != null ? f : ""}.${(p = d.name) != null ? p : ""}`;
      }),
  );
  for (let d of e.anchors) {
    if (!d.value || d.value.kind === "image") continue;
    let f = `${d.sheetId}.${d.name}`,
      p = n.values.get(f);
    if (!p) continue;
    let m = i.slice(d.value.start, d.value.end),
      h = n.scalarPrecision.get(f);
    if (h === void 0 || (d.percent && a.has(f))) continue;
    let w = (c = n.scalarUnits.get(f)) != null ? c : null,
      g = Cn(p, h),
      S = d.percent ? Yr(g, h) : et(mt(g, h), w);
    (d.percent || _l(m) ? m !== S : !on(g, m, h)) &&
      r.push({
        start: d.value.start,
        end: d.value.end,
        text: S,
        finding: s(d.value.start, d.value.end),
      });
  }
  for (let d of e.sheets.values()) {
    let f = d.imported;
    if (!f) continue;
    let p = n.imports.get(d.id);
    if (!p || p.digest === null || p.state === "ok" || p.state === "error" || p.state === "skipped")
      continue;
    let m = `at sha256:${p.digest}`;
    f.stampSpan
      ? r.push({
          start: f.stampSpan.start,
          end: f.stampSpan.end,
          text: m,
          finding: s(f.stampSpan.start, f.stampSpan.end),
        })
      : r.push({
          start: f.declSpan.end,
          end: f.declSpan.end,
          text: " " + m,
          finding: s(f.declSpan.start, f.declSpan.end),
        });
  }
  if (t.fixDates)
    for (let d of n.findings) {
      if (d.code !== "DATE" || !d.isoFix || !d.sheetId || !d.name) continue;
      let f = e.sheets.get(d.sheetId),
        p = f == null ? void 0 : f.table;
      if (!p) continue;
      let m = f.columnIndex.get(d.name);
      if (m === void 0) continue;
      let h = p.rows.find((g) => {
          var S;
          return ((S = g.cells[0]) == null ? void 0 : S.text) === d.rowLabel;
        }),
        w = h == null ? void 0 : h.cells[m];
      w && w.text === d.raw && r.push({ start: w.start, end: w.end, text: d.isoFix, finding: d });
    }
  return og(r);
}
function og(e) {
  let n = new Set(),
    t = [];
  for (let r of e) {
    let i = `${r.start}:${r.end}`;
    n.has(i) || (n.add(i), t.push(r));
  }
  return t;
}
function Jo(e) {
  let n = [];
  for (let t of e.charts)
    (t.state !== "stale" && t.state !== "missing") ||
      !t.target ||
      !t.svg ||
      n.push({
        target: t.target,
        svg: t.svg,
        path: t.path,
        state: t.state,
        sheetId: t.sheetId,
        chart: t.name,
      });
  return n;
}
var sg = /^[A-Za-z_][A-Za-z0-9_]*$/,
  ag = new Set(["a", "an", "the", "of", "per", "in", "on", "for", "and", "or", "to", "at", "by"]);
function lg(e) {
  let r = e
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter((i) => !ag.has(i.toLowerCase()))
    .map((i) => i[0].toLowerCase())
    .join("");
  return ((r === "" || /^[0-9]/.test(r)) && (r = `_${r}`), r);
}
function bu(e, n) {
  let t = [],
    r = [],
    i = new Set(n);
  for (let o of e.table.headers.map((s) => s.text)) {
    if (sg.test(o) || e.managed.has(o) || e.aliasedHeaders.has(o) || o.includes('"')) continue;
    let s = lg(o);
    if (i.has(s)) {
      r.push({ header: o, name: s });
      continue;
    }
    (i.add(s),
      t.push({
        kind: "alias",
        stage: 1,
        sheetId: e.id,
        mintedSheetId: e.minted || void 0,
        name: s,
        header: o,
        rule: `"${o}" is ${s}`,
        fits: 0,
        rows: 0,
        tableSpan: e.table.span,
      }));
  }
  return { proposals: t, collisions: r };
}
function Xr(e) {
  let n = Te(e),
    t = qe(n),
    r = new Map();
  for (let [l, u] of n.tableBeforeBlock) u && r.set(u, l);
  let i = new Set(t.sheets.keys()),
    o = 1,
    s = () => {
      for (;;) {
        let l = `unnamed${o++}`;
        if (!i.has(l)) return (i.add(l), l);
      }
    },
    a = n.tables.map((l) => {
      var g, S, b, I;
      let u = (g = r.get(l)) != null ? g : null,
        c = (u == null ? void 0 : u.sheetId) == null,
        d = (S = u == null ? void 0 : u.sheetId) != null ? S : s(),
        f = t.sheets.get(d),
        p = new Map();
      l.headers.forEach((R, y) => p.set(R.text, y));
      let m = [],
        h = new Map(),
        w = new Set();
      for (let [R, y] of p) {
        let T = l.rows
          .map((P) => {
            var E, U;
            return (U = (E = P.cells[y]) == null ? void 0 : E.text) != null ? U : "";
          })
          .filter((P) => P.trim() !== "");
        if ((h.set(R, T.length), T.length === 0)) continue;
        let M = T.map((P) => it(P));
        M.some((P) => P === null) || (m.push(R), M.every((P) => P.equals(M[0])) && w.add(R));
      }
      return {
        id: d,
        minted: c,
        table: l,
        block: u,
        index: p,
        numeric: m,
        managed: new Set((b = f == null ? void 0 : f.columns.keys()) != null ? b : []),
        aliasedHeaders: new Set(
          [...((I = f == null ? void 0 : f.aliases.values()) != null ? I : [])].map(
            (R) => R.header,
          ),
        ),
        filled: h,
        constant: w,
      };
    });
  return { source: e, doc: n, base: t, sheets: a };
}
function Xo(e, n) {
  let t = new Map();
  for (let [r, i] of e.base.sheets) t.set(r, ug(i));
  for (let r of e.sheets)
    t.has(r.id) ||
      t.set(r.id, {
        id: r.id,
        table: r.table,
        columns: new Map(),
        scalars: new Map(),
        columnIndex: new Map(r.index),
        inputColumns: new Set(r.index.keys()),
        aliases: new Map(),
        assertions: [],
        charts: [],
        imported: null,
      });
  for (let r of n) {
    let i = t.get(r.sheetId);
    i &&
      (r.kind === "column"
        ? (i.columns.set(r.name, r), i.inputColumns.delete(r.name))
        : i.scalars.set(r.name, r));
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
function ug(e) {
  return {
    id: e.id,
    table: e.table,
    columns: new Map(e.columns),
    scalars: new Map(e.scalars),
    columnIndex: new Map(e.columnIndex),
    inputColumns: new Set(e.inputColumns),
    aliases: new Map(e.aliases),
    assertions: [...e.assertions],
    charts: [...e.charts],
    imported: e.imported,
  };
}
function yu(e, n) {
  let t = Lo(n);
  return {
    id: `${e.id}.${t.name}`,
    sheetId: e.id,
    name: t.name,
    expr: t.expr,
    kind: e.index.has(t.name) ? "column" : "scalar",
    ...(t.precision === void 0 ? {} : { precision: t.precision }),
    span: { start: 0, end: n.length },
  };
}
function es(e, n) {
  let t = e.indexOf("=");
  return t === -1 ? e : `${e.slice(0, t).trimEnd()} precision ${n} = ${e.slice(t + 1).trim()}`;
}
function cg(e, n) {
  var i, o;
  let t = e.index.get(n);
  if (t === void 0) return null;
  let r = -1;
  for (let s of e.table.rows) {
    let a = rn((o = (i = s.cells[t]) == null ? void 0 : i.text) != null ? o : "");
    a !== null && (r = Math.max(r, a));
  }
  return r === -1 ? null : r;
}
function ei(e, n, t, r, i = !1) {
  var h, w, g;
  let o = { usable: !1, rows: 0, fits: 0, misses: [] },
    s = ts(n, t);
  if (!s || s.kind !== "column") return o;
  let a = Xo(e, [...Su(r), s]),
    l = ge(a),
    u = `${n.id}.${s.name}`;
  for (let S of l.findings)
    if (S.code !== "STALE") {
      if (S.code === "PRECISION" && S.sheetId === n.id && S.name === s.name && !i) {
        let b = cg(n, s.name);
        if (b === null) return o;
        let I = es(t, b),
          R = ei(e, n, I, r, !0);
        return R.usable ? { ...R, ruleUsed: I } : o;
      }
      if (
        (S.sheetId === n.id && S.name === s.name) ||
        (S.code === "CYCLE" && (h = S.cyclePath) != null && h.includes(s.id))
      )
        return o;
    }
  let c = l.cells.get(u);
  if (!c) return o;
  let d = (w = l.columnPrecision.get(u)) != null ? w : 2,
    f = (g = l.columnUnits.get(u)) != null ? g : null,
    p = n.index.get(s.name),
    m = { usable: !0, rows: 0, fits: 0, misses: [] };
  return (
    n.table.rows.forEach((S, b) => {
      var T, M, P;
      let I = S.cells[p],
        R = (T = I == null ? void 0 : I.text) != null ? T : "";
      if (R.trim() === "") return;
      m.rows++;
      let y = c[b];
      if (y == null) {
        m.usable = !1;
        return;
      }
      if (on(y, R, d)) {
        m.fits++;
        return;
      }
      m.misses.push({
        rowIndex: b,
        rowLabel: (P = (M = S.cells[0]) == null ? void 0 : M.text) != null ? P : `row ${b + 1}`,
        stored: R,
        computed: et(mt(y, d), f),
        span: I ? { start: I.start, end: I.end } : { start: 0, end: 0 },
      });
    }),
    m.usable ? m : o
  );
}
function vu(e, n, t, r, i) {
  var d;
  let o = { usable: !1, derivable: !1, text: () => "", writes: () => !1 },
    s = ts(n, t);
  if (!s || s.kind !== "scalar") return o;
  let a = Xo(e, [...Su(r), s]),
    l = ge(a);
  for (let f of l.findings)
    if (!(f.code === "STALE" || f.code === "WARN") && f.sheetId === n.id && f.name === s.name)
      return o;
  let u = l.values.get(s.id);
  if (!u) return o;
  let c = i && (d = l.columnUnits.get(`${n.id}.${i}`)) != null ? d : null;
  return {
    usable: !0,
    derivable: l.scalarPrecision.has(s.id),
    text: (f) => mt(u, f),
    writes: (f) => dg(u, c, f),
  };
}
function dg(e, n, t) {
  var a, l;
  let r = t.trim(),
    i = Xe(r);
  if (i.kind !== "number") return !1;
  let o = /^-?\d+(?:\.(\d+))?$/.exec(i.num);
  if (!o) return !1;
  let s = (l = (a = o[1]) == null ? void 0 : a.length) != null ? l : 0;
  return et(mt(Cn(e, s), s), n) === r;
}
function Su(e) {
  let n = [];
  for (let t of e) {
    let r = ts(t.sheet, t.rule);
    r && n.push(r);
  }
  return n;
}
function ts(e, n) {
  try {
    return yu(e, n);
  } catch (t) {
    return null;
  }
}
var fg = 6,
  pg = ["*", "+"],
  mg = ["-", "/"];
function Eu(e, n, t) {
  let r = [];
  for (let i of Cu(n)) {
    let o = n.numeric.filter((s) => s !== i);
    for (let s of pg)
      for (let a = 0; a < o.length; a++)
        for (let l = a + 1; l < o.length; l++) ti(r, e, n, t, 1, i, o[a], s, o[l]);
    for (let s of mg) for (let a of o) for (let l of o) a !== l && ti(r, e, n, t, 1, i, a, s, l);
    for (let s of o) {
      let a = gg(n, i, s);
      a && ti(r, e, n, t, 2, i, s, "*", a);
    }
  }
  return r;
}
function Iu(e, n, t, r) {
  let i = [];
  for (let o of Cu(n))
    for (let s of n.numeric)
      if (s !== o)
        for (let a of t) {
          let l = a.sheetId === n.id ? a.name : `${a.sheetId}.${a.name}`;
          ti(i, e, n, r, 4, o, s, "*", l, `${a.sheetId}.${a.name}`);
        }
  return i;
}
function Cu(e) {
  return e.numeric.filter((n) => !e.managed.has(n));
}
function ti(e, n, t, r, i, o, s, a, l, u) {
  var w;
  let c = `${o} = ${s} ${a} ${l}`,
    d = ei(n, t, c, r);
  if (!d.usable || d.fits === 0) return;
  let f = (w = d.ruleUsed) != null ? w : c,
    p = [s, l].filter((g) => t.index.has(g)),
    m = p.map((g) => `${t.id}.${g}`);
  u && m.push(u);
  let h = {
    sheet: t,
    stage: i,
    target: o,
    rule: f,
    op: a,
    operands: p,
    deps: m,
    constant: i === 2 ? l : void 0,
    verdict: d,
  };
  ((h.degenerateWith = hg(n, t, r, h, s, l)), e.push(h));
}
function hg(e, n, t, r, i, o) {
  if (r.op !== "*") return;
  let s = n.constant.has(i) ? o : n.constant.has(o) ? i : null;
  if (s === null) return;
  let a = `${r.target} = ${s}`,
    l = ei(e, n, a, t);
  return l.usable && l.misses.length === 0 && l.rows > 0 ? a : void 0;
}
function gg(e, n, t) {
  var o, s, a, l;
  let r = e.index.get(n),
    i = e.index.get(t);
  for (let u of e.table.rows) {
    let c = it((s = (o = u.cells[r]) == null ? void 0 : o.text) != null ? s : ""),
      d = it((l = (a = u.cells[i]) == null ? void 0 : a.text) != null ? l : "");
    if (c === null || d === null || d.isZero()) continue;
    let f = c.div(d);
    return !f.isFinite() || f.isZero() || f.equals(1) || f.decimalPlaces() > fg
      ? null
      : f.toString();
  }
  return null;
}
var wg = "prefers a rule over materialised columns",
  xg = "another rule for this column ranks higher";
function Ru(e, n = new Map()) {
  let t = new Map(n),
    r = { accepted: [], weak: [], nearMisses: [], ambiguous: [], alsoFits: [], edges: t },
    i = new Map();
  for (let l of e) i.has(l.sheet) || i.set(l.sheet, i.size);
  let o = e.filter(kg),
    s = new Set(),
    a = new Map();
  for (;;) {
    let l = o.filter((w) => !s.has(Ct(w)) && !Au(t, Ct(w), w.deps));
    if (l.length === 0) break;
    let u = Math.min(...l.map(Tu)),
      c = l.filter((w) => Tu(w) === u),
      d = (w) => {
        var g, S;
        return (
          ((g = i.get(w.sheet)) != null ? g : 0) * 1e3 +
          ((S = w.sheet.index.get(w.target)) != null ? S : 0)
        );
      },
      f = c.reduce((w, g) => (d(w) <= d(g) ? w : g)),
      p = c.filter((w) => Ct(w) === Ct(f)),
      m = [...new Set(p.map((w) => w.rule))];
    if ((s.add(Ct(f)), m.length > 1)) {
      r.ambiguous.push({ sheet: f.sheet, target: f.target, alternatives: m });
      continue;
    }
    let h = p[0];
    if (h.degenerateWith) {
      r.ambiguous.push({
        sheet: h.sheet,
        target: h.target,
        alternatives: [h.rule, h.degenerateWith],
      });
      continue;
    }
    (t.set(Ct(h), h.deps),
      a.set(Ct(h), h),
      h.verdict.misses.length > 0
        ? r.nearMisses.push(h)
        : Pu(h)
          ? r.weak.push(h)
          : r.accepted.push(h));
  }
  for (let l of o) {
    if (l.verdict.misses.length > 0) continue;
    let u = a.get(Ct(l));
    !u ||
      u === l ||
      Au(t, Ct(l), l.deps) ||
      r.alsoFits.push({ candidate: l, reason: ns(u) < ns(l) ? wg : xg });
  }
  return r;
}
function kg(e) {
  let { rows: n, misses: t } = e.verdict;
  return t.length === 0 ? n >= 2 : t.length === 1 && n >= 3;
}
function Pu(e) {
  return e.verdict.rows === 2;
}
var Ct = (e) => `${e.sheet.id}.${e.target}`,
  ns = (e) => (e.stage === 1 ? 0 : e.stage === 4 ? 1 : 2);
function Tu(e) {
  let n = e.verdict.misses.length === 0 ? 0 : 1,
    t = Pu(e) ? 1 : 0,
    r = ns(e),
    i = e.op === "*" || e.op === "+" ? 0 : 1;
  return ((n * 2 + t) * 3 + r) * 2 + i;
}
function Au(e, n, t) {
  var o;
  let r = new Set(),
    i = [...t];
  for (; i.length > 0;) {
    let s = i.pop();
    if (s === n) return !0;
    r.has(s) || (r.add(s), i.push(...((o = e.get(s)) != null ? o : [])));
  }
  return !1;
}
var bg = /^-?\d+(?:\.\d+)?%?$/,
  yg = ["SUM", "AVG", "MIN", "MAX", "COUNT"],
  vg = { SUM: "_total", AVG: "_avg", MIN: "_min", MAX: "_max", COUNT: "_count" };
function Sg(e) {
  var n;
  return (n = rn(e)) != null ? n : 2;
}
function Qn(e) {
  let n = Xr(e),
    { picks: t, ambiguousFigures: r } = Cg(n);
  for (let c of t)
    c.candidate.derivable || (c.candidate.rule = es(c.candidate.rule, Sg(c.figure.text)));
  let i = t.map((c) => ({ sheet: c.candidate.sheet, rule: c.candidate.rule })),
    o = t.map((c) => ({ sheetId: c.candidate.sheet.id, name: c.candidate.name })),
    s = [];
  for (let c of n.sheets) (s.push(...Eu(n, c, i)), s.push(...Iu(n, c, o, i)));
  let a = new Map();
  for (let c of t)
    a.set(`${c.candidate.sheet.id}.${c.candidate.name}`, [
      `${c.candidate.sheet.id}.${c.candidate.column}`,
    ]);
  let l = Ru(s, a),
    u = Ag(n, l, t, r);
  return (u.push(...Ig(n, u)), u);
}
var Eg = new Set([
  "is",
  "assert",
  "chart",
  ...Be.keys(),
  ...[...Be.keys()].map((e) => e.toLowerCase()),
]);
function Ig(e, n) {
  var r, i;
  let t = [];
  for (let o of e.sheets) {
    let s = e.base.sheets.get(o.id),
      a = new Set([
        ...Eg,
        ...o.index.keys(),
        ...((r = s == null ? void 0 : s.scalars.keys()) != null ? r : []),
        ...((i = s == null ? void 0 : s.aliases.keys()) != null ? i : []),
        ...n.filter((c) => c.sheetId === o.id).map((c) => c.name),
      ]),
      { proposals: l, collisions: u } = bu(o, a);
    t.push(...l);
    for (let c of u)
      t.push({
        kind: "ambiguous",
        stage: 1,
        sheetId: o.id,
        mintedSheetId: o.minted || void 0,
        name: c.header,
        rule: "",
        fits: 0,
        rows: o.table.rows.length,
        tableSpan: o.table.span,
        alternatives: [`"${c.header}" is ${c.name} \u2014 \`${c.name}\` is already taken`],
      });
  }
  return t;
}
function Cg(e) {
  var o, s;
  let n = [];
  for (let a of e.sheets) {
    if (a.table.rows.length < 2) continue;
    let l = new Set(
      (s = (o = e.base.sheets.get(a.id)) == null ? void 0 : o.scalars.keys()) != null ? s : [],
    );
    for (let u of a.numeric)
      for (let c of yg) {
        let d = u.toLowerCase() + vg[c];
        if (l.has(d)) continue;
        let f = `${d} = ${c}(${u})`,
          p = vu(e, a, f, [], u);
        p.usable &&
          n.push({
            sheet: a,
            column: u,
            reduce: c,
            name: d,
            rule: f,
            derivable: p.derivable,
            writes: p.writes,
          });
      }
  }
  let t = [],
    r = [],
    i = new Set();
  for (let a of e.doc.figures) {
    if (a.anchored) continue;
    let l = n.filter((c) => c.writes(a.text));
    if (l.length === 0) continue;
    let u = l.filter((c) => !i.has(c) && c.sheet.table.span.end < a.value.start);
    if (u.length === 1) {
      (i.add(u[0]), t.push({ candidate: u[0], figure: a }));
      continue;
    }
    l.length >= 2 && r.push({ figure: a, alternatives: l.map((c) => Tg(c)) });
  }
  return { picks: t, ambiguousFigures: r };
}
var Tg = (e) => `${e.sheet.id}.${e.name} = ${e.reduce}(${e.column})`;
function Ag(e, n, t, r) {
  let i = [];
  for (let o of e.sheets) {
    let s = (u) => u.sheet === o,
      a = { sheetId: o.id, mintedSheetId: o.minted || void 0, tableSpan: o.table.span },
      l = Rg([...n.accepted, ...n.weak].filter(s), n.edges);
    for (let u of l) {
      let c = u.constant ? Pg(e, u.constant) : void 0;
      (i.push({
        ...a,
        kind: "column",
        stage: u.stage,
        name: u.target,
        rule: u.rule,
        fits: u.verdict.fits,
        rows: u.verdict.rows,
        weak: n.weak.includes(u) || void 0,
        constantEcho: c,
      }),
        u.constant &&
          c &&
          i.push({
            ...a,
            kind: "constant",
            stage: 2,
            name: u.constant,
            rule: u.rule,
            fits: u.verdict.fits,
            rows: u.verdict.rows,
            constantEcho: c,
          }));
    }
    for (let u of t.filter((c) => c.candidate.sheet === o))
      i.push({
        ...a,
        kind: "scalar",
        stage: 3,
        name: u.candidate.name,
        rule: u.candidate.rule,
        fits: o.table.rows.length,
        rows: o.table.rows.length,
        anchorSite: u.figure.anchorAt === null ? void 0 : u.figure.value,
        reason: u.figure.anchorAt === null ? "no anchorable inline node holds this figure" : void 0,
      });
    for (let u of n.nearMisses.filter(s)) {
      let c = u.verdict.misses[0];
      i.push({
        ...a,
        kind: "near-miss",
        stage: u.stage,
        name: u.target,
        rule: u.rule,
        fits: u.verdict.fits,
        rows: u.verdict.rows,
        disagreement: {
          rowIndex: c.rowIndex,
          rowLabel: c.rowLabel,
          stored: c.stored,
          computed: c.computed,
          span: c.span,
        },
      });
    }
    for (let u of n.ambiguous.filter((c) => c.sheet === o))
      i.push({
        ...a,
        kind: "ambiguous",
        stage: 1,
        name: u.target,
        rule: "",
        fits: 0,
        rows: o.table.rows.length,
        alternatives: u.alternatives,
      });
    for (let { candidate: u, reason: c } of n.alsoFits.filter((d) => s(d.candidate)))
      i.push({
        ...a,
        kind: "alternative",
        stage: u.stage,
        name: u.target,
        rule: u.rule,
        fits: u.verdict.fits,
        rows: u.verdict.rows,
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
function Rg(e, n) {
  let t = new Map(e.map((s) => [`${s.sheet.id}.${s.target}`, s])),
    r = [],
    i = new Set(),
    o = (s) => {
      var l;
      if (i.has(s)) return;
      i.add(s);
      for (let u of (l = n.get(s)) != null ? l : []) t.has(u) && o(u);
      let a = t.get(s);
      a && r.push(a);
    };
  for (let s of e) o(`${s.sheet.id}.${s.target}`);
  return r;
}
function Pg(e, n) {
  let t = it(n);
  if (t)
    for (let r of e.doc.figures) {
      if (r.text === n || !bg.test(r.text)) continue;
      let i = it(r.text);
      if (i && i.equals(t)) return { text: r.text, span: r.value };
    }
}
function rs(e, n) {
  let t = n != null ? n : Qn(e),
    r = Xr(e),
    i = new Map(r.sheets.map((c) => [c.id, c])),
    o = Te(e),
    s = o.figures,
    a = Fg(e, o, t);
  if (a) return [a];
  let l = t.filter(
      (c) =>
        !c.weak &&
        (c.kind === "column" ||
          c.kind === "alias" ||
          (c.kind === "scalar" && c.anchorSite !== void 0)),
    ),
    u = [];
  for (let c of r.sheets) {
    let d = l.filter((w) => w.sheetId === c.id);
    if (d.length === 0) continue;
    let f = d.filter((w) => w.kind === "alias"),
      p = d.filter((w) => w.kind === "column"),
      m = d.filter((w) => w.kind === "scalar"),
      h = [Dg(f), Mu(p), Mu(m)].filter((w) => w.length > 0).join(`

`);
    u.push({ ...Ng(e, c, h), kind: "block", proposal: d[0], proposals: d });
  }
  for (let c of l) {
    if (c.kind !== "scalar" || !c.anchorSite) continue;
    let d = i.get(c.sheetId);
    if (!d) continue;
    let f = s.find((p) => p.value.start === c.anchorSite.start && p.value.end === c.anchorSite.end);
    !f ||
      f.anchorAt === null ||
      u.push({
        start: f.anchorAt,
        end: f.anchorAt,
        text: `<!--vmark=${d.id}.${c.name}-->`,
        kind: "anchor",
        proposal: c,
        proposals: [c],
      });
  }
  return (
    u.length > 0 && o.noFormulas !== null && u.push({ ...Mg(e, o.noFormulas), kind: "marker" }), u
  );
}
function Mg(e, n) {
  let t = n.start,
    r = n.end;
  return (
    e[r] ===
      `
` && (r += 1),
    e[t - 1] ===
      `
` &&
      e[t - 2] ===
        `
` &&
      (t -= 1),
    { start: t, end: r, text: "" }
  );
}
function Fg(e, n, t) {
  if (t.length > 0 || n.tables.length === 0 || n.noFormulas !== null || Ko(qe(n)) > 0) return null;
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
    text: `${r}${Un}
`,
    kind: "marker",
  };
}
function Ng(e, n, t) {
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
function Mu(e) {
  let n = e.map((r) => {
      let i = r.rule.indexOf("=");
      return i === -1
        ? { head: r.name, body: r.rule }
        : { head: r.rule.slice(0, i).trimEnd(), body: r.rule.slice(i + 1).trimStart() };
    }),
    t = Math.max(0, ...n.map((r) => r.head.length));
  return n.map((r) => `${r.head.padEnd(t)} = ${r.body}`).join(`
`);
}
function Dg(e) {
  return e.map((n) => n.rule).join(`
`);
}
var $g = 10;
var zI = " ".repeat($g);
function Fu(e) {
  return e.t === "num"
    ? e.d.toString()
    : e.t === "date"
      ? e.iso
      : e.t === "bool"
        ? String(e.b)
        : e.s;
}
function sn(e) {
  let n = {};
  for (let [t, r] of e.values) n[t] = Fu(r);
  for (let [t, r] of e.cells) n[t] = r.map((i) => (i ? Fu(i) : null));
  return n;
}
var _g = new Uint32Array([
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221,
  3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580,
  3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
  2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895,
  666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037,
  2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344,
  430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779,
  1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298,
]);
function ht(e, n) {
  return (e >>> n) | (e << (32 - n));
}
function Vg(e) {
  let n = e.length * 8,
    t = new Uint8Array((((e.length + 8) >> 6) + 1) << 6);
  (t.set(e), (t[e.length] = 128));
  let r = new DataView(t.buffer);
  (r.setUint32(t.length - 8, Math.floor(n / 4294967296)), r.setUint32(t.length - 4, n >>> 0));
  let i = 1779033703,
    o = 3144134277,
    s = 1013904242,
    a = 2773480762,
    l = 1359893119,
    u = 2600822924,
    c = 528734635,
    d = 1541459225,
    f = new Uint32Array(64);
  for (let p = 0; p < t.length; p += 64) {
    for (let y = 0; y < 16; y++) f[y] = r.getUint32(p + y * 4);
    for (let y = 16; y < 64; y++) {
      let T = f[y - 15],
        M = f[y - 2],
        P = ht(T, 7) ^ ht(T, 18) ^ (T >>> 3),
        E = ht(M, 17) ^ ht(M, 19) ^ (M >>> 10);
      f[y] = (f[y - 16] + P + f[y - 7] + E) >>> 0;
    }
    let m = i,
      h = o,
      w = s,
      g = a,
      S = l,
      b = u,
      I = c,
      R = d;
    for (let y = 0; y < 64; y++) {
      let T = ht(S, 6) ^ ht(S, 11) ^ ht(S, 25),
        M = (S & b) ^ (~S & I),
        P = (R + T + M + _g[y] + f[y]) >>> 0,
        E = ht(m, 2) ^ ht(m, 13) ^ ht(m, 22),
        U = (m & h) ^ (m & w) ^ (h & w),
        _ = (E + U) >>> 0;
      ((R = I),
        (I = b),
        (b = S),
        (S = (g + P) >>> 0),
        (g = w),
        (w = h),
        (h = m),
        (m = (P + _) >>> 0));
    }
    ((i = (i + m) >>> 0),
      (o = (o + h) >>> 0),
      (s = (s + w) >>> 0),
      (a = (a + g) >>> 0),
      (l = (l + S) >>> 0),
      (u = (u + b) >>> 0),
      (c = (c + I) >>> 0),
      (d = (d + R) >>> 0));
  }
  return [i, o, s, a, l, u, c, d].map(Bg).join("");
}
function Bg(e) {
  return (e >>> 0).toString(16).padStart(8, "0");
}
function is(e) {
  return Vg(new TextEncoder().encode(e));
}
function ni(e) {
  let n = (t) => {
    var r;
    return (r = e(t)) != null ? r : null;
  };
  return {
    exists: (t) => n(t) !== null,
    realpath: (t) => t,
    readText: n,
    readSealed: (t) => {
      let r = n(t);
      return r === null ? null : { text: r, sha256: is(r) };
    },
  };
}
var Nu = 4;
function ri(e) {
  return e.startsWith("/") ? e.slice(1) : e;
}
function zg(e, n) {
  let t = ni((r) => {
    var i;
    return (i = e.get(r)) != null ? i : null;
  });
  return {
    exists: (r) => (n.add(r), t.exists(r)),
    realpath: (r) => (n.add(r), t.realpath(r)),
    readText: (r) => (n.add(r), t.readText(r)),
    readSealed: (r) => (n.add(r), t.readSealed(r)),
  };
}
async function Ug(e, n, t) {
  let r = "/" + ri(n),
    i = new Map(),
    o = new Set(),
    s = new Set(),
    a = 0;
  for (;;) {
    a++;
    let l = new Set();
    ge(e, { doc: { path: r, reader: zg(i, l) } });
    for (let c of l) s.add(c);
    let u = [...l].filter((c) => !o.has(c) && c !== r);
    if (u.length === 0) break;
    if (a >= Nu)
      throw new Error(
        `visimark: reading ${n} did not settle after ${Nu} rounds; still asking for ${u.join(", ")}. A path request now depends on a file's contents, which the snapshot design assumes it cannot \u2014 see src/snapshot.ts.`,
      );
    for (let c of u) {
      o.add(c);
      let d = await t(ri(c));
      d !== null && i.set(c, d);
    }
  }
  return {
    reader: ni((l) => {
      var u;
      return (u = i.get(l)) != null ? u : null;
    }),
    path: r,
    asked: s,
    held: new Set(i.keys()),
    rounds: a,
  };
}
async function ot(e, n, t) {
  let r = qe(Te(e));
  return { model: r, snapshot: await Ug(r, n, t) };
}
function jg(e, n) {
  if (e.state === "missing")
    return n === null
      ? null
      : "a file now exists at this chart's target \u2014 refusing to overwrite it";
  let t = n === null ? null : Kr(n);
  return t === null
    ? "this chart's target is no longer a VisiMark chart \u2014 refusing to overwrite it"
    : t.sheet !== e.sheetId || t.chart !== e.chart
      ? "this chart's target now belongs to a different chart \u2014 refusing to overwrite it"
      : null;
}
async function Du(e, n, t) {
  let r = 0;
  for (let i of e) {
    let o = ri(i.target),
      s = jg(i, await n(o));
    if (s !== null) return { written: r, failed: { chart: i.chart, err: s } };
    let a = await t(o, i.svg);
    if ("err" in a) return { written: r, failed: { chart: i.chart, err: a.err } };
    r++;
  }
  return { written: r, failed: null };
}
var Ke = require("obsidian");
function Ue(e) {
  return Te(e).blocks.length > 0;
}
function os(e) {
  var n, t;
  return (t = (n = e.raw) != null ? n : e.name) != null ? t : "this value";
}
var Hg = {
  STALE: (e) =>
    e.artifact !== void 0
      ? e.name !== void 0
        ? "This chart is older than the numbers it draws."
        : "This note's data file has changed since it was last checked in."
      : e.anchorGroup === !0
        ? e.suppressedCount === void 0
          ? "Some values in the text no longer match their formulas."
          : e.suppressedCount === 1
            ? "1 value in the text no longer matches its formula."
            : `${e.suppressedCount} values in the text no longer match their formulas.`
        : "This value no longer matches its formula.",
  DATE: () => "This looks like a date but is not one VisiMark can read.",
  UNIT: () => "This column mixes units.",
  UNDEF: (e) => `Nothing in this note is called ${os(e)}.`,
  DUP: (e) => `${os(e)} is defined twice.`,
  VECTOR: () => "This uses a whole column where one value is expected.",
  CYCLE: () => "These values depend on each other in a loop.",
  TYPE: () => "This formula does not fit together.",
  SHEET: () => "This block has rules but no table above it.",
  ANCHOR: () => "This highlighted value has nothing to bind to.",
  PRECISION: () => "VisiMark cannot tell how many decimals this should have.",
  ASSERT: () => "This check does not hold.",
  ARTIFACT: () => "This chart could not be built.",
  IMPORT: (e) =>
    e.message === "unstamped import"
      ? "This note has not checked in its data file yet."
      : "The data file this note reads could not be read.",
  WARN: (e) => `${os(e)} is defined but never used.`,
  COVERAGE: (e) =>
    e.span !== void 0
      ? "A marker says nothing here is checked, but this table now has rules."
      : "Nothing in this table is checked yet.",
  NOTE: null,
};
function Wg(e) {
  return e.code === "STALE" && e.artifact === void 0
    ? { kind: "repair" }
    : e.code === "COVERAGE" && e.span === void 0
      ? { kind: "infer" }
      : e.code === "CYCLE" && e.cyclePath !== void 0
        ? { kind: "cycle", path: e.cyclePath }
        : e.code === "UNDEF" && e.suggestion !== void 0
          ? { kind: "suggest", name: e.suggestion }
          : null;
}
var qg = new Set(["WARN", "NOTE"]);
function $u(e) {
  let n = Hg[e.code];
  return n === null
    ? null
    : {
        code: e.code,
        severity: qg.has(e.code) ? "advice" : "problem",
        row: n(e),
        ...(e.code === "ASSERT" && e.source !== void 0 ? { quote: e.source } : {}),
        action: Wg(e),
      };
}
function Wt(e) {
  return e.problems.length === 0 && e.advice.length === 0;
}
var ii = (e) => {
  var n, t;
  return (t = (n = e.span) == null ? void 0 : n.start) != null ? t : Number.MAX_SAFE_INTEGER;
};
function Tt(e, n, t, r = {}) {
  var f, p, m, h;
  let i = Qo(e, n, {
      noArtifacts: !0,
      fixDates: (f = r.fixDates) != null ? f : !1,
      ...(t ? { doc: t } : {}),
    }),
    o = (w) => ({ start: w.start, end: w.end, text: w.text }),
    s = n.findings.filter((w) => w.code === "STALE" && w.span === void 0),
    a = s.length === 1 ? s[0] : null,
    l = new Set(n.findings),
    u = new Map();
  for (let w of i) {
    let g = l.has(w.finding) ? w.finding : a;
    if (g === null) continue;
    let S = u.get(g);
    S ? S.push(o(w)) : u.set(g, [o(w)]);
  }
  let c = [],
    d = [];
  for (let w of n.findings) {
    let g = $u(w);
    if (g === null) continue;
    let S =
        ((p = g.action) == null ? void 0 : p.kind) === "repair" && (m = u.get(w)) != null
          ? m
          : null,
      b = {
        reader: g,
        finding: w,
        span: (h = w.span) != null ? h : null,
        repair: S !== null && S.length > 0 ? S : null,
      };
    (g.severity === "problem" ? c : d).push(b);
  }
  return (
    c.sort((w, g) => ii(w) - ii(g)),
    d.sort((w, g) => ii(w) - ii(g)),
    { problems: c, advice: d, allRepairs: i.map(o) }
  );
}
var an = require("obsidian");
function ss(e) {
  return async (n) => {
    try {
      return await e.adapter.read((0, an.normalizePath)(n));
    } catch (t) {
      return null;
    }
  };
}
function qt(e) {
  let n = ss(e);
  return async (t) => {
    let r = e.getAbstractFileByPath((0, an.normalizePath)(t));
    if (r instanceof an.TFile)
      try {
        return await e.cachedRead(r);
      } catch (i) {
        return null;
      }
    return n(t);
  };
}
function Lu(e) {
  return async (n, t) => {
    try {
      let r = (0, an.normalizePath)(n),
        i = e.getAbstractFileByPath(r);
      if (i instanceof an.TFile) return (await e.modify(i, t), { ok: !0 });
      let o = r.lastIndexOf("/");
      if (o > 0) {
        let s = r.slice(0, o);
        e.getAbstractFileByPath(s) || (await e.createFolder(s));
      }
      return (await e.create(r, t), { ok: !0 });
    } catch (r) {
      return { err: r instanceof Error ? r.message : String(r) };
    }
  };
}
var Jn = "visimark-findings",
  oi = class extends Ke.ItemView {
    constructor(t) {
      super(t);
      W(
        this,
        "refreshSoon",
        (0, Ke.debounce)(
          () => {
            this.refresh();
          },
          400,
          !0,
        ),
      );
      W(this, "renderId", 0);
      W(this, "renderedSource", null);
      W(this, "activeView", null);
      W(this, "collapsedSections", new Set());
      W(this, "peeked", new Set());
      W(this, "pinned", null);
    }
    getViewType() {
      return Jn;
    }
    getDisplayText() {
      return "VisiMark findings";
    }
    getIcon() {
      return "list-checks";
    }
    async onOpen() {
      (this.registerEvent(
        this.app.workspace.on("active-leaf-change", () => {
          this.refresh();
        }),
      ),
        this.registerEvent(
          this.app.workspace.on("file-open", () => {
            this.refresh();
          }),
        ),
        this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshSoon())),
        await this.refresh());
    }
    async refresh() {
      let t = ++this.renderId,
        r = this.noteView(),
        i = r == null ? void 0 : r.file;
      if (r === null || i === null || i === void 0)
        return ((this.activeView = null), this.drawEmpty(null));
      this.activeView = r;
      let o = r.getViewData();
      if (!Ue(o)) return this.drawEmpty(i.basename);
      try {
        let { model: s, snapshot: a } = await ot(o, i.path, ss(this.app.vault));
        if (t !== this.renderId) return;
        let l = { path: a.path, reader: a.reader };
        this.draw(Tt(s, ge(s, { doc: l }), l), i.basename, o);
      } catch (s) {
        if (t !== this.renderId) return;
        this.drawFailed(i.basename);
      }
    }
    container() {
      let t = this.contentEl;
      t.empty();
      for (let r of this.peeked) r.removeClass("visimark-peek");
      return (this.peeked.clear(), (this.pinned = null), t.createDiv({ cls: "visimark-findings" }));
    }
    drawEmpty(t) {
      ((this.renderedSource = null),
        this.container().createEl("p", {
          cls: "visimark-note-state",
          text:
            t === null
              ? "Open a note to see what VisiMark checks in it."
              : `${t} has no VisiMark block, so there is nothing to check in it yet.`,
        }));
    }
    drawFailed(t) {
      ((this.renderedSource = null),
        this.container().createEl("p", {
          cls: "visimark-note-state",
          text: `${t} could not be checked. Nothing here is a verdict about it.`,
        }));
    }
    draw(t, r, i) {
      this.renderedSource = i;
      let o = this.container();
      if (Wt(t)) {
        o.createEl("p", {
          cls: "visimark-note-state",
          text: `Everything in ${r} agrees with its formulas.`,
        });
        return;
      }
      (this.section(o, "Needs attention", t.problems), this.section(o, "Advice", t.advice));
    }
    section(t, r, i) {
      if (i.length === 0) return;
      let o = t.createDiv({ cls: "visimark-section" }),
        s = this.collapsedSections.has(r),
        a = o.createEl("button", {
          cls: "visimark-section-heading",
          attr: { type: "button", "aria-expanded": String(!s) },
        });
      (a.toggleClass("is-collapsed", s),
        (0, Ke.setIcon)(a.createSpan({ cls: "visimark-section-chevron" }), "chevron-right"),
        a.createSpan({ text: r }));
      let l = o.createEl("ul", { cls: "visimark-list" });
      l.toggleClass("visimark-list-collapsed", s);
      for (let u of i) this.node(l, u);
      a.addEventListener("click", () => {
        let u = !this.collapsedSections.has(r);
        (u ? this.collapsedSections.add(r) : this.collapsedSections.delete(r),
          a.toggleClass("is-collapsed", u),
          a.setAttr("aria-expanded", String(!u)),
          l.toggleClass("visimark-list-collapsed", u));
      });
    }
    node(t, r) {
      let i = t.createEl("li", { cls: "visimark-node" });
      Yg(r.finding) ? this.valueNode(i, r) : this.leafNode(i, r);
    }
    valueNode(t, r) {
      let i = r.finding,
        o = t.createEl("ul", { cls: "visimark-node-children" });
      (o.addEventListener("mouseenter", () => this.peek(r, !0)),
        o.addEventListener("mouseleave", () => {
          this.pinned !== r && this.peek(r, !1);
        }));
      let a = o.createEl("li", { cls: "visimark-node-detail" }).createEl("button", {
        cls: "visimark-node-detail-action",
        attr: { type: "button", "aria-label": Ou(r), "data-tooltip-position": "top" },
      });
      (a.createSpan({ text: `${i.stored}: ${r.reader.row}` }),
        a.addEventListener("click", () => this.select(r)));
      let l = o.createEl("li", { cls: "visimark-node-detail visimark-node-fact" });
      (l.createSpan({ text: `The formula gives ${i.computed}` }),
        r.repair !== null && this.fixIcon(l, r));
    }
    leafNode(t, r) {
      var a;
      let i = t.createDiv({ cls: "visimark-node-row" }),
        o = i.createEl("button", {
          cls: "visimark-node-self",
          attr: { type: "button", "aria-label": Ou(r), "data-tooltip-position": "top" },
        });
      o.createSpan({ cls: "visimark-row-text", text: r.reader.row });
      let s = (a = r.finding.rowLabel) != null ? a : r.finding.name;
      (s !== void 0 && o.createSpan({ cls: "visimark-row-where", text: s }),
        o.addEventListener("click", () => this.select(r)),
        o.addEventListener("mouseenter", () => this.peek(r, !0)),
        o.addEventListener("mouseleave", () => {
          this.pinned !== r && this.peek(r, !1);
        }),
        r.repair !== null && this.fixIcon(i, r));
    }
    fixIcon(t, r) {
      let i = t.createEl("button", {
        cls: "visimark-fix clickable-icon",
        attr: {
          type: "button",
          "aria-label": `Fix: ${r.reader.row}`,
          "data-tooltip-position": "top",
        },
      });
      (0, Ke.setIcon)(i, "wrench");
      let o = r.repair;
      i.addEventListener("click", () => this.apply(o, r));
    }
    markedElements(t) {
      var s;
      let r = (s = this.targetView()) == null ? void 0 : s.contentEl;
      if (r == null) return [];
      let i = t.finding;
      if (i.code === "STALE" && i.anchorGroup === !0)
        return [...r.querySelectorAll(".visimark-disagrees[data-vmark]:not([data-vmark-row])")];
      if (t.span === null) return [];
      if (i.name === void 0) return [];
      let o = i.sheetId === void 0 || i.sheetId === "" ? i.name : `${i.sheetId}.${i.name}`;
      return [...r.querySelectorAll("[data-vmark]")].filter(
        (a) => a.getAttribute("data-vmark") === o,
      );
    }
    peek(t, r) {
      for (let i of this.markedElements(t))
        (i.toggleClass("visimark-peek", r), r ? this.peeked.add(i) : this.peeked.delete(i));
    }
    select(t) {
      var r, i;
      (this.jumpTo(t),
        this.pinned !== null && this.pinned !== t && this.peek(this.pinned, !1),
        (this.pinned = t),
        ((r = this.targetView()) == null ? void 0 : r.getMode()) !== "source" &&
          (this.peek(t, !0),
          (i = this.markedElements(t)[0]) == null ||
            i.scrollIntoView({ behavior: "smooth", block: "center" })));
    }
    jumpTo(t) {
      let r = this.editor();
      if (r === null || t.span === null) return;
      let i = r.offsetToPos(t.span.start),
        o = r.offsetToPos(t.span.end);
      (r.setSelection(i, o), r.scrollIntoView({ from: i, to: o }, !0), r.focus());
    }
    apply(t, r) {
      let i = this.editor();
      if (i === null) {
        new Ke.Notice("Open the note in an editor to repair it.");
        return;
      }
      if (i.getValue() !== this.renderedSource) {
        (new Ke.Notice("This note changed since it was checked. Checking again before repairing."),
          this.refresh());
        return;
      }
      let o = [...t].sort((s, a) => a.start - s.start);
      (i.transaction({
        changes: o.map((s) => ({
          from: i.offsetToPos(s.start),
          to: i.offsetToPos(s.end),
          text: s.text,
        })),
      }),
        new Ke.Notice(r.reader.row.replace(/\.$/, " \u2014 repaired.")),
        this.refresh());
    }
    editor() {
      var t, r;
      return (r = (t = this.targetView()) == null ? void 0 : t.editor) != null ? r : null;
    }
    noteView() {
      let t = this.app.workspace.getMostRecentLeaf();
      return (t == null ? void 0 : t.view) instanceof Ke.MarkdownView ? t.view : null;
    }
    targetView() {
      return this.activeView !== null && this.activeView.containerEl.isConnected
        ? this.activeView
        : this.noteView();
    }
  };
function Ou(e) {
  let n = e.finding,
    t = [e.reader.row, `VisiMark calls this ${n.code}`];
  (n.name !== void 0 && t.push(n.name),
    n.stored !== void 0 &&
      n.computed !== void 0 &&
      t.push(`the note says ${n.stored}, the formula gives ${n.computed}`),
    e.reader.quote !== void 0 && t.push(e.reader.quote));
  let r = Gg(e);
  return (r !== null && t.push(r), t.join(" \xB7 "));
}
function Gg(e) {
  let n = e.reader.action;
  return n === null
    ? null
    : n.kind === "suggest"
      ? `Did you mean ${n.name}?`
      : n.kind === "cycle"
        ? n.path.join(" \u2192 ")
        : n.kind === "infer"
          ? "VisiMark can propose the formulas for this table."
          : null;
}
function Yg(e) {
  return e.code === "STALE" && e.stored !== void 0 && e.computed !== void 0;
}
function _u(e, n) {
  async function t(r) {
    let i = n(r);
    if (i === null) throw new Error("visimark: that is not a note in this vault");
    let o = await e(i);
    if (o === null) throw new Error(`visimark: cannot read ${i}`);
    let { model: s, snapshot: a } = await ot(o, i, e),
      l = ge(s, { doc: { path: a.path, reader: a.reader } });
    return { model: s, result: l };
  }
  return {
    apiVersion: 1,
    async check(r) {
      return (await t(r)).result.findings;
    },
    async evaluate(r) {
      return sn((await t(r)).result);
    },
    async get(r, i) {
      var o;
      return (o = sn((await t(r)).result)[i]) != null ? o : null;
    },
    async explain(r, i) {
      let { model: o, result: s } = await t(r);
      return as(o, s, i);
    },
  };
}
function as(e, n, t) {
  var o, s, a;
  let r = Zg(e, t);
  if (r === null) return null;
  let i = Sn(e, r);
  return {
    name: t,
    kind: r.kind,
    source: e.source.slice(r.span.start, r.span.end),
    value: (o = sn(n)[t]) != null ? o : null,
    inputs: Kg(i),
    precision:
      (a =
        (s = r.kind === "column" ? n.columnPrecision.get(r.id) : n.scalarPrecision.get(r.id)) !=
        null
          ? s
          : r.precision) != null
        ? a
        : null,
  };
}
function Zg(e, n) {
  var r, i;
  let t = n.lastIndexOf(".");
  if (t > 0) {
    let o = e.sheets.get(n.slice(0, t)),
      s = n.slice(t + 1),
      a =
        (r = o == null ? void 0 : o.columns.get(s)) != null
          ? r
          : o == null
            ? void 0
            : o.scalars.get(s);
    if (a) return a;
  }
  return (i = e.docScope.get(n)) != null ? i : null;
}
function Kg(e) {
  let n = new Set(),
    t = [];
  for (let { res: r } of e.refs) {
    let i;
    switch (r.kind) {
      case "column":
      case "scalar":
      case "doc-scalar":
        i = r.binding.id;
        break;
      case "input-column":
        i = `${r.sheetId}.${r.column}`;
        break;
      default:
        i = null;
    }
    i === null || n.has(i) || (n.add(i), t.push(i));
  }
  return t;
}
function Vu(e, n) {
  let t = (r) => n >= r.start && n <= r.end;
  for (let r of Te(e.source).anchors) {
    let i = r.sheetId === "" ? r.name : `${r.sheetId}.${r.name}`;
    if (t(r.commentSpan) || (r.value !== null && t(r.value))) return i;
  }
  for (let [r, i] of e.docScope) if (t(i.span)) return r;
  for (let r of e.sheets.values()) {
    for (let [i, o] of r.columns) if (t(o.span)) return `${r.id}.${i}`;
    for (let [i, o] of r.scalars) if (t(o.span)) return `${r.id}.${i}`;
  }
  return null;
}
var Bu = require("obsidian");
var Xn = class extends Bu.Modal {
  constructor(t, r, i) {
    super(t);
    W(this, "explanation", r);
    W(this, "row", i);
  }
  onOpen() {
    var o;
    let t = this.explanation;
    this.setTitle(t.name);
    let { contentEl: r } = this;
    r.createEl("pre", { cls: "visimark-explain-rule" }).createEl("code", { text: t.source });
    let i = Array.isArray(t.value)
      ? this.row !== void 0
        ? (o = t.value[this.row]) != null
          ? o
          : "?"
        : t.value.map((s) => (s != null ? s : "?")).join(", ")
      : t.value;
    (r.createEl("p", {
      cls: "visimark-explain-value",
      text:
        i === null
          ? "It has no value at the moment \u2014 something it reads could not be worked out."
          : `It comes to ${i}.`,
    }),
      t.inputs.length > 0
        ? r.createEl("p", {
            cls: "visimark-explain-inputs",
            text: `Worked out from ${t.inputs.join(", ")}.`,
          })
        : r.createEl("p", {
            cls: "visimark-explain-inputs",
            text: "It reads nothing else \u2014 it is written down rather than worked out.",
          }),
      t.precision !== null &&
        r.createEl("p", {
          cls: "visimark-explain-inputs",
          text: `Written to ${t.precision} ${t.precision === 1 ? "decimal place" : "decimal places"}.`,
        }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var er = require("obsidian");
function zu(e) {
  return e.inserts.length === 0;
}
function Qg(e) {
  return {
    inserts: [],
    blocks: [],
    marker: null,
    removesMarker: !1,
    result: e,
    counts: { columns: 0, scalars: 0, aliases: 0, anchors: 0 },
  };
}
function Uu(e, n) {
  let t = Qn(e),
    r = Xg(t, n);
  if (r !== void 0 && r.length === 0 && t.length > 0) return Qg(e);
  let i = rs(e, r),
    o = { columns: 0, scalars: 0, aliases: 0, anchors: 0 },
    s = [],
    a = null,
    l = !1;
  for (let u of i) {
    if ((u.kind === "anchor" && o.anchors++, u.kind === "block")) {
      s.push(u.text);
      for (let c of u.proposals)
        c.kind === "column"
          ? o.columns++
          : c.kind === "scalar"
            ? o.scalars++
            : c.kind === "alias" && o.aliases++;
    }
    u.kind === "marker" && (u.text.length > 0 ? (a = u.text.trim()) : (l = !0));
  }
  return { inserts: i, blocks: s, marker: a, removesMarker: l, result: Jr(e, i), counts: o };
}
function ju(e) {
  if (e.marker !== null)
    return "VisiMark cannot find any arithmetic here, and will mark this table as having none to check.";
  let { columns: n, scalars: t, aliases: r, anchors: i } = e.counts,
    o = [];
  if (
    (n > 0 && o.push(`${n} ${n === 1 ? "column" : "columns"}`),
    t > 0 && o.push(`${t} ${t === 1 ? "total" : "totals"}`),
    r > 0 && o.push(`${r} ${r === 1 ? "name" : "names"}`),
    o.length === 0 && i === 0)
  )
    return "There is nothing here to work out.";
  let s = o.length === 0 ? "the formulas" : Jg(o),
    a =
      i === 0
        ? ""
        : `, and bind ${i} ${i === 1 ? "number" : "numbers"} in your text to ${i === 1 ? "it" : "them"}`;
  return `VisiMark can work out ${s}${a}. Nothing you have written is changed.`;
}
function Jg(e) {
  var n;
  return e.length <= 1
    ? (n = e[0]) != null
      ? n
      : ""
    : `${e.slice(0, -1).join(", ")} and ${e[e.length - 1]}`;
}
function Xg(e, n) {
  if (n === void 0 || n.start >= n.end) return;
  let t = (i) => i.start < n.end && n.start < i.end,
    r = new Set();
  for (let i of e) t(i.tableSpan) && r.add(`${i.tableSpan.start}:${i.tableSpan.end}`);
  return e.filter((i) => r.has(`${i.tableSpan.start}:${i.tableSpan.end}`));
}
var ls = class extends er.Modal {
  constructor(t, r, i) {
    super(t);
    W(this, "preview", r);
    W(this, "onAccept", i);
  }
  onOpen() {
    this.setTitle("Work out the formulas");
    let { contentEl: t } = this;
    t.createEl("p", { cls: "visimark-infer-lead", text: ju(this.preview) });
    for (let a of this.preview.blocks)
      t.createEl("pre", { cls: "visimark-infer-block" }).createEl("code", { text: a.trim() });
    (this.preview.marker !== null &&
      t
        .createEl("pre", { cls: "visimark-infer-block" })
        .createEl("code", { text: this.preview.marker }),
      this.preview.removesMarker &&
        t.createEl("p", {
          cls: "visimark-infer-note",
          text: "This table already said it had no formulas to check. That comment will be removed, since it now does.",
        }));
    let { anchors: r } = this.preview.counts;
    r > 0 &&
      t.createEl("p", {
        cls: "visimark-infer-note",
        text: `${r} ${r === 1 ? "number" : "numbers"} already in your text ${r === 1 ? "gets" : "get"} an invisible comment tying ${r === 1 ? "it" : "them"} to a name, so ${r === 1 ? "it stays" : "they stay"} checked as the table changes.`,
      });
    let i = t.createDiv({ cls: "visimark-infer-buttons" });
    i.createEl("button", {
      text: "Cancel",
      attr: { type: "button", "aria-label": "Leave the note as it is" },
    }).addEventListener("click", () => this.close());
    let s = i.createEl("button", {
      cls: "mod-cta",
      text: "Insert",
      attr: { type: "button", "aria-label": "Insert these formulas into the note" },
    });
    (s.addEventListener("click", () => {
      (this.close(), this.onAccept());
    }),
      s.focus());
  }
  onClose() {
    this.contentEl.empty();
  }
};
function Hu(e, n, t) {
  if (zu(t)) {
    new er.Notice("There is nothing here for VisiMark to work out yet.");
    return;
  }
  new ls(e, t, () => {
    (n.transaction({
      changes: t.inserts.map((r) => ({
        from: n.offsetToPos(r.start),
        to: n.offsetToPos(r.end),
        text: r.text,
      })),
    }),
      new er.Notice(
        t.marker !== null
          ? "Marked. Nothing you had written was changed."
          : "Inserted. Nothing you had written was changed.",
      ));
  }).open();
}
function Wu(e, n) {
  let t = [e.source.trim()],
    r = ew(e, n);
  return (
    r !== null && t.push(`comes to ${r}`),
    e.inputs.length > 0 && t.push(`reads ${e.inputs.join(", ")}`),
    t.join(" \xB7 ")
  );
}
function ew(e, n) {
  var r;
  let t = e.value;
  return t === null
    ? null
    : Array.isArray(t)
      ? n === void 0
        ? null
        : (r = t[n]) != null
          ? r
          : null
      : t;
}
function us(e) {
  if (e === null) return;
  let n = Number.parseInt(e, 10);
  return Number.isInteger(n) && n >= 0 ? n : void 0;
}
var Ku = require("obsidian"),
  cs = require("@codemirror/state"),
  ai = require("@codemirror/view");
var qu = (e) => `${e.start}:${e.end}`;
function si(e, n) {
  let t = new Set();
  for (let o of n.findings) o.code === "STALE" && o.span !== void 0 && t.add(qu(o.span));
  let r = (o) => (t.has(qu(o)) ? "disagrees" : "computed"),
    i = [];
  for (let o of e.sheets.values()) {
    let s = o.table;
    if (s !== null)
      for (let a of o.columns.keys()) {
        let l = o.columnIndex.get(a);
        if (l !== void 0)
          for (let [u, c] of s.rows.entries()) {
            let d = c.cells[l];
            d !== void 0 &&
              i.push({
                span: { start: d.start, end: d.end },
                mark: r(d),
                name: `${o.id}.${a}`,
                kind: "cell",
                row: u,
                column: l,
              });
          }
      }
  }
  for (let o of e.located.anchors)
    o.value === null ||
      o.value.kind === "image" ||
      i.push({
        span: { start: o.value.start, end: o.value.end },
        mark: r(o.value),
        name: o.sheetId === "" ? o.name : `${o.sheetId}.${o.name}`,
        kind: "anchor",
        anchorKind: o.value.kind,
      });
  return i.sort((o, s) => o.span.start - s.span.start);
}
function Gu(e, n, t) {
  return e.filter((r) => r.span.start >= n && r.span.end <= t);
}
function tw(e, n) {
  let t = { "data-vmark": e.name, tabindex: "0" };
  return (
    n !== null && (t["data-vmark-path"] = n),
    e.row !== void 0 && (t["data-vmark-row"] = String(e.row)),
    ai.Decoration.mark({
      class: e.mark === "disagrees" ? "visimark-computed visimark-disagrees" : "visimark-computed",
      attributes: t,
    })
  );
}
function Yu(e) {
  var s, a, l;
  let n = e.state.doc.toString(),
    t = new cs.RangeSetBuilder();
  if (!Ue(n)) return t.finish();
  let r = Ku.editorInfoField,
    i =
      (l = (a = (s = e.state.field(r, !1)) == null ? void 0 : s.file) == null ? void 0 : a.path) !=
      null
        ? l
        : null,
    o = qe(Te(n));
  for (let u of si(o, ge(o))) t.add(u.span.start, u.span.end, tw(u, i));
  return t.finish();
}
var Zu = new cs.RangeSetBuilder().finish();
function Qu(e) {
  return ai.ViewPlugin.define(
    (n) => ({
      decorations: e() ? Yu(n) : Zu,
      update(t) {
        t.docChanged && (this.decorations = e() ? Yu(t.view) : Zu);
      },
    }),
    { decorations: (n) => n.decorations },
  );
}
var nw = { strong: "strong", emphasis: "em", inlineCode: "code" };
function Xu(e, n) {
  let t = n.getSectionInfo(e);
  if (t === null) return;
  let r = t.text;
  if (!Ue(r)) return;
  let i = Ju(r, t.lineStart),
    o = Ju(r, t.lineEnd + 1),
    s = qe(Te(r)),
    a = Gu(si(s, ge(s)), i, o);
  a.length !== 0 && (rw(e, a, n.sourcePath), iw(e, r, a, n.sourcePath));
}
function Ju(e, n) {
  let t = 0;
  for (let r = 0; r < n; r++) {
    let i = e.indexOf(
      `
`,
      t,
    );
    if (i === -1) return e.length;
    t = i + 1;
  }
  return t;
}
function rw(e, n, t) {
  let r = e.querySelector("table");
  if (r === null) return;
  let i = r.querySelectorAll("tbody tr");
  for (let o of n) {
    if (o.kind !== "cell" || o.row === void 0 || o.column === void 0) continue;
    let s = i[o.row],
      a = s == null ? void 0 : s.querySelectorAll("td")[o.column];
    a !== void 0 && ds(a, o, t);
  }
}
function iw(e, n, t, r) {
  let i = new Set();
  for (let o of t) {
    if (o.kind !== "anchor") continue;
    let s = n.slice(o.span.start, o.span.end),
      a = o.anchorKind !== void 0 ? nw[o.anchorKind] : void 0;
    if (a !== void 0) {
      let u = Array.from(e.querySelectorAll(a)).find((c) => {
        var d;
        return !i.has(c) && ((d = c.textContent) == null ? void 0 : d.trim()) === s;
      });
      if (u === void 0) continue;
      (i.add(u), ds(u, o, r));
      continue;
    }
    let l = ow(e, s, i);
    l !== null && ds(l, o, r);
  }
}
function ow(e, n, t) {
  var o;
  let r = e.doc,
    i = r.createTreeWalker(e, NodeFilter.SHOW_TEXT);
  for (let s = i.nextNode(); s !== null; s = i.nextNode()) {
    if (t.has(s)) continue;
    let l = ((o = s.textContent) != null ? o : "").indexOf(n);
    if (l === -1) continue;
    let u = r.createRange();
    (u.setStart(s, l), u.setEnd(s, l + n.length));
    let c = r.createElement("span");
    return (u.surroundContents(c), c.firstChild !== null && t.add(c.firstChild), c);
  }
  return null;
}
function ds(e, n, t) {
  (e.addClass("visimark-computed"),
    n.mark === "disagrees" && e.addClass("visimark-disagrees"),
    e.setAttribute("data-vmark", n.name),
    e.setAttribute("data-vmark-path", t),
    n.row !== void 0 && e.setAttribute("data-vmark-row", String(n.row)),
    e.setAttribute("tabindex", "0"));
}
var fs = {
  formatOnSave: !1,
  showProvenanceInLivePreview: !0,
  sweepOnOpen: !1,
  writeChartArtifacts: !1,
  fixDatesOnFormat: !1,
};
var Gt = require("obsidian");
var li = class extends Gt.PluginSettingTab {
  constructor(t, r) {
    super(t, r);
    W(this, "plugin", r);
  }
  display() {
    let { containerEl: t } = this;
    (t.empty(),
      new Gt.Setting(t)
        .setName("Format on explicit save")
        .setDesc(
          "Apply every repair fmt would make \u2014 the same plan the Format command runs \u2014 when you press Ctrl/Cmd+S with a VisiMark note focused. An autosave never triggers this. Saving another way, such as the command palette's \u201CSave file,\u201D does not either: Obsidian has no event for an explicit save distinct from autosave, so this listens for the keystroke specifically.",
        )
        .addToggle((r) =>
          r.setValue(this.plugin.settings.formatOnSave).onChange(async (i) => {
            ((this.plugin.settings.formatOnSave = i), await this.plugin.saveSettings());
          }),
        ),
      new Gt.Setting(t)
        .setName("Show provenance in Live Preview")
        .setDesc(
          "Mark a computed value while you type, the same way reading mode always does. Turn off if the anchor comment behind a mark reads badly as literal text next to it.",
        )
        .addToggle((r) =>
          r.setValue(this.plugin.settings.showProvenanceInLivePreview).onChange(async (i) => {
            ((this.plugin.settings.showProvenanceInLivePreview = i),
              await this.plugin.saveSettings());
          }),
        ),
      new Gt.Setting(t)
        .setName("Sweep the vault on open")
        .setDesc(
          "Start a vault-wide check automatically each time this vault opens, and keep a live count next to the ribbon icon updated as you edit (v1.1 row 13) \u2014 turning this on here starts that count for the rest of this session too, without waiting for the next open.",
        )
        .addToggle((r) =>
          r.setValue(this.plugin.settings.sweepOnOpen).onChange(async (i) => {
            ((this.plugin.settings.sweepOnOpen = i),
              await this.plugin.saveSettings(),
              i && this.plugin.startAmbientIndex());
          }),
        ),
      new Gt.Setting(t)
        .setName("Write chart artifacts")
        .setDesc(
          "Let Format (the command, or format-on-save) regenerate a stale or missing chart's SVG in the vault. Off by default: this plugin has never created a new file in your vault before, and this is the first setting that lets it. With this off, a stale chart still gets a finding \u2014 it just never gets rewritten for you.",
        )
        .addToggle((r) =>
          r.setValue(this.plugin.settings.writeChartArtifacts).onChange(async (i) => {
            ((this.plugin.settings.writeChartArtifacts = i), await this.plugin.saveSettings());
          }),
        ),
      new Gt.Setting(t)
        .setName("Fix unambiguous dates")
        .setDesc(
          "Let Format also rewrite a date it can read but that is not in ISO form \u2014 the same thing the CLI's fmt --fix-dates does. Off by default, same as that flag. A date VisiMark cannot read at all (an ambiguous one such as 03/04/2026) still needs a person either way.",
        )
        .addToggle((r) =>
          r.setValue(this.plugin.settings.fixDatesOnFormat).onChange(async (i) => {
            ((this.plugin.settings.fixDatesOnFormat = i), await this.plugin.saveSettings());
          }),
        ));
  }
};
var ps = { text: "", detail: "", kind: "hidden" };
function ec(e) {
  let n = e.problems.length,
    t = e.advice.length;
  return n === 0
    ? {
        text: "VisiMark \u2713",
        detail: Wt(e)
          ? "Everything in this note agrees with its formulas."
          : `Everything in this note agrees with its formulas. ${t} ${t === 1 ? "note is" : "notes are"} worth knowing about.`,
        kind: "clean",
      }
    : {
        text: `VisiMark \xB7 ${n} to look at`,
        detail:
          `${n} ${n === 1 ? "thing needs" : "things need"} attention in this note.` +
          (t > 0 ? ` ${t} more ${t === 1 ? "is" : "are"} worth knowing.` : ""),
        kind: "problems",
      };
}
var tc = {
  text: "VisiMark \xB7 ?",
  detail: "This note could not be checked, so nothing here is a verdict about it.",
  kind: "unknown",
};
function ms(e) {
  return e.includes("vmark");
}
async function ui(e, n = {}) {
  var s, a, l, u, c;
  let t = (s = n.chunk) != null ? s : 50,
    r = (a = n.pause) != null ? a : () => Promise.resolve(),
    i = e.paths(),
    o = { scanned: 0, candidates: 0, checked: 0, notes: [], unreadable: [], cancelled: !1 };
  for (let d of i) {
    if (((l = n.signal) == null ? void 0 : l.aborted) === !0) {
      o.cancelled = !0;
      break;
    }
    (o.scanned++,
      o.scanned % t === 0 &&
        ((u = n.onProgress) == null || u.call(n, o.scanned, i.length), await r()));
    let f = await e.read(d);
    if (f === null) {
      o.unreadable.push(d);
      continue;
    }
    if (ms(f) && (o.candidates++, !!Ue(f))) {
      o.checked++;
      try {
        let { model: p, snapshot: m } = await ot(f, d, e.read),
          h = { path: m.path, reader: m.reader },
          w = Tt(p, ge(p, { doc: h }), h);
        if (Wt(w)) continue;
        o.notes.push({ path: d, problems: w.problems.length, advice: w.advice.length, report: w });
      } catch (p) {
        o.unreadable.push(d);
      }
    }
  }
  return ((c = n.onProgress) == null || c.call(n, o.scanned, i.length), o);
}
var Tn = require("obsidian");
var tr = "visimark-sweep",
  ci = class extends Tn.ItemView {
    constructor(t, r = () => null) {
      super(t);
      W(this, "getIndex", r);
      W(this, "running", !1);
      W(this, "signal", { aborted: !1 });
      W(this, "unsubscribe", null);
    }
    getViewType() {
      return tr;
    }
    getDisplayText() {
      return "VisiMark vault sweep";
    }
    getIcon() {
      return "search-check";
    }
    async onOpen() {
      let t = this.getIndex();
      if (t !== null && t.isSeeded()) {
        (this.drawFromIndex(t), (this.unsubscribe = t.onChange(() => this.drawFromIndex(t))));
        return;
      }
      await this.run();
    }
    onClose() {
      var t;
      return (
        (this.signal.aborted = !0),
        (t = this.unsubscribe) == null || t.call(this),
        (this.unsubscribe = null),
        Promise.resolve()
      );
    }
    drawFromIndex(t) {
      let r = this.container(),
        i = t.notes(),
        o = i.length,
        s = r.createDiv({ cls: "visimark-sweep-status" });
      if (
        (s.createSpan({
          cls: "visimark-note-state",
          text:
            o === 0
              ? "Nothing in this vault currently disagrees with itself."
              : `${o} ${o === 1 ? "note disagrees" : "notes disagree"} with ${o === 1 ? "itself" : "themselves"}, kept up to date as you edit.`,
        }),
        s
          .createEl("button", {
            cls: "visimark-sweep-again",
            text: "Look again",
            attr: { type: "button", "aria-label": "Look through the whole vault again" },
          })
          .addEventListener("click", () => {
            this.run();
          }),
        o === 0)
      )
        return;
      let l = r.createEl("ul", { cls: "visimark-list" });
      for (let u of i) this.row(l, u);
    }
    async run() {
      var i, o;
      if (this.running) return;
      ((this.running = !0),
        (this.signal = { aborted: !1 }),
        (i = this.unsubscribe) == null || i.call(this),
        (this.unsubscribe = null),
        (o = this.getIndex()) == null || o.beginSeed());
      let t = this.app.vault.getMarkdownFiles(),
        r = qt(this.app.vault);
      this.drawProgress(0, t.length);
      try {
        let s = await ui(
            { paths: () => t.map((l) => l.path), read: r },
            {
              chunk: 50,
              pause: () => new Promise((l) => activeWindow.setTimeout(l, 0)),
              onProgress: (l, u) => this.drawProgress(l, u),
              signal: this.signal,
            },
          ),
          a = this.getIndex();
        (!s.cancelled &&
          a !== null &&
          (a.seed(s), (this.unsubscribe = a.onChange(() => this.drawFromIndex(a)))),
          this.drawResult(s));
      } finally {
        this.running = !1;
      }
    }
    container() {
      let t = this.contentEl;
      return (t.empty(), t.createDiv({ cls: "visimark-sweep" }));
    }
    drawProgress(t, r) {
      let o = this.container().createDiv({ cls: "visimark-sweep-status" });
      (o.createSpan({
        cls: "visimark-note-state",
        text: `Looking at note ${t.toLocaleString()} of ${r.toLocaleString()}.`,
      }),
        o
          .createEl("button", {
            cls: "visimark-sweep-cancel",
            text: "Stop",
            attr: { type: "button", "aria-label": "Stop looking through the vault" },
          })
          .addEventListener("click", () => {
            this.signal.aborted = !0;
          }));
    }
    drawResult(t) {
      let r = this.container(),
        i = t.notes.length,
        o = r.createDiv({ cls: "visimark-sweep-status" });
      if (
        (o.createSpan({ cls: "visimark-note-state", text: this.summaryLine(t) }),
        o
          .createEl("button", {
            cls: "visimark-sweep-again",
            text: t.cancelled ? "Start again" : "Look again",
            attr: { type: "button", "aria-label": "Look through the vault again" },
          })
          .addEventListener("click", () => {
            this.run();
          }),
        t.unreadable.length > 0 &&
          r.createEl("p", {
            cls: "visimark-note-state",
            text: `${t.unreadable.length} ${t.unreadable.length === 1 ? "note" : "notes"} could not be read, so nothing here is a verdict about ${t.unreadable.length === 1 ? "it" : "them"}.`,
          }),
        i === 0)
      )
        return;
      let a = r.createEl("ul", { cls: "visimark-list" });
      for (let l of t.notes) this.row(a, l);
    }
    summaryLine(t) {
      let r = t.notes.length,
        i = t.scanned.toLocaleString();
      return t.cancelled
        ? r === 0
          ? `Stopped after ${i} notes. Nothing so far disagrees with itself.`
          : `Stopped after ${i} notes. ${r} of them ${r === 1 ? "disagrees" : "disagree"} with ${r === 1 ? "itself" : "themselves"}.`
        : r === 0
          ? `Nothing in this vault disagrees with itself. ${i} notes looked at.`
          : `${r} ${r === 1 ? "note disagrees" : "notes disagree"} with ${r === 1 ? "itself" : "themselves"}, out of ${i} looked at.`;
    }
    row(t, r) {
      let o = t.createEl("li", { cls: "visimark-row" }).createEl("button", {
          cls: "visimark-row-main",
          attr: {
            type: "button",
            "aria-label": `Open ${r.path}`,
            "data-tooltip-position": "top",
          },
        }),
        s = r.path.lastIndexOf("/");
      (o.createSpan({ cls: "visimark-row-text", text: r.path.slice(s + 1).replace(/\.md$/, "") }),
        s > 0 && o.createSpan({ cls: "visimark-row-where", text: r.path.slice(0, s) }),
        o.createSpan({ cls: "visimark-row-where", text: this.countLine(r) }),
        o.addEventListener("click", () => {
          this.open(r.path);
        }));
    }
    countLine(t) {
      let r = [];
      return (
        t.problems > 0 &&
          r.push(`${t.problems} ${t.problems === 1 ? "thing needs" : "things need"} attention`),
        t.advice > 0 && r.push(`${t.advice} worth knowing`),
        r.join(", ")
      );
    }
    async open(t) {
      let r = this.app.vault.getAbstractFileByPath(t);
      if (!(r instanceof Tn.TFile)) {
        new Tn.Notice("That note is no longer in the vault.");
        return;
      }
      await this.app.workspace.getLeaf(!1).openFile(r);
    }
  };
var nc = [
  {
    id: "invoice",
    title: "Invoice",
    body: `# Invoice 001

**From:** your name or company
**To:** the client

**Issued:** 2026-01-31 &nbsp;&nbsp; **Payment due:** 2026-02-14

\`\`\`vmark
vat = 23%
\`\`\`

## Work

| Item               | Unit  | Qty |   Rate |     Net |    VAT |   Gross |
|--------------------|-------|----:|-------:|--------:|-------:|--------:|
| Discovery workshop | day   |   2 | 800.00 | 1600.00 | 368.00 | 1968.00 |
| Implementation     | hour  |  20 | 100.00 | 2000.00 | 460.00 | 2460.00 |
| Support retainer   | month |   1 | 300.00 |  300.00 |  69.00 |  369.00 |

\`\`\`vmark #lines
Net             = Qty * Rate
VAT precision 2 = Net * vat
Gross           = Net + VAT

net_total   = SUM(Net)
vat_total   = SUM(VAT)
gross_total = SUM(Gross)
\`\`\`

Before tax this invoice comes to **3900.00**<!--vmark=lines.net_total-->.
Tax adds **897.00**<!--vmark=lines.vat_total-->, so the amount due is
**4797.00**<!--vmark=lines.gross_total-->.

## How to use this

Edit the input columns \u2014 **Item**, **Unit**, **Qty** and **Rate** \u2014 and the
tax rate at the top. Everything else is computed: **Net**, **VAT**,
**Gross** and the three numbers in the sentence above all recalculate, and
VisiMark tells you when one of them stops agreeing with its formula.

Add or delete table rows freely. The formulas are one rule per column, not one
per cell, so they apply to whatever rows are there.

The numbers in the sentence are bound to names by an invisible comment right
after them. Keep the comment when you edit the sentence and the number stays
checked; delete it and the sentence becomes ordinary prose again.
`,
  },
  {
    id: "budget",
    title: "Monthly budget",
    body: `# Budget \u2014 January 2026

\`\`\`vmark
carried_over = 0.00
\`\`\`

## Spending

| Category      | Planned |  Actual |   Left |
|---------------|--------:|--------:|-------:|
| Rent          | 1200.00 | 1200.00 |   0.00 |
| Groceries     |  450.00 |  512.40 | -62.40 |
| Transport     |  120.00 |   96.00 |  24.00 |
| Subscriptions |   45.00 |   45.00 |   0.00 |
| Going out     |  200.00 |  150.00 |  50.00 |

\`\`\`vmark #spending
Left = Planned - Actual

planned_total = SUM(Planned)
actual_total  = SUM(Actual)
left_total    = SUM(Left)

available = planned_total + carried_over
assert left_total == planned_total - actual_total
\`\`\`

Planned spending for the month is **2015.00**<!--vmark=spending.planned_total-->,
of which **2003.40**<!--vmark=spending.actual_total--> has gone out, leaving
**11.60**<!--vmark=spending.left_total-->. With anything carried over from last
month the budget is **2015.00**<!--vmark=spending.available-->.

## How to use this

Edit **Category**, **Planned** and **Actual**. **Left** is computed per row,
and the three numbers in the sentence recompute with it.

The line \`assert left_total == planned_total - actual_total\` is the part worth
keeping. It does not store anything and it is never repaired \u2014 it is a claim
about the table that VisiMark checks every time. Change a number so the two
sides stop agreeing and the assertion fails, which catches the class of mistake
that a per-row formula cannot: one where every cell agrees with its own formula
and the table as a whole still says something false.

Carry a balance forward by putting last month's **Left** into \`carried_over\` at
the top.
`,
  },
  {
    id: "capacity",
    title: "Team capacity",
    body: `# Team capacity \u2014 sprint 12

## People

| Person  | Days | Hours | Util | Available |
|---------|-----:|------:|-----:|----------:|
| Ada     |   10 |     8 |  70% |     56.00 |
| Grace   |    8 |     8 |  70% |     44.80 |
| Linus   |   10 |     6 |  80% |     48.00 |
| Barbara |    6 |     8 |  60% |     28.80 |

\`\`\`vmark #people
Available precision 2 = Days * Hours * Util

available_total = SUM(Available)
\`\`\`

## Commitments

| Work item              | Estimate |
|------------------------|---------:|
| Checkout rewrite       |       60 |
| Search relevance       |       28 |
| On-call and interrupts |       24 |
| Accessibility audit    |       16 |

\`\`\`vmark #work
committed = SUM(Estimate)

headroom precision 2 = people.available_total - committed
\`\`\`

The team has **177.60**<!--vmark=people.available_total--> hours in this sprint
and has committed **128**<!--vmark=work.committed--> of them, leaving
**49.60**<!--vmark=work.headroom--> hours of headroom.

## How to use this

Edit **Person**, **Days**, **Hours** and **Util** in the first table, and the
work items in the second. **Available**, the two totals and the headroom are
computed.

**Util** is the fraction of a working day that actually goes into planned work.
It is written as a percentage, which is just a number \u2014 \`70%\` and \`0.7\` mean
the same thing, so you can write whichever reads better.

Headroom is the number to watch. When it goes negative the sprint is
over-committed, and it goes negative the moment you add a work item, not at the
end of the sprint when you notice.

The two tables are separate sheets, and the second reads a total out of the
first as \`people.available_total\`. A whole column of another sheet can only be
used inside a total like \`SUM(...)\`, because two tables have no reason to have
the same number of rows.
`,
  },
  {
    id: "experiment",
    title: "Experiment log",
    body: `# Experiment \u2014 checkout button copy

**Started:** 2026-01-12 &nbsp;&nbsp; **Ended:** 2026-01-26

**Question:** does "Pay now" convert better than "Continue"?

## Results

| Variant        | Visitors | Conversions |   Rate |
|----------------|---------:|------------:|-------:|
| A \u2014 "Continue" |     4120 |         186 | 0.0451 |
| B \u2014 "Pay now"  |     4098 |         221 | 0.0539 |

\`\`\`vmark #variants
Rate precision 4 = Conversions / Visitors

visitors    = SUM(Visitors)
conversions = SUM(Conversions)

pooled_rate precision 4 = conversions / visitors
assert visitors > 0
\`\`\`

Across **8218**<!--vmark=variants.visitors--> visitors the experiment recorded
**407**<!--vmark=variants.conversions--> conversions, a pooled rate of
**0.0495**<!--vmark=variants.pooled_rate-->.

**Read:** _write what you concluded, and what you are doing about it._

## How to use this

Edit **Variant**, **Visitors** and **Conversions**. **Rate** and the three
numbers in the sentence are computed.

\`precision 4\` on **Rate** is doing real work. A conversion rate is a division,
and a division does not tell you how many decimals it deserves \u2014 VisiMark will
say so rather than guess, and \`precision 4\` is you answering. Change it to \`3\`
and every rate in the column is rewritten to three places.

One limit worth knowing before you rely on it: a formula is one rule for a
whole column, so there is no way to write "B's rate minus A's rate" as a cell.
Compare the two rates by reading them, or give each variant its own small table
and a block that reads across them \u2014 the way the capacity template's second
table reads a total out of the first.

The \`assert\` line is a claim about the whole table rather than about one cell.
This one is nearly trivial, and it is still worth keeping: it fails loudly if
you ever paste in a table whose **Visitors** column is empty, which is the
state in which every rate silently becomes meaningless.
`,
  },
];
var An = require("obsidian");
function rc(e) {
  return Object.entries(e)
    .map(([n, t]) =>
      Array.isArray(t)
        ? { name: n, kind: "column", value: t.map((r) => (r != null ? r : "?")).join(", ") }
        : { name: n, kind: "scalar", value: t },
    )
    .sort((n, t) => n.name.localeCompare(t.name));
}
function ic(e) {
  return (
    JSON.stringify(e, null, 2) +
    `
`
  );
}
var di = class extends An.Modal {
  constructor(t, r) {
    super(t);
    W(this, "values", r);
  }
  onOpen() {
    this.setTitle("What this note works out to");
    let { contentEl: t } = this,
      r = rc(this.values);
    if (r.length === 0) {
      t.createEl("p", { text: "This note names no values yet." });
      return;
    }
    let o = t.createDiv({ cls: "visimark-values-actions" }).createEl("button", {
      cls: "mod-cta",
      text: "Copy as JSON",
      attr: { type: "button", "aria-label": "Copy these values to the clipboard as JSON" },
    });
    o.addEventListener("click", () => {
      try {
        let a = o.win.navigator.clipboard;
        if (a === void 0) throw new Error("no Clipboard API on this window");
        a.writeText(ic(this.values)).then(
          () => new An.Notice("Copied. This is what `visimark eval --json` reports."),
          () => new An.Notice("Could not reach the clipboard."),
        );
      } catch (a) {
        new An.Notice("Could not reach the clipboard.");
      }
    });
    let s = t.createEl("dl", { cls: "visimark-values" });
    for (let a of r)
      (s.createEl("dt", { cls: "visimark-value-name", text: a.name }),
        s.createEl("dd", { cls: "visimark-value-value", text: a.value }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var sw = 750,
  fi = class {
    constructor(n, t = (i, o) => setTimeout(i, o), r = clearTimeout) {
      W(this, "read", n);
      W(this, "scheduleTimeout", t);
      W(this, "cancelScheduled", r);
      W(this, "entries", new Map());
      W(this, "listeners", new Set());
      W(this, "pending", new Map());
      W(this, "seededOnce", !1);
      W(this, "generation", new Map());
      W(this, "epoch", 0);
      W(this, "touched", null);
    }
    notes() {
      return [...this.entries.values()];
    }
    count() {
      return this.entries.size;
    }
    isSeeded() {
      return this.seededOnce;
    }
    onChange(n) {
      return (
        this.listeners.add(n),
        () => {
          this.listeners.delete(n);
        }
      );
    }
    beginSeed() {
      this.touched = new Set();
    }
    seed(n) {
      let t = this.touched;
      ((this.touched = null), this.epoch++, this.entries.clear());
      for (let r of n.notes) this.entries.set(r.path, r);
      ((this.seededOnce = !0), this.notify());
      for (let r of t != null ? t : []) this.scheduleRecheck(r, 0);
    }
    remove(n) {
      var t;
      ((t = this.touched) == null || t.add(n),
        this.bump(n),
        this.cancelPending(n),
        this.entries.delete(n) && this.notify());
    }
    rename(n, t) {
      (this.remove(n), this.scheduleRecheck(t));
    }
    scheduleRecheck(n, t = sw) {
      var i;
      ((i = this.touched) == null || i.add(n), this.cancelPending(n));
      let r = this.bump(n);
      this.pending.set(
        n,
        this.scheduleTimeout(() => {
          (this.pending.delete(n), this.recheck(n, r));
        }, t),
      );
    }
    bump(n) {
      var r;
      let t = ((r = this.generation.get(n)) != null ? r : 0) + 1;
      return (this.generation.set(n, t), t);
    }
    cancelPending(n) {
      let t = this.pending.get(n);
      t !== void 0 && (this.cancelScheduled(t), this.pending.delete(n));
    }
    async recheck(n, t = this.bump(n)) {
      let r = this.epoch,
        i = await this.read(n),
        o = i === null ? null : await this.verdictFor(n, i);
      this.epoch !== r ||
        this.generation.get(n) !== t ||
        (o === null
          ? this.entries.delete(n) && this.notify()
          : (this.entries.set(n, o), this.notify()));
    }
    dispose() {
      for (let n of this.pending.values()) this.cancelScheduled(n);
      (this.pending.clear(), this.listeners.clear());
    }
    async verdictFor(n, t) {
      if (!ms(t) || !Ue(t)) return null;
      try {
        let { model: r, snapshot: i } = await ot(t, n, this.read),
          o = { path: i.path, reader: i.reader },
          s = Tt(r, ge(r, { doc: o }), o);
        return Wt(s)
          ? null
          : { path: n, problems: s.problems.length, advice: s.advice.length, report: s };
      } catch (r) {
        return null;
      }
    }
    notify() {
      for (let n of this.listeners) n();
    }
  };
var aw = { clean: "check-circle-2", problems: "alert-circle", unknown: "help-circle" },
  pi = class extends ae.Plugin {
    constructor() {
      super(...arguments);
      W(this, "status", null);
      W(this, "actionFor", new Map());
      W(this, "index", null);
      W(this, "indexStarting", null);
      W(this, "indexGeneration", 0);
      W(this, "ribbonIcon", null);
      W(this, "settings", fs);
      W(this, "hoverPending", new WeakSet());
      W(
        this,
        "api",
        _u(
          (t) => qt(this.app.vault)(t),
          (t) => (t instanceof ae.TFile ? t.path : typeof t == "string" ? t : null),
        ),
      );
      W(
        this,
        "refreshSoon",
        (0, ae.debounce)(() => this.refresh(), 400, !0),
      );
      W(this, "renderId", 0);
    }
    async saveSettings() {
      await this.saveData(this.settings);
    }
    async onload() {
      ((this.settings = { ...fs, ...(await this.loadData()) }),
        this.addSettingTab(new li(this.app, this)),
        this.registerView(Jn, (l) => new oi(l)),
        this.addCommand({
          id: "check",
          name: "Check this note",
          callback: () => {
            this.openFindings();
          },
        }),
        this.addCommand({
          id: "format",
          name: "Format this note",
          editorCallback: (l) => {
            this.format(l);
          },
        }),
        this.addCommand({
          id: "evaluate",
          name: "Evaluate this note",
          editorCallback: (l) => {
            this.evaluate(l);
          },
        }),
        this.addCommand({
          id: "explain",
          name: "Explain this value",
          editorCallback: (l) => {
            this.explain(l);
          },
        }),
        this.addCommand({
          id: "infer",
          name: "Infer the formulas",
          editorCallback: (l) => {
            let c =
              l.getSelection().length > 0
                ? {
                    start: l.posToOffset(l.getCursor("from")),
                    end: l.posToOffset(l.getCursor("to")),
                  }
                : void 0;
            Hu(this.app, l, Uu(l.getValue(), c));
          },
        }),
        this.registerView(tr, (l) => new ci(l, () => this.index)),
        this.addCommand({
          id: "sweep",
          name: "Sweep the vault",
          callback: () => {
            this.openSweep();
          },
        }),
        this.registerMarkdownPostProcessor((l, u) => Xu(l, u)),
        this.registerEditorExtension(Qu(() => this.settings.showProvenanceInLivePreview)));
      let t = (l) => {
          if (l.pointerType !== "mouse") return;
          let u = hs(l);
          u === null ||
            u.hasAttribute("data-vmark-hovered") ||
            this.hoverPending.has(u) ||
            (this.hoverPending.add(u),
            this.describe(u).then((c) => {
              (this.hoverPending.delete(u),
                c !== null &&
                  (u.setAttribute("data-vmark-hovered", ""),
                  (0, ae.setTooltip)(u, c, { placement: "top" }),
                  (0, ae.displayTooltip)(u, c, { placement: "top" })));
            }));
        },
        r = (l) => {
          let u = hs(l);
          u !== null &&
            ((u.closest(".cm-editor") !== null && !(l.metaKey || l.ctrlKey)) ||
              this.explainElement(u));
        },
        i = (l) => {
          if (l.key !== "Enter" && l.key !== " ") return;
          let u = hs(l);
          u !== null && (l.preventDefault(), this.explainElement(u));
        },
        o = (l) => {
          if (
            !this.settings.formatOnSave ||
            l.shiftKey ||
            l.altKey ||
            !(ae.Platform.isMacOS ? l.metaKey : l.ctrlKey) ||
            l.key.toLowerCase() !== "s"
          )
            return;
          let c = this.app.workspace.getActiveViewOfType(ae.MarkdownView);
          if (c === null) return;
          let d = l.target;
          d === null ||
            typeof d.nodeType != "number" ||
            (c.contentEl.contains(d) && this.format(c.editor, { silent: !0 }));
        },
        s = new Set(),
        a = (l) => {
          s.has(l) ||
            (s.add(l),
            this.registerDomEvent(l.document, "pointerover", t),
            this.registerDomEvent(l.document, "click", r),
            this.registerDomEvent(l.document, "keydown", i),
            this.registerDomEvent(l, "keydown", o, { capture: !0 }));
        };
      (a(window),
        this.app.workspace.iterateAllLeaves((l) => {
          let u = l.view.containerEl.doc.defaultView;
          u !== null && a(u);
        }),
        this.registerEvent(this.app.workspace.on("window-open", (l, u) => a(u))),
        (this.status = this.addStatusBarItem()),
        this.status.addClass("visimark-status"),
        this.status.addClass("visimark-hidden"),
        this.status.setAttribute("aria-live", "polite"),
        this.status.addClass("mod-clickable"),
        this.status.setAttribute("role", "button"),
        this.status.setAttribute("tabindex", "0"),
        this.registerDomEvent(this.status, "click", () => {
          this.openFindings();
        }),
        this.registerDomEvent(this.status, "keydown", (l) => {
          (l.key !== "Enter" && l.key !== " ") || (l.preventDefault(), this.openFindings());
        }),
        (this.ribbonIcon = this.addRibbonIcon(
          "search-check",
          "Sweep the vault with VisiMark",
          () => {
            this.openSweep();
          },
        )));
      for (let l of nc)
        this.addCommand({
          id: `insert-${l.id}-template`,
          name: `Insert ${l.title.toLowerCase()} template`,
          editorCallback: (u) => {
            (u.replaceSelection(l.body),
              new ae.Notice(`Inserted the ${l.title.toLowerCase()} template.`),
              this.refresh());
          },
        });
      (this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh())),
        this.registerEvent(this.app.workspace.on("file-open", () => this.refresh())),
        this.registerEvent(this.app.workspace.on("editor-change", () => this.refreshSoon())),
        this.app.workspace.onLayoutReady(() => {
          (this.refresh(),
            this.settings.sweepOnOpen &&
              this.startAmbientIndex().then(() => {
                this.index !== null && this.openSweep();
              }));
        }));
    }
    startAmbientIndex() {
      if (this.index !== null) return Promise.resolve();
      if (this.indexStarting !== null) return this.indexStarting;
      let t = this.indexGeneration,
        r = this.buildAmbientIndex(t).finally(() => {
          this.indexStarting === r && (this.indexStarting = null);
        });
      return ((this.indexStarting = r), r);
    }
    async buildAmbientIndex(t) {
      let r = qt(this.app.vault),
        i = new fi(r);
      i.beginSeed();
      let o = (l) => l instanceof ae.TFile && l.extension === "md";
      (this.registerEvent(
        this.app.vault.on("modify", (l) => {
          o(l) && i.scheduleRecheck(l.path);
        }),
      ),
        this.registerEvent(
          this.app.vault.on("create", (l) => {
            o(l) && i.scheduleRecheck(l.path);
          }),
        ),
        this.registerEvent(
          this.app.vault.on("delete", (l) => {
            o(l) && i.remove(l.path);
          }),
        ),
        this.registerEvent(
          this.app.vault.on("rename", (l, u) => {
            o(l) ? i.rename(u, l.path) : u.endsWith(".md") && i.remove(u);
          }),
        ));
      let s = this.app.vault.getMarkdownFiles(),
        a = await ui(
          { paths: () => s.map((l) => l.path), read: r },
          { chunk: 50, pause: () => new Promise((l) => activeWindow.setTimeout(l, 0)) },
        );
      t !== this.indexGeneration ||
        this.index !== null ||
        (i.seed(a),
        i.onChange(() => this.updateRibbonBadge()),
        (this.index = i),
        this.updateRibbonBadge());
    }
    updateRibbonBadge() {
      if (this.ribbonIcon === null || this.index === null) return;
      let t = this.index.count(),
        r = this.ribbonIcon.querySelector(".visimark-ribbon-badge");
      if (t === 0) {
        (r == null || r.remove(),
          this.ribbonIcon.setAttribute("aria-label", "Sweep the vault with VisiMark"));
        return;
      }
      ((r != null ? r : this.ribbonIcon.createSpan({ cls: "visimark-ribbon-badge" })).setText(
        t > 99 ? "99+" : String(t),
      ),
        this.ribbonIcon.setAttribute(
          "aria-label",
          `Sweep the vault with VisiMark \u2014 ${t} ${t === 1 ? "note needs" : "notes need"} attention`,
        ));
    }
    onunload() {
      var t;
      for (let { el: r } of this.actionFor.values()) r.remove();
      (this.actionFor.clear(),
        this.indexGeneration++,
        (t = this.index) == null || t.dispose(),
        (this.index = null));
    }
    async openFindings() {
      var o;
      let t = this.app.workspace.getActiveViewOfType(ae.MarkdownView);
      if (t === null || !Ue(t.getViewData())) {
        new ae.Notice("This note has no VisiMark block, so there is nothing to check in it yet.");
        return;
      }
      let i =
        (o = this.app.workspace.getLeavesOfType(Jn)[0]) != null
          ? o
          : this.app.workspace.getRightLeaf(!1);
      i !== null &&
        (await i.setViewState({ type: Jn, active: !0 }), this.app.workspace.revealLeaf(i));
    }
    async format(t, r = {}) {
      let i = t.getValue(),
        o = await this.noteFor(t, r);
      if (o === null) return;
      let { report: s, result: a } = o,
        l = this.settings.writeChartArtifacts ? Jo(a) : [];
      if (s.allRepairs.length === 0 && l.length === 0) {
        r.silent || new ae.Notice("Everything in this note already agrees with its formulas.");
        return;
      }
      if (t.getValue() !== i) {
        r.silent ||
          new ae.Notice("This note changed while it was being checked. Try Format again.");
        return;
      }
      let u = 0;
      if (l.length > 0) {
        let c = await Du(l, qt(this.app.vault), Lu(this.app.vault));
        if (((u = c.written), c.failed !== null)) {
          new ae.Notice(`Could not write the "${c.failed.chart}" chart: ${c.failed.err}`);
          return;
        }
        if (t.getValue() !== i) {
          r.silent ||
            new ae.Notice("This note changed while writing its charts. Try Format again.");
          return;
        }
      }
      if (
        (s.allRepairs.length > 0 &&
          t.transaction({
            changes: s.allRepairs.map((c) => ({
              from: t.offsetToPos(c.start),
              to: t.offsetToPos(c.end),
              text: c.text,
            })),
          }),
        !r.silent)
      ) {
        let c = s.allRepairs.length,
          d = c > 0 ? `Applied ${c} ${c === 1 ? "repair" : "repairs"}.` : "Nothing to repair.",
          f = this.settings.writeChartArtifacts
            ? u > 0
              ? ` Wrote ${u} chart${u === 1 ? "" : "s"}.`
              : " No chart needed writing."
            : " No chart was written.";
        new ae.Notice(d + f);
      }
    }
    async evaluate(t) {
      let r = await this.noteFor(t);
      r !== null && new di(this.app, sn(r.result)).open();
    }
    async explain(t) {
      let r = await this.noteFor(t);
      if (r === null) return;
      let i = Vu(r.model, t.posToOffset(t.getCursor()));
      if (i === null) {
        new ae.Notice("Put the cursor on a value VisiMark works out, and ask again.");
        return;
      }
      let o = as(r.model, r.result, i);
      if (o === null) {
        new ae.Notice(`Nothing in this note is called ${i}.`);
        return;
      }
      new Xn(this.app, o).open();
    }
    async noteFor(t, r = {}) {
      var d, f;
      let i = t.getValue();
      if (!Ue(i))
        return (
          r.silent ||
            new ae.Notice(
              "This note has no VisiMark block, so there is nothing to check in it yet.",
            ),
          null
        );
      let o =
          (d = this.app.workspace.getActiveViewOfType(ae.MarkdownView)) == null ? void 0 : d.file,
        s = (f = o == null ? void 0 : o.path) != null ? f : "untitled.md",
        { model: a, snapshot: l } = await ot(i, s, qt(this.app.vault)),
        u = { path: l.path, reader: l.reader },
        c = ge(a, { doc: u });
      return {
        model: a,
        result: c,
        report: Tt(a, c, u, { fixDates: this.settings.fixDatesOnFormat }),
      };
    }
    fileFor(t) {
      var o, s;
      let r = t.getAttribute("data-vmark-path");
      if (r === null)
        return (s =
          (o = this.app.workspace.getActiveViewOfType(ae.MarkdownView)) == null
            ? void 0
            : o.file) != null
          ? s
          : null;
      let i = this.app.vault.getAbstractFileByPath(r);
      return i instanceof ae.TFile ? i : null;
    }
    async describe(t) {
      let r = t.getAttribute("data-vmark"),
        i = this.fileFor(t);
      if (r === null || i === null) return null;
      try {
        let o = await this.api.explain(i, r);
        return o === null ? null : Wu(o, us(t.getAttribute("data-vmark-row")));
      } catch (o) {
        return null;
      }
    }
    async explainElement(t) {
      let r = t.getAttribute("data-vmark"),
        i = this.fileFor(t);
      if (!(r === null || i === null))
        try {
          let o = await this.api.explain(i, r);
          o !== null && new Xn(this.app, o, us(t.getAttribute("data-vmark-row"))).open();
        } catch (o) {
          new ae.Notice("Could not check this value.");
        }
    }
    async openSweep() {
      var i;
      let r =
        (i = this.app.workspace.getLeavesOfType(tr)[0]) != null
          ? i
          : this.app.workspace.getRightLeaf(!1);
      r !== null &&
        (await r.setViewState({ type: tr, active: !0 }), this.app.workspace.revealLeaf(r));
    }
    refresh() {
      var s, a, l, u;
      if (this.status === null) return;
      let t = ++this.renderId,
        r = this.app.workspace.getActiveViewOfType(ae.MarkdownView),
        i = (s = r == null ? void 0 : r.getViewData()) != null ? s : null;
      if (i === null || !Ue(i)) {
        this.show(ps, r);
        return;
      }
      let o = (l = (a = r.file) == null ? void 0 : a.path) != null ? l : "untitled.md";
      (((u = this.actionFor.get(r)) == null ? void 0 : u.path) !== o && this.showAction(ps, r),
        this.refreshState(r, i, t));
    }
    async refreshState(t, r, i) {
      var s, a;
      let o = (a = (s = t.file) == null ? void 0 : s.path) != null ? a : "untitled.md";
      try {
        let { model: l, snapshot: u } = await ot(r, o, qt(this.app.vault)),
          c = { path: u.path, reader: u.reader };
        if (i !== this.renderId) return;
        this.show(ec(Tt(l, ge(l, { doc: c }), c)), t);
      } catch (l) {
        if (i !== this.renderId) return;
        this.show(tc, t);
      }
    }
    show(t, r) {
      (this.status !== null &&
        (this.status.setText(t.text),
        this.status.setAttribute("aria-label", t.detail),
        this.status.toggleClass("visimark-hidden", t.text === "")),
        this.showAction(t, r));
    }
    showAction(t, r) {
      var a, l, u;
      if (r === null) return;
      if (t.kind === "hidden") {
        ((a = this.actionFor.get(r)) == null || a.el.remove(), this.actionFor.delete(r));
        return;
      }
      let i = aw[t.kind],
        o = (u = (l = r.file) == null ? void 0 : l.path) != null ? u : "untitled.md",
        s = this.actionFor.get(r);
      if (s === void 0) {
        let c = r.addAction(i, t.detail, () => {
          this.openFindings();
        });
        this.actionFor.set(r, { el: c, path: o });
      } else
        ((0, ae.setIcon)(s.el, i),
          (0, ae.setTooltip)(s.el, t.detail, { placement: "bottom" }),
          (s.path = o));
    }
  };
function hs(e) {
  let n = e.target,
    t = n !== null && n.nodeType === 1 ? n : n == null ? void 0 : n.parentElement;
  return t == null || typeof t.closest != "function" ? null : t.closest("[data-vmark]");
}
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
