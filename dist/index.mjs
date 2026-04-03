import { FeatureflipClient as e, createNodePlatform as t } from "@featureflip/js";
//#region src/client.ts
var n = "https://eval.featureflip.io", r = class r {
	inner;
	constructor(r) {
		let i = t();
		this.inner = new e({
			...r,
			baseUrl: r.baseUrl ?? n
		}, i);
	}
	static async create(e) {
		let t = new r(e);
		return await t.waitForInitialization(), t;
	}
	get isInitialized() {
		return this.inner.isInitialized;
	}
	async waitForInitialization() {
		return this.inner.waitForInitialization();
	}
	boolVariation(e, t, n) {
		return this.inner.boolVariation(e, t, n);
	}
	stringVariation(e, t, n) {
		return this.inner.stringVariation(e, t, n);
	}
	numberVariation(e, t, n) {
		return this.inner.numberVariation(e, t, n);
	}
	jsonVariation(e, t, n) {
		return this.inner.jsonVariation(e, t, n);
	}
	variationDetail(e, t, n) {
		return this.inner.variationDetail(e, t, n);
	}
	track(e, t, n) {
		this.inner.track(e, t, n);
	}
	identify(e) {
		this.inner.identify(e);
	}
	async flush() {
		return this.inner.flush();
	}
	async close() {
		return this.inner.close();
	}
	static forTesting(t) {
		let n = Object.create(r.prototype);
		return n.inner = e.forTesting(t), n;
	}
};
//#endregion
export { r as FeatureflipClient };
