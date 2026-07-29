import { createRequire as e } from "node:module";
import { BrowserWindow as t, app as n, ipcMain as r } from "electron";
import i from "path";
import { fileURLToPath as a } from "url";
import o from "crypto";
import { execFileSync as s, spawn as c } from "child_process";
import l from "fs";
//#region \0rolldown/runtime.js
var u = Object.create, d = Object.defineProperty, f = Object.getOwnPropertyDescriptor, p = Object.getOwnPropertyNames, ee = Object.getPrototypeOf, m = Object.prototype.hasOwnProperty, te = (e, t) => () => (e && (t = e(e = 0)), t), ne = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), re = (e, t) => {
	let n = {};
	for (var r in e) d(n, r, {
		get: e[r],
		enumerable: !0
	});
	return t || d(n, Symbol.toStringTag, { value: "Module" }), n;
}, h = (e, t, n, r) => {
	if (t && typeof t == "object" || typeof t == "function") for (var i = p(t), a = 0, o = i.length, s; a < o; a++) s = i[a], !m.call(e, s) && s !== n && d(e, s, {
		get: ((e) => t[e]).bind(null, s),
		enumerable: !(r = f(t, s)) || r.enumerable
	});
	return e;
}, g = (e, t, n) => (n = e == null ? {} : u(ee(e)), h(t || !e || !e.__esModule ? d(n, "default", {
	value: e,
	enumerable: !0
}) : n, e)), _ = (e) => m.call(e, "module.exports") ? e["module.exports"] : h(d({}, "__esModule", { value: !0 }), e), v = /* @__PURE__ */ e(import.meta.url), y = null;
function ie(e) {
	try {
		return crypto.getRandomValues(new Uint8Array(e));
	} catch {}
	try {
		return o.randomBytes(e);
	} catch {}
	if (!y) throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
	return y(e);
}
function ae(e) {
	y = e;
}
function b(e, t) {
	if (e ||= N, typeof e != "number") throw Error("Illegal arguments: " + typeof e + ", " + typeof t);
	e < 4 ? e = 4 : e > 31 && (e = 31);
	var n = [];
	return n.push("$2b$"), e < 10 && n.push("0"), n.push(e.toString()), n.push("$"), n.push(A(ie(M), M)), n.join("");
}
function x(e, t, n) {
	if (typeof t == "function" && (n = t, t = void 0), typeof e == "function" && (n = e, e = void 0), e === void 0) e = N;
	else if (typeof e != "number") throw Error("illegal arguments: " + typeof e);
	function r(t) {
		T(function() {
			try {
				t(null, b(e));
			} catch (e) {
				t(e);
			}
		});
	}
	if (n) {
		if (typeof n != "function") throw Error("Illegal callback: " + typeof n);
		r(n);
	} else return new Promise(function(e, t) {
		r(function(n, r) {
			if (n) {
				t(n);
				return;
			}
			e(r);
		});
	});
}
function S(e, t) {
	if (t === void 0 && (t = N), typeof t == "number" && (t = b(t)), typeof e != "string" || typeof t != "string") throw Error("Illegal arguments: " + typeof e + ", " + typeof t);
	return H(e, t);
}
function C(e, t, n, r) {
	function i(n) {
		typeof e == "string" && typeof t == "number" ? x(t, function(t, i) {
			H(e, i, n, r);
		}) : typeof e == "string" && typeof t == "string" ? H(e, t, n, r) : T(n.bind(this, Error("Illegal arguments: " + typeof e + ", " + typeof t)));
	}
	if (n) {
		if (typeof n != "function") throw Error("Illegal callback: " + typeof n);
		i(n);
	} else return new Promise(function(e, t) {
		i(function(n, r) {
			if (n) {
				t(n);
				return;
			}
			e(r);
		});
	});
}
function w(e, t) {
	for (var n = e.length ^ t.length, r = 0; r < e.length; ++r) n |= e.charCodeAt(r) ^ t.charCodeAt(r);
	return n === 0;
}
function oe(e, t) {
	if (typeof e != "string" || typeof t != "string") throw Error("Illegal arguments: " + typeof e + ", " + typeof t);
	return t.length === 60 ? w(S(e, t.substring(0, t.length - 31)), t) : !1;
}
function se(e, t, n, r) {
	function i(n) {
		if (typeof e != "string" || typeof t != "string") {
			T(n.bind(this, Error("Illegal arguments: " + typeof e + ", " + typeof t)));
			return;
		}
		if (t.length !== 60) {
			T(n.bind(this, null, !1));
			return;
		}
		C(e, t.substring(0, 29), function(e, r) {
			e ? n(e) : n(null, w(r, t));
		}, r);
	}
	if (n) {
		if (typeof n != "function") throw Error("Illegal callback: " + typeof n);
		i(n);
	} else return new Promise(function(e, t) {
		i(function(n, r) {
			if (n) {
				t(n);
				return;
			}
			e(r);
		});
	});
}
function ce(e) {
	if (typeof e != "string") throw Error("Illegal arguments: " + typeof e);
	return parseInt(e.split("$")[2], 10);
}
function le(e) {
	if (typeof e != "string") throw Error("Illegal arguments: " + typeof e);
	if (e.length !== 60) throw Error("Illegal hash length: " + e.length + " != 60");
	return e.substring(0, 29);
}
function ue(e) {
	if (typeof e != "string") throw Error("Illegal arguments: " + typeof e);
	return E(e) > 72;
}
var T = typeof setImmediate == "function" ? setImmediate : typeof scheduler == "object" && typeof scheduler.postTask == "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function E(e) {
	for (var t = 0, n = 0, r = 0; r < e.length; ++r) n = e.charCodeAt(r), n < 128 ? t += 1 : n < 2048 ? t += 2 : (n & 64512) == 55296 && (e.charCodeAt(r + 1) & 64512) == 56320 ? (++r, t += 4) : t += 3;
	return t;
}
function D(e) {
	for (var t = 0, n, r, i = Array(E(e)), a = 0, o = e.length; a < o; ++a) n = e.charCodeAt(a), n < 128 ? i[t++] = n : n < 2048 ? (i[t++] = n >> 6 | 192, i[t++] = n & 63 | 128) : (n & 64512) == 55296 && ((r = e.charCodeAt(a + 1)) & 64512) == 56320 ? (n = 65536 + ((n & 1023) << 10) + (r & 1023), ++a, i[t++] = n >> 18 | 240, i[t++] = n >> 12 & 63 | 128, i[t++] = n >> 6 & 63 | 128, i[t++] = n & 63 | 128) : (i[t++] = n >> 12 | 224, i[t++] = n >> 6 & 63 | 128, i[t++] = n & 63 | 128);
	return i;
}
var O = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(""), k = [
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	0,
	1,
	54,
	55,
	56,
	57,
	58,
	59,
	60,
	61,
	62,
	63,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	12,
	13,
	14,
	15,
	16,
	17,
	18,
	19,
	20,
	21,
	22,
	23,
	24,
	25,
	26,
	27,
	-1,
	-1,
	-1,
	-1,
	-1,
	-1,
	28,
	29,
	30,
	31,
	32,
	33,
	34,
	35,
	36,
	37,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
	45,
	46,
	47,
	48,
	49,
	50,
	51,
	52,
	53,
	-1,
	-1,
	-1,
	-1,
	-1
];
function A(e, t) {
	var n = 0, r = [], i, a;
	if (t <= 0 || t > e.length) throw Error("Illegal len: " + t);
	for (; n < t;) {
		if (i = e[n++] & 255, r.push(O[i >> 2 & 63]), i = (i & 3) << 4, n >= t) {
			r.push(O[i & 63]);
			break;
		}
		if (a = e[n++] & 255, i |= a >> 4 & 15, r.push(O[i & 63]), i = (a & 15) << 2, n >= t) {
			r.push(O[i & 63]);
			break;
		}
		a = e[n++] & 255, i |= a >> 6 & 3, r.push(O[i & 63]), r.push(O[a & 63]);
	}
	return r.join("");
}
function j(e, t) {
	var n = 0, r = e.length, i = 0, a = [], o, s, c, l, u, d;
	if (t <= 0) throw Error("Illegal len: " + t);
	for (; n < r - 1 && i < t && (d = e.charCodeAt(n++), o = d < k.length ? k[d] : -1, d = e.charCodeAt(n++), s = d < k.length ? k[d] : -1, !(o == -1 || s == -1 || (u = o << 2 >>> 0, u |= (s & 48) >> 4, a.push(String.fromCharCode(u)), ++i >= t || n >= r) || (d = e.charCodeAt(n++), c = d < k.length ? k[d] : -1, c == -1) || (u = (s & 15) << 4 >>> 0, u |= (c & 60) >> 2, a.push(String.fromCharCode(u)), ++i >= t || n >= r)));) d = e.charCodeAt(n++), l = d < k.length ? k[d] : -1, u = (c & 3) << 6 >>> 0, u |= l, a.push(String.fromCharCode(u)), ++i;
	var f = [];
	for (n = 0; n < i; n++) f.push(a[n].charCodeAt(0));
	return f;
}
var M = 16, N = 10, de = 16, fe = 100, P = [
	608135816,
	2242054355,
	320440878,
	57701188,
	2752067618,
	698298832,
	137296536,
	3964562569,
	1160258022,
	953160567,
	3193202383,
	887688300,
	3232508343,
	3380367581,
	1065670069,
	3041331479,
	2450970073,
	2306472731
], F = [
	3509652390,
	2564797868,
	805139163,
	3491422135,
	3101798381,
	1780907670,
	3128725573,
	4046225305,
	614570311,
	3012652279,
	134345442,
	2240740374,
	1667834072,
	1901547113,
	2757295779,
	4103290238,
	227898511,
	1921955416,
	1904987480,
	2182433518,
	2069144605,
	3260701109,
	2620446009,
	720527379,
	3318853667,
	677414384,
	3393288472,
	3101374703,
	2390351024,
	1614419982,
	1822297739,
	2954791486,
	3608508353,
	3174124327,
	2024746970,
	1432378464,
	3864339955,
	2857741204,
	1464375394,
	1676153920,
	1439316330,
	715854006,
	3033291828,
	289532110,
	2706671279,
	2087905683,
	3018724369,
	1668267050,
	732546397,
	1947742710,
	3462151702,
	2609353502,
	2950085171,
	1814351708,
	2050118529,
	680887927,
	999245976,
	1800124847,
	3300911131,
	1713906067,
	1641548236,
	4213287313,
	1216130144,
	1575780402,
	4018429277,
	3917837745,
	3693486850,
	3949271944,
	596196993,
	3549867205,
	258830323,
	2213823033,
	772490370,
	2760122372,
	1774776394,
	2652871518,
	566650946,
	4142492826,
	1728879713,
	2882767088,
	1783734482,
	3629395816,
	2517608232,
	2874225571,
	1861159788,
	326777828,
	3124490320,
	2130389656,
	2716951837,
	967770486,
	1724537150,
	2185432712,
	2364442137,
	1164943284,
	2105845187,
	998989502,
	3765401048,
	2244026483,
	1075463327,
	1455516326,
	1322494562,
	910128902,
	469688178,
	1117454909,
	936433444,
	3490320968,
	3675253459,
	1240580251,
	122909385,
	2157517691,
	634681816,
	4142456567,
	3825094682,
	3061402683,
	2540495037,
	79693498,
	3249098678,
	1084186820,
	1583128258,
	426386531,
	1761308591,
	1047286709,
	322548459,
	995290223,
	1845252383,
	2603652396,
	3431023940,
	2942221577,
	3202600964,
	3727903485,
	1712269319,
	422464435,
	3234572375,
	1170764815,
	3523960633,
	3117677531,
	1434042557,
	442511882,
	3600875718,
	1076654713,
	1738483198,
	4213154764,
	2393238008,
	3677496056,
	1014306527,
	4251020053,
	793779912,
	2902807211,
	842905082,
	4246964064,
	1395751752,
	1040244610,
	2656851899,
	3396308128,
	445077038,
	3742853595,
	3577915638,
	679411651,
	2892444358,
	2354009459,
	1767581616,
	3150600392,
	3791627101,
	3102740896,
	284835224,
	4246832056,
	1258075500,
	768725851,
	2589189241,
	3069724005,
	3532540348,
	1274779536,
	3789419226,
	2764799539,
	1660621633,
	3471099624,
	4011903706,
	913787905,
	3497959166,
	737222580,
	2514213453,
	2928710040,
	3937242737,
	1804850592,
	3499020752,
	2949064160,
	2386320175,
	2390070455,
	2415321851,
	4061277028,
	2290661394,
	2416832540,
	1336762016,
	1754252060,
	3520065937,
	3014181293,
	791618072,
	3188594551,
	3933548030,
	2332172193,
	3852520463,
	3043980520,
	413987798,
	3465142937,
	3030929376,
	4245938359,
	2093235073,
	3534596313,
	375366246,
	2157278981,
	2479649556,
	555357303,
	3870105701,
	2008414854,
	3344188149,
	4221384143,
	3956125452,
	2067696032,
	3594591187,
	2921233993,
	2428461,
	544322398,
	577241275,
	1471733935,
	610547355,
	4027169054,
	1432588573,
	1507829418,
	2025931657,
	3646575487,
	545086370,
	48609733,
	2200306550,
	1653985193,
	298326376,
	1316178497,
	3007786442,
	2064951626,
	458293330,
	2589141269,
	3591329599,
	3164325604,
	727753846,
	2179363840,
	146436021,
	1461446943,
	4069977195,
	705550613,
	3059967265,
	3887724982,
	4281599278,
	3313849956,
	1404054877,
	2845806497,
	146425753,
	1854211946,
	1266315497,
	3048417604,
	3681880366,
	3289982499,
	290971e4,
	1235738493,
	2632868024,
	2414719590,
	3970600049,
	1771706367,
	1449415276,
	3266420449,
	422970021,
	1963543593,
	2690192192,
	3826793022,
	1062508698,
	1531092325,
	1804592342,
	2583117782,
	2714934279,
	4024971509,
	1294809318,
	4028980673,
	1289560198,
	2221992742,
	1669523910,
	35572830,
	157838143,
	1052438473,
	1016535060,
	1802137761,
	1753167236,
	1386275462,
	3080475397,
	2857371447,
	1040679964,
	2145300060,
	2390574316,
	1461121720,
	2956646967,
	4031777805,
	4028374788,
	33600511,
	2920084762,
	1018524850,
	629373528,
	3691585981,
	3515945977,
	2091462646,
	2486323059,
	586499841,
	988145025,
	935516892,
	3367335476,
	2599673255,
	2839830854,
	265290510,
	3972581182,
	2759138881,
	3795373465,
	1005194799,
	847297441,
	406762289,
	1314163512,
	1332590856,
	1866599683,
	4127851711,
	750260880,
	613907577,
	1450815602,
	3165620655,
	3734664991,
	3650291728,
	3012275730,
	3704569646,
	1427272223,
	778793252,
	1343938022,
	2676280711,
	2052605720,
	1946737175,
	3164576444,
	3914038668,
	3967478842,
	3682934266,
	1661551462,
	3294938066,
	4011595847,
	840292616,
	3712170807,
	616741398,
	312560963,
	711312465,
	1351876610,
	322626781,
	1910503582,
	271666773,
	2175563734,
	1594956187,
	70604529,
	3617834859,
	1007753275,
	1495573769,
	4069517037,
	2549218298,
	2663038764,
	504708206,
	2263041392,
	3941167025,
	2249088522,
	1514023603,
	1998579484,
	1312622330,
	694541497,
	2582060303,
	2151582166,
	1382467621,
	776784248,
	2618340202,
	3323268794,
	2497899128,
	2784771155,
	503983604,
	4076293799,
	907881277,
	423175695,
	432175456,
	1378068232,
	4145222326,
	3954048622,
	3938656102,
	3820766613,
	2793130115,
	2977904593,
	26017576,
	3274890735,
	3194772133,
	1700274565,
	1756076034,
	4006520079,
	3677328699,
	720338349,
	1533947780,
	354530856,
	688349552,
	3973924725,
	1637815568,
	332179504,
	3949051286,
	53804574,
	2852348879,
	3044236432,
	1282449977,
	3583942155,
	3416972820,
	4006381244,
	1617046695,
	2628476075,
	3002303598,
	1686838959,
	431878346,
	2686675385,
	1700445008,
	1080580658,
	1009431731,
	832498133,
	3223435511,
	2605976345,
	2271191193,
	2516031870,
	1648197032,
	4164389018,
	2548247927,
	300782431,
	375919233,
	238389289,
	3353747414,
	2531188641,
	2019080857,
	1475708069,
	455242339,
	2609103871,
	448939670,
	3451063019,
	1395535956,
	2413381860,
	1841049896,
	1491858159,
	885456874,
	4264095073,
	4001119347,
	1565136089,
	3898914787,
	1108368660,
	540939232,
	1173283510,
	2745871338,
	3681308437,
	4207628240,
	3343053890,
	4016749493,
	1699691293,
	1103962373,
	3625875870,
	2256883143,
	3830138730,
	1031889488,
	3479347698,
	1535977030,
	4236805024,
	3251091107,
	2132092099,
	1774941330,
	1199868427,
	1452454533,
	157007616,
	2904115357,
	342012276,
	595725824,
	1480756522,
	206960106,
	497939518,
	591360097,
	863170706,
	2375253569,
	3596610801,
	1814182875,
	2094937945,
	3421402208,
	1082520231,
	3463918190,
	2785509508,
	435703966,
	3908032597,
	1641649973,
	2842273706,
	3305899714,
	1510255612,
	2148256476,
	2655287854,
	3276092548,
	4258621189,
	236887753,
	3681803219,
	274041037,
	1734335097,
	3815195456,
	3317970021,
	1899903192,
	1026095262,
	4050517792,
	356393447,
	2410691914,
	3873677099,
	3682840055,
	3913112168,
	2491498743,
	4132185628,
	2489919796,
	1091903735,
	1979897079,
	3170134830,
	3567386728,
	3557303409,
	857797738,
	1136121015,
	1342202287,
	507115054,
	2535736646,
	337727348,
	3213592640,
	1301675037,
	2528481711,
	1895095763,
	1721773893,
	3216771564,
	62756741,
	2142006736,
	835421444,
	2531993523,
	1442658625,
	3659876326,
	2882144922,
	676362277,
	1392781812,
	170690266,
	3921047035,
	1759253602,
	3611846912,
	1745797284,
	664899054,
	1329594018,
	3901205900,
	3045908486,
	2062866102,
	2865634940,
	3543621612,
	3464012697,
	1080764994,
	553557557,
	3656615353,
	3996768171,
	991055499,
	499776247,
	1265440854,
	648242737,
	3940784050,
	980351604,
	3713745714,
	1749149687,
	3396870395,
	4211799374,
	3640570775,
	1161844396,
	3125318951,
	1431517754,
	545492359,
	4268468663,
	3499529547,
	1437099964,
	2702547544,
	3433638243,
	2581715763,
	2787789398,
	1060185593,
	1593081372,
	2418618748,
	4260947970,
	69676912,
	2159744348,
	86519011,
	2512459080,
	3838209314,
	1220612927,
	3339683548,
	133810670,
	1090789135,
	1078426020,
	1569222167,
	845107691,
	3583754449,
	4072456591,
	1091646820,
	628848692,
	1613405280,
	3757631651,
	526609435,
	236106946,
	48312990,
	2942717905,
	3402727701,
	1797494240,
	859738849,
	992217954,
	4005476642,
	2243076622,
	3870952857,
	3732016268,
	765654824,
	3490871365,
	2511836413,
	1685915746,
	3888969200,
	1414112111,
	2273134842,
	3281911079,
	4080962846,
	172450625,
	2569994100,
	980381355,
	4109958455,
	2819808352,
	2716589560,
	2568741196,
	3681446669,
	3329971472,
	1835478071,
	660984891,
	3704678404,
	4045999559,
	3422617507,
	3040415634,
	1762651403,
	1719377915,
	3470491036,
	2693910283,
	3642056355,
	3138596744,
	1364962596,
	2073328063,
	1983633131,
	926494387,
	3423689081,
	2150032023,
	4096667949,
	1749200295,
	3328846651,
	309677260,
	2016342300,
	1779581495,
	3079819751,
	111262694,
	1274766160,
	443224088,
	298511866,
	1025883608,
	3806446537,
	1145181785,
	168956806,
	3641502830,
	3584813610,
	1689216846,
	3666258015,
	3200248200,
	1692713982,
	2646376535,
	4042768518,
	1618508792,
	1610833997,
	3523052358,
	4130873264,
	2001055236,
	3610705100,
	2202168115,
	4028541809,
	2961195399,
	1006657119,
	2006996926,
	3186142756,
	1430667929,
	3210227297,
	1314452623,
	4074634658,
	4101304120,
	2273951170,
	1399257539,
	3367210612,
	3027628629,
	1190975929,
	2062231137,
	2333990788,
	2221543033,
	2438960610,
	1181637006,
	548689776,
	2362791313,
	3372408396,
	3104550113,
	3145860560,
	296247880,
	1970579870,
	3078560182,
	3769228297,
	1714227617,
	3291629107,
	3898220290,
	166772364,
	1251581989,
	493813264,
	448347421,
	195405023,
	2709975567,
	677966185,
	3703036547,
	1463355134,
	2715995803,
	1338867538,
	1343315457,
	2802222074,
	2684532164,
	233230375,
	2599980071,
	2000651841,
	3277868038,
	1638401717,
	4028070440,
	3237316320,
	6314154,
	819756386,
	300326615,
	590932579,
	1405279636,
	3267499572,
	3150704214,
	2428286686,
	3959192993,
	3461946742,
	1862657033,
	1266418056,
	963775037,
	2089974820,
	2263052895,
	1917689273,
	448879540,
	3550394620,
	3981727096,
	150775221,
	3627908307,
	1303187396,
	508620638,
	2975983352,
	2726630617,
	1817252668,
	1876281319,
	1457606340,
	908771278,
	3720792119,
	3617206836,
	2455994898,
	1729034894,
	1080033504,
	976866871,
	3556439503,
	2881648439,
	1522871579,
	1555064734,
	1336096578,
	3548522304,
	2579274686,
	3574697629,
	3205460757,
	3593280638,
	3338716283,
	3079412587,
	564236357,
	2993598910,
	1781952180,
	1464380207,
	3163844217,
	3332601554,
	1699332808,
	1393555694,
	1183702653,
	3581086237,
	1288719814,
	691649499,
	2847557200,
	2895455976,
	3193889540,
	2717570544,
	1781354906,
	1676643554,
	2592534050,
	3230253752,
	1126444790,
	2770207658,
	2633158820,
	2210423226,
	2615765581,
	2414155088,
	3127139286,
	673620729,
	2805611233,
	1269405062,
	4015350505,
	3341807571,
	4149409754,
	1057255273,
	2012875353,
	2162469141,
	2276492801,
	2601117357,
	993977747,
	3918593370,
	2654263191,
	753973209,
	36408145,
	2530585658,
	25011837,
	3520020182,
	2088578344,
	530523599,
	2918365339,
	1524020338,
	1518925132,
	3760827505,
	3759777254,
	1202760957,
	3985898139,
	3906192525,
	674977740,
	4174734889,
	2031300136,
	2019492241,
	3983892565,
	4153806404,
	3822280332,
	352677332,
	2297720250,
	60907813,
	90501309,
	3286998549,
	1016092578,
	2535922412,
	2839152426,
	457141659,
	509813237,
	4120667899,
	652014361,
	1966332200,
	2975202805,
	55981186,
	2327461051,
	676427537,
	3255491064,
	2882294119,
	3433927263,
	1307055953,
	942726286,
	933058658,
	2468411793,
	3933900994,
	4215176142,
	1361170020,
	2001714738,
	2830558078,
	3274259782,
	1222529897,
	1679025792,
	2729314320,
	3714953764,
	1770335741,
	151462246,
	3013232138,
	1682292957,
	1483529935,
	471910574,
	1539241949,
	458788160,
	3436315007,
	1807016891,
	3718408830,
	978976581,
	1043663428,
	3165965781,
	1927990952,
	4200891579,
	2372276910,
	3208408903,
	3533431907,
	1412390302,
	2931980059,
	4132332400,
	1947078029,
	3881505623,
	4168226417,
	2941484381,
	1077988104,
	1320477388,
	886195818,
	18198404,
	3786409e3,
	2509781533,
	112762804,
	3463356488,
	1866414978,
	891333506,
	18488651,
	661792760,
	1628790961,
	3885187036,
	3141171499,
	876946877,
	2693282273,
	1372485963,
	791857591,
	2686433993,
	3759982718,
	3167212022,
	3472953795,
	2716379847,
	445679433,
	3561995674,
	3504004811,
	3574258232,
	54117162,
	3331405415,
	2381918588,
	3769707343,
	4154350007,
	1140177722,
	4074052095,
	668550556,
	3214352940,
	367459370,
	261225585,
	2610173221,
	4209349473,
	3468074219,
	3265815641,
	314222801,
	3066103646,
	3808782860,
	282218597,
	3406013506,
	3773591054,
	379116347,
	1285071038,
	846784868,
	2669647154,
	3771962079,
	3550491691,
	2305946142,
	453669953,
	1268987020,
	3317592352,
	3279303384,
	3744833421,
	2610507566,
	3859509063,
	266596637,
	3847019092,
	517658769,
	3462560207,
	3443424879,
	370717030,
	4247526661,
	2224018117,
	4143653529,
	4112773975,
	2788324899,
	2477274417,
	1456262402,
	2901442914,
	1517677493,
	1846949527,
	2295493580,
	3734397586,
	2176403920,
	1280348187,
	1908823572,
	3871786941,
	846861322,
	1172426758,
	3287448474,
	3383383037,
	1655181056,
	3139813346,
	901632758,
	1897031941,
	2986607138,
	3066810236,
	3447102507,
	1393639104,
	373351379,
	950779232,
	625454576,
	3124240540,
	4148612726,
	2007998917,
	544563296,
	2244738638,
	2330496472,
	2058025392,
	1291430526,
	424198748,
	50039436,
	29584100,
	3605783033,
	2429876329,
	2791104160,
	1057563949,
	3255363231,
	3075367218,
	3463963227,
	1469046755,
	985887462
], I = [
	1332899944,
	1700884034,
	1701343084,
	1684370003,
	1668446532,
	1869963892
];
function L(e, t, n, r) {
	var i, a = e[t], o = e[t + 1];
	return a ^= n[0], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[1], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[2], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[3], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[4], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[5], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[6], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[7], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[8], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[9], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[10], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[11], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[12], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[13], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[14], i = r[a >>> 24], i += r[256 | a >> 16 & 255], i ^= r[512 | a >> 8 & 255], i += r[768 | a & 255], o ^= i ^ n[15], i = r[o >>> 24], i += r[256 | o >> 16 & 255], i ^= r[512 | o >> 8 & 255], i += r[768 | o & 255], a ^= i ^ n[16], e[t] = o ^ n[de + 1], e[t + 1] = a, e;
}
function R(e, t) {
	for (var n = 0, r = 0; n < 4; ++n) r = r << 8 | e[t] & 255, t = (t + 1) % e.length;
	return {
		key: r,
		offp: t
	};
}
function z(e, t, n) {
	for (var r = 0, i = [0, 0], a = t.length, o = n.length, s, c = 0; c < a; c++) s = R(e, r), r = s.offp, t[c] = t[c] ^ s.key;
	for (c = 0; c < a; c += 2) i = L(i, 0, t, n), t[c] = i[0], t[c + 1] = i[1];
	for (c = 0; c < o; c += 2) i = L(i, 0, t, n), n[c] = i[0], n[c + 1] = i[1];
}
function B(e, t, n, r) {
	for (var i = 0, a = [0, 0], o = n.length, s = r.length, c, l = 0; l < o; l++) c = R(t, i), i = c.offp, n[l] = n[l] ^ c.key;
	for (i = 0, l = 0; l < o; l += 2) c = R(e, i), i = c.offp, a[0] ^= c.key, c = R(e, i), i = c.offp, a[1] ^= c.key, a = L(a, 0, n, r), n[l] = a[0], n[l + 1] = a[1];
	for (l = 0; l < s; l += 2) c = R(e, i), i = c.offp, a[0] ^= c.key, c = R(e, i), i = c.offp, a[1] ^= c.key, a = L(a, 0, n, r), r[l] = a[0], r[l + 1] = a[1];
}
function V(e, t, n, r, i) {
	var a = I.slice(), o = a.length, s;
	if (n < 4 || n > 31) if (s = Error("Illegal number of rounds (4-31): " + n), r) {
		T(r.bind(this, s));
		return;
	} else throw s;
	if (t.length !== M) if (s = Error("Illegal salt length: " + t.length + " != " + M), r) {
		T(r.bind(this, s));
		return;
	} else throw s;
	n = 1 << n >>> 0;
	var c, l, u = 0, d;
	typeof Int32Array == "function" ? (c = new Int32Array(P), l = new Int32Array(F)) : (c = P.slice(), l = F.slice()), B(t, e, c, l);
	function f() {
		if (i && i(u / n), u < n) for (var s = Date.now(); u < n && (u += 1, z(e, c, l), z(t, c, l), !(Date.now() - s > fe)););
		else {
			for (u = 0; u < 64; u++) for (d = 0; d < o >> 1; d++) L(a, d << 1, c, l);
			var p = [];
			for (u = 0; u < o; u++) p.push((a[u] >> 24 & 255) >>> 0), p.push((a[u] >> 16 & 255) >>> 0), p.push((a[u] >> 8 & 255) >>> 0), p.push((a[u] & 255) >>> 0);
			if (r) {
				r(null, p);
				return;
			} else return p;
		}
		r && T(f);
	}
	if (r !== void 0) f();
	else for (var p;;) if ((p = f()) !== void 0) return p || [];
}
function H(e, t, n, r) {
	var i;
	if (typeof e != "string" || typeof t != "string") if (i = Error("Invalid string / salt: Not a string"), n) {
		T(n.bind(this, i));
		return;
	} else throw i;
	var a, o;
	if (t.charAt(0) !== "$" || t.charAt(1) !== "2") if (i = Error("Invalid salt version: " + t.substring(0, 2)), n) {
		T(n.bind(this, i));
		return;
	} else throw i;
	if (t.charAt(2) === "$") a = "\0", o = 3;
	else {
		if (a = t.charAt(2), a !== "a" && a !== "b" && a !== "y" || t.charAt(3) !== "$") if (i = Error("Invalid salt revision: " + t.substring(2, 4)), n) {
			T(n.bind(this, i));
			return;
		} else throw i;
		o = 4;
	}
	if (t.charAt(o + 2) > "$") if (i = Error("Missing salt rounds"), n) {
		T(n.bind(this, i));
		return;
	} else throw i;
	var s = parseInt(t.substring(o, o + 1), 10) * 10 + parseInt(t.substring(o + 1, o + 2), 10), c = t.substring(o + 3, o + 25);
	e += a >= "a" ? "\0" : "";
	var l = D(e), u = j(c, M);
	function d(e) {
		var t = [];
		return t.push("$2"), a >= "a" && t.push(a), t.push("$"), s < 10 && t.push("0"), t.push(s.toString()), t.push("$"), t.push(A(u, u.length)), t.push(A(e, I.length * 4 - 1)), t.join("");
	}
	if (n === void 0) return d(V(l, u, s));
	V(l, u, s, function(e, t) {
		e ? n(e, null) : n(null, d(t));
	}, r);
}
function pe(e, t) {
	return A(e, t);
}
function me(e, t) {
	return j(e, t);
}
var U = {
	setRandomFallback: ae,
	genSaltSync: b,
	genSalt: x,
	hashSync: S,
	hash: C,
	compareSync: oe,
	compare: se,
	getRounds: ce,
	getSalt: le,
	truncates: ue,
	encodeBase64: pe,
	decodeBase64: me
}, he = a(import.meta.url), W = i.dirname(he), G = null, K = n.isPackaged, ge = K ? i.join(process.resourcesPath, "mysql-portable") : i.join(W, "..", "mysql-portable"), q = i.join(ge, "bin", "mysqld.exe"), J = i.join(n.getPath("userData"), "mysql-data"), _e = K ? i.join(process.resourcesPath, "db") : i.join(W, "..", "db"), Y = i.join(_e, "esquema_la_cuchilla_final.sql");
async function ve() {
	let e = !l.existsSync(J);
	if (!l.existsSync(q)) throw Error(`No se encontró mysqld.exe en: ${q}`);
	e && (console.log("Primera vez: inicializando base de datos..."), l.mkdirSync(J, { recursive: !0 }), s(q, [`--datadir=${J}`, "--initialize-insecure"])), console.log("Arrancando MySQL..."), G = c(q, [
		`--datadir=${J}`,
		"--port=54320",
		"--bind-address=127.0.0.1"
	]), G.stdout?.on("data", (e) => console.log(`[mysqld] ${e}`)), G.stderr?.on("data", (e) => console.log(`[mysqld] ${e}`)), G.on("error", (e) => {
		console.error("Error al arrancar MySQL:", e);
	}), await Ce(), console.log("MySQL listo."), await X(), await xe();
}
function ye(e) {
	return e.split("\n").filter((e) => !/^\s*DELIMITER\s+/i.test(e)).join("\n").replace(/\$\$/g, ";");
}
function be(e) {
	let t = e.match(/^CREATE TABLE\s+\w+/gim);
	return t ? t.length : 0;
}
async function X() {
	let e = await import("./promise-BRojEzbR.js").then((e) => /* @__PURE__ */ g(e.default, 1));
	if (!l.existsSync(Y)) throw Error(`No encontré el esquema para cargarlo: ${Y}`);
	let t = l.readFileSync(Y, "utf8"), n = be(t), r = await e.createConnection({
		host: "127.0.0.1",
		port: 54320,
		user: "root"
	});
	await r.query("CREATE DATABASE IF NOT EXISTS la_cuchilla"), await r.end();
	let i = await e.createConnection({
		host: "127.0.0.1",
		port: 54320,
		user: "root",
		database: "la_cuchilla"
	}), [a] = await i.query("SELECT COUNT(*) AS total FROM information_schema.tables\n         WHERE table_schema = 'la_cuchilla' AND table_type = 'BASE TABLE'");
	await i.end();
	let o = a[0].total;
	if (o >= n && o > 0) {
		console.log(`la_cuchilla ya tiene sus ${o} tablas, no se recarga el esquema.`);
		return;
	}
	if (o > 0) {
		console.warn(`la_cuchilla quedó a medias (${o}/${n} tablas) — probablemente una corrida anterior se interrumpió. Recreando desde cero...`);
		let t = await e.createConnection({
			host: "127.0.0.1",
			port: 54320,
			user: "root"
		});
		await t.query("DROP DATABASE la_cuchilla"), await t.query("CREATE DATABASE la_cuchilla CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"), await t.end();
	}
	console.log("Cargando esquema_la_cuchilla_final.sql...");
	let s = ye(t), c = await e.createConnection({
		host: "127.0.0.1",
		port: 54320,
		user: "root",
		database: "la_cuchilla",
		multipleStatements: !0
	});
	try {
		await c.query(s), console.log("Esquema cargado correctamente.");
	} finally {
		await c.end();
	}
}
async function xe() {
	let e = await (await import("./promise-BRojEzbR.js").then((e) => /* @__PURE__ */ g(e.default, 1))).createConnection({
		host: "127.0.0.1",
		port: 54320,
		user: "root",
		database: "la_cuchilla"
	});
	try {
		let [t] = await e.query("SELECT 1 FROM information_schema.tables\n             WHERE table_schema = 'la_cuchilla' AND table_name = 'Lote' LIMIT 1");
		if (t.length === 0) {
			console.warn("ensureLoteEnteradoColumns: la tabla Lote no existe todavía, se omite esta migración (revisa ensureSchemaLoaded).");
			return;
		}
		let [n] = await e.query("SELECT COLUMN_NAME FROM information_schema.columns\n             WHERE table_schema = 'la_cuchilla' AND table_name = 'Lote' AND COLUMN_NAME = 'enterado'");
		if (n.length > 0) return;
		console.log("Migrando tabla Lote: agregando columnas enterado/enterado_por/enterado_en..."), await e.query("ALTER TABLE Lote\n                ADD COLUMN enterado BOOLEAN DEFAULT FALSE,\n                ADD COLUMN enterado_por CHAR(36),\n                ADD COLUMN enterado_en TIMESTAMP NULL,\n                ADD CONSTRAINT fk_lote_enterado_por FOREIGN KEY (enterado_por) REFERENCES Perfil_Info(id_perfil_info) ON DELETE SET NULL"), console.log("Migración de Lote completada.");
	} finally {
		await e.end();
	}
}
function Se() {
	G &&= (G.kill(), null);
}
async function Ce(e = 30) {
	let t = await import("./promise-BRojEzbR.js").then((e) => /* @__PURE__ */ g(e.default, 1));
	for (let n = 0; n < e; n++) try {
		await (await t.createConnection({
			host: "127.0.0.1",
			port: 54320,
			user: "root"
		})).end();
		return;
	} catch {
		await new Promise((e) => setTimeout(e, 500));
	}
	throw Error("MySQL no arrancó a tiempo (timeout).");
}
//#endregion
//#region electron/main.ts
var we = a(import.meta.url), Z = i.dirname(we), Q = null, $ = null, Te = n.isPackaged ? i.join(process.resourcesPath, "assets", "logo.ico") : i.join(Z, "..", "assets", "logo.ico");
async function Ee() {
	Q = new t({
		width: 1200,
		height: 800,
		icon: Te,
		webPreferences: {
			preload: i.join(Z, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	}), n.isPackaged ? Q.loadFile(i.join(Z, "../dist/index.html")) : Q.loadURL("http://localhost:5173");
}
n.whenReady().then(async () => {
	try {
		await ve(), $ = (await import("./promise-BRojEzbR.js").then((e) => /* @__PURE__ */ g(e.default, 1))).createPool({
			host: "127.0.0.1",
			port: 54320,
			user: "root",
			database: "la_cuchilla"
		});
	} catch (e) {
		console.error("Fallo iniciando MySQL:", e);
	}
	Ee();
}), r.handle("db:query", async (e, t, n = []) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	let [r] = await $.query(t, n);
	return r;
}), r.handle("db:execute", async (e, t, n = [], r) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	let [i] = await $.query(t, n);
	return r && Q?.webContents.send("db:changed", r), i;
}), r.handle("auth:login", async (e, t) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	let n = (t.identifier ?? "").trim(), r = t.password ?? "";
	if (!n || !r) throw Error("Correo/usuario y contraseña son obligatorios.");
	let [i] = await $.query("SELECT c.password_hash, p.id_perfil_info\n         FROM Credenciales c\n         JOIN Perfil_Info p ON p.id_perfil_info = c.id_perfil_info\n         WHERE c.correo_acceso = ? OR p.usuario = ?\n         LIMIT 1", [n, n]);
	if (i.length === 0 || !await U.compare(r, i[0].password_hash)) throw Error("Correo/usuario o contraseña incorrectos.");
	let [a] = await $.query("SELECT * FROM v_usuarios WHERE id_perfil_info = ?", [i[0].id_perfil_info]);
	return a[0];
}), r.handle("users:crear", async (e, t) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	let n = await U.hash(t.password, 10), r = await $.getConnection();
	try {
		await r.query("CALL sp_crear_usuario(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @id_perfil_info)", [
			t.usuario,
			t.nombres,
			t.apellido_paterno,
			t.apellido_materno,
			t.rol,
			t.correo_acceso,
			n,
			t.correo_personal,
			t.lada,
			t.telefono,
			t.direccion
		]);
		let [[e]] = await r.query("SELECT @id_perfil_info AS id_perfil_info");
		return Q?.webContents.send("db:changed", "usuarios"), e.id_perfil_info;
	} finally {
		r.release();
	}
}), r.handle("users:asignarCredenciales", async (e, t) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	let n = await U.hash(t.password, 10);
	await $.query("CALL sp_asignar_credenciales(?, ?, ?)", [
		t.id_perfil_info,
		t.correo_acceso,
		n
	]), Q?.webContents.send("db:changed", "usuarios");
}), r.handle("users:cambiarPassword", async (e, t) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	let n = await U.hash(t.password, 10);
	await $.query("UPDATE Credenciales SET password_hash = ? WHERE id_perfil_info = ?", [n, t.id_perfil_info]), Q?.webContents.send("db:changed", "usuarios");
}), r.handle("users:revocarCredenciales", async (e, t) => {
	if (!$) throw Error("La base de datos no está lista todavía");
	await $.query("CALL sp_revocar_credenciales(?)", [t]), Q?.webContents.send("db:changed", "usuarios");
}), n.on("window-all-closed", () => {
	process.platform !== "darwin" && n.quit();
}), n.on("before-quit", () => {
	Se();
});
//#endregion
export { _ as a, v as i, te as n, re as r, ne as t };
